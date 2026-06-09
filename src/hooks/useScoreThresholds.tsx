import * as React from "react";
import type { ScoreStatus, ScoreThreshold } from "@/types/reporting";
import { DEFAULT_THRESHOLDS } from "@/config/scoreThresholds";
import {
  getThresholdForScore as _getThresholdForScore,
  getStatusForScore as _getStatusForScore,
  isPassingScore as _isPassingScore,
  isWarningScore as _isWarningScore,
  isFailingScore as _isFailingScore,
  getStatusColor as _getStatusColor,
  getStatusLabel as _getStatusLabel,
} from "@/utils/scoreStatus";

/**
 * Threshold provider. Starts from code-defined defaults and can be edited in
 * memory (Score Settings page). Persisting to a DB later means swapping the
 * initial value / setter for a fetch+mutation — consumers don't change.
 */
interface ThresholdContextValue {
  thresholds: ScoreThreshold[];
  setThresholds: (t: ScoreThreshold[]) => void;
  resetThresholds: () => void;
  getThresholdForScore: (score: number | null) => ScoreThreshold;
  getStatusForScore: (score: number | null) => ScoreStatus;
  isPassingScore: (score: number | null) => boolean;
  isWarningScore: (score: number | null) => boolean;
  isFailingScore: (score: number | null) => boolean;
  getStatusColor: (status: ScoreStatus) => string;
  getStatusLabel: (status: ScoreStatus) => string;
}

const ThresholdContext = React.createContext<ThresholdContextValue | null>(null);

export function ScoreThresholdProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [thresholds, setThresholds] =
    React.useState<ScoreThreshold[]>(DEFAULT_THRESHOLDS);

  const value = React.useMemo<ThresholdContextValue>(
    () => ({
      thresholds,
      setThresholds,
      resetThresholds: () => setThresholds(DEFAULT_THRESHOLDS),
      getThresholdForScore: (s) => _getThresholdForScore(s, thresholds),
      getStatusForScore: (s) => _getStatusForScore(s, thresholds),
      isPassingScore: (s) => _isPassingScore(s, thresholds),
      isWarningScore: (s) => _isWarningScore(s, thresholds),
      isFailingScore: (s) => _isFailingScore(s, thresholds),
      getStatusColor: (st) => _getStatusColor(st, thresholds),
      getStatusLabel: (st) => _getStatusLabel(st, thresholds),
    }),
    [thresholds]
  );

  return (
    <ThresholdContext.Provider value={value}>
      {children}
    </ThresholdContext.Provider>
  );
}

export function useScoreThresholds(): ThresholdContextValue {
  const ctx = React.useContext(ThresholdContext);
  if (!ctx)
    throw new Error(
      "useScoreThresholds must be used within <ScoreThresholdProvider>"
    );
  return ctx;
}
