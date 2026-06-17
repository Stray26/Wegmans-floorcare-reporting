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
 * What dashboard the user sees is driven by their Smart Inspect ROLE
 * (changed 2026-06-16 — was store-count based):
 *  - Account role          -> portfolio overview (corporate)
 *  - Operator / Supervisor -> store manager dashboard (multi-store users switch
 *                             stores via the in-header store switcher)
 * Demo mode has no live role, so it falls back to store-count so the mock
 * portfolio stays reachable under `npm run dev`.
 *
 * Permissions are still grouped config -> stores; the session's `configFilter`
 * (corporate Filters drawer, multi-select) picks one or more active configs and
 * `stores` is the union of those configs' stores. The store data a user can
 * fetch is always validated against their SI permissions server-side, so this
 * role gate is routing/UX, not the security boundary.
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

  // Resolve the session's selected config NAMES against live permissions,
  // dropping any stale name (a selection can never widen access). An empty
  // selection defaults to the first permitted config, so dashboards still land
  // on a single program by default.
  const chosenConfigs = configs.filter((c) =>
    configFilter.includes(c.configName)
  );
  const selectedConfigs: PermittedConfig[] = chosenConfigs.length
    ? chosenConfigs
    : configs[0]
      ? [configs[0]]
      : [];

  // More than one program in scope -> the corporate multi-config view (drives
  // the Config column). "All configs" is the special case where every permitted
  // config is selected (drives the label only).
  const isMultiConfig = selectedConfigs.length > 1;
  const isAllConfigs =
    isMultiConfig && selectedConfigs.length === configs.length;

  // Back-compat: the single active config, or null when multiple are selected
  // (no single active program).
  const activeConfig = selectedConfigs.length === 1 ? selectedConfigs[0] : null;

  // Stores the dashboards show: the union of every SELECTED config's stores.
  // Each StoreMeta keeps its own configId/name, so the same physical store can
  // appear once per config it belongs to (in production each store lives in a
  // single config, so that's naturally one row per store).
  const stores: StoreMeta[] = selectedConfigs.length
    ? selectedConfigs.flatMap((c) => c.stores)
    : allStores;

  // Human label for the active scope (page headers, export titles).
  const configLabel = isAllConfigs
    ? "All Configs"
    : isMultiConfig
      ? `${selectedConfigs.length} Configs`
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
    /** Names of the configs currently in scope (the resolved selection). */
    selectedConfigNames: selectedConfigs.map((c) => c.configName),
    /** True when more than one config is in scope (corporate multi-config view). */
    isMultiConfig,
    /** True when every permitted config is selected ("All Configs"). */
    isAllConfigs,
    /** Display label for the active scope ("All Configs" or the config name). */
    configLabel,
    buildingIds: stores.map((s) => s.buildingId),
    accessMode,
    userName,
  };
}
