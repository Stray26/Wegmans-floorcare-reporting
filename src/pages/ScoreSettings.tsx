import * as React from "react";
import { RotateCcw, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useScoreThresholds } from "@/hooks/useScoreThresholds";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { ScoreThreshold } from "@/types/reporting";

/**
 * Admin page for QSP thresholds. Edits Passed-min and Needs-Improvement-min;
 * the four buckets are derived from those two cut points. Persists in-memory
 * via the threshold provider (DB-ready later).
 */
export function ScoreSettings() {
  const { thresholds, setThresholds, resetThresholds } = useScoreThresholds();
  const { toast } = useToast();

  const passed = thresholds.find((t) => t.status === "passed")!;
  const ni = thresholds.find((t) => t.status === "needs-improvement")!;

  const [passedMin, setPassedMin] = React.useState(String(passed.min));
  const [niMin, setNiMin] = React.useState(String(ni.min));

  React.useEffect(() => {
    setPassedMin(String(passed.min));
    setNiMin(String(ni.min));
  }, [passed.min, ni.min]);

  const p = Number(passedMin);
  const n = Number(niMin);
  const valid =
    Number.isFinite(p) &&
    Number.isFinite(n) &&
    n > 0 &&
    p > n &&
    p <= 100;

  const save = () => {
    if (!valid) return;
    const next: ScoreThreshold[] = [
      { status: "passed", label: "Passed", min: p, max: 100, color: "#16a34a" },
      {
        status: "needs-improvement",
        label: "Needs Improvement",
        min: n,
        max: Number((p - 0.01).toFixed(2)),
        color: "#d97706",
      },
      {
        status: "failed",
        label: "Failed",
        min: 0,
        max: Number((n - 0.01).toFixed(2)),
        color: "#dc2626",
      },
      {
        status: "not-uploaded",
        label: "Not Uploaded",
        min: NaN,
        max: NaN,
        color: "#6b7280",
      },
    ];
    setThresholds(next);
    toast({
      title: "Thresholds saved",
      description: `Passed ≥ ${p} · Needs Improvement ${n}–${(p - 0.01).toFixed(2)} · Failed < ${n}`,
      variant: "success",
    });
  };

  return (
    <div>
      <PageHeader
        title="Score Settings"
        subtitle="Configure the QSP status thresholds used across all reports"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetThresholds();
                toast({ title: "Reset to defaults" });
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button size="sm" disabled={!valid} onClick={save}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thresholds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Passed — minimum score
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={passedMin}
                onChange={(e) => setPassedMin(e.target.value)}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Scores at or above this are Passed (green).
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Needs Improvement — minimum score
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={niMin}
                onChange={(e) => setNiMin(e.target.value)}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Scores from here up to Passed are Needs Improvement (yellow);
                anything below is Failed (red).
              </span>
            </label>

            {!valid && (
              <p className="rounded-md bg-status-failed-bg px-3 py-2 text-xs text-status-failed">
                Needs Improvement min must be greater than 0 and less than
                Passed min, and Passed min must be ≤ 100.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PreviewRow status="passed" range={`${p || 90} – 100`} />
            <PreviewRow
              status="needs-improvement"
              range={`${n || 80} – ${valid ? (p - 0.01).toFixed(2) : "…"}`}
            />
            <PreviewRow
              status="failed"
              range={`0 – ${valid ? (n - 0.01).toFixed(2) : "…"}`}
            />
            <PreviewRow status="not-uploaded" range="No inspection in range" />
            <p className="pt-1 text-xs text-muted-foreground">
              Not Uploaded is always separate from Failed and never derived from a
              numeric score.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreviewRow({
  status,
  range,
}: {
  status: ScoreThreshold["status"];
  range: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <StatusBadge status={status} />
      <span className="text-sm tabular-nums text-muted-foreground">{range}</span>
    </div>
  );
}
