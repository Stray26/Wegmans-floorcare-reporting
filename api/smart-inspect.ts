import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  siPost,
  ENDPOINT_PATHS,
  outerTierNamesFrom,
  outerTierIdsFrom,
  getUserPermissions,
  reconcileOuterTiers,
  reconcileOuterTierIds,
} from "./_lib/smartInspect.js";
import { readSession, type PortalSession } from "./_lib/session.js";

/**
 * POST /api/smart-inspect — single dispatcher for all Smart Inspect calls.
 *
 * Auth model (see docs/si-internal-api.md):
 *  - Every call requires a signed-in portal session (httpOnly cookie from
 *    /api/auth/login). No session → 401. Demo mode never hits this proxy.
 *  - `getPermissions` runs AS THE USER (their SIQ-0 token + memberId), so the
 *    response is that member's stores — Smart Inspect stays the source of truth.
 *  - Data endpoints (runWidgets, tickets, …) use the company SIQ-1 token (its
 *    request shapes are the documented, production-proven ones) but the proxy
 *    first validates the requested stores against THE USER's permissions —
 *    server-side enforcement, not just hidden UI.
 */

/** The user's permitted store names, via their own SI session. */
async function userAllowedStores(session: PortalSession): Promise<Set<string>> {
  const perms = await getUserPermissions(
    session.siSessionToken,
    session.companyId,
    session.memberId
  );
  return outerTierNamesFrom(perms);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const session = readSession(req);
    if (!session) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }

    const { endpoint, ...body } = req.body ?? {};
    const path = ENDPOINT_PATHS[endpoint as string];
    if (!path) {
      res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
      return;
    }

    // Permissions: per-user, straight from the member's own SI session.
    if (endpoint === "getPermissions") {
      const data = await getUserPermissions(
        session.siSessionToken,
        session.companyId,
        session.memberId
      );
      res.status(200).json(data);
      return;
    }

    // runWidgets: validate/inject the USER's permitted stores. Smart Inspect
    // honors `outerTierIds` (it ignores the name arrays), so when the client
    // sends IDs we validate THOSE; otherwise fall back to the legacy name gate.
    if (endpoint === "runWidgets") {
      const perms = await getUserPermissions(
        session.siSessionToken,
        session.companyId,
        session.memberId
      );
      const filters = (body.filters ?? {}) as {
        outerTiers?: string[];
        outerTierIds?: Array<string | number>;
        [k: string]: unknown;
      };
      if (Array.isArray(filters.outerTierIds) && filters.outerTierIds.length > 0) {
        filters.outerTierIds = reconcileOuterTierIds(
          outerTierIdsFrom(perms),
          filters.outerTierIds
        );
      } else {
        filters.outerTiers = reconcileOuterTiers(
          outerTierNamesFrom(perms),
          filters.outerTiers
        );
      }
      const data = await siPost(path, { ...body, filters });
      res.status(200).json(data);
      return;
    }

    // createTicket: capability + store both checked against the user.
    if (endpoint === "createTicket") {
      if (session.permissionLevels?.canTicket === false) {
        res.status(403).json({ error: "Your account is not allowed to create tickets." });
        return;
      }
      const allowed = await userAllowedStores(session);
      const building = (body.ticket ?? {}).building as string | undefined;
      reconcileOuterTiers(allowed, building ? [building] : []);
      const data = await siPost(path, body);
      res.status(200).json(data);
      return;
    }

    // getconfig, configurations, listTags, getTicket: authenticated pass-through.
    const data = await siPost(path, body);
    res.status(200).json(data);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
}
