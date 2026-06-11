import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDate, formatDateTime, formatScore } from "@/utils/formatting";
import type { InspectionHistoryItem } from "@/types/reporting";

/** Recent inspections list (date, inspector, QSP, status, uploaded). */
export function InspectionHistoryTable({
  history,
  limit,
}: {
  history: InspectionHistoryItem[];
  limit?: number;
}) {
  const rows = limit ? history.slice(0, limit) : history;

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No inspections in the selected range.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Date</TableHead>
          <TableHead>Inspector</TableHead>
          <TableHead className="text-right">QSP</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Uploaded</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((h) => (
          <TableRow key={h.id} className="hover:bg-transparent">
            <TableCell className="font-medium">{formatDate(h.date)}</TableCell>
            <TableCell className="text-muted-foreground">{h.inspector}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatScore(h.qspScore)}
            </TableCell>
            <TableCell>
              <StatusBadge status={h.status} showDot={false} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTime(h.uploadedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
