import { cn } from "@/lib/utils";
import { useSession } from "@/context/SessionContext";
import type { DateRange } from "@/types/reporting";

type Preset = { label: string; days: number };

const PRESETS: Preset[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function rangeForDays(days: number): DateRange {
  const end = new Date();
  const start = new Date(end);
  if (days === 0) {
    return { start: iso(end), end: iso(end) };
  }
  start.setDate(start.getDate() - days);
  return { start: iso(start), end: iso(end) };
}

/** Returns the preset matching the current range, or null if it's custom. */
function matchPreset(range: DateRange): string | null {
  if (range.start === range.end) return "Today";
  for (const p of PRESETS) {
    const r = rangeForDays(p.days);
    if (r.start === range.start && r.end === range.end) return p.label;
  }
  return null;
}

/** Compact date-range quick picks bound to the session reporting window. */
export function DateRangePicker({ className }: { className?: string }) {
  const { dateRange, setDateRange } = useSession();
  const active = matchPreset(dateRange);

  const pick = (key: string, days: number) => {
    setDateRange(rangeForDays(days));
    void key;
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5",
        className
      )}
    >
      <button
        onClick={() => pick("Today", 0)}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          active === "Today"
            ? "bg-card text-brand-900 shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Today
      </button>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => pick(p.label, p.days)}
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
      {active === null && (
        <span className="px-2 text-xs text-muted-foreground">Custom</span>
      )}
    </div>
  );
}
