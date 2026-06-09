import { useQuery } from "@tanstack/react-query";
import { getTickets } from "@/api/smartInspectClient";
import { useSession } from "@/context/SessionContext";
import type { StoreMeta } from "@/api/reportingTransforms";

export function useTickets(stores: StoreMeta[]) {
  const { dateRange } = useSession();
  return useQuery({
    queryKey: ["tickets", stores.map((s) => s.buildingId), dateRange],
    queryFn: () => getTickets(stores, dateRange),
    enabled: stores.length > 0,
  });
}
