import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSession, isAdminSession } from "../_lib/session.js";
import {
  listSubscriptions,
  upsertSubscription,
  deleteSubscription,
  listRecipients,
  type ReportFrequency,
} from "../_lib/supabase.js";

/**
 * /api/admin/subscriptions — manage scheduled-report recipients + cadence.
 * Admin-only (session email on the report-admin allowlist). All Supabase writes
 * use the service-role key server-side; the browser never touches Supabase.
 *   GET    -> { subscriptions, recipients }
 *   POST   -> upsert { id?, email, frequency, enabled?, member_id?, weekly_dow?, monthly_dom?, send_hour? }
 *   DELETE -> ?id=<uuid>
 */
const FREQS: ReportFrequency[] = ["daily", "weekly", "monthly"];

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

  try {
    if (req.method === "GET") {
      const [subscriptions, recipients] = await Promise.all([
        listSubscriptions(),
        listRecipients(),
      ]);
      res.status(200).json({ subscriptions, recipients });
      return;
    }

    if (req.method === "POST") {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const email = typeof b.email === "string" ? b.email.trim() : "";
      const frequency = b.frequency as ReportFrequency;
      if (!email || !FREQS.includes(frequency)) {
        res.status(400).json({
          error: "A valid email and frequency (daily, weekly, or monthly) are required.",
        });
        return;
      }
      const subscription = await upsertSubscription({
        id: typeof b.id === "string" ? b.id : undefined,
        email,
        member_id: typeof b.member_id === "string" ? b.member_id : null,
        frequency,
        enabled: typeof b.enabled === "boolean" ? b.enabled : true,
        weekly_dow: typeof b.weekly_dow === "number" ? b.weekly_dow : null,
        monthly_dom: typeof b.monthly_dom === "number" ? b.monthly_dom : null,
        send_hour: typeof b.send_hour === "number" ? b.send_hour : undefined,
      });
      res.status(200).json({ subscription });
      return;
    }

    if (req.method === "DELETE") {
      const fromQuery = typeof req.query.id === "string" ? req.query.id : "";
      const fromBody =
        typeof (req.body as { id?: string } | undefined)?.id === "string"
          ? (req.body as { id: string }).id
          : "";
      const id = fromQuery || fromBody;
      if (!id) {
        res.status(400).json({ error: "id is required." });
        return;
      }
      await deleteSubscription(id);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ error: e.message ?? "Request failed." });
  }
}
