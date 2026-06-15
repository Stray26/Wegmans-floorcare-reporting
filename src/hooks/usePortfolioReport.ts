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
      // config in the key: the same store under a different config (program)
      // is different data — switching configs must refetch, not hit cache.
      stores[0]?.configName ?? null,
      stores.map((s) => s.buildingId),
      dateRange,
      thresholds,
      demoData,
    ],
    queryFn: () => getPortfolioReport(stores, dateRange, thresholds),
    enabled: stores.length > 0,
  });
}
