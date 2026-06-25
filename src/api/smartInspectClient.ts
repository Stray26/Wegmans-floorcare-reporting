/**
 * Browser-side Smart Inspect client.
 *
 * The browser NEVER calls Smart Inspect directly. In live mode it POSTs
 * `{ endpoint, ...body }` to our own /api/smart-inspect proxy, which injects
 * the SIQ-1 token and validates store permissions server-side. In mock mode it
 * resolves from local mock data through the same transforms, so the UI is
 * identical either way.
 */
import {
  getMockPermissions,
  getMockRunWidgets,
  getMockTickets,
  getMockListTags,
  getMockNotes,
  mockPhotoUrl,
  type DemoRole,
} from "./mockData";
import {
  transformStoreReport,
  buildPortfolioReport,
  transformTicket,
  type StoreMeta,
} from "./reportingTransforms";
import { FLOORCARE_CONFIG } from "@/config/wegmans";
import type { ScoreThreshold, DateRange } from "@/types/reporting";
import {
  transformApiRecord,
  extractPermittedOuterTiers,
  extractPermittedConfigs,
  type SIPermissionOuterTier,
  type SIRecord,
  type SIRawRecord,
  type SITicket,
  type SIInspectionNote,
  type SIRunWidgetsResponse,
  type SIPermissionsResponse,
  type SIListTagsResponse,
  type SIFilters,
  type SIWidgets,
} from "@/types/smartInspect";

/**
 * Mock mode is runtime-switchable so a "Demo data" toggle can flip the live
 * site between real Smart Inspect data and the mock Wegmans portfolio without
 * a redeploy. The env var sets the initial value; SessionProvider keeps the
 * runtime flag in sync, and data hooks include it in their query keys so
 * toggling triggers a refetch.
 */
export const DEFAULT_MOCK =
  (import.meta.env.VITE_ENABLE_MOCK_DATA ?? "true") !== "false";

let runtimeMock = DEFAULT_MOCK;
export function isMockMode(): boolean {
  return runtimeMock;
}
export function setMockMode(value: boolean): void {
  runtimeMock = value;
}

const INSPECTION_WIDGETS = {
  "inspection.details": {},
  "inspection.allRecords": {},
  "inspection.imageRecords": {},
};
const TICKET_WIDGETS = { "ticket.getTickets": {} };

/* ----------------------------- proxy I/O ------------------------------- */

async function proxy<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/smart-inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ endpoint, ...body }),
  });
  // Session missing/expired: bounce to sign-in (mock mode never reaches here).
  if (res.status === 401 && !isMockMode()) {
    window.location.assign("/login");
    throw new Error("Not signed in.");
  }
  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(data?.error ?? `Smart Inspect proxy error ${res.status}`);
  }
  return data as T;
}

function toFilter(dateRange: DateRange): { startDate: string; endDate: string; timezone: string } {
  // Smart Inspect requires RFC-3339 date-time (with a timezone marker), e.g.
  // "2026-06-01T00:00:00Z" — a bare "...T00:00:00" is rejected by the schema.
  return {
    startDate: `${dateRange.start}T00:00:00Z`,
    endDate: `${dateRange.end}T23:59:59Z`,
    timezone: FLOORCARE_CONFIG.timezone,
  };
}

/* ----------------------------- permissions ----------------------------- */

export async function getPermissions(role: DemoRole): Promise<SIPermissionsResponse> {
  if (isMockMode()) return getMockPermissions(role);
  return proxy<SIPermissionsResponse>("getPermissions", {
    permissionType: "Access",
  });
}

function toStoreMeta(
  ot: SIPermissionOuterTier,
  config?: { configId: string; configName: string }
): StoreMeta {
  const name = ot.name;
  const city = name.includes(" - ") ? name.split(" - ").slice(1).join(" - ").trim() : undefined;
  return {
    buildingId: String(ot.outerTierId),
    storeName: name,
    city,
    configId: config?.configId,
    configName: config?.configName,
  };
}

/** Flatten a permissions response into the stores (outer tiers) the user may see. */
export function permittedStores(perms: SIPermissionsResponse): StoreMeta[] {
  return extractPermittedOuterTiers(perms).map((ot) => toStoreMeta(ot));
}

/** A permitted config (inspection program) with the stores it grants. */
export interface PermittedConfig {
  configId: string;
  configName: string;
  stores: StoreMeta[];
}

/**
 * Known config names by id. runWidgets matches configs BY NAME, so for configs
 * we know, prefer the canonical name over whatever label permissions carry —
 * a mismatched label would silently fetch zero records. Names verified against
 * the live listConfigs (2026-06-25); the new active Pre-Launch IDs replaced the
 * archived originals (20633/20635/20637).
 */
