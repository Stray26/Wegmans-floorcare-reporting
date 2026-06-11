import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { ScoreStatus } from "@/types/reporting";
import { STATUS_DOT } from "@/config/scoreThresholds";

interface KpiCardProps {
  label: string;
  value: string | number;
  /** ties the accent dot/border to a status color */
  status?: ScoreStatus;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export function KpiCard({
  label,
  value,
  status,
  hint,
  active,
  onClick,
  icon,
}: KpiCardProps) {
  const clickable = !!onClick;
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 transition-all",
        clickable && "cursor-pointer hover:shadow-card-hover",
        active && "ring-2 ring-brand-900 ring-offset-1"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {status && (
            <span
              className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[status])}
            />
          )}
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
