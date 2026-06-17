import { useQuery } from "@tanstack/react-query";
import { getPortfolioReport } from "@/api/smartInspectClient";
import { useSession } from "@/context/SessionContext";
import { useScoreThresholds } from "@/hooks/useScoreThresholds";
import type { StoreMeta } from "@/api/reportingTransforms";

export function usePortfolioReport(stores: StoreMeta[]) {
  const { dateRange, demoData } = useSession();
  const { thresholds } = useScoreThresholds();

  return useQuery({
    queryKey: [
      "portfolio",
      // configs in the key: the same store under a different config (program)
      // is different data — switching/adding configs must refetch, not hit
      // cache. Capture EVERY config in scope (multi-select), not just the first.
      [...new Set(stores.map((s) => s.configName ?? ""))].sort().join("|"),
      stores.map((s) => s.buildingId),
      dateRange,
      thresholds,
      demoData,
    ],
    queryFn: () => getPortfolioReport(stores, dateRange, thresholds),
    enabled: stores.length > 0,
  });
}
