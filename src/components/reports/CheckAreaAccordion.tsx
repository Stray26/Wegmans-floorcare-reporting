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
  const defTotal = area.deficiencyBreakdown.reduce((s, d) => s + d.count, 0) || 1;

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
          {area.deficiencyBreakdown.length > 0 ? (
            <div className="space-y-2">
              {area.deficiencyBreakdown.map((d) => (
                <div key={d.deficiencyName} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm font-medium">
                    {d.deficiencyName}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-900"
                      style={{ width: `${(d.count / defTotal) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {d.count} · {d.percentage.toFixed(0)}%
                  </div>
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
