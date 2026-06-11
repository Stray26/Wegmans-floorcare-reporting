/**
 * Mock Smart Inspect data — mirrors the REAL API response shapes
 * (types/smartInspect.ts). Isolated here so it can be swapped for live
 * responses without touching transforms or UI. Deterministic (seeded).
 *
 * The pilot config is "Wegmans Floorcare Pilot" (configId 20035, clientId
 * 1172). Stores are Smart Inspect "outer tiers".
 */
import {
  FLOORCARE_CONFIG,
  CHECK_AREAS,
  DEFICIENCY_ATTRIBUTES,
} from "@/config/wegmans";
import type {
  SIPermissionsResponse,
  SIRunWidgetsResponse,
  SIRawRecord,
  SITicket,
  SIListTagsResponse,
  SIWidgets,
  SIInspectionDetails,
} from "@/types/smartInspect";

/* ----------------------------- seeded RNG ------------------------------ */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INSPECTORS = [
  "M. Alvarez",
  "J. Chen",
  "S. Patel",
  "R. Thompson",
  "L. Nguyen",
  "D. Okafor",
  "K. Romano",
];

/* --------------------------- store directory --------------------------- */
interface StoreSeed {
  outerTierId: number;
  storeNumber: string;
  /** outerTier name as used in filters & records */
  outerTier: string;
  city: string;
  state: string;
}

const PILOT_STORES: StoreSeed[] = [
  { outerTierId: 115, storeNumber: "115", outerTier: "115 - Tysons Corner", city: "Tysons", state: "VA" },
  { outerTierId: 73, storeNumber: "73", outerTier: "73 - Johnson City", city: "Johnson City", state: "NY" },
  { outerTierId: 92, storeNumber: "92", outerTier: "92 - Military Road", city: "Buffalo", state: "NY" },
];

// Real Wegmans-market cities across the chain's footprint, for a believable
// 100-store demo portfolio.
const CITY_POOL: { city: string; state: string }[] = [
  // NY
  { city: "Rochester", state: "NY" }, { city: "Pittsford", state: "NY" },
  { city: "Penfield", state: "NY" }, { city: "Fairport", state: "NY" },
  { city: "Henrietta", state: "NY" }, { city: "Greece", state: "NY" },
  { city: "Webster", state: "NY" }, { city: "Brighton", state: "NY" },
  { city: "Canandaigua", state: "NY" }, { city: "Victor", state: "NY" },
  { city: "Geneva", state: "NY" }, { city: "Auburn", state: "NY" },
  { city: "Syracuse", state: "NY" }, { city: "DeWitt", state: "NY" },
  { city: "Liverpool", state: "NY" }, { city: "Ithaca", state: "NY" },
  { city: "Corning", state: "NY" }, { city: "Elmira", state: "NY" },
  { city: "Amherst", state: "NY" }, { city: "Cheektowaga", state: "NY" },
  { city: "Niagara Falls", state: "NY" }, { city: "Lancaster", state: "NY" },
  { city: "Albany", state: "NY" },
  // NJ
  { city: "Bridgewater", state: "NJ" }, { city: "Princeton", state: "NJ" },
  { city: "Cherry Hill", state: "NJ" }, { city: "Mount Laurel", state: "NJ" },
  { city: "Manalapan", state: "NJ" }, { city: "Woodbridge", state: "NJ" },
  { city: "Ocean", state: "NJ" }, { city: "Hanover", state: "NJ" },
  { city: "Montvale", state: "NJ" }, { city: "Parsippany", state: "NJ" },
  { city: "Hillsborough", state: "NJ" },
  // PA
  { city: "Pittsburgh", state: "PA" }, { city: "Erie", state: "PA" },
  { city: "State College", state: "PA" }, { city: "Allentown", state: "PA" },
  { city: "Bethlehem", state: "PA" }, { city: "King of Prussia", state: "PA" },
  { city: "Malvern", state: "PA" }, { city: "Downingtown", state: "PA" },
  { city: "Warrington", state: "PA" }, { city: "Collegeville", state: "PA" },
  { city: "Lancaster", state: "PA" },
  // MA
  { city: "Westwood", state: "MA" }, { city: "Burlington", state: "MA" },
  { city: "Natick", state: "MA" }, { city: "Chestnut Hill", state: "MA" },
  { city: "Medford", state: "MA" },
  // VA
  { city: "Fairfax", state: "VA" }, { city: "Sterling", state: "VA" },
  { city: "Chantilly", state: "VA" }, { city: "Reston", state: "VA" },
  { city: "Alexandria", state: "VA" }, { city: "Richmond", state: "VA" },
  { city: "Charlottesville", state: "VA" }, { city: "Fredericksburg", state: "VA" },
  { city: "Midlothian", state: "VA" }, { city: "Short Pump", state: "VA" },
  { city: "Leesburg", state: "VA" }, { city: "Gainesville", state: "VA" },
  { city: "Dulles", state: "VA" },
  // MD
  { city: "Columbia", state: "MD" }, { city: "Germantown", state: "MD" },
  { city: "Frederick", state: "MD" }, { city: "Hunt Valley", state: "MD" },
  { city: "Owings Mills", state: "MD" }, { city: "Crofton", state: "MD" },
  { city: "Bel Air", state: "MD" }, { city: "Lanham", state: "MD" },
  { city: "Rockville", state: "MD" }, { city: "Woodmore", state: "MD" },
  // NC
  { city: "Cary", state: "NC" }, { city: "Raleigh", state: "NC" },
  { city: "Chapel Hill", state: "NC" }, { city: "Holly Springs", state: "NC" },
  { city: "Wake Forest", state: "NC" },
  // DC
  { city: "Washington", state: "DC" },
];

