import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  FileBarChart,
  Ticket,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { useAuth } from "@/context/AuthContext";

/**
 * Wegmans wordmark. Renders the brand logo from /wegmans-logo.png (drop the
 * file in /public). Shown on a white chip so it reads on the green sidebar and
 * works whether the file has a transparent or white background. Falls back to a
 * text wordmark if the image isn't present.
 */
function BrandLogo() {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <p className="text-xl font-bold tracking-tight text-white">Wegmans</p>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-white px-3 py-1.5 shadow-sm">
      <img
        src="/wegmans-logo.png"
        alt="Wegmans"
        onError={() => setOk(false)}
        className="h-6 w-auto"
      />
    </span>
  );
}

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.modes || n.modes.includes(accessMode));

  async function onSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 text-white md:flex">
      <div className="px-5 py-5">
        <BrandLogo />
        <p className="mt-1.5 text-[11px] text-white/60">Floorcare Compliance</p>
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

      <div className="border-t border-white/10 px-3 py-3">
        {/* Only when a real SI session exists (demo mode without login has no
            session to end). */}
        {user && (
          <button
            onClick={onSignOut}
            className="mb-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        )}
        <p className="px-3 text-[11px] text-white/50">
          Powered by Smart Inspect
        </p>
      </div>
    </aside>
  );
}
