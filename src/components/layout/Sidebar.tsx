import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  FileBarChart,
  Ticket,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** show only for these access modes */
  modes?: ("portfolio" | "group" | "store")[];
}

const NAV: NavItem[] = [
  {
    to: "/portfolio",
    label: "Portfolio Overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
    modes: ["portfolio", "group"],
  },
  {
    // Single-store users land here ("My Store"); multi-store users use it as a
    // per-store dashboard via the store switcher in the header.
    to: "/my-store",
    label: "Store View",
    icon: <Store className="h-4 w-4" />,
  },
  {
    to: "/report",
    label: "Custom Detail Report",
    icon: <FileBarChart className="h-4 w-4" />,
  },
  { to: "/tickets", label: "Tickets", icon: <Ticket className="h-4 w-4" /> },
  {
    to: "/settings/scores",
    label: "Score Settings",
    icon: <SlidersHorizontal className="h-4 w-4" />,
    modes: ["portfolio", "group"],
  },
];

export function Sidebar() {
  const { accessMode } = useSmartInspectPermissions();
  const items = NAV.filter((n) => !n.modes || n.modes.includes(accessMode));

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 text-white md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <ShieldCheck className="h-5 w-5 text-status-passed" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Wegmans</p>
          <p className="text-[11px] text-white/60">Floorcare Compliance</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] text-white/50">
          Powered by Smart Inspect
        </p>
      </div>
    </aside>
  );
}
