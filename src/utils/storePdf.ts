import type { StoreReport } from "@/types/reporting";
import { renderStoreReportDoc, type PdfLogo } from "@/utils/storePdfLayout";

// jsPDF + autotable are loaded on demand so they don't weigh down the initial
// bundle. The actual layout lives in storePdfLayout.ts and is shared with the
// server-side email renderer (api/_lib/reportPdf.ts) for guaranteed parity.

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

/** Branded store Floorcare PDF, downloaded in the browser. */
export async function exportStorePdf(store: StoreReport): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const logo = await loadLogo();
  renderStoreReportDoc(doc, autoTable, store, logo);
  const safeName = store.storeName.replace(/[^\w\s-]/g, "").trim();
  doc.save(`${safeName} - Floorcare Report.pdf`);
}
