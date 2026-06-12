import { useQuery } from "@tanstack/react-query";
import { getPermissions, permittedStores } from "@/api/smartInspectClient";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import type { StoreMeta } from "@/api/reportingTransforms";

export type AccessMode = "portfolio" | "group" | "store";

/**
 * Smart Inspect permissions are the source of truth for what the user sees:
 *  - multiple stores       -> portfolio dashboard
 *  - a small group (2–5)   -> scaled-down portfolio
 *  - a single store        -> store manager dashboard
 */
export function useSmartInspectPermissions() {
  const { role, demoData } = useSession();
  const { user } = useAuth();

  const query = useQuery({
    // memberId in the key: a different sign-in must never see the previous
    // user's cached permissions. (null in demo mode.)
    queryKey: ["permissions", role, demoData, user?.memberId ?? null],
    queryFn: () => getPermissions(role),
  });

  const stores: StoreMeta[] = query.data ? permittedStores(query.data) : [];
  const accessMode: AccessMode =
    stores.length <= 1 ? "store" : stores.length <= 5 ? "group" : "portfolio";

  const perms = query.data?.permissions;
  const userName = Array.isArray(perms)
    ? (perms[0]?.name ?? "")
    : (perms?.name ?? "");

  return {
    ...query,
    permissions: query.data,
    stores,
    buildingIds: stores.map((s) => s.buildingId),
    accessMode,
    userName,
  };
}
