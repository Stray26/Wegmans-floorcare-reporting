import type { PortfolioReport } from "@/types/reporting";
import {
  renderPortfolioReportDoc,
  type PortfolioPdfMeta,
} from "@/utils/portfolioPdfLayout";
import type { PdfLogo } from "@/utils/storePdfLayout";

/**
 * Browser portfolio PDF export. Loads jsPDF on demand and the logo over HTTP,
 * then defers to the shared layout (src/utils/portfolioPdfLayout.ts) so the
 * downloaded report is identical to the emailed one.
 */

async function loadLogo(): Promise<PdfLogo | null> {
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
      img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
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
  meta?: PortfolioPdfMeta
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // Landscape so the wide store table fits comfortably.
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "landscape" });
  const logo = await loadLogo();
  renderPortfolioReportDoc(doc, (d, o) => autoTable(d, o), portfolio, logo, meta);
  doc.save(`Wegmans Floorcare - Portfolio Report.pdf`);
}
