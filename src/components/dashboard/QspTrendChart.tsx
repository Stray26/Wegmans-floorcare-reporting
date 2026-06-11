import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useScoreThresholds } from "@/hooks/useScoreThresholds";
import { formatDate } from "@/utils/formatting";
import type { TrendPoint } from "@/types/reporting";

export function QspTrendChart({
  trend,
  height = 220,
}: {
  trend: TrendPoint[];
  height?: number;
}) {
  const { thresholds } = useScoreThresholds();
  const passedMin = thresholds.find((t) => t.status === "passed")?.min ?? 90;
  const niMin =
    thresholds.find((t) => t.status === "needs-improvement")?.min ?? 80;

  if (trend.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-muted-foreground"
      >
        No trend data in range.
      </div>
    );
  }

  const data = trend.map((t) => ({ ...t, label: formatDate(t.date) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          domain={[60, 100]}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={passedMin} stroke="#16a34a" strokeDasharray="4 4" />
        <ReferenceLine y={niMin} stroke="#d97706" strokeDasharray="4 4" />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}%`, "QSP"]}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone"
          dataKey="qspScore"
          stroke="#006938"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#006938" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
