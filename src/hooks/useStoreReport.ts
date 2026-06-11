import { useQuery } from "@tanstack/react-query";
import { getStoreReport } from "@/api/smartInspectClient";
import { useSession } from "@/context/SessionContext";
import { useScoreThresholds } from "@/hooks/useScoreThresholds";
import type { StoreMeta } from "@/api/reportingTransforms";

export function useStoreReport(store: StoreMeta | null) {
  const { dateRange, demoData } = useSession();
  const { thresholds } = useScoreThresholds();

  return useQuery({
    queryKey: ["store", store?.buildingId, dateRange, thresholds, demoData],
    queryFn: () => getStoreReport(store as StoreMeta, dateRange, thresholds),
    enabled: !!store,
  });
}
