/**
 * Normalized, frontend-friendly reporting types.
 *
 * These are the shapes the UI consumes. Raw Smart Inspect API responses
 * (see ./smartInspect.ts) are converted into these via reportingTransforms.ts,
 * so the UI never depends on the raw API shape and we can swap mock <-> live
 * data without touching components.
 */

export type ScoreStatus =
  | "passed"
  | "needs-improvement"
  | "failed"
  | "not-uploaded";

export interface DateRange {
  /** ISO date (yyyy-mm-dd) */
  start: string;
  /** ISO date (yyyy-mm-dd) */
  end: string;
}

/** A single deficiency type tally (e.g. "Soil", count 12). */
export interface DeficiencyReport {
  deficiencyName: string;
  /** "Soil / Suciedad" */
  bilingualLabel: string;
  count: number;
  /** 0-100, share of deficiencies in its scope */
  percentage: number;
  checkAreaName?: string;
  storeName?: string;
  /** ISO date of most recent occurrence */
  date?: string;
}

/**
 * A granular inspection point within a check area — e.g. "Baseboards",
 * "High Traffic Lane", "Floor, Corners". Smart Inspect added this deeper level
 * under each area in 2026-06; the same point name can recur across areas, so
 * points are always scoped to their area (never merged across areas).
 */
export interface CheckPointReport {
  /** Slug of the point name, unique within its area. */
  pointId: string;
  /** Point name as inspected, e.g. "Baseboards". */
  pointName: string;
  acceptableCount: number;
  deficiencyCount: number;
  totalCount: number;
  qspScore: number;
  status: ScoreStatus;
  /** Most common deficiency attribute on this point, if any. */
  topDeficiency?: string;
}

/** One of the floorcare check areas for a store (Vestibules, Restrooms, …). */
export interface CheckAreaReport {
  checkAreaId: string;
  checkAreaName: string;
  bilingualLabel: string;
  acceptableCount: number;
  deficiencyCount: number;
  totalCount: number;
  qspScore: number;
  status: ScoreStatus;
  topDeficiency?: string;
  deficiencyBreakdown: DeficiencyReport[];
  /**
   * Granular inspection points within this area (the new SI sub-level). Empty
   * for older inspections that recorded only at the area level.
   */
  points: CheckPointReport[];
}

export interface PhotoReport {
  id: string;
  url: string;
  caption?: string;
  checkAreaName?: string;
  /** The granular inspection point (checkmark) the photo documents, e.g. "Baseboards". */
  pointName?: string;
  deficiencyName?: string;
  capturedAt: string;
}

/** A free-text note captured during an inspection (optionally with a photo). */
export interface NoteReport {
  id: string;
  storeName: string;
  /** The note body the inspector typed. */
  noteText: string;
  /** SI note category (often the area/section the note was filed under). */
  noteCategory?: string;
  /** Friendly check-area name when the note maps to one of the 10 areas. */
  checkAreaName?: string;
  inspector?: string;
  /** Direct CDN URL of the note's photo, when one was attached. */
  photoUrl?: string;
  capturedAt: string;
}

export type TicketStatus = "open" | "in-progress" | "closed" | "overdue";

export interface TicketReport {
  ticketId: string;
  storeId: string;
  storeName: string;
  areaName: string;
  deficiency: string;
  status: TicketStatus;
  /** Age in days */
  age: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  photoUrls: string[];
  /** Richer fields surfaced in the ticket detail view. */
  summary?: string;
  description?: string;
  priority?: string;
  category?: string;
  /** ISO due date */
  dueBy?: string;
}

export interface TrendPoint {
  /** ISO date */
  date: string;
  qspScore: number;
}

export interface InspectionHistoryItem {
  id: string;
  date: string;
  inspector: string;
  qspScore: number;
  status: ScoreStatus;
  uploadedAt: string;
}

export interface StoreReport {
  storeId: string;
  storeName: string;
  city: string;
  state: string;
  configurationId: string;
  configurationName: string;
  dateRange: DateRange;
  lastUploadedAt: string | null;
  uploaded: boolean;
  qspScore: number | null;
  status: ScoreStatus;
  inspectionsCompleted: number;
  acceptableCount: number;
  deficiencyCount: number;
  totalCheckCount: number;
  topDeficiency?: string;
  openTicketCount: number;
  checkAreas: CheckAreaReport[];
  deficiencies: DeficiencyReport[];
  photos: PhotoReport[];
  notes: NoteReport[];
  tickets: TicketReport[];
  trend: TrendPoint[];
  history: InspectionHistoryItem[];
}

export interface PortfolioReport {
  totalStores: number;
  storesUploaded: number;
  storesNotUploaded: number;
  storesPassed: number;
  storesNeedsImprovement: number;
  storesFailed: number;
  /** Average QSP across uploaded stores only */
  averageQspScore: number;
  uploadCompliancePercentage: number;
  topDeficiencies: DeficiencyReport[];
  storeReports: StoreReport[];
}

/** Configurable QSP thresholds (code-first, DB-ready later). */
export interface ScoreThreshold {
  status: ScoreStatus;
  label: string;
  min: number;
  max: number;
  /** hex color */
  color: string;
}
