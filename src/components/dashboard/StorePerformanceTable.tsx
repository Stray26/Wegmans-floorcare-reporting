import * as React from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { formatScore, formatRelativeDays } from "@/utils/formatting";
import type { StoreReport, ScoreStatus } from "@/types/reporting";

type SortKey = "store" | "qsp" | "uploaded" | "status" | "tickets";

const STATUS_ORDER: Record<ScoreStatus, number> = {
  failed: 0,
  "needs-improvement": 1,
  "not-uploaded": 2,
  passed: 3,
};

const PAGE_SIZE = 12;

export function StorePerformanceTable({
  stores,
  search,
  statusFilter,
  onRowClick,
}: {
  stores: StoreReport[];
  search: string;
  statusFilter: ScoreStatus | null;
  onRowClick: (store: StoreReport) => void;
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>("qsp");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => {
    let rows = stores;
    if (statusFilter) rows = rows.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.storeName.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.state.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [stores, statusFilter, search]);

  const sorted = React.useMemo(() => {
    const rows = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sortKey) {
        case "store":
          return a.storeName.localeCompare(b.storeName) * dir;
        case "qsp":
          return ((a.qspScore ?? -1) - (b.qspScore ?? -1)) * dir;
        case "uploaded":
          return (
            (new Date(a.lastUploadedAt ?? 0).getTime() -
              new Date(b.lastUploadedAt ?? 0).getTime()) *
            dir
          );
        case "status":
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
        case "tickets":
          return (a.openTicketCount - b.openTicketCount) * dir;
        default:
          return 0;
      }
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  React.useEffect(() => setPage(0), [search, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "store" ? "asc" : "asc");
    }
  };

  const SortHead = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortHead label="Store" k="store" />
            <TableHead>City / State</TableHead>
            <SortHead label="Last Uploaded" k="uploaded" />
            <SortHead label="QSP Score" k="qsp" />
            <SortHead label="Status" k="status" />
            <TableHead>Top Deficiency</TableHead>
            <SortHead label="Open Tickets" k="tickets" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((s) => (
            <TableRow
              key={s.storeId}
              onClick={() => onRowClick(s)}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">{s.storeName}</TableCell>
              <TableCell className="text-muted-foreground">
                {s.city}, {s.state}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelativeDays(s.lastUploadedAt)}
              </TableCell>
              <TableCell className="font-semibold tabular-nums">
                {formatScore(s.qspScore)}
              </TableCell>
              <TableCell>
                <StatusBadge status={s.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {s.topDeficiency ?? "—"}
              </TableCell>
              <TableCell>
                {s.openTicketCount > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium">
                    {s.openTicketCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {pageRows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={7}
                className="py-10 text-center text-muted-foreground"
              >
                No stores match the current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-1 py-3 text-sm">
        <span className="text-muted-foreground">
          {sorted.length} store{sorted.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
