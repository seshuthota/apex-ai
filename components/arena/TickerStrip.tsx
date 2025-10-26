"use client";

import type { ReactNode } from "react";

type TickerItem = {
  id: string;
  label: string;
  value: number;
  icon?: ReactNode;
  color: string;
};

type TickerStripProps = {
  items: TickerItem[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

export function TickerStrip({ items }: TickerStripProps) {
  return (
    <div className="border-b border-white/10">
      <div className="flex w-full snap-x snap-mandatory overflow-x-auto">
        {items.length === 0 && (
          <div className="px-4 py-3 text-xs text-zinc-500">Waiting…</div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex snap-start items-center gap-3 border-r border-white/5 px-4 py-3 text-xs uppercase tracking-wide text-zinc-400 last:border-r-0"
          >
            {item.icon && <span className="text-base">{item.icon}</span>}
            <span className="font-semibold text-white">{item.label}</span>
            <span className="rounded bg-white/[0.06] px-2 py-1 font-mono text-[11px] text-white">
              ₹{formatCurrency(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
