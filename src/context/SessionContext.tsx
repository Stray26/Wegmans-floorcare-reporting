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

  // Flip the client's runtime mock flag SYNCHRONOUSLY before the state update
  // re-renders consumers. If we did this in an effect, the permissions query
  // (a descendant) would refetch before the provider's effect ran, so it would
  // read the old data source — yielding live permissions with mock data (or
  // vice-versa). Setting it here guarantees isMockMode() is correct before any
  // query refetches.
  const setDemoData = React.useCallback((v: boolean) => {
    setMockMode(v);
    setDemoDataState(v);
  }, []);

  const value = React.useMemo(
    () => ({
      role,
      setRole,
      dateRange,
      setDateRange,
      demoData,
      setDemoData,
    }),
    [role, dateRange, demoData, setDemoData]
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
