import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PhotoGallery } from "@/components/reports/PhotoGallery";
import { formatScore } from "@/utils/formatting";
import { useSession } from "@/context/SessionContext";
import type { CheckAreaReport, PhotoReport } from "@/types/reporting";

function AreaRow({
  area,
  photos,
}: {
  area: CheckAreaReport;
  photos: PhotoReport[];
}) {
  const [open, setOpen] = React.useState(false);
  const { dateRange } = useSession();
  // A single-day range (e.g. Today) is one inspection, so each area is simply
  // pass/fail — let the status chip speak rather than show a 0%/100% "score".
  const singleDay = dateRange.start === dateRange.end;

  const areaPhotos = photos.filter((p) => p.checkAreaName === area.checkAreaName);

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
        {!singleDay && (
          <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
            {formatScore(area.qspScore)}
          </span>
        )}
        <StatusBadge status={area.status} showDot={false} className="shrink-0" />
      </button>

      {open && (
        <div className="space-y-4 px-1 pb-4 pl-8">
          {area.points.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Inspection points
              </p>
              {area.points.map((p) => (
                <div key={p.pointId} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.pointName}</span>
                  {p.topDeficiency && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {p.topDeficiency}
                    </span>
                  )}
                  {!singleDay && (
                    <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                      {formatScore(p.qspScore)}
                    </span>
                  )}
                  <StatusBadge status={p.status} showDot={false} className="shrink-0" />
                </div>
              ))}
            </div>
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
  photos,
}: {
  areas: CheckAreaReport[];
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
        <AreaRow key={a.checkAreaId} area={a} photos={photos} />
      ))}
    </div>
  );
}
