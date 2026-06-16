import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSession, isAdminSession } from "../_lib/session.js";
import {
  listCompanyMembers,
  getMemberStoreGrants,
  type MemberStoreGrant,
} from "../_lib/smartInspect.js";
import { isFloorcareConfig } from "@/config/wegmans";

/**
 * GET /api/admin/members — the live Smart Inspect member roster plus each
 * member's Floorcare store permissions. Admin-only, read-only.
 *
 * Heavier than /api/admin/subscriptions (one getMemberPermissions per member),
 * so it's a SEPARATE endpoint with its own loading state — it never blocks the
 * subscriptions list or the recipient picker. Resolved via the SI admin service
 * account (SI_ADMIN_USERNAME / SI_ADMIN_PASSWORD); if those aren't set the call
 * fails and the caller shows a "configure the admin account" message.
 *
 *   GET -> { members: [{ memberId, email, displayName, roleId, canGetReports, stores: [...] }] }
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
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const roster = await listCompanyMembers();
    // Per-member store grants, in parallel (reuses the cached admin session).
    const members = await Promise.all(
      roster.map(async (m) => {
        let stores: MemberStoreGrant[] = [];
        try {
          const grants = await getMemberStoreGrants(m.memberId);
          stores = grants.filter((g) =>
            isFloorcareConfig({ configId: g.configId, configName: g.configName })
          );
        } catch {
          // one member's lookup failing shouldn't drop the whole roster
        }
        return { ...m, stores };
      })
    );
    res.status(200).json({ members });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    // Most likely SI_ADMIN_USERNAME/PASSWORD unset, or the admin login failed.
    res.status(e.statusCode ?? 500).json({ error: e.message ?? "Couldn't load members." });
  }
}
