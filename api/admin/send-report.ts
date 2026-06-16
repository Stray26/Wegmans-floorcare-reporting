import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSession, isAdminSession } from "../_lib/session.js";
import { listCompanyMembers } from "../_lib/smartInspect.js";
import { getSubscriptionById } from "../_lib/supabase.js";
import { sendReportForSubscription } from "../_lib/sendReport.js";

/**
 * POST /api/admin/send-report  { id }
 *
 * Admin-only test send: renders a subscription's report right now and emails it
 * to the SIGNED-IN ADMIN (not the real recipient), so you can preview/verify the
 * pipeline without spamming managers. Does NOT update last_sent_at, so it won't
 * interfere with the scheduled send. Reuses the exact cron send path.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  if (!isAdminSession(session)) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const id = typeof (req.body as { id?: string } | undefined)?.id === "string"
    ? (req.body as { id: string }).id
    : "";
  if (!id) {
    res.status(400).json({ error: "Subscription id is required." });
    return;
  }

  try {
    const sub = await getSubscriptionById(id);
    if (!sub) {
      res.status(404).json({ error: "Subscription not found." });
      return;
    }
    const roster = await listCompanyMembers().catch(() => []);
    // Deliver the test to the admin running it, not the real recipient.
    const outcome = await sendReportForSubscription(sub, roster, { overrideTo: session.email });
    res.status(200).json({ ...outcome, sentTo: session.email });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ error: e.message ?? "Test send failed." });
  }
}
