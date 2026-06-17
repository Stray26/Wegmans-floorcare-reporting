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
  SIInspectionNote,
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

/** The three live pilot stores — always populated in the demo (incl. today). */
const PILOT_IDS = new Set(PILOT_STORES.map((s) => s.outerTierId));

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

/* ------------------------------ demo configs ---------------------------- */
/**
 * A second demo config (inspection program) so the corporate Config -> Store
 * filter cascade is demonstrable in Demo mode. Live currently has only the
 * Floorcare pilot; SI permissions group stores under configs exactly like this.
 */
const SANITATION_CONFIG = {
  configId: 20036,
  configurationName: "Wegmans Sanitation Pilot",
};

/** Every 3rd store participates in the sanitation pilot (~33 stores). */
const SANITATION_STORE_IDS = new Set(
  STORE_SEEDS.filter((_, i) => i % 3 === 0).map((s) => s.outerTierId)
);

interface MockConfig {
  configId: number;
  configurationName: string;
}

function mockConfigByName(name?: string): MockConfig {
  if (name === SANITATION_CONFIG.configurationName) return SANITATION_CONFIG;
  return {
    configId: FLOORCARE_CONFIG.configId,
    configurationName: FLOORCARE_CONFIG.configurationName,
  };
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
        // Corporate also sees the second demo program, with its store subset,
        // so the Config -> Store filter cascade is exercisable in Demo mode.
        ...(role === "boss"
          ? [
              {
                configId: SANITATION_CONFIG.configId,
                configName: SANITATION_CONFIG.configurationName,
                permissionOuterTiers: stores
                  .filter((s) => SANITATION_STORE_IDS.has(s.outerTierId))
                  .map((s) => ({
                    id: s.outerTierId,
                    name: s.outerTier,
                    outerTierId: s.outerTierId,
                  })),
              },
            ]
          : []),
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
  // Anchored to the real "now" so the demo portfolio is always current and the
  // Today / Yesterday quick-picks land on real, populated days.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, Math.floor((days * 7) % 60), 0, 0);
  return d.toISOString();
}

/**
 * QSP scoring model for the demo portfolio.
 *
 * Wegmans inspects 10 check areas per visit. We model each area as a single
 * pass/fail check (count = 1), so an inspection's QSP = (acceptable areas / 10)
 * x 100 is always a whole ten. With a fixed 10 inspections per store, the
 * per-store and per-check-area aggregates also land on whole tens. Scores are
 * floored at 60 (no store / inspection / check-area score ever shows < 60).
 */
const INSPECTIONS_PER_STORE = 10;
const MIN_ACCEPTABLE = 6; // 6/10 -> 60, the floor
const MAX_ACCEPTABLE = 10; // 10/10 -> 100

/** Deterministic store QSP target (whole ten, 60-100) with a believable mix. */
function pickTargetScore(rng: () => number): number {
  const r = rng();
  if (r < 0.05) return 60; // failed
  if (r < 0.12) return 70; // failed
  if (r < 0.35) return 80; // needs improvement
  if (r < 0.68) return 90; // passed
  return 100; // passed
}

/** Vary a margin vector with canceling +1/-1 swaps; preserves sum and [6,10]. */
function perturbMargins(margin: number[], rng: () => number): void {
  for (let s = 0; s < 8; s++) {
    const i = Math.floor(rng() * margin.length);
    const j = Math.floor(rng() * margin.length);
    if (i !== j && margin[i] < MAX_ACCEPTABLE && margin[j] > MIN_ACCEPTABLE) {
      margin[i] += 1;
      margin[j] -= 1;
    }
  }
}

/**
 * Gale-Ryser greedy realization of a 0/1 matrix with the given row and column
 * sums: assign each row's acceptables to the columns with the most remaining
 * capacity. Returns null if the requested margins aren't realizable.
 */
function realizeMatrix(
  rowSums: number[],
  colSums: number[]
): boolean[][] | null {
  const matrix = rowSums.map(() =>
    new Array<boolean>(colSums.length).fill(false)
  );
  const colRem = colSums.map((rem, i) => ({ i, rem }));
  const rowOrder = rowSums.map((v, k) => ({ k, v })).sort((a, b) => b.v - a.v);
  for (const { k, v } of rowOrder) {
    colRem.sort((a, b) => b.rem - a.rem || a.i - b.i);
    if (v > colRem.length) return null;
    for (let t = 0; t < v; t++) {
      if (colRem[t].rem <= 0) return null;
      matrix[k][colRem[t].i] = true;
      colRem[t].rem -= 1;
    }
  }
  return colRem.every((c) => c.rem === 0) ? matrix : null;
}

