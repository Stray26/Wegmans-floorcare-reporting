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
import { TicketsTable } from "@/components/reports/TicketsTable";
import { CreateTicketDialog } from "@/components/reports/CreateTicketDialog";
import { useToast } from "@/components/ui/toast";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { useTickets } from "@/hooks/useTickets";
import type { TicketReport, TicketStatus } from "@/types/reporting";

const WEEK = 7 * 86400000;

function withinDays(iso: string, ms: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() - t <= ms;
}

const STATUS_OPTIONS: { value: TicketStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "overdue", label: "Overdue" },
  { value: "closed", label: "Closed" },
];

export function TicketsPage() {
  const { stores } = useSmartInspectPermissions();
  const { data: tickets, isLoading, isError, error } = useTickets(stores);
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<TicketStatus | "all">(
    "all"
  );
  const [storeFilter, setStoreFilter] = React.useState<string>("all");

  const all: TicketReport[] = React.useMemo(() => tickets ?? [], [tickets]);

  const kpis = React.useMemo(() => {
    const open = all.filter((t) => t.status !== "closed");
    const overdue = all.filter((t) => t.status === "overdue");
    const createdThisWeek = all.filter((t) => withinDays(t.createdAt, WEEK));
    const closedThisWeek = all.filter(
      (t) => t.status === "closed" && withinDays(t.updatedAt, WEEK)
    );
    const avgAge =
      open.length > 0
        ? Math.round(open.reduce((s, t) => s + t.age, 0) / open.length)
        : 0;
    return {
      open: open.length,
      createdThisWeek: createdThisWeek.length,
      closedThisWeek: closedThisWeek.length,
      avgAge,
      overdue: overdue.length,
    };
  }, [all]);

  const filtered = React.useMemo(() => {
    let rows = all;
    if (statusFilter !== "all")
      rows = rows.filter((t) => t.status === statusFilter);
    if (storeFilter !== "all")
      rows = rows.filter((t) => t.storeName === storeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.ticketId.toLowerCase().includes(q) ||
          t.areaName.toLowerCase().includes(q) ||
          t.deficiency.toLowerCase().includes(q) ||
          t.storeName.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => b.age - a.age);
  }, [all, statusFilter, storeFilter, search]);

  const selectCls =
    "h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle="Smart Inspect ticket tracking and follow-up"
        actions={
          <>
            <CreateTicketDialog stores={stores} />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast({ title: "Export started", description: "Generating ticket export…" })
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Open Tickets" value={kpis.open} status="needs-improvement" />
        <KpiCard label="Created This Week" value={kpis.createdThisWeek} />
        <KpiCard label="Closed This Week" value={kpis.closedThisWeek} status="passed" />
        <KpiCard label="Average Age" value={`${kpis.avgAge}d`} />
        <KpiCard label="Overdue" value={kpis.overdue} status="failed" />
      </div>

      <Card className="mt-5">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>All Tickets</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 pl-8"
              />
            </div>
            <select
              className={selectCls}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as TicketStatus | "all")
              }
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="all">All stores</option>
              {stores.map((s) => (
                <option key={s.buildingId} value={s.storeName}>
                  {s.storeName}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isError ? (
            <p className="py-8 text-center text-sm text-status-failed">
              {(error as Error)?.message ?? "Couldn’t load tickets."}
            </p>
          ) : isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading tickets…
            </p>
          ) : (
            <TicketsTable tickets={filtered} showStore />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
