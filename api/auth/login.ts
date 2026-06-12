import type { VercelRequest, VercelResponse } from "@vercel/node";
import { siPostWith, COMPANY_ID } from "../_lib/smartInspect.js";
import { sealSession, setSessionCookie, publicIdentity } from "../_lib/session.js";

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
}
