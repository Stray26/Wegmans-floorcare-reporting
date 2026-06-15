/**
 * Transform functions: normalized Smart Inspect records/tickets -> reporting
 * objects the UI consumes. This is the ONLY place that understands the raw
 * record shape, so swapping mock data for live `runWidgets` responses requires
 * no UI changes.
 *
 * Input is SIRecord[] (output of transformApiRecord over inspection.allRecords)
 * grouped by building (= outer tier = store).
 */
import type { SIRecord, SITicket } from "@/types/smartInspect";
import type {
  StoreReport,
  CheckAreaReport,
  DeficiencyReport,
  PortfolioReport,
  TicketReport,
  TicketStatus,
  PhotoReport,
  TrendPoint,
  InspectionHistoryItem,
  ScoreThreshold,
  DateRange,
} from "@/types/reporting";
import {
  englishLabel,
  checkAreaIdForLabel,
  friendlyCheckmark,
} from "@/config/wegmans";
import { computeQspScore, getStatusForScore } from "@/utils/scoreStatus";
import { DEFAULT_THRESHOLDS } from "@/config/scoreThresholds";

/** Parse the city from an outer-tier name like "115 - Tysons Corner". */
function cityFromBuilding(building: string): string {
  const parts = building.split(" - ");
  return parts.length > 1 ? parts.slice(1).join(" - ").trim() : building;
}

function topDeficiencyName(breakdown: DeficiencyReport[]): string | undefined {
  if (breakdown.length === 0) return undefined;
  return [...breakdown].sort((a, b) => b.count - a.count)[0].deficiencyName;
}

/** Build a single check area from the records belonging to one checkmark. */
function buildCheckArea(
  itemLabel: string,
  records: SIRecord[],
  thresholds: ScoreThreshold[]
): CheckAreaReport {
  let total = 0;
  let acceptable = 0;
  const defMap = new Map<string, number>();

  for (const r of records) {
    total += r.checkmarkCount;
    if (r.qspScore === 100) acceptable += r.checkmarkCount;
    else if (r.deficiency && r.deficiency !== "Acceptable") {
      defMap.set(r.deficiency, (defMap.get(r.deficiency) ?? 0) + r.checkmarkCount);
    }
  }

  const friendly = friendlyCheckmark(itemLabel);
  const deficiencyCount = total - acceptable;
  const defTotal = [...defMap.values()].reduce((s, n) => s + n, 0) || 1;
  const breakdown: DeficiencyReport[] = [...defMap.entries()]
    .map(([bilingual, count]) => ({
      deficiencyName: englishLabel(bilingual),
      bilingualLabel: bilingual,
      count,
      percentage: (count / defTotal) * 100,
      checkAreaName: englishLabel(friendly),
    }))
    .sort((a, b) => b.count - a.count);

  const qsp = computeQspScore(acceptable, total);

  return {
    checkAreaId: checkAreaIdForLabel(friendly),
    checkAreaName: englishLabel(friendly),
    bilingualLabel: friendly,
    acceptableCount: acceptable,
    deficiencyCount,
    totalCount: total,
    qspScore: qsp ?? 0,
    status: getStatusForScore(qsp, thresholds),
    topDeficiency: topDeficiencyName(breakdown),
    deficiencyBreakdown: breakdown,
  };
}

function aggregateDeficiencies(
  checkAreas: CheckAreaReport[],
  storeName?: string
): DeficiencyReport[] {
  const map = new Map<string, DeficiencyReport>();
  let total = 0;
  for (const ca of checkAreas) {
    for (const d of ca.deficiencyBreakdown) {
      total += d.count;
      const ex = map.get(d.deficiencyName);
      if (ex) ex.count += d.count;
      else
        map.set(d.deficiencyName, {
          deficiencyName: d.deficiencyName,
          bilingualLabel: d.bilingualLabel,
          count: d.count,
          percentage: 0,
          storeName,
        });
    }
  }
  const list = [...map.values()];
  const denom = total || 1;
  for (const d of list) d.percentage = (d.count / denom) * 100;
  return list.sort((a, b) => b.count - a.count);
}

