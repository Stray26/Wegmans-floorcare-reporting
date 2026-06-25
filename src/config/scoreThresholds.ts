import type { ScoreThreshold, ScoreStatus } from "@/types/reporting";

/**
 * Default QSP score thresholds. Code-first so the Score Settings page can edit
 * them in memory now, and they can be persisted to a DB (e.g. Supabase) later
 * without changing consumers — everything reads through useScoreThresholds.
 *
 * QSP Score = Acceptable checks / Total checks * 100.
 *  - Meets Standard:    90 – 100   (green)
 *  - Needs Improvement: 80 – 89.99 (yellow)
 *  - Below Standard:     0 – 79.99 (red)
 *  - Not Uploaded:      no inspection in range (gray) — handled separately,
 *    never derived from a numeric score.
 */
export const DEFAULT_THRESHOLDS: ScoreThreshold[] = [
  { status: "passed", label: "Meets Standard", min: 90, max: 100, color: "#16a34a" },
  {
    status: "needs-improvement",
    label: "Needs Improvement",
    min: 80,
    max: 89.99,
    color: "#d97706",
  },
  { status: "failed", label: "Below Standard", min: 0, max: 79.99, color: "#dc2626" },
  {
    status: "not-uploaded",
    label: "Not Uploaded",
    min: NaN,
    max: NaN,
    color: "#6b7280",
  },
];

export const STATUS_BG: Record<ScoreStatus, string> = {
  passed: "bg-status-passed-bg text-status-passed",
  "needs-improvement": "bg-status-warning-bg text-status-warning",
  failed: "bg-status-failed-bg text-status-failed",
  "not-uploaded": "bg-status-notuploaded-bg text-status-notuploaded",
};

export const STATUS_DOT: Record<ScoreStatus, string> = {
  passed: "bg-status-passed",
  "needs-improvement": "bg-status-warning",
  failed: "bg-status-failed",
  "not-uploaded": "bg-status-notuploaded",
};
