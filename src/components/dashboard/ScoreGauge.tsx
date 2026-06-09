import { useScoreThresholds } from "@/hooks/useScoreThresholds";
import { formatScore } from "@/utils/formatting";

/** Compact circular QSP gauge colored by status threshold. */
export function ScoreGauge({
  score,
  size = 120,
}: {
  score: number | null;
  size?: number;
}) {
  const { getStatusForScore, getStatusColor } = useScoreThresholds();
  const status = getStatusForScore(score);
  const color = getStatusColor(status);
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold text-foreground">
          {formatScore(score)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          QSP
        </span>
      </div>
    </div>
  );
}