/** Store identity, so not-uploaded stores (zero records) still render. */
export interface StoreMeta {
  buildingId: string;
  storeName: string;
  city?: string;
  state?: string;
  /** Config (inspection program) this store grant belongs to. */
  configId?: string;
  configName?: string;
}

/**
 * Build a StoreReport from one store's records.
 * @param resolvePhotoUrl optional — returns a URL for a photo-bearing record,
 *   or null to skip. Live photos come from inspection.imageRecords; in mock
 *   mode the client supplies a resolver. Defaults to skipping.
 */
export function transformStoreReport(
  meta: StoreMeta,
  records: SIRecord[],
  tickets: SITicket[],
  dateRange: DateRange,
  configId: string,
  configurationName: string,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS,
  resolvePhotoUrl?: (r: SIRecord) => string | null
): StoreReport {
  const buildingId = meta.buildingId;
  const uploaded = records.length > 0;
  const building = records[0]?.building ?? meta.storeName;
  const state = records[0]?.state ?? records[0]?.region ?? meta.state ?? "";

  // group by checkmark (item)
  const byItem = new Map<string, SIRecord[]>();
  for (const r of records) {
    const arr = byItem.get(r.item);
    if (arr) arr.push(r);
    else byItem.set(r.item, [r]);
  }
  const checkAreas = [...byItem.entries()].map(([item, recs]) =>
    buildCheckArea(item, recs, thresholds)
  );

  const acceptableCount = checkAreas.reduce((s, c) => s + c.acceptableCount, 0);
  const totalCheckCount = checkAreas.reduce((s, c) => s + c.totalCount, 0);
  const deficiencyCount = totalCheckCount - acceptableCount;
  const qspScore = uploaded ? computeQspScore(acceptableCount, totalCheckCount) : null;
  const status = uploaded ? getStatusForScore(qspScore, thresholds) : "not-uploaded";

  const deficiencies = aggregateDeficiencies(checkAreas, building);

  // photos
  const photos: PhotoReport[] = [];
  if (resolvePhotoUrl) {
    for (const r of records) {
      // The resolver returns a URL only for records that actually have a photo
      // (mock: hasPhoto-flagged; live: present in inspection.imageRecords).
      const url = resolvePhotoUrl(r);
      if (!url) continue;
      photos.push({
        id: r.id,
        url,
        caption: englishLabel(r.deficiency),
        checkAreaName: englishLabel(friendlyCheckmark(r.item)),
        deficiencyName: englishLabel(r.deficiency),
        capturedAt: r.inspectionDate,
      });
    }
  }

  // group by inspection for trend + history
  const byInspection = new Map<string, SIRecord[]>();
  for (const r of records) {
    const arr = byInspection.get(r.inspectionId);
    if (arr) arr.push(r);
    else byInspection.set(r.inspectionId, [r]);
  }
  const inspections = [...byInspection.entries()].map(([id, recs]) => {
    let acc = 0;
    let tot = 0;
    for (const r of recs) {
      tot += r.checkmarkCount;
      if (r.qspScore === 100) acc += r.checkmarkCount;
    }
    const score = computeQspScore(acc, tot);
    return {
      id,
      date: recs[0].inspectionDate,
      uploadedAt: recs[0].uploadDate,
      inspector: recs[0].inspector,
      score: score ?? 0,
      status: getStatusForScore(score, thresholds),
    };
  });

  const trend: TrendPoint[] = [...inspections]
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .map((i) => ({ date: i.date, qspScore: i.score }));

  const history: InspectionHistoryItem[] = [...inspections]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map((i) => ({
      id: i.id,
      date: i.date,
      inspector: i.inspector,
      qspScore: i.score,
      status: i.status,
      uploadedAt: i.uploadedAt,
    }));

  const lastUploadedAt = uploaded
    ? records.reduce<string | null>((max, r) => {
        return !max || +new Date(r.uploadDate) > +new Date(max)
          ? r.uploadDate
          : max;
      }, null)
    : null;

  const storeTickets = tickets
    .filter((t) => String(t.outerTierId ?? "") === buildingId || t.building === building)
    .map(transformTicket);

  return {
    storeId: buildingId,
    storeName: building,
    city: meta.city ?? cityFromBuilding(building),
    state,
    configurationId: configId,
    configurationName,
    dateRange,
    lastUploadedAt,
    uploaded,
    qspScore,
    status,
    inspectionsCompleted: byInspection.size,
    acceptableCount,
    deficiencyCount,
    totalCheckCount,
    topDeficiency: deficiencies[0]?.deficiencyName,
    openTicketCount: storeTickets.filter((t) => t.status !== "closed").length,
    checkAreas,
    deficiencies,
    photos,
    tickets: storeTickets,
    trend,
    history,
  };
}

