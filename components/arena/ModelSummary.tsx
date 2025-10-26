"use client";

import type { ReactNode } from "react";

type SummaryRow = {
  id: string;
  name: string;
  value: number;
  icon?: ReactNode;
  color: string;
};

type ModelSummaryProps = {
  rows: SummaryRow[];
};

const formatValue = (value: number) =>
  `₹${value.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;

export function ModelSummary({ rows }: ModelSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-px rounded-b-lg border border-t-0 border-white/10 bg-white/10 text-xs sm:grid-cols-4 lg:grid-cols-7">
      {rows.map((row) => (
        <div
          key={`${row.id}-${row.name}`}
          className="flex flex-col gap-2 bg-[#181818] px-3 py-4 text-white"
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-400">
            {row.icon && <span className="h-4 w-4 text-white">{row.icon}</span>}
            <span className="truncate">{row.name}</span>
          </div>
          <span
            className="font-semibold"
            style={{ color: row.color || "#f4f4f5" }}
          >
            {formatValue(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
