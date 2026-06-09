import * as React from "react";
import type { DateRange } from "@/types/reporting";
import type { DemoRole } from "@/api/mockData";

/**
 * Demo session state.
 *  - role: drives the Boss/Corporate <-> Store Manager demo toggle. In live
 *    mode this is replaced by real Smart Inspect permissions; the toggle is a
 *    research-preview convenience only.
 *  - dateRange: the active reporting window for all data hooks.
 */
interface SessionContextValue {
  role: DemoRole;
  setRole: (r: DemoRole) => void;
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

function defaultRange(): DateRange {
  // Default to the last 90 days so recent pilot inspections are visible
  // out of the box (the date picker can narrow/widen this at any time).
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<DemoRole>("boss");
  const [dateRange, setDateRange] = React.useState<DateRange>(defaultRange());

  const value = React.useMemo(
    () => ({ role, setRole, dateRange, setDateRange }),
    [role, dateRange]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