const KNOWN_CONFIG_NAMES: Record<string, string> = {
  [String(FLOORCARE_CONFIG.configId)]: FLOORCARE_CONFIG.configurationName, // 20035
  "20754": "Pre-Launch - ABS Wegmans Floorcare Pilot",
  "20755": "Pre-Launch - CSG Wegmans Floorcare Pilot",
  "20756": "Pre-Launch - Tec Services Wegmans Floorcare Pilot",
  "20639": "Post-Launch - ABS Wegmans Floorcare Pilot",
  "20634": "Post-Launch - CSG Wegmans Floorcare Pilot",
  "20636": "Post-Launch - Tec Services Wegmans Floorcare Pilot",
};

/** Group the permissions response by config, preserving the SI hierarchy. */
export function permittedConfigs(perms: SIPermissionsResponse): PermittedConfig[] {
  return extractPermittedConfigs(perms).map((cfg) => {
    const configName = KNOWN_CONFIG_NAMES[cfg.configId] ?? cfg.configName;
    return {
      configId: cfg.configId,
      configName,
      stores: cfg.outerTiers.map((ot) =>
        toStoreMeta(ot, { configId: cfg.configId, configName })
      ),
    };
  });
}

/* ------------------------------ run widgets ---------------------------- */

/**
 * Extract an array from a widget value. Smart Inspect widgets may return a
 * bare array OR wrap it in an object, e.g. inspection.allRecords ->
 * { records: [...], total } and ticket.getTickets -> { records|tickets: [...] }.
 */
function widgetArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.records)) return o.records as T[];
    if (Array.isArray(o.tickets)) return o.tickets as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

/**
 * Pull inspection.imageRecords rows out of a runWidgets response. The shape is
 * `{ inspectionRecords: [...], noteRecords: [...] }`; tolerant of the web-app
 * alias form (the records live under whichever widget key carries them).
 */
function extractImageRecords(widgets: SIWidgets): SIRawRecord[] {
  const fromVal = (v: unknown): SIRawRecord[] | null =>
    v &&
    typeof v === "object" &&
    Array.isArray((v as { inspectionRecords?: unknown }).inspectionRecords)
      ? (v as { inspectionRecords: SIRawRecord[] }).inspectionRecords
      : null;
  return (
    fromVal(widgets["inspection.imageRecords"]) ??
    Object.values(widgets)
      .map(fromVal)
      .find((r): r is SIRawRecord[] => !!r) ??
    []
  );
}

/**
 * Pull the noteRecords out of an inspection.imageRecords response (free-text
 * inspection notes, optionally with a photo). Falls back to a bare
 * inspection.notes widget when present.
 */
function extractNoteRecords(widgets: SIWidgets): SIInspectionNote[] {
  const fromVal = (v: unknown): SIInspectionNote[] | null =>
    v &&
    typeof v === "object" &&
    Array.isArray((v as { noteRecords?: unknown }).noteRecords)
      ? (v as { noteRecords: SIInspectionNote[] }).noteRecords
      : null;
  if (Array.isArray(widgets["inspection.notes"])) {
    return widgets["inspection.notes"] as SIInspectionNote[];
  }
  return (
    fromVal(widgets["inspection.imageRecords"]) ??
    Object.values(widgets)
      .map(fromVal)
      .find((r): r is SIInspectionNote[] => !!r) ??
    []
  );
}

/**
 * Smart Inspect tickets carry no photo link, so associate each ticket with the
 * inspection photos sharing its store + check area + deficiency (best-effort).
 * Mutates ticket.photoUrls in place; leaves any already set (e.g. mock) alone.
 */
function attachTicketPhotos(tickets: SITicket[], images: SIRawRecord[]): void {
  if (images.length === 0) return;
  const byKey = new Map<string, string[]>();
  for (const im of images) {
    if (!im.url) continue;
    const key = `${im.outerTierId}|${im.checkmark}|${im.checkAttribute}`;
    const arr = byKey.get(key);
    if (arr) arr.push(im.url);
    else byKey.set(key, [im.url]);
  }
  for (const t of tickets) {
    if (t.photoUrls && t.photoUrls.length > 0) continue;
    const urls = byKey.get(`${t.outerTierId}|${t.item}|${t.deficiency}`);
    if (urls) t.photoUrls = urls.slice(0, 6);
  }
}

/**
 * Resolve the config (inspection program) scoping a fetch from the stores'
 * permission metadata. Falls back to the Floorcare pilot for StoreMeta built
 * before configs were threaded through (or demo seeds without one).
 */
