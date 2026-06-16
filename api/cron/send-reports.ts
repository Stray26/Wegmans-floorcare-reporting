import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  siPost,
  listCompanyMembers,
  getMemberStoreGrants,
  type CompanyMember,
  type MemberStoreGrant,
} from "../_lib/smartInspect.js";
import {
  getEnabledSubscriptions,
  markSubscriptionSent,
  type SubscriptionRow,
} from "../_lib/supabase.js";
import { sendEmail } from "../_lib/email.js";
import { renderStorePdf } from "../_lib/reportPdf.js";
import { FLOORCARE_CONFIG, isFloorcareConfig } from "@/config/wegmans";
import { DEFAULT_THRESHOLDS } from "@/config/scoreThresholds";
import { transformApiRecord } from "@/types/smartInspect";
import { transformStoreReport, type StoreMeta } from "@/api/reportingTransforms";
import type {
  SIRawRecord,
  SITicket,
  SIRecord,
  SIRunWidgetsResponse,
} from "@/types/smartInspect";
import type { StoreReport } from "@/types/reporting";

/**
 * GET /api/cron/send-reports — daily Vercel Cron (see vercel.json).
 *
 * Reads enabled subscriptions and sends the ones due today (daily / weekly DOW /
 * monthly DOM). Store scope is pulled LIVE per member: the cron logs in as the
 * SI admin service account and calls listMembers + getMemberPermissions to get
 * each subscriber's current Floorcare store grants (no login-capture needed,
 * never stale). The company SIQ-1 token still fetches the inspection data.
 *
 * Precedence for store scope:
 *   1. explicit admin override (subscription.stores_override) — wins if set
 *   2. the member's live Smart Inspect permissions (Floorcare configs only)
 */

/** Safety cap: never attach more than this many store PDFs to a single email. */
const MAX_STORES_PER_EMAIL = 30;

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

function isoRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
function windowDays(freq: SubscriptionRow["frequency"]): number {
  return freq === "daily" ? 1 : freq === "weekly" ? 7 : 30;
}
function sameUTCDate(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
/** Stateless cadence check, run by the once-a-day cron. */
function isDue(sub: SubscriptionRow, now: Date): boolean {
  if (sub.last_sent_at && sameUTCDate(new Date(sub.last_sent_at), now)) return false;
  if (sub.frequency === "daily") return true;
  if (sub.frequency === "weekly") return now.getUTCDay() === (sub.weekly_dow ?? 1);
  if (sub.frequency === "monthly") return now.getUTCDate() === (sub.monthly_dom ?? 1);
  return false;
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
  const records = widgetArray<SIRawRecord>(
    inspResp.widgets["inspection.allRecords"]
  ).map(transformApiRecord);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Fail closed: Vercel sends `Authorization: Bearer <CRON_SECRET>` for cron
  // invocations when CRON_SECRET is set. Without it, refuse to run so the
  // email endpoint can't be triggered publicly.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured." });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const now = new Date();
  const subs = await getEnabledSubscriptions();
  const due = subs.filter((s) => isDue(s, now));
  const results: { email: string; status: string; detail?: string }[] = [];

  // Live member roster (admin session) → authoritative email/display name and
  // member_id lookup. Best-effort: if it fails we fall back to the
  // subscription's own email; live scope resolution below will surface errors.
  let roster: CompanyMember[] = [];
  try {
    roster = await listCompanyMembers();
  } catch (err) {
    console.warn("listCompanyMembers failed:", (err as Error)?.message);
  }
  const byId = new Map(roster.map((m) => [m.memberId, m]));
  const byEmail = new Map(roster.map((m) => [m.email.toLowerCase(), m]));

  for (const sub of due) {
    try {
      const member =
        (sub.member_id ? byId.get(String(sub.member_id)) : undefined) ??
        byEmail.get(sub.email.toLowerCase());
      const memberId = sub.member_id ?? member?.memberId ?? null;
      const toEmail = member?.email || sub.email;
      const displayName = member?.displayName ?? null;

      // Store scope: explicit admin override wins; otherwise pull the member's
      // LIVE Floorcare permissions via getMemberPermissions.
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
        results.push({
          email: sub.email,
          status: "skipped",
          detail: "no member_id and no manual store override — can't resolve permissions",
        });
        continue;
      } else {
        scope = "live";
        const all = await getMemberStoreGrants(memberId);
        grants = all.filter((g) =>
          isFloorcareConfig({ configId: g.configId, configName: g.configName })
        );
      }

      if (grants.length === 0) {
        results.push({
          email: toEmail,
          status: "skipped",
          detail:
            scope === "live"
              ? "member has no Floorcare store permissions"
              : "manual override contained no stores",
        });
        continue;
      }

      let capped = false;
      if (grants.length > MAX_STORES_PER_EMAIL) {
        grants = grants.slice(0, MAX_STORES_PER_EMAIL);
        capped = true;
      }

      const range = isoRange(windowDays(sub.frequency));

      // Group by config — outerTierIds are per-config, and runWidgets filters by
      // config + store NAME, so we fetch each config the member is granted once.
      const groups = new Map<
        string,
        { configName: string; configId: string; stores: MemberStoreGrant[] }
      >();
      for (const g of grants) {
        const key = g.configName || g.configId;
        const grp = groups.get(key) ?? {
          configName: g.configName,
          configId: g.configId,
          stores: [],
        };
        grp.stores.push(g);
        groups.set(key, grp);
      }

      const attachments: { filename: string; content: Buffer }[] = [];
      for (const grp of groups.values()) {
        const { records, tickets } = await fetchStoreData(
          grp.stores.map((s) => s.storeName),
          grp.configName,
          range
        );
        for (const s of grp.stores) {
          const report = buildStoreReport(
            { outerTierId: s.outerTierId, name: s.storeName },
            grp.configName,
            grp.configId,
            range,
            records,
            tickets
          );
          const safe = s.storeName.replace(/[^\w\s-]/g, "").trim();
          attachments.push({
            filename: `${safe} - Floorcare Report.pdf`,
            content: renderStorePdf(report),
          });
        }
      }

      const storeList = grants.map((s) => s.storeName).join(", ");
      await sendEmail({
        to: toEmail,
        subject: `Wegmans Floorcare ${sub.frequency} report — ${range.end}`,
        html: `<p>Hi${displayName ? " " + displayName : ""},</p>
<p>Attached is your ${sub.frequency} Wegmans Floorcare compliance report for <strong>${storeList}</strong> (covering ${range.start} to ${range.end}).</p>
<p style="color:#6e747c;font-size:12px">Wegmans Floorcare Compliance · powered by Smart Inspect</p>`,
        attachments,
      });
      await markSubscriptionSent(sub.id);
      results.push({
        email: toEmail,
        status: "sent",
        detail: `${attachments.length} store(s)${capped ? ` (capped at ${MAX_STORES_PER_EMAIL})` : ""} · scope=${scope}`,
      });
    } catch (err) {
      results.push({ email: sub.email, status: "error", detail: (err as Error)?.message });
    }
  }

  res.status(200).json({
    ran: now.toISOString(),
    considered: subs.length,
    due: due.length,
    results,
  });
}
