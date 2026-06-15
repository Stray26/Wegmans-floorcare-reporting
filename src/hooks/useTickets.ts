import { useQuery } from "@tanstack/react-query";
import { getTickets } from "@/api/smartInspectClient";
import { useSession } from "@/context/SessionContext";
import type { StoreMeta } from "@/api/reportingTransforms";

export function useTickets(stores: StoreMeta[]) {
  const { dateRange, demoData } = useSession();
  return useQuery({
    queryKey: [
      "tickets",
      stores[0]?.configName ?? null,
      stores.map((s) => s.buildingId),
      dateRange,
      demoData,
    ],
    queryFn: () => getTickets(stores, dateRange),
    enabled: stores.length > 0,
  });
}
