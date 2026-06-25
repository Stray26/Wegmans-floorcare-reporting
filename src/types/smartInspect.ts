/**
 * Raw Smart Inspect API types — the REAL contract.
 *
 * Transport: the browser POSTs `{ endpoint, ...body }` to our own
 * /api/smart-inspect proxy. The proxy adds `Authorization: SIQ-1 <token>` and
 * forwards to https://app.mysmartinspect.com/api/<endpoint>. These types model
 * the upstream request/response shapes; reportingTransforms.ts converts them
 * into the normalized reporting.ts types the UI consumes.
 *
 * Hierarchy: config -> outerTier -> midTier -> selectTier -> checkmark -> checkAttribute
 *   config     = customer program  ("Wegmans Floorcare Pilot")
 *   outerTier  = store / building
 *   midTier    = area-type group   ("01")
 *   selectTier = inspection form    ("Daily Floor Care Compliance Check")
 *   checkmark  = line item          (10 bilingual items)
 *   checkAttribute = pass/fail reason (Acceptable, Buildup, Dust, ...)
 */

export type SIEndpoint =
  | "runWidgets"
  | "getPermissions"
  | "getconfig"
  | "configurations"
  | "listTags"
  | "createTicket"
  | "getTicket";

/** Envelope the browser sends to /api/smart-inspect. */
export interface SIProxyRequest {
  endpoint: SIEndpoint;
  [key: string]: unknown;
}

/* ----------------------------- date filters ---------------------------- */

export interface SIDateFilter {
  startDate: string; // ISO, e.g. "2026-06-01T00:00:00Z"
  endDate: string;
  timezone: string; // IANA, e.g. "America/New_York"
}

/* ----------------------------- runWidgets ------------------------------ */

export interface SIFilters {
  inspectionRange?: SIDateFilter;
  isForTickets?: boolean;
  ticketDates?: SIDateFilter;
  clientId: number;
  /** Config NAMES — legacy; Smart Inspect actually filters by configIds. */
  configs?: string[];
  /** Config IDs — Smart Inspect's real config filter. */
  configIds?: number[];
  /** Store NAMES — Smart Inspect IGNORES these; kept for legacy callers. */
  outerTiers?: string[];
  /** Outer-tier IDs — Smart Inspect's real store filter (what it honors). */
  outerTierIds?: Array<number | string>;
  inspectors?: string[];
}

export interface SIRunWidgetsRequest {
  filters: SIFilters;
  widgets: Record<string, Record<string, unknown>>;
}

export interface SIRunWidgetsResponse {
  appliedFilters?: unknown;
  success: boolean;
  widgets: SIWidgets;
  error?: string;
  status?: number;
}

export interface SIWidgets {
  "inspection.details"?: SIInspectionDetails;
  "inspection.allRecords"?: SIRawRecord[];
  "inspection.qspBy"?: Record<string, number>;
  "inspection.itemCount"?: Record<string, number>;
  "inspection.imageRecords"?: SIImageRecords;
  "inspection.notes"?: SIInspectionNote[];
  "ticket.getTickets"?: SITicket[];
  "ticket.countBy"?: Record<string, number>;
  [key: string]: unknown;
}

export interface SIInspectionDetails {
  numGoodChecks: number;
  totalChecks: number;
  totalPhotos: number;
  numNotes: number;
  selectTiers: string[];
  inspectors: string[];
  configs: string[];
  inspectionIds: Array<number | string>;
  startDate: string;
  endDate: string;
}

