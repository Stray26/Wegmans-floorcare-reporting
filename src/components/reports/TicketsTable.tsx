import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/formatting";
import type { TicketReport, TicketStatus } from "@/types/reporting";

const TICKET_STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-status-warning-bg text-status-warning",
  "in-progress": "bg-blue-100 text-blue-700",
  closed: "bg-status-passed-bg text-status-passed",
  overdue: "bg-status-failed-bg text-status-failed",
};

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  "in-progress": "In Progress",
  closed: "Closed",
  overdue: "Overdue",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TICKET_STATUS_STYLE[status]
      )}
    >
      {TICKET_STATUS_LABEL[status]}
    </span>
  );
}

export function TicketsTable({
  tickets,
  showStore = false,
}: {
  tickets: TicketReport[];
  showStore?: boolean;
}) {
  if (tickets.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No tickets for this store.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Ticket</TableHead>
          {showStore && <TableHead>Store</TableHead>}
          <TableHead>Area</TableHead>
          <TableHead>Deficiency</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Age</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.ticketId} className="hover:bg-transparent">
            <TableCell className="font-medium">{t.ticketId}</TableCell>
            {showStore && (
              <TableCell className="text-muted-foreground">
                {t.storeName}
              </TableCell>
            )}
            <TableCell>{t.areaName}</TableCell>
            <TableCell className="text-muted-foreground">
              {t.deficiency}
            </TableCell>
            <TableCell>
              <TicketStatusBadge status={t.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {t.age}d
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(t.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
