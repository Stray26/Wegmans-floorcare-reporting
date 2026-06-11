import { Download, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ScoreGauge } from "@/components/dashboard/ScoreGauge";
import { QspTrendChart } from "@/components/dashboard/QspTrendChart";
import { TopDeficienciesList } from "@/components/dashboard/TopDeficienciesList";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { CheckAreaAccordion } from "@/components/reports/CheckAreaAccordion";
import { InspectionHistoryTable } from "@/components/reports/InspectionHistoryTable";
import { PhotoGallery } from "@/components/reports/PhotoGallery";
import { TicketsTable } from "@/components/reports/TicketsTable";
import { CreateTicketDialog } from "@/components/reports/CreateTicketDialog";
import { useToast } from "@/components/ui/toast";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { useStoreReport } from "@/hooks/useStoreReport";
import { formatRelativeDays, formatDateTime } from "@/utils/formatting";

export function StoreManagerDashboard() {
  const { stores } = useSmartInspectPermissions();
  const store0 = stores[0] ?? null;
  const {
    data: store,
    isLoading,
    isFetching,
    isError,
    error,
  } = useStoreReport(store0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (isError) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-lg border border-status-failed-bg bg-status-failed-bg/40 p-6 text-center">
        <p className="font-semibold text-status-failed">Couldn’t load store</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {(error as Error)?.message ?? "Unknown error from Smart Inspect."}
        </p>
      </div>
    );
  }

  if (isLoading || !store) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading store dashboard…
      </div>
    );
  }

  const attentionAreas = [...store.checkAreas]
    .filter((c) => c.status !== "passed")
    .sort((a, b) => a.qspScore - b.qspScore);
  const actionItemCount = store.deficiencies.filter((d) => d.count > 0).length;

  return (
    <div className="pb-6">
      <PageHeader
        title="My Store Dashboard"
        subtitle={`${store.storeName} · ${store.configurationName}`}
        actions={
          <>
            <DateRangePicker className="hidden sm:inline-flex" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["store"] });
                toast({ title: "Refreshed", description: "Latest data loaded." });
              }}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast({
                  title: "Export started",
                  description: `Generating PDF for ${store.storeName}…`,
                })
              }
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
      />

      <div className="mb-4 sm:hidden">
        <DateRangePicker />
      </div>

      {/* Did we upload? Did we pass? */}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 p-6">
          <ScoreGauge score={store.qspScore} size={120} />
          <StatusBadge status={store.status} />
        </Card>

        <div className="space-y-3">
          {/* Upload banner */}
          <Card
            className={cn(
              "flex items-center gap-3 p-4",
              store.uploaded
                ? "border-status-passed/30 bg-status-passed-bg/40"
                : "border-status-notuploaded/30 bg-status-notuploaded-bg"
            )}
          >
            {store.uploaded ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-status-passed" />
            ) : (
              <AlertTriangle className="h-6 w-6 shrink-0 text-status-notuploaded" />
            )}
            <div>
              <p className="font-semibold text-foreground">
                {store.uploaded ? "Inspection uploaded" : "No inspection in range"}
              </p>
              <p className="text-sm text-muted-foreground">
                {store.uploaded
                  ? `Last upload ${formatDateTime(store.lastUploadedAt)} · ${formatRelativeDays(store.lastUploadedAt)}`
                  : "Nothing has been uploaded for the selected date range."}
              </p>
            </div>
          </Card>

          {/* Quick KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Inspections" value={store.inspectionsCompleted} />
            <KpiCard label="Action Items" value={actionItemCount} status={actionItemCount ? "needs-improvement" : "passed"} />
            <KpiCard label="Open Tickets" value={store.openTicketCount} />
            <KpiCard label="Deficiencies" value={store.deficiencyCount} />
          </div>
        </div>
      </div>

      {/* What do I fix? */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Check Areas Needing Attention</CardTitle>
            <CreateTicketDialog stores={stores} defaultStore={store.storeName} />
          </CardHeader>
          <CardContent className="pt-0">
            <CheckAreaAccordion
              areas={attentionAreas}
              storeName={store.storeName}
              photos={store.photos}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Deficiencies</CardTitle>
          </CardHeader>
          <CardContent>
            <TopDeficienciesList deficiencies={store.deficiencies} />
          </CardContent>
        </Card>
      </div>

      {/* Are we improving? */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>QSP Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <QspTrendChart trend={store.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Inspections</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <InspectionHistoryTable history={store.history} limit={6} />
          </CardContent>
        </Card>
      </div>

      {/* Photos + tickets */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoGallery photos={store.photos.slice(0, 6)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tickets & Follow-up</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <TicketsTable tickets={store.tickets} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
