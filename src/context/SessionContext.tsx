import * as React from "react";
import type { DateRange } from "@/types/reporting";
import type { DemoRole } from "@/api/mockData";
import { DEFAULT_MOCK, setMockMode } from "@/api/smartInspectClient";

/**
 * Demo session state.
 *  - role: drives the Corporate/Region/Store Manager demo toggle. Only takes
 *    effect in demo-data mode; live mode uses real Smart Inspect permissions.
 *  - dateRange: the active reporting window for all data hooks.
 *  - demoData: when true, the app runs on the mock Wegmans portfolio instead of
 *    live Smart Inspect data. Kept in sync with the client's runtime mock flag.
 */
interface SessionContextValue {
  role: DemoRole;
  setRole: (r: DemoRole) => void;
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
  demoData: boolean;
  setDemoData: (v: boolean) => void;
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
  const [demoData, setDemoDataState] = React.useState<boolean>(DEFAULT_MOCK);

  // Keep the client's runtime mock flag in sync with the toggle.
  React.useEffect(() => {
    setMockMode(demoData);
  }, [demoData]);

  const value = React.useMemo(
    () => ({
      role,
      setRole,
      dateRange,
      setDateRange,
      demoData,
      setDemoData: setDemoDataState,
    }),
    [role, dateRange, demoData]
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
