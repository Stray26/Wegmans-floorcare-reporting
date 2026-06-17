import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSession } from "./_lib/session.js";

/**
 * GET /api/si-image?url=<smartinspect CDN url>
 *
 * Same-origin image proxy used ONLY by the browser PDF export to embed Smart
 * Inspect inspection/note photos without tripping cross-origin (CORS) limits
 * when reading the bytes. Locked down so it can't be used as an open proxy:
 *   - requires a signed-in portal session
 *   - only https URLs on the Smart Inspect file CDN are allowed
 * The email render fetches the CDN directly in Node and never uses this route.
 */
const ALLOWED_HOST = "smartinspect-files.mysmartinspect.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!readSession(req)) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const raw = typeof req.query.url === "string" ? req.query.url : "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }
  try {
    const upstream = await fetch(url.toString());
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
      return;
    }
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "private, max-age=300");
    res.status(200).send(buf);
  } catch {
    res.status(502).json({ error: "Image fetch failed" });
  }
}