function configOf(stores: StoreMeta[]): { configId: string; configName: string } {
  return {
    configId: stores[0]?.configId ?? String(FLOORCARE_CONFIG.configId),
    configName: stores[0]?.configName ?? FLOORCARE_CONFIG.configurationName,
  };
}

/**
 * Group stores by their config (program). runWidgets matches configs BY NAME
 * and outerTierIds are per-config, so a multi-config selection ("All configs")
 * must fetch each program separately and merge the results.
 */
function groupStoresByConfig(stores: StoreMeta[]): StoreMeta[][] {
  const groups = new Map<string, StoreMeta[]>();
  for (const s of stores) {
    const key = s.configName ?? FLOORCARE_CONFIG.configurationName;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  return [...groups.values()];
}

/**
 * Fetch records/tickets/images for a set of stores. Stores spanning multiple
 * configs (the "All configs" view) are fetched one program at a time and
 * merged — a single runWidgets call only matches one config name.
 */
async function fetchRecordsAndTickets(
  stores: StoreMeta[],
  dateRange: DateRange
): Promise<{
  records: SIRecord[];
  tickets: SITicket[];
  images: SIRawRecord[];
  notes: SIInspectionNote[];
}> {
  const groups = groupStoresByConfig(stores);
  if (groups.length <= 1) return fetchConfigRecordsAndTickets(stores, dateRange);
  const results = await Promise.all(
    groups.map((g) => fetchConfigRecordsAndTickets(g, dateRange))
  );
  return {
    records: results.flatMap((r) => r.records),
    tickets: results.flatMap((r) => r.tickets),
    images: results.flatMap((r) => r.images),
    notes: results.flatMap((r) => r.notes),
  };
}

/** Fetch one config's records/tickets/images (all stores share a config here). */
async function fetchConfigRecordsAndTickets(
  stores: StoreMeta[],
  dateRange: DateRange
): Promise<{
  records: SIRecord[];
  tickets: SITicket[];
  images: SIRawRecord[];
  notes: SIInspectionNote[];
}> {
  const outerTierIds = stores.map((s) => s.buildingId);
  const config = configOf(stores);

  if (isMockMode()) {
    const resp = getMockRunWidgets(
      outerTierIds,
      dateRange.start,
      dateRange.end,
      config.configName
    );
    const records = widgetArray<SIRawRecord>(
      resp.widgets["inspection.allRecords"]
    ).map(transformApiRecord);
    const tickets = widgetArray<SITicket>(resp.widgets["ticket.getTickets"]);
    // Mock photos are synthesized by mockPhotoUrl; notes come from getMockNotes.
    const notes = getMockNotes(outerTierIds, dateRange.start, dateRange.end, config.configName);
    return { records, tickets, images: [], notes };
  }

  // Live: outerTiers (store names) are injected/validated server-side; we send
  // the names we believe we can access and the proxy intersects with the token.
  const outerTierNames = stores.map((s) => s.storeName);
  const baseFilters: SIFilters = {
    clientId: FLOORCARE_CONFIG.clientId,
    configs: [config.configName],
    outerTiers: outerTierNames,
  };

  // Inspection data is the critical path. Tickets are best-effort: a ticket
  // widget failure must NOT blank the whole dashboard.
  const inspResp = await proxy<SIRunWidgetsResponse>("runWidgets", {
    filters: { ...baseFilters, inspectionRange: toFilter(dateRange) },
    widgets: INSPECTION_WIDGETS,
  });

  let tickets: SITicket[] = [];
  try {
    const ticketResp = await proxy<SIRunWidgetsResponse>("runWidgets", {
      filters: { ...baseFilters, isForTickets: true, ticketDates: toFilter(dateRange) },
      widgets: TICKET_WIDGETS,
    });
    tickets = widgetArray<SITicket>(ticketResp.widgets["ticket.getTickets"]);
  } catch (err) {
    console.warn("Ticket widget failed; continuing without tickets.", err);
  }

  const records = widgetArray<SIRawRecord>(
    inspResp.widgets["inspection.allRecords"]
  ).map(transformApiRecord);
  const images = extractImageRecords(inspResp.widgets);
  const notes = extractNoteRecords(inspResp.widgets);
  // SI tickets have no photo link; associate inspection photos best-effort.
  attachTicketPhotos(tickets, images);
  return { records, tickets, images, notes };
}

function groupByBuilding(records: SIRecord[]): Map<string, SIRecord[]> {
  const map = new Map<string, SIRecord[]>();
  for (const r of records) {
    const arr = map.get(r.buildingId);
    if (arr) arr.push(r);
    else map.set(r.buildingId, [r]);
  }
  return map;
}

/**
 * Photo-URL resolver for a record. Mock mode synthesizes URLs for flagged
 * records; live mode maps a record id to its inspection.imageRecords URL — the
 * browser loads it straight from the Smart Inspect file CDN, exactly how the
 * Smart Inspect web app renders photos. Computed per-call so the demo toggle
 * takes effect.
 */
function photoResolver(images: SIRawRecord[]): (r: SIRecord) => string | null {
  if (isMockMode()) {
    return (r: SIRecord) => (r.hasPhoto ? mockPhotoUrl(r.id) : null);
  }
  const urlById = new Map<string, string>();
  for (const im of images) {
    if (im.url) urlById.set(String(im.id), im.url);
  }
  return (r: SIRecord) => urlById.get(r.id) ?? null;
}

/* ------------------------------- reports ------------------------------- */

export async function getPortfolioReport(
  stores: StoreMeta[],
  dateRange: DateRange,
  thresholds: ScoreThreshold[]
) {
  const { records, tickets, images, notes } = await fetchRecordsAndTickets(
    stores,
    dateRange
  );
  const byBuilding = groupByBuilding(records);
  const config = configOf(stores);
  const resolvePhoto = photoResolver(images);

  // Iterate the PERMITTED stores (not just those with records) so that
  // not-uploaded stores still appear as a separate gray status.
  const storeReports = stores.map((meta) =>
    transformStoreReport(
      meta,
      byBuilding.get(meta.buildingId) ?? [],
      tickets,
      dateRange,
      meta.configId ?? config.configId,
      meta.configName ?? config.configName,
      thresholds,
      resolvePhoto,
      notes
    )
  );

  return buildPortfolioReport(storeReports);
}

export async function getStoreReport(
  store: StoreMeta,
  dateRange: DateRange,
  thresholds: ScoreThreshold[]
) {
  const portfolio = await getPortfolioReport([store], dateRange, thresholds);
  return portfolio.storeReports[0] ?? null;
}

/* ------------------------------- tickets ------------------------------- */

export async function getTickets(stores: StoreMeta[], dateRange: DateRange) {
  if (isMockMode()) {
    return getMockTickets(
      stores.map((s) => s.buildingId),
      configOf(stores).configName
    ).map(transformTicket);
  }
  const baseFilters: SIFilters = {
    clientId: FLOORCARE_CONFIG.clientId,
    configs: [configOf(stores).configName],
    outerTiers: stores.map((s) => s.storeName),
  };
  const resp = await proxy<SIRunWidgetsResponse>("runWidgets", {
    filters: { ...baseFilters, isForTickets: true, ticketDates: toFilter(dateRange) },
    widgets: TICKET_WIDGETS,
  });
  const tickets = widgetArray<SITicket>(resp.widgets["ticket.getTickets"]);
  // Best-effort: attach inspection photos to tickets (store + area + deficiency).
  try {
    const imgResp = await proxy<SIRunWidgetsResponse>("runWidgets", {
      filters: { ...baseFilters, inspectionRange: toFilter(dateRange) },
      widgets: { "inspection.imageRecords": {} },
    });
    attachTicketPhotos(tickets, extractImageRecords(imgResp.widgets));
  } catch (err) {
    console.warn("Image records failed; tickets shown without photos.", err);
  }
  return tickets.map(transformTicket);
}

export async function getTicketTags(): Promise<SIListTagsResponse> {
  if (isMockMode()) return getMockListTags();
  return proxy<SIListTagsResponse>("listTags", {});
}

export async function createTicket(input: {
  storeName: string;
  areaName: string;
  deficiency: string;
  note?: string;
  priorityId?: number;
  /** Config (SI "location") the ticket belongs to; defaults to Floorcare. */
  configName?: string;
}): Promise<{ ticketId: string }> {
  if (isMockMode()) {
    return { ticketId: `WGM-${Math.floor(Math.random() * 9000 + 1000)}` };
  }
  const resp = await proxy<{ ticket: { ticketId: number } }>("createTicket", {
    ticket: {
      summary: `${input.deficiency} in ${input.areaName}`,
      location: input.configName ?? FLOORCARE_CONFIG.configurationName,
      building: input.storeName,
      item: input.areaName,
      deficiency: input.deficiency,
      areatype: FLOORCARE_CONFIG.areaTypeName,
      description: input.note,
      priorityId: input.priorityId,
    },
  });
  return { ticketId: `WGM-${resp.ticket.ticketId}` };
}
