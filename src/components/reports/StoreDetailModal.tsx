import { Download, MapPin, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ScoreGauge } from "@/components/dashboard/ScoreGauge";
import { QspTrendChart } from "@/components/dashboard/QspTrendChart";
import { TopDeficienciesList } from "@/components/dashboard/TopDeficienciesList";
import { CheckAreaTable } from "./CheckAreaTable";
import { TicketsTable } from "./TicketsTable";
import { PhotoGallery } from "./PhotoGallery";
import { useToast } from "@/components/ui/toast";
import {
  formatDateTime,
  formatDate,
  formatScore,
} from "@/utils/formatting";
import type { StoreReport } from "@/types/reporting";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

export function StoreDetailModal({
  store,
  onClose,
}: {
  store: StoreReport | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const open = !!store;

  const exportPdf = () =>
    toast({
      title: "Export started",
      description: store
        ? `Generating PDF report for ${store.storeName}…`
        : undefined,
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {store && (
        <DialogContent className="max-w-4xl p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                {store.storeName}
              </DialogTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {store.city}, {store.state}
                </span>
                <span>·</span>
                <span>{store.configurationName}</span>
                <span>·</span>
                <span>Last upload: {formatDateTime(store.lastUploadedAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-8">
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatScore(store.qspScore)}
                </p>
                <StatusBadge status={store.status} />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigate(`/my-store?store=${store.storeId}`);
                  onClose();
                }}
              >
                <LayoutDashboard className="h-4 w-4" />
                Open dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="areas">Check Areas</TabsTrigger>
                <TabsTrigger value="deficiencies">Deficiencies</TabsTrigger>
                <TabsTrigger value="photos">
                  Photos ({store.photos.length})
                </TabsTrigger>
                <TabsTrigger value="tickets">
                  Tickets ({store.tickets.length})
                </TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview">
                <div className="grid gap-4 md:grid-cols-[auto_1fr]">
                  <Card className="flex flex-col items-center justify-center gap-2 p-6">
                    <ScoreGauge score={store.qspScore} />
                    <StatusBadge status={store.status} />
                  </Card>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Stat label="Inspections" value={store.inspectionsCompleted} />
                    <Stat label="Deficiencies" value={store.deficiencyCount} />
                    <Stat label="Open Tickets" value={store.openTicketCount} />
                    <Stat
                      label="Acceptable"
                      value={store.acceptableCount}
                    />
                    <Stat label="Total Checks" value={store.totalCheckCount} />
                    <Stat
                      label="Top Deficiency"
                      value={store.topDeficiency ?? "—"}
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <Card className="p-5">
                    <h3 className="mb-3 text-sm font-semibold">Score Trend</h3>
                    <QspTrendChart trend={store.trend} />
                  </Card>
                </div>
              </TabsContent>

              {/* Check Areas */}
              <TabsContent value="areas">
                <Card className="p-2">
                  <CheckAreaTable checkAreas={store.checkAreas} />
                </Card>
              </TabsContent>

              {/* Deficiencies */}
              <TabsContent value="deficiencies">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-5">
                    <h3 className="mb-3 text-sm font-semibold">
                      Top Deficiency Types
                    </h3>
                    <TopDeficienciesList
                      deficiencies={store.deficiencies}
                      limit={8}
                    />
                  </Card>
                  <Card className="p-5">
                    <h3 className="mb-3 text-sm font-semibold">
                      Most Deficient Check Areas
                    </h3>
                    <div className="space-y-2">
                      {[...store.checkAreas]
                        .sort((a, b) => b.deficiencyCount - a.deficiencyCount)
                        .slice(0, 5)
                        .map((ca) => (
                          <div
                            key={ca.checkAreaId}
                            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                          >
                            <span className="font-medium">
                              {ca.checkAreaName}
                            </span>
                            <span className="text-muted-foreground">
                              {ca.deficiencyCount} def{store.dateRange.start === store.dateRange.end ? "" : ` · ${formatScore(ca.qspScore)}`}
                            </span>
                          </div>
                        ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Photos */}
              <TabsContent value="photos">
                <PhotoGallery photos={store.photos} />
              </TabsContent>

              {/* Tickets */}
              <TabsContent value="tickets">
                <Card className="p-2">
                  <TicketsTable tickets={store.tickets} />
                </Card>
              </TabsContent>

              {/* History */}
              <TabsContent value="history">
                <Card className="p-2">
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
                      {store.history.map((h) => (
                        <TableRow key={h.id} className="hover:bg-transparent">
                          <TableCell className="font-medium">
                            {formatDate(h.date)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {h.inspector}
                          </TableCell>
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
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
