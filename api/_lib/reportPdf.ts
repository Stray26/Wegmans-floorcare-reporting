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
import type { StoreReport } from "@/types/reporting";
import { renderStoreReportDoc, type PdfLogo } from "@/utils/storePdfLayout";

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

/** Render the store Floorcare report to PDF bytes. */
export function renderStorePdf(store: StoreReport): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const logo = loadLogoFromDisk();
  const autoTable = (d: jsPDF, options: UserOptions) =>
    (d as unknown as { autoTable: (o: UserOptions) => void }).autoTable(options);
  renderStoreReportDoc(doc, autoTable, store, logo);
  return Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
}
