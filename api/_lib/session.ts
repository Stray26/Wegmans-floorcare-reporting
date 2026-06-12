/**
 * Server-side session cookie helpers. Runs ONLY in Vercel functions.
 *
 * The Smart Inspect SIQ-0 session token must never reach the browser, so we
 * seal the whole session payload with AES-256-GCM (authenticated encryption —
 * tamper-proof AND unreadable) into an httpOnly cookie. Key derives from the
 * SESSION_SECRET env var. No npm deps; Node crypto only.
 */
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const SESSION_COOKIE = "wgm_session";
/** SI sessions outlive this, but cap our cookie at 12h to bound exposure. */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface PortalSession {
  /** Smart Inspect SIQ-0 session token — SECRET, never sent to the browser. */
  siSessionToken: string;
  memberId: number;
  companyId: number;
  /** Smart Inspect role for this company, e.g. "Operator" | "Supervisor" | "Account". */
  roleId: string;
  displayName: string;
  email: string;
  permissionLevels: Record<string, unknown>;
  /** Unix seconds — our own expiry, checked on every read. */
  exp: number;
}

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw Object.assign(new Error("SESSION_SECRET is not configured (set it in Vercel env)."), {
      statusCode: 500,
    });
  }
  // Derive a stable 32-byte key from whatever string is provided.
  return createHash("sha256").update(secret).digest();
}

export function sealSession(payload: Omit<PortalSession, "exp">): string {
  const session: PortalSession = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function openSession(sealed: string): PortalSession | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const session = JSON.parse(json) as PortalSession;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null; // wrong key, tampered, or malformed — treat as logged out
  }
}

/* ----------------------------- cookie I/O ------------------------------ */

export function readSession(req: VercelRequest): PortalSession | null {
  const header = req.headers.cookie ?? "";
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return openSession(match.slice(SESSION_COOKIE.length + 1));
}

export function setSessionCookie(res: VercelResponse, sealed: string): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sealed}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

/** The shape we expose to the browser — NO token. */
export function publicIdentity(s: PortalSession) {
  return {
    memberId: s.memberId,
    companyId: s.companyId,
    roleId: s.roleId,
    displayName: s.displayName,
    email: s.email,
    permissionLevels: s.permissionLevels,
  };
}
