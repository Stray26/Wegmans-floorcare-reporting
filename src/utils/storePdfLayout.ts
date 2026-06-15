import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import type { StoreReport, ScoreStatus } from "@/types/reporting";

/**
 * Shared, environment-agnostic renderer for the store Floorcare PDF. The jsPDF
 * doc, the autoTable invoker, and the (already-loaded) logo are injected, so the
 * SAME layout powers both the browser export (src/utils/storePdf.ts, downloads)
 * and the server/email render (api/_lib/reportPdf.ts, returns bytes). Keeping
 * one layout guarantees the emailed report matches the on-screen export.
 */

export type AutoTableFn = (doc: jsPDF, options: UserOptions) => void;
export interface PdfLogo {
  dataUrl: string;
  ratio: number;
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
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "Not uploaded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not uploaded";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Render the full store report into `doc`. Does not create or save the doc. */
export function renderStoreReportDoc(
  doc: jsPDF,
  autoTable: AutoTableFn,
  store: StoreReport,
  logo: PdfLogo | null
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
  doc.text(`Generated ${new Date().toLocaleString("en-US")}`, pageW - margin, margin + 2, {
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
  const actionItems = store.deficiencies.filter((d) => d.count > 0).length;
  const kpis: [string, string][] = [
    ["Uploaded", store.uploaded ? "Yes" : "No"],
    ["Last Upload", fmtDate(store.lastUploadedAt)],
    ["Inspections", String(store.inspectionsCompleted)],
    ["Action Items", String(actionItems)],
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
      head: [["Check Area", "Total", "Acceptable", "Deficiencies", "QSP", "Status"]],
      body: areas.map((a) => [
        a.checkAreaName,
        String(a.totalCount),
        String(a.acceptableCount),
        String(a.deficiencyCount),
        fmtScore(a.qspScore),
        STATUS_LABEL[a.status],
      ]),
      headStyles,
      styles: baseStyles,
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
      didParseCell: (d) => {
        if (d.column.index === 5) colorStatusCell(d as never);
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
