/**
 * Shared "send one subscription's report" logic, used by BOTH the daily cron
 * (api/cron/send-reports.ts) and the admin test-send endpoint
 * (api/admin/send-report.ts). Keeping it in one place means the test email is
 * byte-identical to the scheduled one.
 *
 * Store scope is pulled live per member (getMemberPermissions), Floorcare configs
 * only; an explicit stores_override wins. report_type decides the output:
 *   - "store"     → one per-store Floorcare PDF per store
 *   - "portfolio" → a single summary PDF across all the member's stores
 */
import { siPost, getMemberStoreGrants, type CompanyMember, type MemberStoreGrant } from "./smartInspect.js";
import { sendEmail } from "./email.js";
import { renderStorePdf, renderPortfolioPdf } from "./reportPdf.js";
import type { SubscriptionRow } from "./supabase.js";
import { FLOORCARE_CONFIG, isFloorcareConfig } from "@/config/wegmans";
import { DEFAULT_THRESHOLDS } from "@/config/scoreThresholds";
import { transformApiRecord } from "@/types/smartInspect";
import {
  transformStoreReport,
  buildPortfolioReport,
  type StoreMeta,
} from "@/api/reportingTransforms";
import type {
  SIRawRecord,
  SITicket,
  SIRecord,
  SIRunWidgetsResponse,
} from "@/types/smartInspect";
import type { StoreReport } from "@/types/reporting";

/** Safety cap: never attach more than this many store PDFs to a single email. */
export const MAX_STORES_PER_EMAIL = 30;

export interface SendOutcome {
  status: "sent" | "skipped" | "error";
  to: string;
  detail?: string;
}

function widgetArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.records)) return o.records as T[];
    if (Array.isArray(o.tickets)) return o.tickets as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

export function isoRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
export function windowDays(freq: SubscriptionRow["frequency"]): number {
  return freq === "daily" ? 1 : freq === "weekly" ? 7 : 30;
}

async function fetchStoreData(
  storeNames: string[],
  configName: string,
  range: { start: string; end: string }
): Promise<{ records: SIRecord[]; tickets: SITicket[] }> {
  const inspectionRange = {
    startDate: `${range.start}T00:00:00Z`,
    endDate: `${range.end}T23:59:59Z`,
    timezone: FLOORCARE_CONFIG.timezone,
  };
  const baseFilters = {
    clientId: FLOORCARE_CONFIG.clientId,
    configs: [configName],
    outerTiers: storeNames,
  };
  const inspResp = await siPost<SIRunWidgetsResponse>("/runWidgets", {
    filters: { ...baseFilters, inspectionRange },
    widgets: { "inspection.details": {}, "inspection.allRecords": {} },
  });
  let tickets: SITicket[] = [];
  try {
    const ticketResp = await siPost<SIRunWidgetsResponse>("/runWidgets", {
      filters: { ...baseFilters, isForTickets: true, ticketDates: inspectionRange },
      widgets: { "ticket.getTickets": {} },
    });
    tickets = widgetArray<SITicket>(ticketResp.widgets["ticket.getTickets"]);
  } catch {
    // tickets are best-effort; never block the report
  }
  const records = widgetArray<SIRawRecord>(inspResp.widgets["inspection.allRecords"]).map(
    transformApiRecord
  );
  return { records, tickets };
}

function buildStoreReport(
  store: { outerTierId: string; name: string },
  configName: string,
  configId: string,
  range: { start: string; end: string },
  records: SIRecord[],
  tickets: SITicket[]
): StoreReport {
  const meta: StoreMeta = {
    buildingId: store.outerTierId,
    storeName: store.name,
    configId,
    configName,
  };
  const own = records.filter((r) => r.buildingId === store.outerTierId);
  return transformStoreReport(meta, own, tickets, range, configId, configName, DEFAULT_THRESHOLDS);
}

/**
 * Resolve a subscription's stores (override or live), build the report(s) per
 * report_type, and email them. Does NOT touch last_sent_at — the caller decides
 * (the cron marks sent; the test endpoint doesn't). `overrideTo` redirects the
 * email (used by the admin test-send to deliver to the admin instead).
 */
