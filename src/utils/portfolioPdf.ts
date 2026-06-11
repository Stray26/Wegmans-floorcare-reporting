import type { PortfolioReport, ScoreStatus } from "@/types/reporting";

/**
 * Programmatic, branded portfolio compliance PDF. Built section-by-section so
 * it stays crisp and organized: header band with portfolio rollups, a
 * store-based KPI strip, top deficiencies, and a full store-performance table
 * (paginated automatically). jsPDF is loaded on demand.
 */

const BRAND: [number, number, number] = [0, 105, 56];
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
const STATUS_ORDER: Record<ScoreStatus, number> = {
  failed: 0,
  "needs-improvement": 1,
  "not-uploaded": 2,
  passed: 3,
};

function fmtScore(s: number | null): string {
  return s === null || Number.isNaN(s) ? "—" : `${s.toFixed(1)}%`;
}
function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function loadLogo(): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const res = await fetch("/wegmans-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
      img.onerror = () => resolve(4);
      img.src = dataUrl;
    });
    return { dataUrl, ratio };
  } catch {
    return null;
  }
}

export async function exportPortfolioPdf(
  portfolio: PortfolioReport,
  meta?: { dateStart?: string; dateEnd?: string; scope?: string }
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // Landscape so the wide store table fits comfortably.
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  /* ----------------------------- header ------------------------------ */
  const logo = await loadLogo();
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
  doc.text("FLOORCARE COMPLIANCE · PORTFOLIO REPORT", margin, topY + 1);
  doc.text(
    `Generated ${new Date().toLocaleString("en-US")}`,
    pageW - margin,
    margin + 2,
    { align: "right" }
  );

  /* --------------------------- title band ---------------------------- */
  const bandY = topY + 5;
  const bandH = 24;
  doc.setFillColor(...BRAND);
  doc.roundedRect(margin, bandY, contentW, bandH, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Portfolio Overview", margin + 6, bandY + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const range =
    meta?.dateStart && meta?.dateEnd
      ? `${fmtDate(meta.dateStart)} – ${fmtDate(meta.dateEnd)}`
      : "Selected date range";
  doc.text(
    `${meta?.scope ?? "Wegmans Floorcare Compliance"}   ·   ${range}   ·   ${portfolio.totalStores} stores`,
    margin + 6,
    bandY + 17
  );
  // right side: avg QSP + upload compliance
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(fmtScore(portfolio.averageQspScore), pageW - margin - 6, bandY + 11, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Avg QSP · ${fmtPct(portfolio.uploadCompliancePercentage)} upload compliance`,
    pageW - margin - 6,
    bandY + 18,
    { align: "right" }
  );

  /* ---------------------------- KPI strip ---------------------------- */
  let y = bandY + bandH + 8;
  const kpis: [string, string, [number, number, number]][] = [
    ["Stores Passed", String(portfolio.storesPassed), STATUS_COLOR.passed],
    ["Needs Improvement", String(portfolio.storesNeedsImprovement), STATUS_COLOR["needs-improvement"]],
    ["Stores Failed", String(portfolio.storesFailed), STATUS_COLOR.failed],
    ["Not Uploaded", String(portfolio.storesNotUploaded), STATUS_COLOR["not-uploaded"]],
    ["Uploaded", `${portfolio.storesUploaded} / ${portfolio.totalStores}`, INK],
    ["Average QSP", fmtScore(portfolio.averageQspScore), INK],
  ];
  const cellW = contentW / kpis.length;
  kpis.forEach(([label, value, color], i) => {
    const x = margin + i * cellW;
    // accent dot
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(x + 2.6, y - 1.4, 1.1, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 5, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(value, x + 5, y + 6);
    if (i > 0) {
      doc.setDrawColor(225, 228, 232);
      doc.setLineWidth(0.2);
      doc.line(x, y - 5, x, y + 8);
    }
  });
  y += 14;

  const headStyles = {
    fillColor: BRAND,
    textColor: [255, 255, 255] as [number, number, number],
    fontSize: 8.5,
    fontStyle: "bold" as const,
  };
  const baseStyles = { fontSize: 8, cellPadding: 1.6, textColor: INK };
  const lastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const section = (title: string) => {
    if (y > pageH - 36) {
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

  /* ----------------------- top deficiencies -------------------------- */
  const defs = portfolio.topDeficiencies.filter((d) => d.count > 0).slice(0, 10);
  if (defs.length > 0) {
    section("Top Deficiencies (portfolio-wide)");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Deficiency", "Count", "% of Deficiencies"]],
      body: defs.map((d) => [
        d.deficiencyName,
        String(d.count),
        `${d.percentage.toFixed(0)}%`,
      ]),
      headStyles,
      styles: baseStyles,
      tableWidth: contentW / 2,
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = lastY() + 8;
  }

  /* ---------------------- store performance -------------------------- */
  const stores = [...portfolio.storeReports].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return (a.qspScore ?? 101) - (b.qspScore ?? 101);
  });

  section("Store Performance");
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      ["Store", "City / State", "Last Uploaded", "QSP", "Status", "Top Deficiency", "Open Tickets"],
    ],
    body: stores.map((s) => [
      s.storeName,
      `${s.city}${s.state ? ", " + s.state : ""}`,
      fmtDate(s.lastUploadedAt),
      fmtScore(s.qspScore),
      STATUS_LABEL[s.status],
      s.topDeficiency ?? "—",
      String(s.openTicketCount),
    ]),
    headStyles,
    styles: baseStyles,
    alternateRowStyles: { fillColor: [246, 248, 250] },
    columnStyles: {
      3: { halign: "right" },
      6: { halign: "right" },
    },
    didParseCell: (d) => {
      if (d.column.index === 4) colorStatusCell(d as never);
    },
  });

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
    doc.text(
      "Wegmans Floorcare Compliance · Powered by Smart Inspect",
      margin,
      pageH - 7
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 7, {
      align: "right",
    });
  }

  doc.save(`Wegmans Floorcare - Portfolio Report.pdf`);
}
