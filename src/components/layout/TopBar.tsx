import { LogOut, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";

export function TopBar() {
  const { userName } = useSmartInspectPermissions();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.displayName || userName || "User";
  const subtitle = user?.roleId || user?.email || "Smart Inspect";

  async function onSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
      <DateRangePicker className="mr-auto" />

      <div className="flex items-center gap-2 pl-1">
        <UserCircle2 className="h-7 w-7 text-muted-foreground" />
        <div className="hidden leading-tight sm:block">
          <p className="text-xs font-semibold text-foreground">{displayName}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
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