export async function sendReportForSubscription(
  sub: SubscriptionRow,
  roster: CompanyMember[],
  opts?: { overrideTo?: string }
): Promise<SendOutcome> {
  const byId = new Map(roster.map((m) => [m.memberId, m]));
  const byEmail = new Map(roster.map((m) => [m.email.toLowerCase(), m]));
  const member =
    (sub.member_id ? byId.get(String(sub.member_id)) : undefined) ??
    byEmail.get(sub.email.toLowerCase());
  const memberId = sub.member_id ?? member?.memberId ?? null;
  const toEmail = opts?.overrideTo || member?.email || sub.email;
  const displayName = member?.displayName ?? null;

  // Store scope: explicit admin override wins; else the member's live Floorcare grants.
  const override = Array.isArray(sub.stores_override) ? sub.stores_override : [];
  let grants: MemberStoreGrant[];
  let scope: "override" | "live";
  if (override.length > 0) {
    scope = "override";
    grants = override.map((s) => ({
      configId: String(FLOORCARE_CONFIG.configId),
      configName: FLOORCARE_CONFIG.configurationName,
      outerTierId: s.outerTierId,
      storeName: s.name,
    }));
  } else if (!memberId) {
    return {
      status: "skipped",
      to: toEmail,
      detail: "no member_id and no manual store override — can't resolve permissions",
    };
  } else {
    scope = "live";
    const all = await getMemberStoreGrants(memberId);
    grants = all.filter((g) =>
      isFloorcareConfig({ configId: g.configId, configName: g.configName })
    );
  }

  if (grants.length === 0) {
    return {
      status: "skipped",
      to: toEmail,
      detail:
        scope === "live"
          ? "member has no Floorcare store permissions"
          : "manual override contained no stores",
    };
  }

  let capped = false;
  if (grants.length > MAX_STORES_PER_EMAIL) {
    grants = grants.slice(0, MAX_STORES_PER_EMAIL);
    capped = true;
  }

  const range = isoRange(windowDays(sub.frequency));

  // Group by config (outerTierIds are per-config; SI filters by store name).
  const groups = new Map<
    string,
    { configName: string; configId: string; stores: MemberStoreGrant[] }
  >();
  for (const g of grants) {
    const key = g.configName || g.configId;
    const grp = groups.get(key) ?? { configName: g.configName, configId: g.configId, stores: [] };
    grp.stores.push(g);
    groups.set(key, grp);
  }

  // Build a StoreReport for every store (used by both report types).
  const built: { report: StoreReport; storeName: string }[] = [];
  for (const grp of groups.values()) {
    const { records, tickets } = await fetchStoreData(
      grp.stores.map((s) => s.storeName),
      grp.configName,
      range
    );
    for (const s of grp.stores) {
      built.push({
        report: buildStoreReport(
          { outerTierId: s.outerTierId, name: s.storeName },
          grp.configName,
          grp.configId,
          range,
          records,
          tickets
        ),
        storeName: s.storeName,
      });
    }
  }

  const reportType = sub.report_type === "portfolio" ? "portfolio" : "store";
  let attachments: { filename: string; content: Buffer }[];
  if (reportType === "portfolio") {
    const portfolio = buildPortfolioReport(built.map((b) => b.report));
    attachments = [
      {
        filename: `Wegmans Floorcare - Portfolio Report.pdf`,
        content: renderPortfolioPdf(portfolio, {
          dateStart: range.start,
          dateEnd: range.end,
          scope: "Wegmans Floorcare Compliance",
        }),
      },
    ];
  } else {
    attachments = built.map(({ report, storeName }) => {
      const safe = storeName.replace(/[^\w\s-]/g, "").trim();
      return { filename: `${safe} - Floorcare Report.pdf`, content: renderStorePdf(report) };
    });
  }

  const storeList = grants.map((s) => s.storeName).join(", ");
  const body =
    reportType === "portfolio"
      ? `your ${sub.frequency} Wegmans Floorcare <strong>portfolio summary</strong> across ${grants.length} store(s)`
      : `your ${sub.frequency} Wegmans Floorcare compliance report for <strong>${storeList}</strong>`;
  await sendEmail({
    to: toEmail,
    subject: `Wegmans Floorcare ${sub.frequency} ${reportType === "portfolio" ? "portfolio " : ""}report — ${range.end}`,
    html: `<p>Hi${displayName ? " " + displayName : ""},</p>
<p>Attached is ${body} (covering ${range.start} to ${range.end}).</p>
<p style="color:#6e747c;font-size:12px">Wegmans Floorcare Compliance · powered by Smart Inspect</p>`,
    attachments,
  });

  return {
    status: "sent",
    to: toEmail,
    detail: `${attachments.length} attachment(s)${capped ? ` (capped at ${MAX_STORES_PER_EMAIL})` : ""} · ${reportType} · scope=${scope}`,
  };
}
