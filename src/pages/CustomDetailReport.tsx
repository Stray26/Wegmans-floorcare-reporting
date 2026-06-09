import * as React from "react";
import { Play, FileSpreadsheet, FileDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckAreaTable } from "@/components/reports/CheckAreaTable";
import { TopDeficienciesList } from "@/components/dashboard/TopDeficienciesList";
import { useToast } from "@/components/ui/toast";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { usePortfolioReport } from "@/hooks/usePortfolioReport";
import { useScoreThresholds } from "@/hooks/useScoreThresholds";
import { FLOORCARE_CONFIG } from "@/config/wegmans";
import { computeQspScore } from "@/utils/scoreStatus";
import { formatScore } from "@/utils/formatting";
import type {
  CheckAreaReport,
  DeficiencyReport,
  ScoreStatus,
} from "@/types/reporting";

const selectCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70";

/** Merge check areas across multiple stores into one aggregated set. */
function aggregateCheckAreas(
  areasByStore: CheckAreaReport[][],
  statusFor: (score: number | null) => ScoreStatus
): CheckAreaReport[] {
  const map = new Map<string, CheckAreaReport>();
  for (const areas of areasByStore) {
    for (const ca of areas) {
      const existing = map.get(ca.checkAreaId);
      if (!existing) {
        map.set(ca.checkAreaId, {
          ...ca,
          deficiencyBreakdown: ca.deficiencyBreakdown.map((d) => ({ ...d })),
        });
      } else {
        existing.acceptableCount += ca.acceptableCount;
        existing.deficiencyCount += ca.deficiencyCount;
        existing.totalCount += ca.totalCount;
        for (const d of ca.deficiencyBreakdown) {
          const ed = existing.deficiencyBreakdown.find(
            (x) => x.deficiencyName === d.deficiencyName
          );
          if (ed) ed.count += d.count;
          else existing.deficiencyBreakdown.push({ ...d });
        }
      }
    }
  }
  // recompute scores, status, percentages, top deficiency
  return [...map.values()].map((ca) => {
    const qsp = computeQspScore(ca.acceptableCount, ca.totalCount) ?? 0;
    const defTotal =
      ca.deficiencyBreakdown.reduce((s, d) => s + d.count, 0) || 1;
    ca.deficiencyBreakdown = ca.deficiencyBreakdown
      .map((d) => ({ ...d, percentage: (d.count / defTotal) * 100 }))
      .sort((a, b) => b.count - a.count);
    return {
      ...ca,
      qspScore: qsp,
      status: statusFor(qsp),
      topDeficiency: ca.deficiencyBreakdown[0]?.deficiencyName,
    };
  });
}

export function CustomDetailReport() {
  const { stores } = useSmartInspectPermissions();
  const { data: portfolio } = usePortfolioReport(stores);
  const { getStatusForScore } = useScoreThresholds();
  const { toast } = useToast();

  const [storeSel, setStoreSel] = React.useState("all");
  const [ran, setRan] = React.useState<{ store: string } | null>(null);

  const result = React.useMemo(() => {
    if (!ran || !portfolio) return null;
    const reports =
      ran.store === "all"
        ? portfolio.storeReports
        : portfolio.storeReports.filter((s) => s.storeId === ran.store);
    const uploaded = reports.filter((s) => s.uploaded);
    const areas = aggregateCheckAreas(
      uploaded.map((s) => s.checkAreas),
      getStatusForScore
    );
    // overall deficiencies
    const defMap = new Map<string, DeficiencyReport>();
    let total = 0;
    for (const ca of areas)
      for (const d of ca.deficiencyBreakdown) {
        total += d.count;
        const ex = defMap.get(d.deficiencyName);
        if (ex) ex.count += d.count;
        else defMap.set(d.deficiencyName, { ...d });
      }
    const denom = total || 1;
    const deficiencies = [...defMap.values()]
      .map((d) => ({ ...d, percentage: (d.count / denom) * 100 }))
      .sort((a, b) => b.count - a.count);

    const acceptable = areas.reduce((s, c) => s + c.acceptableCount, 0);
    const totalChecks = areas.reduce((s, c) => s + c.totalCount, 0);
    return {
      areas,
      deficiencies,
      storeCount: reports.length,
      uploadedCount: uploaded.length,
      qsp: computeQspScore(acceptable, totalChecks),
    };
  }, [ran, portfolio, getStatusForScore]);

  const exportToast = (kind: string) =>
    toast({ title: `${kind} export started`, description: "Generating report…" });

  return (
    <div>
      <PageHeader
        title="Custom Detail Report"
        subtitle="QSP drilldown — Configuration → Store → Area Type → Check"
      />

      {/* Controls */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Configuration
            </span>
            <select className={selectCls} disabled value="cfg">
              <option value="cfg">{FLOORCARE_CONFIG.configurationName}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Store
            </span>
            <select
              className={selectCls}
              value={storeSel}
              onChange={(e) => setStoreSel(e.target.value)}
            >
              <option value="all">All stores ({stores.length})</option>
              {stores.map((s) => (
                <option key={s.buildingId} value={s.buildingId}>
                  {s.storeName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Area Type
            </span>
            <select className={selectCls} disabled value="at">
              <option value="at">{FLOORCARE_CONFIG.areaTypeName}</option>
            </select>
          </label>

          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={() => setRan({ store: storeSel })}
            >
              <Play className="h-4 w-4" />
              Run Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {!result ? (
        <Card className="px-6 py-16 text-center text-sm text-muted-foreground">
          Choose a scope and click <span className="font-medium">Run Report</span>{" "}
          to generate the drilldown. Uses the date range from the top bar.
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {result.uploadedCount} of {result.storeCount} store
              {result.storeCount === 1 ? "" : "s"} reporting ·{" "}
              <span className="font-semibold text-foreground">
                {formatScore(result.qsp)}
              </span>{" "}
              overall QSP
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToast("Excel")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToast("PDF")}
              >
                <FileDown className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Check Area Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {result.areas.length > 0 ? (
                  <CheckAreaTable checkAreas={result.areas} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No inspection data in the selected range.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Deficiencies</CardTitle>
              </CardHeader>
              <CardContent>
                <TopDeficienciesList
                  deficiencies={result.deficiencies}
                  limit={8}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
