import type { DeficiencyReport } from "@/types/reporting";

/** Horizontal bar list of the most common deficiency types (bilingual). */
export function TopDeficienciesList({
  deficiencies,
  limit = 6,
}: {
  deficiencies: DeficiencyReport[];
  limit?: number;
}) {
  const top = deficiencies.slice(0, limit).filter((d) => d.count > 0);
  const max = Math.max(1, ...top.map((d) => d.count));

  if (top.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No deficiencies recorded.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {top.map((d) => (
        <div key={d.deficiencyName}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-foreground">
              {d.deficiencyName}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {d.count} · {d.percentage.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-900"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
