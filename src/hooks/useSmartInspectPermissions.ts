import { useQuery } from "@tanstack/react-query";
import {
  getPermissions,
  permittedStores,
  permittedConfigs,
  type PermittedConfig,
} from "@/api/smartInspectClient";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import type { StoreMeta } from "@/api/reportingTransforms";

export type AccessMode = "portfolio" | "group" | "store";

/**
 * Smart Inspect permissions are the source of truth for what the user sees:
 *  - multiple stores       -> portfolio dashboard
 *  - a small group (2–5)   -> scaled-down portfolio
 *  - a single store        -> store manager dashboard
 *
 * Permissions are grouped config -> stores. The session's `configFilter`
 * (corporate Filters drawer) picks the active config; `stores` is scoped to
 * it. Access-mode routing stays based on ALL permitted stores so switching
 * config never flips a corporate user into the store-manager view.
 */
export function useSmartInspectPermissions() {
  const { role, demoData, configFilter } = useSession();
  const { user } = useAuth();

  const query = useQuery({
    // memberId in the key: a different sign-in must never see the previous
    // user's cached permissions. (null in demo mode.)
    queryKey: ["permissions", role, demoData, user?.memberId ?? null],
    queryFn: () => getPermissions(role),
  });

  const configs: PermittedConfig[] = query.data
    ? permittedConfigs(query.data)
    : [];
  const allStores: StoreMeta[] = query.data ? permittedStores(query.data) : [];

  // Active config: the session filter when it matches a permitted config,
  // otherwise the first permitted one (covers stale filters after re-login).
  const activeConfig =
    configs.find((c) => c.configName === configFilter) ?? configs[0] ?? null;
  const stores: StoreMeta[] = activeConfig?.stores ?? allStores;

  const accessMode: AccessMode =
    allStores.length <= 1 ? "store" : allStores.length <= 5 ? "group" : "portfolio";

  const perms = query.data?.permissions;
  const userName = Array.isArray(perms)
    ? (perms[0]?.name ?? "")
    : (perms?.name ?? "");

  return {
    ...query,
    permissions: query.data,
    /** Stores in the ACTIVE config (what dashboards should show). */
    stores,
    /** Every permitted store across all configs (routing/navigation). */
    allStores,
    /** Permitted configs (inspection programs), each with its stores. */
    configs,
    activeConfig,
    buildingIds: stores.map((s) => s.buildingId),
    accessMode,
    userName,
  };
}
