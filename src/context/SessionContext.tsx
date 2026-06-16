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
  /**
   * Selected config (inspection program) NAME scoping all dashboards.
   * null = default to the user's first permitted config. Set from the
   * corporate Filters drawer; useSmartInspectPermissions resolves it.
   */
  configFilter: string | null;
  setConfigFilter: (name: string | null) => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

/**
 * Sentinel `configFilter` value meaning "show every permitted config at once"
 * (the corporate all-stores view). Distinct from null, which means "default to
 * the first permitted config" — so the normal default stays single-config.
 */
export const ALL_CONFIGS = "__all_configs__";

const CONFIG_FILTER_KEY = "wegmans-portal.configFilter";

function defaultRange(): DateRange {
  // Land on Today. This is a daily upload/compliance check, so the default
  // view answers "who uploaded today, and did they pass?". The quick-pick bar
  // can widen to 7/30/90 days (or a custom range) at any time.
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(new Date());
  return { start: today, end: today };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<DemoRole>("boss");
  const [dateRange, setDateRange] = React.useState<DateRange>(defaultRange());
  const [demoData, setDemoDataState] = React.useState<boolean>(DEFAULT_MOCK);
  // Persist the selected config across reloads. If the saved name no longer
  // matches a permitted config, useSmartInspectPermissions falls back to the
  // user's first permitted config — a stale value can never widen access.
  const [configFilter, setConfigFilterState] = React.useState<string | null>(
    () => {
      try {
        return window.localStorage.getItem(CONFIG_FILTER_KEY);
      } catch {
        return null;
      }
    }
  );
  const setConfigFilter = React.useCallback((name: string | null) => {
    try {
      if (name) window.localStorage.setItem(CONFIG_FILTER_KEY, name);
      else window.localStorage.removeItem(CONFIG_FILTER_KEY);
    } catch {
      // storage unavailable (private mode etc.) — selection still works in-session
    }
    setConfigFilterState(name);
  }, []);

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
      configFilter,
      setConfigFilter,
    }),
    [role, dateRange, demoData, setDemoData, configFilter, setConfigFilter]
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