/* -------------------------------- tickets ------------------------------ */

function mapTicketStatus(t: SITicket): TicketStatus {
  const desc = (t.status?.description ?? "").toLowerCase();
  if (t.status?.isFinal || desc.includes("close")) return "closed";
  if (desc.includes("progress")) return "in-progress";
  return "open";
}

function ageInDays(createdAt?: string): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

export function transformTicket(t: SITicket): TicketReport {
  const base = mapTicketStatus(t);
  const age = ageInDays(t.createdAt);
  const overdue =
    base !== "closed" && t.dueBy != null && +new Date(t.dueBy) < Date.now();
  const status: TicketStatus = overdue ? "overdue" : base;
  return {
    ticketId: `WGM-${t.ticketId}`,
    storeId: String(t.outerTierId ?? ""),
    storeName: t.building,
    areaName: englishLabel(t.item ?? ""),
    deficiency: englishLabel(t.deficiency ?? ""),
    status,
    age,
    createdAt: t.createdAt ?? "",
    updatedAt: t.startAt ?? t.createdAt ?? "",
    assignedTo: undefined,
    photoUrls: t.photoUrls ?? [],
    summary: t.summary,
    description: t.description,
    priority: t.priority?.description,
    category: t.category?.description,
    dueBy: t.dueBy,
  };
}

/* ------------------------------ portfolio ------------------------------ */

export function buildPortfolioReport(stores: StoreReport[]): PortfolioReport {
  const uploaded = stores.filter((s) => s.uploaded);
  const notUploaded = stores.filter((s) => !s.uploaded);

  const storesPassed = stores.filter((s) => s.status === "passed").length;
  const storesNeedsImprovement = stores.filter(
    (s) => s.status === "needs-improvement"
  ).length;
  const storesFailed = stores.filter((s) => s.status === "failed").length;

  const avg =
    uploaded.length > 0
      ? uploaded.reduce((s, r) => s + (r.qspScore ?? 0), 0) / uploaded.length
      : 0;

  const map = new Map<string, DeficiencyReport>();
  let total = 0;
  for (const s of uploaded) {
    for (const d of s.deficiencies) {
      total += d.count;
      const ex = map.get(d.deficiencyName);
      if (ex) ex.count += d.count;
      else
        map.set(d.deficiencyName, {
          deficiencyName: d.deficiencyName,
          bilingualLabel: d.bilingualLabel,
          count: d.count,
          percentage: 0,
        });
    }
  }
  const denom = total || 1;
  const topDeficiencies = [...map.values()]
    .map((d) => ({ ...d, percentage: (d.count / denom) * 100 }))
    .sort((a, b) => b.count - a.count);

  return {
    totalStores: stores.length,
    storesUploaded: uploaded.length,
    storesNotUploaded: notUploaded.length,
    storesPassed,
    storesNeedsImprovement,
    storesFailed,
    averageQspScore: avg,
    uploadCompliancePercentage:
      stores.length > 0 ? (uploaded.length / stores.length) * 100 : 0,
    topDeficiencies,
    storeReports: stores,
  };
}
