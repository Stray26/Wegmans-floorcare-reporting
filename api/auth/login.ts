import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  siPostWith,
  COMPANY_ID,
  getUserPermissions,
  permittedStoresFrom,
  firstConfigFrom,
} from "../_lib/smartInspect.js";
import { sealSession, setSessionCookie, publicIdentity } from "../_lib/session.js";
import { upsertRecipient } from "../_lib/supabase.js";

/**
 * POST /api/auth/login — { username, password }
 *
 * Verifies credentials against Smart Inspect's own login (startSession), so SI
 * remains the source of truth for identity. We never store passwords; the
 * resulting SIQ-0 session token is sealed into an httpOnly cookie and never
 * reaches the browser.
 */

interface SICompanyMembership {
  companyId: number;
  roleId: string;
  permissionLevels?: Record<string, unknown>;
}
interface SIStartSessionResponse {
  success?: boolean;
  sessionToken?: string;
  member?: { id: number; displayName?: string; email?: string };
  companies?: SICompanyMembership[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  let si: SIStartSessionResponse;
  try {
    si = await siPostWith<SIStartSessionResponse>("SIQ-0 null", "/startSession", {
      username,
      memberPassword: password,
    });
  } catch {
    // Wrong credentials and upstream failures both land here; keep the message
    // generic (don't leak which one it was).
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  if (!si?.sessionToken || !si.member?.id) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  const membership = (si.companies ?? []).find((c) => c.companyId === COMPANY_ID);
  if (!membership) {
    res.status(403).json({
      error: "Your Smart Inspect account does not have access to this portal.",
    });
    return;
  }

  // Best-effort: capture this user's permitted stores so the scheduled report
  // job can scope their email without a live session. Never blocks sign-in —
  // if SI permissions or Supabase are unavailable, we just skip it.
  try {
    const perms = await getUserPermissions(si.sessionToken, COMPANY_ID, si.member.id);
    const cfg = firstConfigFrom(perms);
    await upsertRecipient({
      member_id: String(si.member.id),
      email: si.member.email ?? username,
      display_name: si.member.displayName ?? username,
      company_id: COMPANY_ID,
      config_id: cfg?.configId ?? null,
      config_name: cfg?.configName ?? null,
      stores: permittedStoresFrom(perms),
      permission_levels: membership.permissionLevels ?? null,
    });
  } catch (err) {
    console.warn("Recipient capture failed (non-fatal):", (err as Error)?.message);
  }

  // Sealing/cookie can throw (e.g. missing SESSION_SECRET) — return a clean 500
  // rather than crashing the function process.
  try {
    const sealed = sealSession({
      siSessionToken: si.sessionToken,
      memberId: si.member.id,
      companyId: COMPANY_ID,
      roleId: membership.roleId,
      displayName: si.member.displayName ?? username,
      email: si.member.email ?? username,
      permissionLevels: membership.permissionLevels ?? {},
    });
    setSessionCookie(res, sealed);
    res.status(200).json({
      user: publicIdentity({
        siSessionToken: "",
        memberId: si.member.id,
        companyId: COMPANY_ID,
        roleId: membership.roleId,
        displayName: si.member.displayName ?? username,
        email: si.member.email ?? username,
        permissionLevels: membership.permissionLevels ?? {},
        exp: 0,
      }),
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ error: e.message ?? "Sign-in failed." });
  }
}