function buildStoreSeeds(extra: number): StoreSeed[] {
  const rng = mulberry32(20260609);
  const seeds = [...PILOT_STORES];
  let num = 200;
  for (let i = 0; i < extra; i++) {
    const loc = CITY_POOL[Math.floor(rng() * CITY_POOL.length)];
    num += Math.floor(rng() * 6) + 1;
    seeds.push({
      outerTierId: num,
      storeNumber: String(num),
      outerTier: `${num} - ${loc.city}`,
      city: loc.city,
      state: loc.state,
    });
  }
  return seeds;
}

export const STORE_SEEDS = buildStoreSeeds(97);

function seedById(id: string): StoreSeed | undefined {
  return STORE_SEEDS.find((s) => String(s.outerTierId) === String(id));
}

/* ----------------------------- permissions ----------------------------- */
/**
 * Demo roles:
 *  - "boss"    -> all stores (Portfolio)
 *  - "manager" -> single store 115 (Store Manager)
 *  - "group"   -> a handful (scaled portfolio)
 */
export type DemoRole = "boss" | "manager" | "group";

export function getMockPermissions(role: DemoRole): SIPermissionsResponse {
  let stores: StoreSeed[];
  if (role === "manager") stores = STORE_SEEDS.filter((s) => s.outerTierId === 115);
  else if (role === "group")
    stores = STORE_SEEDS.filter((s) => [115, 73, 92].includes(s.outerTierId));
  else stores = STORE_SEEDS;

  return {
    permissions: {
      id: role === "manager" ? "perm-mgr-115" : "perm-corp",
      name:
        role === "manager"
          ? "Tysons Corner Store Manager"
          : role === "group"
            ? "Pilot Region Lead"
            : "Wegmans Floorcare Corporate",
      configId: FLOORCARE_CONFIG.configId,
      permissionConfigs: [
        {
          configId: FLOORCARE_CONFIG.configId,
          configName: FLOORCARE_CONFIG.configurationName,
          permissionOuterTiers: stores.map((s) => ({
            id: s.outerTierId,
            name: s.outerTier,
            outerTierId: s.outerTierId,
          })),
        },
      ],
    },
  };
}

export function getMockListTags(): SIListTagsResponse {
  return {
    statuses: [
      { id: 1, description: "Open", color: "#d97706", order: 1, isDefault: true },
      { id: 2, description: "In Progress", color: "#2563eb", order: 2 },
      { id: 3, description: "Closed", color: "#16a34a", order: 3, isFinal: true },
    ],
    priorities: [
      { id: 1, description: "Low", color: "#6b7280", order: 1 },
      { id: 2, description: "Medium", color: "#d97706", order: 2, isDefault: true },
      { id: 3, description: "High", color: "#dc2626", order: 3, isHot: true },
    ],
    categories: [
      { id: 1, description: "Floor Care", color: "#006938", order: 1, isDefault: true },
      { id: 2, description: "Sanitation", color: "#2563eb", order: 2 },
    ],
  };
}

