import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/context/SessionContext";
import { Input } from "@/components/ui/input";
import type { DateRange } from "@/types/reporting";

/**
 * Date quick-picks for a daily inspection program. "day" presets are a single
 * day (Today / Yesterday); "window" presets are a rolling last-N-days range.
 */
type Preset =
  | { label: string; kind: "day"; offset: number }
  | { label: string; kind: "window"; days: number };

const PRESETS: Preset[] = [
  { label: "Today", kind: "day", offset: 0 },
  { label: "Yesterday", kind: "day", offset: 1 },
  { label: "7d", kind: "window", days: 7 },
  { label: "30d", kind: "window", days: 30 },
  { label: "90d", kind: "window", days: 90 },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function dayIso(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return iso(d);
}

function rangeForPreset(p: Preset): DateRange {
  if (p.kind === "day") {
    const day = dayIso(p.offset);
    return { start: day, end: day };
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - p.days);
  return { start: iso(start), end: iso(end) };
}

/** The preset label matching the current range, or null when it's custom. */
function matchPreset(range: DateRange): string | null {
  for (const p of PRESETS) {
    const r = rangeForPreset(p);
    if (r.start === range.start && r.end === range.end) return p.label;
  }
  return null;
}

/**
 * Global date filter: quick presets (Today, Yesterday, 7d, 30d, 90d) plus an
 * always-available custom from/to range. Bound to the session reporting window,
 * so it drives every dashboard from one control in the top bar.
 */
export function DateRangePicker({ className }: { className?: string }) {
  const { dateRange, setDateRange } = useSession();
  const active = matchPreset(dateRange);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setDateRange(rangeForPreset(p))}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active === p.label
                ? "bg-card text-brand-900 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          type="date"
          aria-label="Start date"
          value={dateRange.start}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          className="h-7 w-[130px] border-0 px-1 shadow-none focus-visible:ring-0"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label="End date"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          className="h-7 w-[130px] border-0 px-1 shadow-none focus-visible:ring-0"
        />
        {active === null && (
          <span className="ml-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Custom
          </span>
        )}
      </div>
    </div>
  );
}
