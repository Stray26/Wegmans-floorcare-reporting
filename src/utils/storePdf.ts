import type { StoreReport } from "@/types/reporting";
import {
  renderStoreReportDoc,
  storeReportImageUrls,
  type PdfLogo,
  type EmbeddedImage,
  type ResolveImage,
} from "@/utils/storePdfLayout";
import { decodeImageMeta } from "@/utils/imageMeta";

// jsPDF + autotable are loaded on demand so they don't weigh down the initial
// bundle. The actual layout lives in storePdfLayout.ts and is shared with the
// server-side email renderer (api/_lib/reportPdf.ts) for guaranteed parity.

const SI_FILE_HOST = "smartinspect-files.mysmartinspect.com";

/**
 * Route Smart Inspect CDN images through our same-origin proxy (/api/si-image)
 * so the browser can read their bytes for embedding without tripping CORS.
 * Other hosts (e.g. the Unsplash demo photos) are CORS-friendly and fetched directly.
 */
function imageFetchUrl(url: string): string {
  try {
    if (new URL(url, window.location.origin).hostname === SI_FILE_HOST) {
      return `/api/si-image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    /* not an absolute URL — fetch as-is */
  }
  return url;
}

/** Fetch + decode one image to a base64 EmbeddedImage (null on any failure). */
async function fetchEmbeddedImage(url: string): Promise<EmbeddedImage | null> {
  try {
    const res = await fetch(imageFetchUrl(url));
    if (!res.ok) return null;
    const blob = await res.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const meta = decodeImageMeta(bytes);
    if (!meta) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    let { width, height } = meta;
    if (!width || !height) {
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = dataUrl;
      });
      width = dims.w;
      height = dims.h;
    }
    return { dataUrl, format: meta.format, width, height };
  } catch {
    return null;
  }
}

/** Pre-fetch every photo the layout needs and return a sync resolver for it. */
async function buildImageResolver(store: StoreReport): Promise<ResolveImage> {
  const urls = storeReportImageUrls(store);
  const entries = await Promise.all(
    urls.map(async (u) => [u, await fetchEmbeddedImage(u)] as const)
  );
  const map = new Map<string, EmbeddedImage>();
  for (const [u, img] of entries) if (img) map.set(u, img);
  return (url: string) => map.get(url) ?? null;
}

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
  const [logo, resolveImage] = await Promise.all([loadLogo(), buildImageResolver(store)]);
  renderStoreReportDoc(doc, autoTable, store, logo, resolveImage);
  const safeName = store.storeName.replace(/[^\w\s-]/g, "").trim();
  doc.save(`${safeName} - Floorcare Report.pdf`);
}
