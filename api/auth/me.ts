import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSession, publicIdentity } from "../_lib/session.js";

/** GET /api/auth/me — current identity from the session cookie, or 401. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.status(200).json({ user: publicIdentity(session) });
}
