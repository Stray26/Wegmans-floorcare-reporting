import * as React from "react";
import { Search, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StorePerformanceTable } from "@/components/dashboard/StorePerformanceTable";
import { DeficiencyBreakdownChart } from "@/components/dashboard/DeficiencyBreakdownChart";
import { UploadComplianceChart } from "@/components/dashboard/UploadComplianceChart";
import {
  FilterDrawer,
  EMPTY_FILTERS,
  type PortfolioFilters,
} from "@/components/dashboard/FilterDrawer";
import { StoreDetailModal } from "@/components/reports/StoreDetailModal";
import { useToast } from "@/components/ui/toast";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { usePortfolioReport } from "@/hooks/usePortfolioReport";
import { formatScore } from "@/utils/formatting";
import type { ScoreStatus, StoreReport } from "@/types/reporting";

export function PortfolioOverview() {
  const { stores: permittedStores, accessMode } = useSmartInspectPermissions();
  const {
    data: portfolio,
    isLoading,
    isError,
    error,
  } = usePortfolioReport(permittedStores);
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ScoreStatus | null>(
    null
  );
  const [filters, setFilters] = React.useState<PortfolioFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = React.useState<StoreReport | null>(null);

  const stores = React.useMemo(() => {
    let rows = portfolio?.storeReports ?? [];
    if (filters.state) rows = rows.filter((s) => s.state === filters.state);
    if (filters.city) rows = rows.filter((s) => s.city === filters.city);
    if (filters.inspector)
      rows = rows.filter((s) =>
        s.history.some((h) => h.inspector === filters.inspector)
      );
    return rows;
  }, [portfolio, filters]);

  const toggleStatus = (status: ScoreStatus) =>
    setStatusFilter((cur) => (cur === status ? null : status));

  if (isError) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-lg border border-status-failed-bg bg-status-failed-bg/40 p-6 text-center">
        <p className="font-semibold text-status-failed">Couldn’t load portfolio</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {(error as Error)?.message ?? "Unknown error from Smart Inspect."}
        </p>
      </div>
    );
  }

  if (isLoading || !portfolio) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading portfolio…
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Portfolio Overview"
        subtitle={
          accessMode === "group"
            ? "Wegmans Floorcare Compliance · Region view"
            : "Wegmans Floorcare Compliance"
        }
        actions={
          <>
            <FilterDrawer
              stores={portfolio.storeReports}
              filters={filters}
              onApply={setFilters}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast({
                  title: "Export started",
                  description: "Generating portfolio PDF…",
                })
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      {/* Store-based KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Stores Passed"
          value={portfolio.storesPassed}
          status="passed"
          active={statusFilter === "passed"}
          onClick={() => toggleStatus("passed")}
        />
        <KpiCard
          label="Needs Improvement"
          value={portfolio.storesNeedsImprovement}
          status="needs-improvement"
          active={statusFilter === "needs-improvement"}
          onClick={() => toggleStatus("needs-improvement")}
        />
        <KpiCard
          label="Stores Failed"
          value={portfolio.storesFailed}
          status="failed"
          active={statusFilter === "failed"}
          onClick={() => toggleStatus("failed")}
        />
        <KpiCard
          label="Not Uploaded"
          value={portfolio.storesNotUploaded}
          status="not-uploaded"
          active={statusFilter === "not-uploaded"}
          onClick={() => toggleStatus("not-uploaded")}
        />
        <KpiCard
          label="Average QSP"
          value={formatScore(portfolio.averageQspScore)}
          hint={`${portfolio.storesUploaded} of ${portfolio.totalStores} uploaded`}
        />
      </div>

      {/* Main grid */}
      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Store Performance</CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search store, city, state…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {statusFilter && (
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                Filtered by status
                <button
                  onClick={() => setStatusFilter(null)}
                  className="rounded bg-muted px-2 py-0.5 font-medium hover:bg-accent"
                >
                  Clear
                </button>
              </div>
            )}
            <StorePerformanceTable
              stores={stores}
              search={search}
              statusFilter={statusFilter}
              onRowClick={setSelected}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deficiency Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <DeficiencyBreakdownChart deficiencies={portfolio.topDeficiencies} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Upload Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadComplianceChart portfolio={portfolio} />
            </CardContent>
          </Card>
        </div>
      </div>

      <StoreDetailModal store={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
