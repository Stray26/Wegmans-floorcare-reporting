import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCompanyMembers, type CompanyMember } from "../_lib/smartInspect.js";
import {
  getEnabledSubscriptions,
  markSubscriptionSent,
  type SubscriptionRow,
} from "../_lib/supabase.js";
import { sendReportForSubscription } from "../_lib/sendReport.js";
import { etDayOfWeek, etDayOfMonth, isSameEasternDate } from "../../src/utils/datetime.js";

/**
 * GET /api/cron/send-reports — daily Vercel Cron (see vercel.json).
 *
 * Sends the subscriptions due today (daily / weekly DOW / monthly DOM). Per-
 * subscription scope + render + email lives in api/_lib/sendReport.ts (shared
 * with the admin test-send). Store scope is pulled live per member via the SI
 * admin service account; report_type decides store vs portfolio output.
 */

/**
 * Stateless cadence check, run by the once-a-day cron. Evaluated on the Eastern
 * calendar (see src/utils/datetime.ts) so the day-of-week / day-of-month and the
 * same-day duplicate guard track the Eastern business day, not UTC.
 */
function isDue(sub: SubscriptionRow, now: Date): boolean {
  if (sub.last_sent_at && isSameEasternDate(new Date(sub.last_sent_at), now)) return false;
  if (sub.frequency === "daily") return true;
  if (sub.frequency === "weekly") return etDayOfWeek(now) === (sub.weekly_dow ?? 1);
  if (sub.frequency === "monthly") return etDayOfMonth(now) === (sub.monthly_dom ?? 1);
  return false;
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

  // Live member roster (admin session) → authoritative email/display + member_id.
  // Best-effort; sendReportForSubscription surfaces resolution errors per row.
  let roster: CompanyMember[] = [];
  try {
    roster = await listCompanyMembers();
  } catch (err) {
    console.warn("listCompanyMembers failed:", (err as Error)?.message);
  }

  for (const sub of due) {
    try {
      const outcome = await sendReportForSubscription(sub, roster);
      if (outcome.status === "sent") await markSubscriptionSent(sub.id);
      results.push({ email: outcome.to, status: outcome.status, detail: outcome.detail });
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
