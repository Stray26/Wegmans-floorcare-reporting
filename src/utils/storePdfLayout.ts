import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import type { StoreReport, ScoreStatus, PhotoReport, NoteReport } from "@/types/reporting";
// Relative `.js` (not `@/`): this layout is reachable from the Vercel /api email
// renderer, where un-bundled ESM can't resolve `@/` at runtime.
import { formatDateET as fmtDate, formatDateTimeET as fmtDateTime } from "./datetime.js";

/**
 * Shared, environment-agnostic renderer for the store Floorcare PDF. The jsPDF
 * doc, the autoTable invoker, and the (already-loaded) logo are injected, so the
 * SAME layout powers both the browser export (src/utils/storePdf.ts, downloads)
 * and the server/email render (api/_lib/reportPdf.ts, returns bytes). Keeping
 * one layout guarantees the emailed report matches the on-screen export.
 *
 * Photos are embedded via an injected `resolveImage(url)` lookup (the bytes are
 * pre-fetched by the environment — Node fetch on the server, an image proxy in
 * the browser — so this module stays free of any fetch/CORS concerns).
 */

export type AutoTableFn = (doc: jsPDF, options: UserOptions) => void;
export interface PdfLogo {
  dataUrl: string;
  ratio: number;
}

/** A photo already decoded to base64, ready for jsPDF.addImage. */
export interface EmbeddedImage {
  /** data:image/...;base64,... */
  dataUrl: string;
  format: "JPEG" | "PNG";
  /** intrinsic px (0 when unknown → caller uses a default aspect). */
  width: number;
  height: number;
}

/** Returns the embedded bytes for a photo URL, or null to show a placeholder. */
export type ResolveImage = (url: string) => EmbeddedImage | null;

/**
 * Safety ceiling on how many photos/notes to embed (guards email size). High
 * enough to include everything for a normal store + date range; the sections
 * paginate across pages rather than truncating.
 */
export const MAX_DEFICIENCY_PHOTOS = 60;
export const MAX_NOTES = 60;

/**
 * The exact set of photo URLs the store layout will try to embed (deficiency
 * cards + notes), deduped. The render wrappers pre-fetch these into base64 so
 * the (sync) layout can stay environment-agnostic.
 */
export function storeReportImageUrls(store: StoreReport): string[] {
  const urls = new Set<string>();
  store.photos
    .filter((p) => p.deficiencyName && p.deficiencyName.toLowerCase() !== "acceptable")
    .slice(0, MAX_DEFICIENCY_PHOTOS)
    .forEach((p) => p.url && urls.add(p.url));
  store.notes.slice(0, MAX_NOTES).forEach((n) => n.photoUrl && urls.add(n.photoUrl));
  return [...urls];
}

const BRAND: [number, number, number] = [0, 105, 56]; // Wegmans green
const INK: [number, number, number] = [33, 37, 41];
const MUTED: [number, number, number] = [110, 116, 124];

const STATUS_COLOR: Record<ScoreStatus, [number, number, number]> = {
  passed: [22, 163, 74],
  "needs-improvement": [217, 119, 6],
  failed: [220, 38, 38],
  "not-uploaded": [107, 114, 128],
};
const STATUS_LABEL: Record<ScoreStatus, string> = {
  passed: "Passed",
  "needs-improvement": "Needs Improvement",
  failed: "Failed",
  "not-uploaded": "Not Uploaded",
};

function fmtScore(s: number | null): string {
  return s === null || Number.isNaN(s) ? "—" : `${s.toFixed(1)}%`;
}
const RED: [number, number, number] = [220, 38, 38];

/** Top deficiency attribute name(s) reported in a check area (for the red column). */
function deficiencyNamesForArea(area: StoreReport["checkAreas"][number]): string {
  const names = area.deficiencyBreakdown
    .filter((d) => d.count > 0)
    .slice(0, 3)
    .map((d) => d.deficiencyName);
  return names.length > 0 ? names.join(", ") : "";
}

