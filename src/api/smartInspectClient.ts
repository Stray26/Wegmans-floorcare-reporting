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
  type SIRecord,
  type SIRawRecord,
  type SITicket,
  type SIRunWidgetsResponse,
  type SIPermissionsResponse,
  type SIListTagsResponse,
  type SIFilters,
} from "@/types/smartInspect";

export const MOCK_MODE =
  (import.meta.env.VITE_ENABLE_MOCK_DATA ?? "true") !== "false";

const INSPECTION_WIDGETS = {
  "inspection.details": {},
  "inspection.allRecords": {},
};
const TICKET_WIDGETS = { "ticket.getTickets": {} };

/* ----------------------------- proxy I/O ------------------------------- */

async function proxy<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/smart-inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint, ...body }),
  });
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
  if (MOCK_MODE) return getMockPermissions(role);
  return proxy<SIPermissionsResponse>("getPermissions", {
    permissionType: "Access",
  });
}

/** Flatten a permissions response into the stores (outer tiers) the user may see. */
export function permittedStores(perms: SIPermissionsResponse): StoreMeta[] {
  return extractPermittedOuterTiers(perms).map((ot) => {
    const name = ot.name;
    const city = name.includes(" - ") ? name.split(" - ").slice(1).join(" - ").trim() : undefined;
    return { buildingId: String(ot.outerTierId), storeName: name, city };
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

async function fetchRecordsAndTickets(
  stores: StoreMeta[],
  dateRange: DateRange
): Promise<{ records: SIRecord[]; tickets: SITicket[] }> {
  const outerTierIds = stores.map((s) => s.buildingId);

  if (MOCK_MODE) {
    const resp = getMockRunWidgets(outerTierIds, dateRange.start, dateRange.end);
    const records = widgetArray<SIRawRecord>(
      resp.widgets["inspection.allRecords"]
    ).map(transformApiRecord);
    const tickets = widgetArray<SITicket>(resp.widgets["ticket.getTickets"]);
    return { records, tickets };
  }

  // Live: outerTiers (store names) are injected/validated server-side; we send
  // the names we believe we can access and the proxy intersects with the token.
  const outerTierNames = stores.map((s) => s.storeName);
  const baseFilters: SIFilters = {
    clientId: FLOORCARE_CONFIG.clientId,
    configs: [FLOORCARE_CONFIG.configurationName],
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
  return { records, tickets };
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

const photoResolver = MOCK_MODE
  ? (r: SIRecord) => mockPhotoUrl(r.id)
  : undefined; // live photos require inspection.imageRecords (not yet wired)

/* ------------------------------- reports ------------------------------- */

export async function getPortfolioReport(
  stores: StoreMeta[],
  dateRange: DateRange,
  thresholds: ScoreThreshold[]
) {
  const { records, tickets } = await fetchRecordsAndTickets(stores, dateRange);
  const byBuilding = groupByBuilding(records);

  // Iterate the PERMITTED stores (not just those with records) so that
  // not-uploaded stores still appear as a separate gray status.
  const storeReports = stores.map((meta) =>
    transformStoreReport(
      meta,
      byBuilding.get(meta.buildingId) ?? [],
      tickets,
      dateRange,
      String(FLOORCARE_CONFIG.configId),
      FLOORCARE_CONFIG.configurationName,
      thresholds,
      photoResolver
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
  if (MOCK_MODE) {
    return getMockTickets(stores.map((s) => s.buildingId)).map(transformTicket);
  }
  const resp = await proxy<SIRunWidgetsResponse>("runWidgets", {
    filters: {
      clientId: FLOORCARE_CONFIG.clientId,
      configs: [FLOORCARE_CONFIG.configurationName],
      outerTiers: stores.map((s) => s.storeName),
      isForTickets: true,
      ticketDates: toFilter(dateRange),
    },
    widgets: TICKET_WIDGETS,
  });
  return widgetArray<SITicket>(resp.widgets["ticket.getTickets"]).map(
    transformTicket
  );
}

export async function getTicketTags(): Promise<SIListTagsResponse> {
  if (MOCK_MODE) return getMockListTags();
  return proxy<SIListTagsResponse>("listTags", {});
}

export async function createTicket(input: {
  storeName: string;
  areaName: string;
  deficiency: string;
  note?: string;
  priorityId?: number;
}): Promise<{ ticketId: string }> {
  if (MOCK_MODE) {
    return { ticketId: `WGM-${Math.floor(Math.random() * 9000 + 1000)}` };
  }
  const resp = await proxy<{ ticket: { ticketId: number } }>("createTicket", {
    ticket: {
      summary: `${input.deficiency} in ${input.areaName}`,
      location: FLOORCARE_CONFIG.configurationName,
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
