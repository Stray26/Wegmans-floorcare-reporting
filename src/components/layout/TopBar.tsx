import { CalendarDays, UserCircle2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import type { DemoRole } from "@/api/mockData";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const ROLE_LABELS: Record<DemoRole, string> = {
  boss: "Corporate",
  group: "Region",
  manager: "Store Manager",
};

/** Demo-only role switch. Only meaningful in demo-data mode. */
function DemoRoleToggle() {
  const { role, setRole } = useSession();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-0.5">
      {(Object.keys(ROLE_LABELS) as DemoRole[]).map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            role === r
              ? "bg-card text-brand-900 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

/** Switch between live Smart Inspect data and the mock Wegmans demo portfolio. */
function DataModeToggle() {
  const { demoData, setDemoData } = useSession();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-0.5">
      <button
        onClick={() => setDemoData(false)}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          !demoData
            ? "bg-card text-brand-900 shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Live
      </button>
      <button
        onClick={() => setDemoData(true)}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          demoData
            ? "bg-card text-brand-900 shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Demo
      </button>
    </div>
  );
}

export function TopBar() {
  const { dateRange, setDateRange, demoData } = useSession();
  const { userName } = useSmartInspectPermissions();

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
      <div className="mr-auto flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Data
        </span>
        <DataModeToggle />
        {demoData && <DemoRoleToggle />}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={dateRange.start}
          onChange={(e) =>
            setDateRange({ ...dateRange, start: e.target.value })
          }
          className="h-7 w-[130px] border-0 px-1 shadow-none focus-visible:ring-0"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          className="h-7 w-[130px] border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="flex items-center gap-2 pl-1">
        <UserCircle2 className="h-7 w-7 text-muted-foreground" />
        <div className="hidden leading-tight sm:block">
          <p className="text-xs font-semibold text-foreground">{userName}</p>
          <p className="text-[11px] text-muted-foreground">Smart Inspect</p>
        </div>
      </div>
    </header>
  );
}