/** Raw per-checkmark row from `inspection.allRecords` (pre-transform). */
export interface SIRawRecord {
  id: number | string;
  inspectionId: number | string;
  recordDate: string;
  uploadDate: string;
  config: string;
  configId?: number | string;
  outerTier: string;
  outerTierId: number | string;
  midTier?: string;
  midTierId?: number | string;
  crossTag?: string;
  crossTagId?: number | string;
  detailTag?: string;
  selectTier: string;
  region?: string;
  state?: string;
  inspector: string;
  checkmark: string;
  checkAttribute: string;
  /** true -> 100, false -> 0, null/undefined -> 50 */
  isGood: boolean | null;
  /** photo reference/url when present; null/false when none */
  photo?: boolean | string | null;
  count: number;
  /**
   * Present on inspection.imageRecords rows: the photo's own id and its direct
   * URL on the Smart Inspect file CDN. Absent on plain inspection.allRecords.
   */
  imageId?: number;
  url?: string;
}

export interface SIInspectionNote {
  id: number | string;
  inspectionId: number | string;
  noteCategory: string;
  noteText: string;
  inspector: string;
  recordDate: string;
  uploadDate: string;
  config: string;
  outerTier: string;
  outerTierId?: number | string;
  midTier?: string;
  selectTier?: string;
  /** Note photo on the SI file CDN. Live rows use `url`; older shapes use `photo`. */
  url?: string;
  photo?: string;
}

export interface SIImageRecords {
  inspectionRecords: SIRawRecord[];
  noteRecords: SIInspectionNote[];
}

/* ------------------------------- tickets ------------------------------- */

export interface SITicketTag {
  id: number;
  description: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
  isFinal?: boolean;
  isHot?: boolean;
}

export interface SITicket {
  ticketId: number;
  companyId?: number;
  summary: string;
  description?: string;
  location: string; // config
  building: string; // outerTier (store)
  configId?: number;
  outerTierId?: number | string;
  floor?: string;
  zone?: string;
  item?: string; // checkmark
  deficiency?: string; // checkAttribute
  areatype?: string; // selectTier
  priorityId?: number;
  statusId?: number;
  categoryId?: number;
  createdAt?: string;
  dueBy?: string;
  startAt?: string;
  status?: SITicketTag;
  priority?: SITicketTag;
  category?: SITicketTag;
  /**
   * Photo URLs attached to the ticket. Live Smart Inspect ticket responses
   * don't carry these yet (they'd come from inspection.imageRecords); the mock
   * supplies them so the ticket detail view is demoable.
   */
  photoUrls?: string[];
}

export interface SIListTagsResponse {
  statuses: SITicketTag[];
  priorities: SITicketTag[];
  categories: SITicketTag[];
}

export interface SICreateTicketInput {
  summary: string;
  location: string;
  building: string;
  description?: string;
  floor?: string;
  zone?: string;
  item?: string;
  deficiency?: string;
  areatype?: string;
  priorityId?: number;
  categoryId?: number;
  statusId?: number;
  dueBy?: string;
  startAt?: string;
}

/* ----------------------------- permissions ----------------------------- */

export interface SIPermissionOuterTier {
  id: number | string;
  name: string;
  outerTierId: number | string;
}

export interface SIPermissionConfig {
  configId?: number;
  /** LIVE getPermissions uses `name`; some shapes/mocks use `configName`. */
  name?: string;
  configName?: string;
  permissionOuterTiers?: SIPermissionOuterTier[];
}

export interface SIPermission {
  id: number | string;
  name: string;
  configId: number;
  permissionNoteCategories?: { id: number | string; name: string }[];
  permissionConfigs?: SIPermissionConfig[];
}

export interface SIPermissionsResponse {
  /** Some tokens return a single permission object, others an array. */
  permissions: SIPermission | SIPermission[];
}

/* --------------------------- normalized record ------------------------- */

/**
 * Output of transformApiRecord — friendly field names per the documented
 * mapping. Reporting transforms build StoreReport from arrays of these.
 */
