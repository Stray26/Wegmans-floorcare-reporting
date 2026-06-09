import type { ScoreStatus, ScoreThreshold } from "@/types/reporting";
import { DEFAULT_THRESHOLDS } from "@/config/scoreThresholds";

/**
 * Pure scoring helpers. Threshold-driven so the same logic powers the
 * useScoreThresholds hook and any non-React caller (transforms, exports).
 */

export function computeQspScore(
  acceptableCount: number,
  totalCount: number
): number | null {
  if (totalCount <= 0) return null;
  return (acceptableCount / totalCount) * 100;
}

export function getThresholdForScore(
  score: number | null,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS
): ScoreThreshold {
  const notUploaded = thresholds.find((t) => t.status === "not-uploaded")!;
  if (score === null || Number.isNaN(score)) return notUploaded;
  const scored = thresholds.filter((t) => t.status !== "not-uploaded");
  const match = scored.find((t) => score >= t.min && score <= t.max);
  // Scores at/above the passed.max fall into passed; below failed.min into failed.
  return match ?? scored.reduce((a, b) => (a.min < b.min ? a : b));
}

export function getStatusForScore(
  score: number | null,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS
): ScoreStatus {
  return getThresholdForScore(score, thresholds).status;
}

export function isPassingScore(
  score: number | null,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS
): boolean {
  return getStatusForScore(score, thresholds) === "passed";
}

export function isWarningScore(
  score: number | null,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS
): boolean {
  return getStatusForScore(score, thresholds) === "needs-improvement";
}

export function isFailingScore(
  score: number | null,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS
): boolean {
  return getStatusForScore(score, thresholds) === "failed";
}

export function getStatusColor(
  status: ScoreStatus,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS
): string {
  return thresholds.find((t) => t.status === status)?.color ?? "#6b7280";
}

export function getStatusLabel(
  status: ScoreStatus,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS
): string {
  return thresholds.find((t) => t.status === status)?.label ?? "Unknown";
}
