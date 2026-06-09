import { formatPercent } from "@/utils/formatting";
import type { PortfolioReport } from "@/types/reporting";

/** Uploaded vs Not Uploaded — Not Uploaded is gray, never red. */
export function UploadComplianceChart({
  portfolio,
}: {
  portfolio: PortfolioReport;
}) {
  const { storesUploaded, storesNotUploaded, totalStores } = portfolio;
  const pct = portfolio.uploadCompliancePercentage;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-foreground">
          {formatPercent(pct)}
        </span>
        <span className="text-sm text-muted-foreground">upload compliance</span>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-status-notuploaded-bg">
        <div
          className="bg-status-passed transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-status-passed" />
            <span className="text-xs text-muted-foreground">Uploaded</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {storesUploaded}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {totalStores}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-status-notuploaded" />
            <span className="text-xs text-muted-foreground">Not Uploaded</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {storesNotUploaded}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {totalStores}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
