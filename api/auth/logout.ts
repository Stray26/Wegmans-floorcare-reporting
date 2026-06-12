import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearSessionCookie } from "../_lib/session.js";

/** POST /api/auth/logout — clears the portal session cookie. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}
