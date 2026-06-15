import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhotoGallery } from "@/components/reports/PhotoGallery";
import { TicketStatusBadge } from "@/components/reports/TicketsTable";
import { formatDate } from "@/utils/formatting";
import type { TicketReport, PhotoReport } from "@/types/reporting";

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

/**
 * Read-only ticket detail. Opens when a row in TicketsTable is clicked, so it
 * works everywhere that table is used (Tickets page, Store Manager, Store
 * Detail modal). Photos come from the ticket's photoUrls (demo supplies them;
 * live tickets are empty until imageRecords are wired).
 */
export function TicketDetailModal({
  ticket,
  onClose,
}: {
  ticket: TicketReport | null;
  onClose: () => void;
}) {
  const photos: PhotoReport[] = (ticket?.photoUrls ?? []).map((url, i) => ({
    id: `${ticket?.ticketId ?? "t"}-${i}`,
    url,
    caption: ticket?.deficiency,
    checkAreaName: ticket?.areaName ?? "",
    deficiencyName: ticket?.deficiency,
    capturedAt: ticket?.createdAt ?? "",
  }));

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {ticket && (
          <div className="max-h-[92vh] overflow-y-auto p-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle>{ticket.ticketId}</DialogTitle>
                <TicketStatusBadge status={ticket.status} />
              </div>
            </DialogHeader>

            <p className="mt-2 text-sm font-medium text-foreground">
              {ticket.summary ?? `${ticket.deficiency} in ${ticket.areaName}`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <Detail label="Store" value={ticket.storeName} />
              <Detail label="Check Area" value={ticket.areaName} />
              <Detail label="Deficiency" value={ticket.deficiency} />
              <Detail label="Priority" value={ticket.priority} />
              <Detail label="Category" value={ticket.category} />
              <Detail label="Assigned to" value={ticket.assignedTo} />
              <Detail label="Created" value={formatDate(ticket.createdAt)} />
              <Detail
                label="Due"
                value={ticket.dueBy ? formatDate(ticket.dueBy) : undefined}
              />
              <Detail label="Age" value={`${ticket.age} days`} />
            </div>

            {ticket.description && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {ticket.description}
                </p>
              </div>
            )}

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Photos
              </p>
              <PhotoGallery photos={photos} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
