import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { DeficiencyReport } from "@/types/reporting";

// Wegmans-green-led palette for the deficiency donut.
const PALETTE = [
  "#006938",
  "#097a45",
  "#2f9e5f",
  "#57b97f",
  "#86d0a3",
  "#b7e3c8",
  "#d97706",
  "#dc2626",
];

export function DeficiencyBreakdownChart({
  deficiencies,
  limit = 6,
}: {
  deficiencies: DeficiencyReport[];
  limit?: number;
}) {
  const top = deficiencies.slice(0, limit);
  const rest = deficiencies.slice(limit);
  const data = [...top];
  if (rest.length) {
    data.push({
      deficiencyName: "Other",
      bilingualLabel: "Other",
      count: rest.reduce((s, d) => s + d.count, 0),
      percentage: rest.reduce((s, d) => s + d.percentage, 0),
    });
  }

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No deficiencies recorded in range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="deficiencyName"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, _n, item) => [
            `${value} (${(item.payload as DeficiencyReport).percentage.toFixed(0)}%)`,
            (item.payload as DeficiencyReport).bilingualLabel,
          ]}
        />
        <Legend
          iconType="circle"
          formatter={(value) => (
            <span className="text-xs text-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
