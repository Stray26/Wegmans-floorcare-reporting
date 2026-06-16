import type { VercelRequest, VercelResponse } from "@vercel/node";
import { siPost } from "../_lib/smartInspect.js";
import {
  getEnabledSubscriptions,
  getRecipient,
  markSubscriptionSent,
  type SubscriptionRow,
  type RecipientStore,
} from "../_lib/supabase.js";
import { sendEmail } from "../_lib/email.js";
import { renderStorePdf } from "../_lib/reportPdf.js";
import { FLOORCARE_CONFIG } from "@/config/wegmans";
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
 * Reads enabled subscriptions, sends the ones due today (daily / weekly DOW /
 * monthly DOM), scopes each by the recipient's captured Smart Inspect stores,
 * renders their store PDF(s) server-side, and emails via Resend. The company
 * SIQ-1 token fetches the data (no user session in a cron); store scoping comes
 * from report_recipients, captured at the user's login.
 */

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
  store: RecipientStore,
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

  for (const sub of due) {
    try {
      const recipient = await getRecipient({ memberId: sub.member_id, email: sub.email });
      // Admin-assigned stores win; otherwise use what was captured at login.
      const override = Array.isArray(sub.stores_override) ? sub.stores_override : null;
      const stores = (override && override.length > 0
        ? override
        : recipient?.stores ?? []) as RecipientStore[];
      if (stores.length === 0) {
        results.push({
          email: sub.email,
          status: "skipped",
          detail: "no stores — recipient hasn't logged in and no manual store assignment",
        });
        continue;
      }
      const configName = recipient?.config_name ?? FLOORCARE_CONFIG.configurationName;
      const configId = recipient?.config_id ?? String(FLOORCARE_CONFIG.configId);
      const range = isoRange(windowDays(sub.frequency));

      const { records, tickets } = await fetchStoreData(
        stores.map((s) => s.name),
        configName,
        range
      );

      const attachments = stores.map((store) => {
        const report = buildStoreReport(store, configName, configId, range, records, tickets);
        const safe = store.name.replace(/[^\w\s-]/g, "").trim();
        return { filename: `${safe} - Floorcare Report.pdf`, content: renderStorePdf(report) };
      });

      const storeList = stores.map((s) => s.name).join(", ");
      await sendEmail({
        to: sub.email,
        subject: `Wegmans Floorcare ${sub.frequency} report — ${range.end}`,
        html: `<p>Hi${recipient?.display_name ? " " + recipient.display_name : ""},</p>
<p>Attached is your ${sub.frequency} Wegmans Floorcare compliance report for <strong>${storeList}</strong> (covering ${range.start} to ${range.end}).</p>
<p style="color:#6e747c;font-size:12px">Wegmans Floorcare Compliance · powered by Smart Inspect</p>`,
        attachments,
      });
      await markSubscriptionSent(sub.id);
      results.push({ email: sub.email, status: "sent", detail: `${attachments.length} store(s)` });
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
