/**
 * Eastern-time date/time helpers — the single source of truth for the portal's
 * "report times and dates are Eastern" rule.
 *
 * Uses the IANA zone America/New_York, so it tracks EST (UTC-5, winter) and EDT
 * (UTC-4, summer) automatically. "EST" in product-speak means the store-local
 * Eastern wall clock, which is exactly what this provides.
 *
 * DEPLOYMENT NOTE: this module is reachable from Vercel /api functions (via the
 * PDF layouts + sendReport/cron), so it must contain NO value `@/` imports —
 * Vercel runs functions as un-bundled ESM and an `@/` specifier would throw
 * ERR_MODULE_NOT_FOUND at runtime. It has none (pure Intl/Date). Files reachable
 * from /api import it with a relative `.js` specifier; browser-only files may use
 * `@/utils/datetime`.
 */

/** The zone every report time/date is rendered and bucketed in. */
export const REPORT_TZ = "America/New_York";

const pad = (n: number) => String(n).padStart(2, "0");

/** {year, month, day} of an instant as seen on the Eastern wall clock. */
function easternParts(d: Date): { year: number; month: number; day: number } {
  // en-CA formats an ISO-like "YYYY-MM-DD" for the given zone, so a simple
  // split gives the Eastern calendar date without manual offset math.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

/** Current Eastern calendar date as "YYYY-MM-DD". */
export function etTodayISO(now: Date = new Date()): string {
  const { year, month, day } = easternParts(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Eastern calendar date `offset` days before `now`, as "YYYY-MM-DD"
 * (offset 0 = today, 1 = yesterday). Anchored at UTC-midnight of the current
 * Eastern date and shifted by whole days, so a DST transition can never push the
 * result onto the wrong calendar day.
 */
export function etDayISO(offset: number, now: Date = new Date()): string {
  const { year, month, day } = easternParts(now);
  const shifted = new Date(Date.UTC(year, month - 1, day) - offset * 86_400_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Day of week (0=Sun … 6=Sat) of an instant on the Eastern calendar. */
export function etDayOfWeek(d: Date = new Date()): number {
  const { year, month, day } = easternParts(d);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Day of month (1 … 31) of an instant on the Eastern calendar. */
export function etDayOfMonth(d: Date = new Date()): number {
  return easternParts(d).day;
}

/** True if two instants fall on the same Eastern calendar date. */
export function isSameEasternDate(a: Date, b: Date): boolean {
  return etTodayISO(a) === etTodayISO(b);
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Format a date for display, e.g. "Jun 22, 2026".
 * A date-only string ("YYYY-MM-DD") is shown as that calendar date verbatim
 * (it carries no time, so it must NOT be shifted into Eastern — otherwise a
 * UTC-midnight parse renders the previous day for an Eastern viewer). A full
 * timestamp is converted to Eastern.
 */
export function formatDateET(iso: string | null): string {
  if (!iso) return "—";
  if (isDateOnly(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      ...DATE_OPTS,
      timeZone: "UTC",
    });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { ...DATE_OPTS, timeZone: REPORT_TZ });
}

/**
 * Format a timestamp as an Eastern date + time with a zone label, e.g.
 * "Jun 22, 2026, 7:30 AM EDT". Used for upload / generated times.
 */
export function formatDateTimeET(
  iso: string | null,
  emptyLabel = "Not uploaded",
): string {
  if (!iso) return emptyLabel;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return emptyLabel;
  return d.toLocaleString("en-US", {
    ...DATE_OPTS,
    hour: "numeric",
    minute: "2-digit",
    timeZone: REPORT_TZ,
    timeZoneName: "short",
  });
}
