import * as React from "react";
import type { DateRange } from "@/types/reporting";
import type { DemoRole } from "@/api/mockData";
import { DEFAULT_MOCK, setMockMode } from "@/api/smartInspectClient";
import { etTodayISO } from "@/utils/datetime";

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
   * Selected config (inspection program) NAMES scoping all dashboards.
   * Empty array = default to the user's first permitted config. Set from the
   * corporate Filters drawer (multi-select); useSmartInspectPermissions
   * resolves the selection to the union of those configs' stores.
   */
  configFilter: string[];
  setConfigFilter: (names: string[]) => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

/**
 * Legacy sentinel: the pre-multi-select `configFilter` string meaning "every
 * permitted config at once". Kept only so loadConfigFilter() can migrate an
 * old saved value. The model is now an array of selected config names.
 */
const LEGACY_ALL_CONFIGS = "__all_configs__";

const CONFIG_FILTER_KEY = "wegmans-portal.configFilter";

/**
 * Read the persisted selection, tolerating the pre-multi-select format.
 *  - JSON array        -> use as-is (current format)
 *  - "__all_configs__" -> [] (resolves to the default first config; the user
 *                          can re-check All in the Filters drawer)
 *  - any other string  -> [name] (old single-config selection)
 */
function loadConfigFilter(): string[] {
  try {
    const raw = window.localStorage.getItem(CONFIG_FILTER_KEY);
    if (!raw) return [];
    if (raw.startsWith("[")) {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [];
    }
    return raw === LEGACY_ALL_CONFIGS ? [] : [raw];
  } catch {
    return [];
  }
}

function defaultRange(): DateRange {
  // Land on Today. This is a daily upload/compliance check, so the default
  // view answers "who uploaded today, and did they pass?". The quick-pick bar
  // can widen to 7/30/90 days (or a custom range) at any time. Eastern calendar
  // day (see src/utils/datetime.ts), not UTC.
  const today = etTodayISO();
  return { start: today, end: today };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<DemoRole>("boss");
  const [dateRange, setDateRange] = React.useState<DateRange>(defaultRange());
  const [demoData, setDemoDataState] = React.useState<boolean>(DEFAULT_MOCK);
  // Persist the selected configs across reloads. Any saved name that no longer
  // matches a permitted config is ignored by useSmartInspectPermissions (it
  // intersects the selection with live permissions), so a stale value can never
  // widen access.
  const [configFilter, setConfigFilterState] =
    React.useState<string[]>(loadConfigFilter);
  const setConfigFilter = React.useCallback((names: string[]) => {
    try {
      if (names.length)
        window.localStorage.setItem(CONFIG_FILTER_KEY, JSON.stringify(names));
      else window.localStorage.removeItem(CONFIG_FILTER_KEY);
    } catch {
      // storage unavailable (private mode etc.) — selection still works in-session
    }
    setConfigFilterState(names);
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
