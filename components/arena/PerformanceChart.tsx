"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false },
);
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false },
);
const ReferenceLine = dynamic(
  () => import("recharts").then((m) => m.ReferenceLine),
  { ssr: false },
);

export type SeriesMeta = {
  id: string;
  name: string;
  color: string;
  icon?: ReactNode;
  value?: number;
};

type PerformanceChartProps = {
  data: Array<{ date: number; [key: string]: number }>;
  series: SeriesMeta[];
  mode: "currency" | "percent";
  onModeChange?: (mode: "currency" | "percent") => void;
  baseline?: number;
};

const formatXAxisTick = (timestamp: number) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatCurrency = (value: number) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const formatYAxisTick = (mode: "currency" | "percent") => (value: number) => {
  if (mode === "percent") {
    return `${value.toFixed(1)}%`;
  }
  return formatCurrency(value);
};

type ChartTooltipProps = TooltipProps<number, string> & {
  mode: "currency" | "percent";
};

const CustomTooltip = ({
  active,
  payload,
  label,
  mode,
}: ChartTooltipProps) => {
  if (!active || !payload?.length || typeof label !== "number") {
    return null;
  }
  const date = new Date(label).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="rounded-lg border border-white/10 bg-black/80 p-3 text-xs text-white shadow-lg backdrop-blur">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">
        {date}
      </p>
      <div className="space-y-2">
        {payload
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .map((entry) => {
            const value = typeof entry.value === "number" ? entry.value : 0;
            return (
              <div
                key={entry.dataKey ?? entry.name}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color ?? "#fff" }}
                  />
                  <span>{entry.name}</span>
                </div>
                <span className="font-semibold">
                  {mode === "percent"
                    ? `${value.toFixed(2)}%`
                    : formatCurrency(value)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export function PerformanceChart({
  data,
  series,
  mode,
  onModeChange,
  baseline = 100000,
}: PerformanceChartProps) {
  const yDomain = useMemo(() => {
    if (!data.length) return undefined;
    const values = data.flatMap((row) =>
      series.map((meta) => row[meta.id]).filter((value) => value !== undefined),
    ) as number[];
    if (!values.length) return undefined;

    if (mode === "percent") {
      const min = Math.min(...values, 0);
      const max = Math.max(...values, 0);
      const spread = Math.max(Math.abs(min), Math.abs(max));
      const padding = spread === 0 ? 5 : spread * 0.1;
      return [min - padding, max + padding];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    return [Math.min(min, baseline * 0.8), Math.max(max, baseline * 1.2)];
  }, [data, series, baseline, mode]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Total Account Value
          </h2>
          <p className="text-xs text-zinc-500">
            Real-time equity curve per autonomous model
          </p>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => onModeChange?.("currency")}
            className={`rounded px-3 py-1 ${
              mode === "currency"
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.("percent")}
            className={`rounded px-3 py-1 ${
              mode === "percent"
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            %
          </button>
        </div>
      </div>
      <div className="h-[420px] w-full">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 20, right: 160, left: 0, bottom: 10 }}
          >
            <XAxis
              dataKey="date"
              type="number"
              stroke="#71717a"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickFormatter={formatXAxisTick}
              minTickGap={60}
            />
            <YAxis
              type="number"
              yAxisId={0}
              orientation="right"
              tickLine={false}
              axisLine={false}
              stroke="#71717a"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickFormatter={formatYAxisTick(mode)}
              domain={yDomain}
            />
            <Tooltip
              content={<CustomTooltip mode={mode} />}
              cursor={{ stroke: "#27272a" }}
            />
            {baseline !== undefined && (
              <ReferenceLine
                y={baseline}
                yAxisId={0}
                stroke="#3f3f46"
                strokeDasharray="3 3"
              />
            )}
            {series.map((meta) => (
              <Line
                key={meta.id}
                dataKey={meta.id}
                name={meta.name}
                stroke={meta.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
