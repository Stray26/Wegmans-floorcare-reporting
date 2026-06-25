import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  FileBarChart,
  Ticket,
  SlidersHorizontal,
  Mail,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
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
];

/**
 * Admin section. Grouped under an "Admin" heading and shown only to report
 * admins (the email allowlist; see useAuth().user.isAdmin). Score Settings was
 * moved here 2026-06-16 (previously visible to all portfolio/group users). Both
 * routes are also guarded by RequireAdmin in App.tsx, so hiding the nav link is
 * not the only gate.
 */
const ADMIN_NAV: NavItem[] = [
  {
    to: "/settings/scores",
    label: "Score Settings",
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
  {
    to: "/settings/reports",
    label: "Report Emails",
    icon: <Mail className="h-4 w-4" />,
  },
];

/** Shared NavLink class for sidebar links (active vs. idle; collapsed centers). */
const navLinkClass =
  (collapsed: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
      collapsed ? "justify-center px-2" : "px-3",
      isActive
        ? "bg-white/10 text-white"
        : "text-white/70 hover:bg-white/5 hover:text-white"
    );

export function Sidebar() {
  const { accessMode } = useSmartInspectPermissions();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.modes || n.modes.includes(accessMode));
  const adminItems = user?.isAdmin ? ADMIN_NAV : [];

  // Collapsed state persists across navigation + sessions (desktop only; the
  // sidebar is hidden on mobile). The flex layout reflows automatically.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("wegmans:sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("wegmans:sidebarCollapsed", next ? "1" : "0");
      } catch {
        /* ignore (private mode, etc.) */
      }
      return next;
    });

  async function onSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-brand-900 text-white transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center py-5",
          collapsed ? "flex-col gap-3 px-2" : "justify-between px-5"
        )}
      >
        {!collapsed && (
          <div>
            <BrandLogo />
            <p className="mt-1.5 text-[11px] text-white/60">Floorcare Compliance</p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className={cn("flex-1 space-y-1 py-2", collapsed ? "px-2" : "px-3")}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={navLinkClass(collapsed)}
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && item.label}
          </NavLink>
        ))}

        {adminItems.length > 0 && (
          <>
            {collapsed ? (
              <div className="my-2 border-t border-white/10" />
            ) : (
              <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Admin
              </p>
            )}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navLinkClass(collapsed)}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className={cn("border-t border-white/10 py-3", collapsed ? "px-2" : "px-3")}>
        {/* Only when a real SI session exists (demo mode without login has no
            session to end). */}
        {user && (
          <button
            onClick={onSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "mb-2 flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center px-2" : "px-3"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign out"}
          </button>
        )}
        {!collapsed && (
          <p className="px-3 text-[11px] text-white/50">Powered by Smart Inspect</p>
        )}
      </div>
    </aside>
  );
}
