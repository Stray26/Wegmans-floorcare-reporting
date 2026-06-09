import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  siPost,
  ENDPOINT_PATHS,
  getAllowedOuterTierNames,
  reconcileOuterTiers,
} from "./_lib/smartInspect.js";

/**
 * POST /api/smart-inspect — single dispatcher for all Smart Inspect calls,
 * mirroring the documented edge function. Routes by the `endpoint` field, adds
 * SIQ-1 auth server-side, and enforces store-level permissions BEFORE
 * forwarding (server-side enforcement, not just hidden UI).
 *
 * Body: { endpoint: "runWidgets" | "getPermissions" | "getconfig" |
 *         "configurations" | "listTags" | "createTicket" | "getTicket", ... }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { endpoint, ...body } = req.body ?? {};
    const path = ENDPOINT_PATHS[endpoint as string];
    if (!path) {
      res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
      return;
    }

    // runWidgets: validate/inject the permitted outer tiers in the filters.
    if (endpoint === "runWidgets") {
      const allowed = await getAllowedOuterTierNames();
      const filters = (body.filters ?? {}) as {
        outerTiers?: string[];
        [k: string]: unknown;
      };
      filters.outerTiers = reconcileOuterTiers(allowed, filters.outerTiers);
      const data = await siPost(path, { ...body, filters });
      res.status(200).json(data);
      return;
    }

    // createTicket: ensure the target store is permitted.
    if (endpoint === "createTicket") {
      const allowed = await getAllowedOuterTierNames();
      const building = (body.ticket ?? {}).building as string | undefined;
      reconcileOuterTiers(allowed, building ? [building] : []);
      const data = await siPost(path, body);
      res.status(200).json(data);
      return;
    }

    // getPermissions, getconfig, configurations, listTags, getTicket: pass through.
    const data = await siPost(path, body);
    res.status(200).json(data);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
}
