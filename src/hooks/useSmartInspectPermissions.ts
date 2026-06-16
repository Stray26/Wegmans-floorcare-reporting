import { useQuery } from "@tanstack/react-query";
import {
  getPermissions,
  permittedStores,
  permittedConfigs,
  type PermittedConfig,
} from "@/api/smartInspectClient";
import { useSession, ALL_CONFIGS } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import type { StoreMeta } from "@/api/reportingTransforms";

export type AccessMode = "portfolio" | "group" | "store";

/**
 * What dashboard the user sees is driven by their Smart Inspect ROLE
 * (changed 2026-06-16 — was store-count based):
 *  - Account role          -> portfolio overview (corporate)
 *  - Operator / Supervisor -> store manager dashboard (multi-store users switch
 *                             stores via the in-header store switcher)
 * Demo mode has no live role, so it falls back to store-count so the mock
 * portfolio stays reachable under `npm run dev`.
 *
 * Permissions are still grouped config -> stores; the session's `configFilter`
 * (corporate Filters drawer) picks the active config and `stores` is scoped to
 * it. The store data a user can fetch is always validated against their SI
 * permissions server-side, so this role gate is routing/UX, not the security boundary.
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

  // "All configs" is the corporate all-stores view spanning every program.
  const isAllConfigs = configFilter === ALL_CONFIGS && configs.length > 0;

  // Active config: the session filter when it matches a permitted config,
  // otherwise the first permitted one (covers stale filters after re-login).
  // null when "All configs" is selected (no single active program).
  const activeConfig = isAllConfigs
    ? null
    : (configs.find((c) => c.configName === configFilter) ?? configs[0] ?? null);

  // Stores the dashboards show. For "All configs" it's the union of every
  // config's stores — each StoreMeta keeps its own configId/name, so the same
  // physical store can appear once per config it belongs to (in production each
  // store lives in a single config, so that's naturally one row per store).
  const stores: StoreMeta[] = isAllConfigs
    ? configs.flatMap((c) => c.stores)
    : (activeConfig?.stores ?? allStores);

  // Human label for the active scope (page headers, export titles).
  const configLabel = isAllConfigs
    ? "All Configs"
    : (activeConfig?.configName ?? "");

  // Role-based: Account -> portfolio, everyone else -> store manager. In demo
  // mode there's no live SI role, so fall back to store-count (keeps the mock
  // corporate portfolio reachable under `npm run dev`).
  const isAccountRole = (user?.roleId ?? "").toLowerCase() === "account";
  const accessMode: AccessMode = demoData
    ? allStores.length <= 1
      ? "store"
      : allStores.length <= 5
        ? "group"
        : "portfolio"
    : isAccountRole
      ? "portfolio"
      : "store";

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
    /** True when the "All configs" (all-stores) scope is selected. */
    isAllConfigs,
    /** Display label for the active scope ("All Configs" or the config name). */
    configLabel,
    buildingIds: stores.map((s) => s.buildingId),
    accessMode,
    userName,
  };
}
