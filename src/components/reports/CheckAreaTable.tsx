import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatScore } from "@/utils/formatting";
import type { CheckAreaReport } from "@/types/reporting";

export function CheckAreaTable({
  checkAreas,
}: {
  checkAreas: CheckAreaReport[];
}) {
  const sorted = [...checkAreas].sort((a, b) => a.qspScore - b.qspScore);
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Check Area</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Acceptable</TableHead>
          <TableHead className="text-right">Deficiencies</TableHead>
          <TableHead className="text-right">QSP</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((ca) => (
          <TableRow key={ca.checkAreaId} className="hover:bg-transparent">
            <TableCell className="font-medium">{ca.checkAreaName}</TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {ca.totalCount}
            </TableCell>
            <TableCell className="text-right tabular-nums text-status-passed">
              {ca.acceptableCount}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {ca.deficiencyCount}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatScore(ca.qspScore)}
            </TableCell>
            <TableCell>
              <StatusBadge status={ca.status} showDot={false} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