export interface SIRecord {
  id: string;
  inspectionId: string;
  inspectionDate: string;
  uploadDate: string;
  location: string; // config
  locationId: string;
  building: string; // outerTier = store
  buildingId: string;
  floor?: string; // midTier
  floorId?: string;
  zone?: string; // crossTag
  zoneId?: string;
  room?: string; // detailTag
  areaType: string; // selectTier
  region?: string;
  state?: string;
  inspector: string;
  item: string; // checkmark
  deficiency: string; // checkAttribute
  qspScore: 100 | 0 | 50; // from isGood
  hasPhoto: boolean;
  checkmarkCount: number;
}

/** Map a raw allRecords row to the normalized record. Mirrors transformApiRecord. */
export function transformApiRecord(r: SIRawRecord): SIRecord {
  const qspScore: 100 | 0 | 50 =
    r.isGood === true ? 100 : r.isGood === false ? 0 : 50;
  return {
    id: String(r.id),
    inspectionId: String(r.inspectionId),
    inspectionDate: r.recordDate,
    uploadDate: r.uploadDate,
    location: r.config,
    locationId: r.configId != null ? String(r.configId) : "",
    building: r.outerTier,
    buildingId: String(r.outerTierId),
    floor: r.midTier,
    floorId: r.midTierId != null ? String(r.midTierId) : undefined,
    zone: r.crossTag,
    zoneId: r.crossTagId != null ? String(r.crossTagId) : undefined,
    room: r.detailTag,
    areaType: r.selectTier,
    region: r.region,
    state: r.state,
    inspector: r.inspector,
    item: r.checkmark,
    deficiency: r.checkAttribute,
    qspScore,
    hasPhoto: !!r.photo,
    checkmarkCount: r.count ?? 1,
  };
}

/**
 * A permitted configuration (inspection program) with its permitted stores.
 * Preserves the config -> store hierarchy from getPermissions, which
 * extractPermittedOuterTiers flattens away.
 */
export interface SIPermittedConfig {
  configId: string;
  configName: string;
  outerTiers: SIPermissionOuterTier[];
}

/** Normalize the permissions response into configs, each with its stores. */
export function extractPermittedConfigs(
  resp: SIPermissionsResponse
): SIPermittedConfig[] {
  const perms = Array.isArray(resp.permissions)
    ? resp.permissions
    : [resp.permissions];
  const byConfig = new Map<string, SIPermittedConfig>();
  for (const p of perms) {
    for (const cfg of p.permissionConfigs ?? []) {
      // Fall back to the permission-level configId when the config entry omits it.
      const id = String(cfg.configId ?? p.configId ?? "");
      // Live responses use `name`, mocks/docs use `configName`; never let the
      // name be blank or the filter UI and config matching break.
      const name =
        cfg.configName ?? cfg.name ?? (id ? `Config ${id}` : "");
      const key = id || name;
      if (!key) continue;
      let entry = byConfig.get(key);
      if (!entry) {
        entry = { configId: id, configName: name, outerTiers: [] };
        byConfig.set(key, entry);
      }
      const seen = new Set(entry.outerTiers.map((t) => String(t.outerTierId)));
      for (const ot of cfg.permissionOuterTiers ?? []) {
        if (!seen.has(String(ot.outerTierId))) {
          seen.add(String(ot.outerTierId));
          entry.outerTiers.push(ot);
        }
      }
    }
  }
  return [...byConfig.values()];
}

/** Normalize the permissions response into a flat list of permitted stores. */
export function extractPermittedOuterTiers(
  resp: SIPermissionsResponse
): SIPermissionOuterTier[] {
  const perms = Array.isArray(resp.permissions)
    ? resp.permissions
    : [resp.permissions];
  const tiers: SIPermissionOuterTier[] = [];
  const seen = new Set<string>();
  for (const p of perms) {
    for (const cfg of p.permissionConfigs ?? []) {
      for (const ot of cfg.permissionOuterTiers ?? []) {
        const key = String(ot.outerTierId);
        if (!seen.has(key)) {
          seen.add(key);
          tiers.push(ot);
        }
      }
    }
  }
  return tiers;
}
