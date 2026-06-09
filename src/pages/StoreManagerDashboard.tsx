import { Download, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ScoreGauge } from "@/components/dashboard/ScoreGauge";
import { QspTrendChart } from "@/components/dashboard/QspTrendChart";
import { TopDeficienciesList } from "@/components/dashboard/TopDeficienciesList";
import { CheckAreaTable } from "@/components/reports/CheckAreaTable";
import { PhotoGallery } from "@/components/reports/PhotoGallery";
import { TicketsTable } from "@/components/reports/TicketsTable";
import { useToast } from "@/components/ui/toast";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { useStoreReport } from "@/hooks/useStoreReport";
import { formatRelativeDays } from "@/utils/formatting";

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

  return (
    <div className="pb-6">
      <PageHeader
        title="My Store Dashboard"
        subtitle={`${store.storeName} · ${store.configurationName}`}
        actions={
          <>
            <StatusBadge status={store.status} className="hidden sm:inline-flex" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["store"] });
                toast({ title: "Refreshed", description: "Latest data loaded." });
              }}
            >
              <RefreshCw
                className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
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

      {/* KPI cards — action oriented */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="flex items-center justify-center p-3">
          <ScoreGauge score={store.qspScore} size={96} />
        </Card>
        <KpiCard label="Status" value="" status={store.status}
          hint={store.uploaded ? "Inspection uploaded" : "No upload in range"} />
        <KpiCard
          label="Last Uploaded"
          value={formatRelativeDays(store.lastUploadedAt)}
        />
        <KpiCard label="Inspections" value={store.inspectionsCompleted} />
        <KpiCard
          label="Open Action Items"
          value={store.deficiencies.filter((d) => d.count > 0).length}
        />
        <KpiCard label="Open Tickets" value={store.openTicketCount} />
      </div>

      {/* Main sections */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Check Areas Needing Attention</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {attentionAreas.length > 0 ? (
              <CheckAreaTable checkAreas={attentionAreas} />
            ) : (
              <p className="py-8 text-center text-sm text-status-passed">
                All check areas are passing. Nice work.
              </p>
            )}
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
            <CardTitle>Recent Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoGallery photos={store.photos.slice(0, 6)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Tickets & Follow-up</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TicketsTable tickets={store.tickets} />
        </CardContent>
      </Card>
    </div>
  );
}
