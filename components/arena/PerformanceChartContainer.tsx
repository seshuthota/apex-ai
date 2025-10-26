"use client";

import { useState } from "react";
import { PerformanceChart, type SeriesMeta } from "./PerformanceChart";

type PerformanceChartContainerProps = {
  data: Array<{ date: number; [key: string]: number }>;
  series: SeriesMeta[];
  baseline?: number;
};

export function PerformanceChartContainer({
  data,
  series,
  baseline,
}: PerformanceChartContainerProps) {
  const [mode, setMode] = useState<"currency" | "percent">("currency");

  return (
    <PerformanceChart
      data={data}
      series={series}
      mode={mode}
      onModeChange={setMode}
      baseline={baseline}
    />
  );
}
