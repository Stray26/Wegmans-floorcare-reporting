import { Ticket } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createTicket } from "@/api/smartInspectClient";
import type { StoreReport } from "@/types/reporting";

interface ActionItem {
  checkAreaName: string;
  deficiency: string;
  count: number;
}

/** Highest-impact deficiencies across a store's check areas. */
function buildActionItems(store: StoreReport, limit = 8): ActionItem[] {
  const items: ActionItem[] = [];
  for (const ca of store.checkAreas) {
    for (const d of ca.deficiencyBreakdown) {
      if (d.count > 0)
        items.push({
          checkAreaName: ca.checkAreaName,
          deficiency: d.deficiencyName,
          count: d.count,
        });
    }
  }
  return items.sort((a, b) => b.count - a.count).slice(0, limit);
}

export function ActionItemsTable({ store }: { store: StoreReport }) {
  const { toast } = useToast();
  const items = buildActionItems(store);

  const handleCreate = async (item: ActionItem) => {
    const res = await createTicket({
      storeName: store.storeName,
      areaName: item.checkAreaName,
      deficiency: item.deficiency,
    });
    toast({
      title: "Ticket created",
      description: `${res.ticketId} · ${item.deficiency} in ${item.checkAreaName}`,
      variant: "success",
    });
  };

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No open action items — all checks acceptable.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Check Area</TableHead>
          <TableHead>Deficiency</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, i) => (
          <TableRow key={i} className="hover:bg-transparent">
            <TableCell className="font-medium">{item.checkAreaName}</TableCell>
            <TableCell className="text-muted-foreground">
              {item.deficiency}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {item.count}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCreate(item)}
              >
                <Ticket className="h-3.5 w-3.5" />
                Create Ticket
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
