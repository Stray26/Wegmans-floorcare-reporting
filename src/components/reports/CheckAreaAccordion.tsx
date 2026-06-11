import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Ticket, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PhotoGallery } from "@/components/reports/PhotoGallery";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createTicket } from "@/api/smartInspectClient";
import { formatScore } from "@/utils/formatting";
import { CHECK_AREAS } from "@/config/wegmans";
import type { CheckAreaReport, PhotoReport } from "@/types/reporting";

/** Map an english area name back to its bilingual label for ticket payloads. */
function bilingualFor(areaName: string, fallback: string): string {
  const m = CHECK_AREAS.find(
    (ca) => ca.label.split("/")[0].trim() === areaName
  );
  return m?.label ?? fallback;
}

function AreaRow({
  area,
  storeName,
  photos,
}: {
  area: CheckAreaReport;
  storeName: string;
  photos: PhotoReport[];
}) {
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const areaPhotos = photos.filter((p) => p.checkAreaName === area.checkAreaName);
  const defTotal = area.deficiencyBreakdown.reduce((s, d) => s + d.count, 0) || 1;

  const mutation = useMutation({
    mutationFn: (deficiency: string) =>
      createTicket({
        storeName,
        areaName: bilingualFor(area.checkAreaName, area.bilingualLabel),
        deficiency,
      }),
    onSuccess: (res, deficiency) => {
      toast({
        title: "Ticket created",
        description: `${res.ticketId} · ${deficiency} in ${area.checkAreaName}`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["store"] });
    },
    onError: (err) =>
      toast({
        title: "Couldn’t create ticket",
        description: (err as Error)?.message ?? "Unknown error",
      }),
  });

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted/40"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {area.checkAreaName}
        </span>
        <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
          {area.deficiencyCount} def
        </span>
        <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
          {formatScore(area.qspScore)}
        </span>
        <StatusBadge status={area.status} showDot={false} className="shrink-0" />
      </button>

      {open && (
        <div className="space-y-4 px-1 pb-4 pl-8">
          {area.deficiencyBreakdown.length > 0 ? (
            <div className="space-y-2">
              {area.deficiencyBreakdown.map((d) => (
                <div key={d.deficiencyName} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm font-medium">
                    {d.deficiencyName}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-navy-900"
                      style={{ width: `${(d.count / defTotal) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {d.count} · {d.percentage.toFixed(0)}%
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(d.deficiencyName)}
                  >
                    {mutation.isPending &&
                    mutation.variables === d.deficiencyName ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Ticket className="h-3.5 w-3.5" />
                    )}
                    Ticket
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-status-passed">
              All checks acceptable in this area.
            </p>
          )}

          {areaPhotos.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Photos
              </p>
              <PhotoGallery photos={areaPhotos} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CheckAreaAccordion({
  areas,
  storeName,
  photos,
}: {
  areas: CheckAreaReport[];
  storeName: string;
  photos: PhotoReport[];
}) {
  if (areas.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-status-passed">
        All check areas are passing. Nice work.
      </p>
    );
  }
  return (
    <div>
      {areas.map((a) => (
        <AreaRow key={a.checkAreaId} area={a} storeName={storeName} photos={photos} />
      ))}
    </div>
  );
}