/**
 * Draw an image fitted (contain) inside a box, centered, preserving aspect.
 * Falls back to a light "photo unavailable" placeholder when bytes are missing
 * or unreadable — a bad image never breaks the rest of the PDF.
 */
function drawFittedImage(
  doc: jsPDF,
  img: EmbeddedImage | null,
  x: number,
  y: number,
  boxW: number,
  boxH: number
): void {
  doc.setFillColor(244, 246, 248);
  doc.setDrawColor(225, 228, 232);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, "FD");
  const placeholder = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 156, 164);
    doc.text("Photo unavailable", x + boxW / 2, y + boxH / 2, {
      align: "center",
      baseline: "middle",
    });
  };
  if (!img) return placeholder();
  const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 4 / 3;
  let w = boxW - 1;
  let h = w / ratio;
  if (h > boxH - 1) {
    h = boxH - 1;
    w = h * ratio;
  }
  const ix = x + (boxW - w) / 2;
  const iy = y + (boxH - h) / 2;
  try {
    doc.addImage(img.dataUrl, img.format, ix, iy, w, h);
  } catch {
    placeholder();
  }
}

/** Render the full store report into `doc`. Does not create or save the doc. */
export function renderStoreReportDoc(
  doc: jsPDF,
  autoTable: AutoTableFn,
  store: StoreReport,
  logo: PdfLogo | null,
  resolveImage?: ResolveImage
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  /* ----------------------------- header ------------------------------ */
  let topY = margin;
  if (logo) {
    const logoW = 38;
    const logoH = logoW / logo.ratio;
    doc.addImage(logo.dataUrl, "PNG", margin, topY, logoW, logoH);
    topY += logoH + 3;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...BRAND);
    doc.text("Wegmans", margin, topY + 5);
    topY += 9;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("FLOORCARE COMPLIANCE REPORT", margin, topY + 1);
  doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, pageW - margin, margin + 2, {
    align: "right",
  });

  /* --------------------------- title band ---------------------------- */
  const bandY = topY + 5;
  const bandH = 26;
  doc.setFillColor(...BRAND);
  doc.roundedRect(margin, bandY, contentW, bandH, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(store.storeName, margin + 6, bandY + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${store.configurationName}   ·   ${fmtDate(store.dateRange.start)} – ${fmtDate(store.dateRange.end)}`,
    margin + 6,
    bandY + 17
  );
  doc.text(`${store.city}${store.state ? ", " + store.state : ""}`, margin + 6, bandY + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(fmtScore(store.qspScore), pageW - margin - 6, bandY + 12, { align: "right" });
  const chipLabel = STATUS_LABEL[store.status];
  doc.setFontSize(8.5);
  const chipW = doc.getTextWidth(chipLabel) + 8;
  const chipX = pageW - margin - 6 - chipW;
  const [cr, cg, cb] = STATUS_COLOR[store.status];
  doc.setFillColor(cr, cg, cb);
  doc.roundedRect(chipX, bandY + 15.5, chipW, 6.5, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(chipLabel, chipX + chipW / 2, bandY + 20, { align: "center" });

  /* ---------------------------- KPI strip ---------------------------- */
  let y = bandY + bandH + 8;
  const kpis: [string, string][] = [
    ["Uploaded", store.uploaded ? "Yes" : "No"],
    ["Last Upload", fmtDate(store.lastUploadedAt)],
    ["Inspections", String(store.inspectionsCompleted)],
    ["Open Tickets", String(store.openTicketCount)],
    ["Deficiencies", String(store.deficiencyCount)],
  ];
  const cellW = contentW / kpis.length;
  doc.setDrawColor(225, 228, 232);
  doc.setLineWidth(0.2);
  kpis.forEach(([label, value], i) => {
    const x = margin + i * cellW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 2, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(value, x + 2, y + 6);
    if (i > 0) doc.line(x, y - 4, x, y + 8);
  });
  y += 14;

  /* --------------------------- sections ------------------------------ */
  const headStyles = {
    fillColor: BRAND,
    textColor: [255, 255, 255] as [number, number, number],
    fontSize: 8.5,
    fontStyle: "bold" as const,
  };
  const baseStyles = { fontSize: 8.5, cellPadding: 1.8, textColor: INK };

  const section = (title: string) => {
    if (y > pageH - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND);
    doc.text(title, margin, y);
    y += 2;
  };

  const colorStatusCell = (data: {
    column: { index: number };
    section: string;
    cell: { text: string[]; styles: { textColor: number[]; fontStyle: string } };
  }) => {
    if (data.section === "body") {
      const txt = (data.cell.text?.[0] ?? "") as string;
      const match = (Object.keys(STATUS_LABEL) as ScoreStatus[]).find(
        (k) => STATUS_LABEL[k] === txt
      );
      if (match) {
        data.cell.styles.textColor = STATUS_COLOR[match];
        data.cell.styles.fontStyle = "bold";
      }
    }
  };

  const finalY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Check Areas
  const areas = [...store.checkAreas].sort((a, b) => a.qspScore - b.qspScore);
  if (areas.length > 0) {
    section("Check Areas");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Check Area", "Total", "Acceptable", "Status", "Deficiency"]],
      body: areas.map((a) => [
        a.checkAreaName,
        String(a.totalCount),
        String(a.acceptableCount),
        STATUS_LABEL[a.status],
        deficiencyNamesForArea(a) || "—",
      ]),
      headStyles,
      styles: baseStyles,
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
      },
      didParseCell: (d) => {
        if (d.column.index === 3) colorStatusCell(d as never);
        // Reported deficiency name(s) in red, in place of a count (Vince's request).
        if (d.column.index === 4 && d.section === "body") {
          const txt = (d.cell.text?.[0] ?? "") as string;
          if (txt && txt !== "—") {
            d.cell.styles.textColor = RED;
            d.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    y = finalY() + 8;
  }

  // Top Deficiencies
  const defs = store.deficiencies.filter((d) => d.count > 0).slice(0, 10);
  if (defs.length > 0) {
    section("Top Deficiencies");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Deficiency", "Count", "% of Deficiencies"]],
      body: defs.map((d) => [d.deficiencyName, String(d.count), `${d.percentage.toFixed(0)}%`]),
      headStyles,
      styles: baseStyles,
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = finalY() + 8;
  }

  // Deficiency photos — a dense, area-ordered grid. Photos are sorted so each
  // area's photos cluster (worst area first), and every card is labeled with its
  // area + the reported deficiency. A continuous 3-up grid keeps using the full
  // row width even when areas have only one photo each (no empty columns, no
  // near-blank pages), and it paginates without splitting a card.
  const isDeficiencyPhoto = (p: PhotoReport) =>
    !!p.deficiencyName && p.deficiencyName.toLowerCase() !== "acceptable";
  const areaRank = new Map<string, number>(
    [...store.checkAreas]
      .sort((a, b) => a.qspScore - b.qspScore)
      .map((a, i) => [a.checkAreaName, i] as const)
  );
  const deficiencyPhotos = store.photos
    .filter(isDeficiencyPhoto)
    .sort(
      (a, b) =>
        (areaRank.get(a.checkAreaName ?? "") ?? 999) -
        (areaRank.get(b.checkAreaName ?? "") ?? 999)
    )
    .slice(0, MAX_DEFICIENCY_PHOTOS);
  const hasDeficiencySection = deficiencyPhotos.length > 0;
  if (hasDeficiencySection) {
    doc.addPage();
    y = margin;
    section("Deficiencies by Area");
    y += 4;
    const cols = 3;
    const gap = 5;
    const cardW = (contentW - gap * (cols - 1)) / cols;
    const imgH = cardW * 0.62;
    const cardH = imgH + 17;
    for (let i = 0; i < deficiencyPhotos.length; i += cols) {
      if (y + cardH > pageH - 16) {
        doc.addPage();
        y = margin;
        section("Deficiencies by Area (cont.)");
        y += 4;
      }
      deficiencyPhotos.slice(i, i + cols).forEach((p: PhotoReport, c) => {
        const x = margin + c * (cardW + gap);
        drawFittedImage(doc, resolveImage ? resolveImage(p.url) : null, x, y, cardW, imgH);
        let ty = y + imgH + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...INK);
        doc.text(doc.splitTextToSize(p.checkAreaName ?? "—", cardW)[0] ?? "", x, ty);
        ty += 4.2;
        if (p.pointName) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...INK);
          doc.text(doc.splitTextToSize(p.pointName, cardW)[0] ?? "", x, ty);
          ty += 4.2;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...RED);
        doc.text(doc.splitTextToSize(p.deficiencyName ?? "", cardW)[0] ?? "", x, ty);
      });
      y += cardH + 6;
    }
  }

  // Inspector Notes — flow directly under the Deficiency cards, divided by a
  // separator, so a short Deficiencies page doesn't look like the report ended.
  // Only break to a fresh page when there's no Deficiencies block above or no room.
  const notes = store.notes.slice(0, MAX_NOTES);
  if (notes.length > 0) {
    const cols = 2;
    const gap = 6;
    const cardW = (contentW - gap * (cols - 1)) / cols;
    const imgH = cardW * 0.45;
    const lineH = 4;
    const wrap = (n: NoteReport): string[] => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(n.noteText || "—", cardW) as string[];
      return lines.length > 4 ? lines.slice(0, 4) : lines;
    };
    const firstRowH =
      imgH + 5 + Math.max(...notes.slice(0, cols).map((n) => wrap(n).length)) * lineH + 6;
    if (hasDeficiencySection && y + 20 + firstRowH <= pageH - 16) {
      // Divider between Deficiencies and Notes on the same page.
      y += 5;
      doc.setDrawColor(210, 214, 219);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 9;
    } else {
      doc.addPage();
      y = margin;
    }
    section("Inspector Notes");
    y += 4;
    for (let i = 0; i < notes.length; i += cols) {
      const rowNotes = notes.slice(i, i + cols);
      const rowH = imgH + 5 + Math.max(...rowNotes.map((n) => wrap(n).length)) * lineH + 6;
      if (y + rowH > pageH - 16) {
        doc.addPage();
        y = margin;
        section("Inspector Notes (cont.)");
        y += 4;
      }
      rowNotes.forEach((n: NoteReport, c) => {
        const x = margin + c * (cardW + gap);
        const img = n.photoUrl && resolveImage ? resolveImage(n.photoUrl) : null;
        drawFittedImage(doc, img, x, y, cardW, imgH);
        let ty = y + imgH + 4.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...INK);
        doc.text(n.storeName, x, ty);
        ty += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...INK);
        doc.text(wrap(n), x, ty);
      });
      y += rowH + 6;
    }
  }

  // Recent Inspections
  const history = store.history.slice(0, 8);
  if (history.length > 0) {
    section("Recent Inspections");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Inspector", "QSP", "Status", "Uploaded"]],
      body: history.map((h) => [
        fmtDate(h.date),
        h.inspector,
        fmtScore(h.qspScore),
        STATUS_LABEL[h.status],
        fmtDateTime(h.uploadedAt),
      ]),
      headStyles,
      styles: baseStyles,
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: { 2: { halign: "right" } },
      didParseCell: (d) => {
        if (d.column.index === 3) colorStatusCell(d as never);
      },
    });
    y = finalY() + 8;
  }

  // Open Tickets
  const openTickets = store.tickets.filter((t) => t.status !== "closed");
  if (openTickets.length > 0) {
    section("Open Tickets");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Ticket", "Area", "Deficiency", "Status", "Age", "Created"]],
      body: openTickets.map((t) => [
        t.ticketId,
        t.areaName,
        t.deficiency,
        t.status,
        `${t.age}d`,
        fmtDate(t.createdAt),
      ]),
      headStyles,
      styles: baseStyles,
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: { 4: { halign: "right" } },
    });
    y = finalY() + 8;
  }

  /* ----------------------------- footer ------------------------------ */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(225, 228, 232);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("Wegmans Floorcare Compliance · Powered by Smart Inspect", margin, pageH - 7);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 7, { align: "right" });
  }
}
