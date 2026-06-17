/**
 * Server-side store PDF render (for email attachments). Reuses the shared
 * layout (src/utils/storePdfLayout.ts) so the emailed report is identical to
 * the browser export. jsPDF runs headless in Node; jspdf-autotable is imported
 * for its prototype side-effect (doc.autoTable). Returns the PDF as a Buffer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";
import type { StoreReport, PortfolioReport } from "../../src/types/reporting.js";
import {
  renderStoreReportDoc,
  storeReportImageUrls,
  type PdfLogo,
  type EmbeddedImage,
  type ResolveImage,
} from "../../src/utils/storePdfLayout.js";
import {
  renderPortfolioReportDoc,
  type PortfolioPdfMeta,
} from "../../src/utils/portfolioPdfLayout.js";
import { decodeImageMeta } from "../../src/utils/imageMeta.js";

/** Fetch one CDN image and decode it to a base64 EmbeddedImage (null on any failure). */
async function fetchEmbeddedImage(url: string): Promise<EmbeddedImage | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const meta = decodeImageMeta(bytes);
    if (!meta) return null;
    const mime = meta.format === "PNG" ? "image/png" : "image/jpeg";
    return {
      dataUrl: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
      format: meta.format,
      width: meta.width,
      height: meta.height,
    };
  } catch {
    return null; // network/timeout/abort — render a placeholder instead
  }
}

/** Pre-fetch every photo the store layout needs, in parallel. */
async function buildImageResolver(store: StoreReport): Promise<ResolveImage> {
  const urls = storeReportImageUrls(store);
  const entries = await Promise.all(
    urls.map(async (u) => [u, await fetchEmbeddedImage(u)] as const)
  );
  const map = new Map<string, EmbeddedImage>();
  for (const [u, img] of entries) if (img) map.set(u, img);
  return (url: string) => map.get(url) ?? null;
}

function loadLogoFromDisk(): PdfLogo | null {
  const candidates = [
    join(process.cwd(), "public", "wegmans-logo.png"),
    join(process.cwd(), "dist", "wegmans-logo.png"),
  ];
  for (const p of candidates) {
    try {
      const buf = readFileSync(p);
      // PNG IHDR: width @ bytes 16-19, height @ 20-23 (big-endian).
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      return {
        dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
        ratio: h ? w / h : 4,
      };
    } catch {
      // try next candidate; fall through to text header if none found
    }
  }
  return null;
}

/** Render the store Floorcare report to PDF bytes (embeds deficiency/note photos). */
export async function renderStorePdf(store: StoreReport): Promise<Buffer> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const logo = loadLogoFromDisk();
  const autoTable = (d: jsPDF, options: UserOptions) =>
    (d as unknown as { autoTable: (o: UserOptions) => void }).autoTable(options);
  const resolveImage = await buildImageResolver(store);
  renderStoreReportDoc(doc, autoTable, store, logo, resolveImage);
  return Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
}

/** Render the portfolio (multi-store summary) report to PDF bytes. */
export function renderPortfolioPdf(
  portfolio: PortfolioReport,
  meta?: PortfolioPdfMeta
): Buffer {
  // Landscape, matching the browser export.
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "landscape" });
  const logo = loadLogoFromDisk();
  const autoTable = (d: jsPDF, options: UserOptions) =>
    (d as unknown as { autoTable: (o: UserOptions) => void }).autoTable(options);
  renderPortfolioReportDoc(doc, autoTable, portfolio, logo, meta);
  return Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
}
