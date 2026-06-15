import { LogOut, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import type { DemoRole } from "@/api/mockData";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";

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
  const { demoData } = useSession();
  const { userName } = useSmartInspectPermissions();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.displayName || userName || "Demo user";
  const subtitle = user ? (user.roleId || user.email) : demoData ? "Demo data" : "Smart Inspect";

  async function onSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
      <div className="mr-auto flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Data
        </span>
        <DataModeToggle />
        {demoData && <DemoRoleToggle />}
      </div>

      <DateRangePicker />

      <div className="flex items-center gap-2 pl-1">
        <UserCircle2 className="h-7 w-7 text-muted-foreground" />
        <div className="hidden leading-tight sm:block">
          <p className="text-xs font-semibold text-foreground">{displayName}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {/* Show whenever a real session exists — even in Demo mode, so a
            logged-in user can always sign out. */}
        {user && (
          <Button
            variant="ghost"
            size="icon"
            title="Sign out"
            aria-label="Sign out"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </header>
  );
}
