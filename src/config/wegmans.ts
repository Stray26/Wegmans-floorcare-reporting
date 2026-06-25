/**
 * Wegmans Floorcare Pilot configuration constants.
 * Centralized so Wegmans-specific values aren't scattered through the UI.
 * When the live getConfig response is wired in, this becomes the fallback /
 * default and the live config takes precedence.
 */

export const FLOORCARE_CONFIG = {
  /** Smart Inspect numeric config id for the pilot. */
  configId: 20035,
  /** Smart Inspect numeric client id. */
  clientId: 1172,
  /** configs[] filter values are matched by NAME in runWidgets. */
  configurationName: "Wegmans Floorcare Pilot",
  /** midTier ("area-type group") value for Wegmans. */
  midTier: "01",
  /** selectTier = the inspection form. */
  areaTypeName: "Daily Floor Care Compliance Check",
  /** Default IANA timezone for inspection/ticket date filters. */
  timezone: "America/New_York",
} as const;

/**
 * Smart Inspect configs this portal reports on. Wegmans (companyId 1382) has
 * several configs; the Floorcare ones are the original pilot (20035) plus the
 * Pre-/Post-Launch variants per vendor (ABS / CSG / Tec Services). The big
 * general "Wegmans" config (19399, ~100 stores) is intentionally EXCLUDED so a
 * member granted that config doesn't trigger ~100 store PDFs in one email.
 * (Discovered via the 2026-06-16 fullPermissions/getMemberPermissions HAR.)
 *
 * 2026-06-25: the three Pre-Launch configs were re-versioned in SI (area types
 * were added). SI archived the originals (20633 CSG, 20635 Tec, 20637 ABS) —
 * renaming them "... Archived" — and created new active configs (20754 ABS,
 * 20755 CSG, 20756 Tec). We report on the new active IDs; the archived versions
 * and the stray "Test Config" (20745) are excluded by isFloorcareConfig's name
 * guard (their names still contain "Floorcare"). Verified against live listConfigs.
 */
export const FLOORCARE_CONFIG_IDS: number[] = [
  20035, // Wegmans Floorcare Pilot (original)
  20754, // Pre-Launch - ABS          (active; replaced archived 20637)
  20755, // Pre-Launch - CSG          (active; replaced archived 20633)
  20756, // Pre-Launch - Tec Services (active; replaced archived 20635)
  20634, // Post-Launch - CSG
  20636, // Post-Launch - Tec Services
  20639, // Post-Launch - ABS
];

/**
 * True if a config belongs to the Floorcare program (so the scheduled report
 * should include it). Matches by known id OR by name containing "Floorcare",
 * which is robust if new Floorcare configs are added later.
 *
 * Archived/test configs are excluded by name FIRST: when SI re-versions a config
 * it appends "Archived" to the old one's name (which still contains "Floorcare"),
 * and there is a stray "Test Config" — neither should ever reach a report.
 */
export function isFloorcareConfig(cfg: {
  configId?: string | number | null;
  configName?: string | null;
}): boolean {
  const name = cfg.configName ?? "";
  if (/\b(archived|test)\b/i.test(name)) return false;
  const id = cfg.configId != null ? Number(cfg.configId) : NaN;
  if (!Number.isNaN(id) && FLOORCARE_CONFIG_IDS.includes(id)) return true;
  return /floorcare/i.test(name);
}

/** The 10 floorcare check areas (bilingual). */
export const CHECK_AREAS: { id: string; label: string }[] = [
  { id: "ca-vestibules", label: "Vestibules / Vestibulos" },
  {
    id: "ca-sales-front",
    label: "Sales & Circulation - Front End / Ventas y circulacion - Area frontal",
  },
  {
    id: "ca-sales-primary",
    label: "Sales & Circulation - Primary / Ventas y circulacion - Area principal",
  },
  {
    id: "ca-sales-secondary",
    label:
      "Sales & Circulation - Secondary / Ventas y circulacion - Area secundaria",
  },
  {
    id: "ca-cafe",
    label:
      "Cafe Seating / Restaurant Areas / Asientos de cafeteria / Areas de restaurante",
  },
  { id: "ca-restrooms", label: "Restrooms / Banos" },
  {
    id: "ca-foodprep",
    label: "Food Prep Areas / Areas de preparacion de alimentos",
  },
  {
    id: "ca-coolers",
    label: "Coolers and Freezers / Camaras frigorificas y congeladores",
  },
  { id: "ca-backroom", label: "Backroom Areas / Areas de almacen" },
  {
    id: "ca-breakroom",
    label: "Employee Breakroom / Sala de descanso para empleados",
  },
];

/** CheckAttributes. The first is the single "Acceptable" attribute. */
export const CHECK_ATTRIBUTES: { id: string; label: string; isAcceptable: boolean }[] =
  [
    { id: "attr-acceptable", label: "Acceptable", isAcceptable: true },
    { id: "attr-buildup", label: "Buildup / Acumulacion", isAcceptable: false },
    { id: "attr-cobweb", label: "Cobweb / Telarana", isAcceptable: false },
    { id: "attr-debris", label: "Debris / Residuos", isAcceptable: false },
    { id: "attr-dull", label: "Dull / Opaco", isAcceptable: false },
    { id: "attr-dust", label: "Dust / Polvo", isAcceptable: false },
    { id: "attr-graffiti", label: "Graffiti / Grafiti", isAcceptable: false },
    { id: "attr-malodor", label: "Malodor / Mal olor", isAcceptable: false },
    { id: "attr-scuff", label: "Scuff / Marca", isAcceptable: false },
    { id: "attr-soil", label: "Soil / Suciedad", isAcceptable: false },
    { id: "attr-spot", label: "Spot / Mancha", isAcceptable: false },
    { id: "attr-streak", label: "Streak / Raya", isAcceptable: false },
  ];

export const DEFICIENCY_ATTRIBUTES = CHECK_ATTRIBUTES.filter(
  (a) => !a.isAcceptable
);

/** "Soil / Suciedad" -> "Soil" */
export function englishLabel(bilingual: string): string {
  return bilingual.split("/")[0].trim();
}

/**
 * Live `checkmark` values are long descriptive strings prefixed with a number,
 * e.g. "01. Vestibules - floor traffic lanes ... streaks." Map that leading
 * number to the clean bilingual area label (1-based, matching CHECK_AREAS order).
 * Falls back to the raw label if it can't be matched.
 */
export function friendlyCheckmark(raw: string): string {
  const m = raw.match(/^\s*(\d+)\s*[.\-)]/);
  if (m) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < CHECK_AREAS.length) return CHECK_AREAS[idx].label;
  }
  return raw;
}

/** Resolve a stable check-area id from a (bilingual) checkmark label. */
export function checkAreaIdForLabel(label: string): string {
  const match = CHECK_AREAS.find((ca) => ca.label === label);
  if (match) return match.id;
  // fallback: slug of the english label
  return (
    "ca-" +
    englishLabel(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}
