import { cn } from "@/lib/utils";
import type { ScoreStatus } from "@/types/reporting";
import { STATUS_BG, STATUS_DOT } from "@/config/scoreThresholds";
import { getStatusLabel } from "@/utils/scoreStatus";

export function StatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: ScoreStatus;
  className?: string;
  showDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_BG[status],
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      )}
      {getStatusLabel(status)}
    </span>
  );
}