/**
 * Build the [area][inspection] acceptable matrix for one store. Row sums =
 * per-area pass counts, column sums = per-inspection pass counts; both, and the
 * grand total, are tuned so every derived QSP score is a whole ten in [60,100].
 * Falls back to the uniform matrix (flat at the target) if a perturbed pair of
 * margins isn't realizable.
 */
function buildAcceptableMatrix(rng: () => number, target: number): boolean[][] {
  const base = target / 10; // 6..10
  const rows = new Array(CHECK_AREAS.length).fill(base);
  const cols = new Array(INSPECTIONS_PER_STORE).fill(base);
  perturbMargins(rows, rng);
  perturbMargins(cols, rng);
  return (
    realizeMatrix(rows, cols) ??
    realizeMatrix(
      new Array(CHECK_AREAS.length).fill(base),
      new Array(INSPECTIONS_PER_STORE).fill(base)
    )!
  );
}

/**
 * Generate raw allRecords rows for one store: one row per (check area,
 * inspection) - Acceptable when the matrix passes, otherwise a single
 * deficiency attribute. `count` is always 1 so every QSP stays on a clean ten.
 * The store produces different (deterministic) results under different programs.
 */
function makeStoreRecords(
  seed: StoreSeed,
  target: number,
  config: MockConfig,
  startOffset: number
): SIRawRecord[] {
  const rng = mulberry32(seed.outerTierId * 977 + 13 + (config.configId % 977));
  const matrix = buildAcceptableMatrix(rng, target);
  const rows: SIRawRecord[] = [];
  let rid = seed.outerTierId * 100000;

  for (let ins = 0; ins < INSPECTIONS_PER_STORE; ins++) {
    const inspectionId = seed.outerTierId * 1000 + ins;
    // Daily cadence: the newest inspection lands `startOffset` days ago, older
    // ones step back a day each. startOffset 0 => this store inspected today.
    const dayOffset = startOffset + (INSPECTIONS_PER_STORE - 1 - ins);
    const recordDate = daysAgoIso(dayOffset);
    const uploadDate = daysAgoIso(dayOffset, 8);
    const inspector = INSPECTORS[Math.floor(rng() * INSPECTORS.length)];

    CHECK_AREAS.forEach((ca, areaIdx) => {
      const base = {
        id: rid++,
        inspectionId,
        recordDate,
        uploadDate,
        config: config.configurationName,
        configId: config.configId,
        outerTier: seed.outerTier,
        outerTierId: seed.outerTierId,
        midTier: FLOORCARE_CONFIG.midTier,
        midTierId: 1,
        selectTier: FLOORCARE_CONFIG.areaTypeName,
        region: seed.state,
        state: seed.state,
        inspector,
        checkmark: ca.label,
        count: 1,
      };

      if (matrix[areaIdx][ins]) {
        rows.push({
          ...base,
          checkAttribute: "Acceptable",
          isGood: true,
          photo: false,
        });
      } else {
        const def =
          DEFICIENCY_ATTRIBUTES[Math.floor(rng() * DEFICIENCY_ATTRIBUTES.length)];
        rows.push({
          ...base,
          checkAttribute: def.label,
          isGood: false,
          photo: rng() > 0.55,
        });
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
  startDate: string,
  endDate: string,
  configName?: string
): SIRunWidgetsResponse {
  const config = mockConfigByName(configName);
  const allowed = STORE_SEEDS.filter((s) =>
    outerTierIds.includes(String(s.outerTierId))
  );
  // Honor the selected reporting window: a record counts when its day falls
  // within [startDate, endDate]. With Today as the default, this is what makes
  // the board show "uploaded today" vs. "Not Uploaded" (no records in range).
  const startDay = startDate.slice(0, 10);
  const endDay = endDate.slice(0, 10);

  const allRecords: SIRawRecord[] = [];
  let numGood = 0;
  let totalChecks = 0;
  let totalPhotos = 0;
  const inspectionIds = new Set<number | string>();

  allowed.forEach((seed) => {
    const rng = mulberry32(seed.outerTierId * 31 + 5 + (config.configId % 31));
    const isPilot = PILOT_IDS.has(seed.outerTierId);
    // A slice of non-pilot stores have no inspections at all in the demo.
    // Keyed off the store (not request order) so the portfolio and the
    // single-store view agree on whether a store has data.
    const neverUploaded = !isPilot && rng() < 0.12;
    if (neverUploaded) return;

    const target = pickTargetScore(rng);
    // Where this store's most recent inspection lands. Pilot stores always
    // have one today so key demo stores are never empty; the rest are a
    // believable mix of uploaded-today vs. a few days behind (=> Not Uploaded
    // for the Today view).
    const uploadedToday = isPilot || rng() < 0.6;
    const startOffset = uploadedToday ? 0 : 1 + Math.floor(rng() * 3);
    const rows = makeStoreRecords(seed, target, config, startOffset);
    for (const r of rows) {
      const day = r.recordDate.slice(0, 10);
      if (day < startDay || day > endDay) continue; // outside the window
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
    configs: [config.configurationName],
    inspectionIds: [...inspectionIds],
    startDate,
    endDate,
  };

  const widgets: SIWidgets = {
    "inspection.details": details,
    "inspection.allRecords": allRecords,
    "ticket.getTickets": getMockTickets(outerTierIds, configName),
  };

  return { appliedFilters: {}, success: true, widgets };
}

/* -------------------------------- tickets ------------------------------ */

export function getMockTickets(
  outerTierIds: string[],
  configName?: string
): SITicket[] {
  const config = mockConfigByName(configName);
  const allowed = STORE_SEEDS.filter((s) =>
    outerTierIds.includes(String(s.outerTierId))
  );
  const tags = getMockListTags();
  const tickets: SITicket[] = [];
  let n = 4800;

  allowed.forEach((s) => {
    const rng = mulberry32(s.outerTierId * 41 + 7 + (config.configId % 41));
    const count = Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      n += 1;
      const ca = CHECK_AREAS[Math.floor(rng() * CHECK_AREAS.length)];
      const def = DEFICIENCY_ATTRIBUTES[Math.floor(rng() * DEFICIENCY_ATTRIBUTES.length)];
      const ageDays = 1 + Math.floor(rng() * 20);
      const status = tags.statuses[Math.floor(rng() * tags.statuses.length)];
      const priority = tags.priorities[Math.floor(rng() * tags.priorities.length)];
      const defName = def.label.split("/")[0].trim();
      const areaName = ca.label.split("/")[0].trim();
      const photoCount = 1 + Math.floor(rng() * 3); // 1-3 photos per ticket
      tickets.push({
        ticketId: n,
        companyId: FLOORCARE_CONFIG.clientId,
        summary: `${defName} in ${areaName}`,
        description: `${defName} observed in ${areaName} at ${s.outerTier} during the daily floor care inspection. Assign and resolve.`,
        location: config.configurationName,
        building: s.outerTier,
        configId: config.configId,
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
        photoUrls: Array.from({ length: photoCount }, (_, k) =>
          mockPhotoUrl(`ticket-${n}-${k}`)
        ),
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

/* --------------------------------- notes ------------------------------- */

const NOTE_TEXTS = [
  "Heavy scuff marks near the vestibule; recommend re-burnishing this week.",
  "Grout discoloration in the cafe seating area — schedule a deep scrub.",
  "Standing water by the produce cooler creating a slip risk.",
  "Baseboards need detail cleaning along the primary sales aisle.",
  "Auto-scrubber left residue streaks; pad change and re-run needed.",
  "Entry mats saturated after rain; swap for dry mats.",
];

/**
 * Mock inspection notes (the noteRecords side of inspection.imageRecords).
 * Deterministic per store; most carry a photo. Mirrors the live SIInspectionNote
 * shape so the notes section renders in demo exactly as it will with real data.
 */
export function getMockNotes(
  outerTierIds: string[],
  startDate: string,
  endDate: string,
  configName?: string
): SIInspectionNote[] {
  const config = mockConfigByName(configName);
  const startDay = startDate.slice(0, 10);
  const endDay = endDate.slice(0, 10);
  const allowed = STORE_SEEDS.filter((s) =>
    outerTierIds.includes(String(s.outerTierId))
  );
  const notes: SIInspectionNote[] = [];
  allowed.forEach((seed) => {
    const rng = mulberry32(seed.outerTierId * 53 + 7 + (config.configId % 53));
    const isPilot = PILOT_IDS.has(seed.outerTierId);
    const dayOffset = isPilot ? 0 : 1 + Math.floor(rng() * 3);
    const day = daysAgoIso(dayOffset).slice(0, 10);
    if (day < startDay || day > endDay) return; // outside the window
    const count = 1 + Math.floor(rng() * 3); // 1-3 notes per store
    for (let i = 0; i < count; i++) {
      const ca = CHECK_AREAS[Math.floor(rng() * CHECK_AREAS.length)];
      const id = seed.outerTierId * 1000 + 900 + i;
      notes.push({
        id,
        inspectionId: seed.outerTierId * 1000,
        noteCategory: ca.label,
        noteText: NOTE_TEXTS[Math.floor(rng() * NOTE_TEXTS.length)],
        inspector: INSPECTORS[Math.floor(rng() * INSPECTORS.length)],
        recordDate: daysAgoIso(dayOffset),
        uploadDate: daysAgoIso(dayOffset, 8),
        config: config.configurationName,
        outerTier: seed.outerTier,
        outerTierId: seed.outerTierId,
        url: rng() > 0.4 ? mockPhotoUrl(`note-${id}`) : undefined,
      });
    }
  });
  return notes;
}

export { seedById };
