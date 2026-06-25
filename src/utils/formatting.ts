/** Display formatting helpers. */
import { formatDateET, formatDateTimeET } from "@/utils/datetime";

export function formatScore(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "—";
  return `${score.toFixed(1)}%`;
}

/** Eastern-time date, e.g. "Jun 22, 2026". See src/utils/datetime.ts. */
export function formatDate(iso: string | null): string {
  return formatDateET(iso);
}

/** Eastern-time date + time with zone, e.g. "Jun 22, 2026, 7:30 AM EDT". */
export function formatDateTime(iso: string | null): string {
  return formatDateTimeET(iso);
}

export function formatRelativeDays(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** "115 - Tysons Corner" -> "115" */
export function storeNumberFromName(name: string): string {
  const m = name.match(/^(\d+)/);
  return m ? m[1] : "";
}
