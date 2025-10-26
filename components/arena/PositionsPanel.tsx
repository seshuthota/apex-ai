"use client";

import type { PortfolioEvent } from "./types";
import { getModelMeta } from "./modelMeta";

type PositionsPanelProps = {
  portfolios: PortfolioEvent[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

export function PositionsPanel({ portfolios }: PositionsPanelProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#181818]">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Open Positions
        </h3>
      </div>
      <div className="max-h-[280px] space-y-4 overflow-y-auto px-4 py-3 text-xs text-zinc-300">
        {portfolios.length === 0 && (
          <p className="text-center text-zinc-500">
            No live positions — kick off a run to populate this panel.
          </p>
        )}
        {portfolios.map((portfolio) => {
          const meta = getModelMeta(portfolio.modelId, portfolio.modelName);
          return (
            <div key={portfolio.modelId} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5">{meta.icon}</span>
                  <span className="font-semibold text-white">
                    {meta.name}
                  </span>
                </div>
                <div className="flex items-end gap-3 text-[11px] text-zinc-400">
                  <span>
                    Cash: ₹{formatCurrency(portfolio.cash)}
                  </span>
                  <span className="text-white">
                    Total: ₹{formatCurrency(portfolio.totalValue)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-wide text-zinc-400">
                {portfolio.positions.length === 0 && (
                  <span className="text-zinc-600">No active positions</span>
                )}
                {portfolio.positions.map((position) => (
                  <span
                    key={position.ticker}
                    className="rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                  >
                    {position.shares} {position.ticker}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