/* ------------------------- record data generator ----------------------- */

function daysAgoIso(days: number, hour = 6): string {
  const d = new Date("2026-06-09T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, Math.floor((days * 7) % 60), 0, 0);
  return d.toISOString();
}

/**
 * Generate raw allRecords rows for one store. Each row = one checkmark
 * observation carrying `count` checks and an isGood flag (acceptable or a
 * specific deficiency attribute).
 */
function makeStoreRecords(
  seed: StoreSeed,
  quality: number,
  inspectionCount: number
): SIRawRecord[] {
  const rng = mulberry32(seed.outerTierId * 977 + 13);
  const rows: SIRawRecord[] = [];
  let rid = seed.outerTierId * 100000;

  for (let ins = 0; ins < inspectionCount; ins++) {
    const inspectionId = seed.outerTierId * 1000 + ins;
    const dayOffset = (inspectionCount - ins) * 4 + Math.floor(rng() * 3);
    const recordDate = daysAgoIso(dayOffset);
    const uploadDate = daysAgoIso(dayOffset, 8);
    const inspector = INSPECTORS[Math.floor(rng() * INSPECTORS.length)];

    CHECK_AREAS.forEach((ca, idx) => {
      const total = 18 + Math.floor(rng() * 14);
      const areaPenalty = idx % 4 === 0 ? 0.08 : 0;
      const accShare = Math.min(
        0.99,
        Math.max(0.55, quality - areaPenalty + (rng() - 0.5) * 0.06)
      );
      const acceptable = Math.round(total * accShare);
      let deficiencies = total - acceptable;

      // Acceptable row
      if (acceptable > 0) {
        rows.push({
          id: rid++,
          inspectionId,
          recordDate,
          uploadDate,
          config: FLOORCARE_CONFIG.configurationName,
          configId: FLOORCARE_CONFIG.configId,
          outerTier: seed.outerTier,
          outerTierId: seed.outerTierId,
          midTier: FLOORCARE_CONFIG.midTier,
          midTierId: 1,
          selectTier: FLOORCARE_CONFIG.areaTypeName,
          region: seed.state,
          state: seed.state,
          inspector,
          checkmark: ca.label,
          checkAttribute: "Acceptable",
          isGood: true,
          photo: false,
          count: acceptable,
        });
      }

      // Deficiency rows spread across attributes
      const shuffled = [...DEFICIENCY_ATTRIBUTES].sort(() => rng() - 0.5);
      for (let i = 0; i < shuffled.length && deficiencies > 0; i++) {
        const take =
          i === shuffled.length - 1
            ? deficiencies
            : Math.floor(rng() * (deficiencies / 1.5));
        if (take > 0) {
          rows.push({
            id: rid++,
            inspectionId,
            recordDate,
            uploadDate,
            config: FLOORCARE_CONFIG.configurationName,
            configId: FLOORCARE_CONFIG.configId,
            outerTier: seed.outerTier,
            outerTierId: seed.outerTierId,
            midTier: FLOORCARE_CONFIG.midTier,
            midTierId: 1,
            selectTier: FLOORCARE_CONFIG.areaTypeName,
            region: seed.state,
            state: seed.state,
            inspector,
            checkmark: ca.label,
            checkAttribute: shuffled[i].label,
            isGood: false,
            photo: rng() > 0.55,
            count: take,
          });
          deficiencies -= take;
        }
      }
    });
  }
  return rows;
}

/**
 * Build a runWidgets response for the requested outer tiers. `forTickets`
 * switches between inspection widgets and the ticket widgets, matching how
 * the live API is called (separate calls for inspection vs ticket data).
 */
export function getMockRunWidgets(
  outerTierIds: string[],
  _startDate: string,
  _endDate: string
): SIRunWidgetsResponse {
  const allowed = STORE_SEEDS.filter((s) =>
    outerTierIds.includes(String(s.outerTierId))
  );

  const allRecords: SIRawRecord[] = [];
  let numGood = 0;
  let totalChecks = 0;
  let totalPhotos = 0;
  const inspectionIds = new Set<number | string>();

  allowed.forEach((seed, i) => {
    const rng = mulberry32(seed.outerTierId * 31 + 5);
    const notUploaded = i !== 0 && rng() < 0.12;
    if (notUploaded) return; // no records in range => "Not Uploaded"

    const quality = 0.7 + rng() * 0.32;
    const inspectionCount = 4 + Math.floor(rng() * 6);
    const rows = makeStoreRecords(seed, quality, inspectionCount);
    for (const r of rows) {
      allRecords.push(r);
      totalChecks += r.count;
      if (r.isGood === true) numGood += r.count;
      if (r.photo) totalPhotos += 1;
      inspectionIds.add(r.inspectionId);
    }
  });

  const details: SIInspectionDetails = {
    numGoodChecks: numGood,
    totalChecks,
    totalPhotos,
    numNotes: 0,
    selectTiers: [FLOORCARE_CONFIG.areaTypeName],
    inspectors: [...new Set(allRecords.map((r) => r.inspector))],
    configs: [FLOORCARE_CONFIG.configurationName],
    inspectionIds: [...inspectionIds],
    startDate: _startDate,
    endDate: _endDate,
  };

  const widgets: SIWidgets = {
    "inspection.details": details,
    "inspection.allRecords": allRecords,
    "ticket.getTickets": getMockTickets(outerTierIds),
  };

  return { appliedFilters: {}, success: true, widgets };
}

/* -------------------------------- tickets ------------------------------ */

export function getMockTickets(outerTierIds: string[]): SITicket[] {
  const allowed = STORE_SEEDS.filter((s) =>
    outerTierIds.includes(String(s.outerTierId))
  );
  const tags = getMockListTags();
  const tickets: SITicket[] = [];
  let n = 4800;

  allowed.forEach((s) => {
    const rng = mulberry32(s.outerTierId * 41 + 7);
    const count = Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      n += 1;
      const ca = CHECK_AREAS[Math.floor(rng() * CHECK_AREAS.length)];
      const def = DEFICIENCY_ATTRIBUTES[Math.floor(rng() * DEFICIENCY_ATTRIBUTES.length)];
      const ageDays = 1 + Math.floor(rng() * 20);
      const status = tags.statuses[Math.floor(rng() * tags.statuses.length)];
      const priority = tags.priorities[Math.floor(rng() * tags.priorities.length)];
      tickets.push({
        ticketId: n,
        companyId: FLOORCARE_CONFIG.clientId,
        summary: `${def.label.split("/")[0].trim()} in ${ca.label.split("/")[0].trim()}`,
        location: FLOORCARE_CONFIG.configurationName,
        building: s.outerTier,
        configId: FLOORCARE_CONFIG.configId,
        outerTierId: s.outerTierId,
        item: ca.label,
        deficiency: def.label,
        areatype: FLOORCARE_CONFIG.areaTypeName,
        statusId: status.id,
        priorityId: priority.id,
        categoryId: tags.categories[0].id,
        createdAt: daysAgoIso(ageDays),
        dueBy: daysAgoIso(ageDays - 14),
        status,
        priority,
        category: tags.categories[0],
      });
    }
  });
  return tickets;
}

/* -------------------------------- photos ------------------------------- */

const PHOTO_SEED = [
  "https://images.unsplash.com/photo-1556911220-bff31c812dba",
  "https://images.unsplash.com/photo-1542838132-92c53300491e",
  "https://images.unsplash.com/photo-1604719312566-8912e9227c6a",
  "https://images.unsplash.com/photo-1601599963565-b7f49deb352a",
];

/** Mock photo URL resolver — live photos come from inspection.imageRecords. */
export function mockPhotoUrl(recordId: string): string {
  let h = 0;
  for (let i = 0; i < recordId.length; i++) h = (h * 31 + recordId.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PHOTO_SEED.length;
  return `${PHOTO_SEED[idx]}?auto=format&fit=crop&w=600&q=70`;
}

export { seedById };
