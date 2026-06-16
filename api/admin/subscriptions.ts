import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSession, isAdminSession } from "../_lib/session.js";
import { siPost, permittedStoresFrom, listCompanyMembers } from "../_lib/smartInspect.js";
import {
  listSubscriptions,
  upsertSubscription,
  deleteSubscription,
  listRecipients,
  type ReportFrequency,
  type RecipientStore,
} from "../_lib/supabase.js";

/**
 * /api/admin/subscriptions — manage scheduled-report recipients + cadence.
 * Admin-only (session email on the report-admin allowlist). All Supabase writes
 * use the service-role key server-side; the browser never touches Supabase.
 *   GET    -> { subscriptions, members, recipients, availableStores }
 *   POST   -> upsert { id?, email, frequency, enabled?, member_id?, weekly_dow?, monthly_dom?, send_hour? }
 *   DELETE -> ?id=<uuid>
 *
 * `members` is the live Smart Inspect roster (admin session) — the picker keys
 * subscriptions to a member_id, and the cron pulls that member's live store
 * permissions at send time. `recipients` (login-captured) is retained for
 * backward-compat display only.
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
      // Live SI member roster — the recipient picker. Best-effort: if the admin
      // service account isn't configured/reachable, fall back to captured
      // recipients so the page still works.
      let members: Awaited<ReturnType<typeof listCompanyMembers>> = [];
      try {
        members = await listCompanyMembers();
      } catch {
        // admin session unavailable — picker falls back to captured recipients
      }
      // Stores the admin can assign as a manual override.
      let availableStores: RecipientStore[] = [];
      try {
        const perms = await siPost("/getPermissions", { permissionType: "Access" });
        availableStores = permittedStoresFrom(
          perms as Parameters<typeof permittedStoresFrom>[0]
        );
      } catch {
        // SI token unset/unreachable — picker simply shows no options
      }
      res.status(200).json({ subscriptions, members, recipients, availableStores });
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
        stores_override: Array.isArray(b.stores_override)
          ? (b.stores_override as Array<{ outerTierId?: unknown; name?: unknown }>)
              .map((s) => ({
                outerTierId: String(s.outerTierId ?? ""),
                name: String(s.name ?? ""),
              }))
              .filter((s) => s.outerTierId)
          : undefined,
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
