"use client";

import type { TradeEvent } from "./types";
import { ArrowDown } from "./icons";
import { getModelMeta } from "./modelMeta";

type TradeFeedProps = {
  trades: TradeEvent[];
};

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options,
  });

const formatTimestamp = (value?: string) => {
  if (!value) return "Pending timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const classifyAction = (action: string) => {
  const normalized = action.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("long")) {
    return { tone: "text-emerald-400", label: "LONG" };
  }
  if (normalized.includes("sell") || normalized.includes("short")) {
    return { tone: "text-rose-400", label: "SHORT" };
  }
  return { tone: "text-sky-400", label: action.toUpperCase() };
};

export function TradeFeed({ trades }: TradeFeedProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-white/10 bg-[#181818]">
      <div className="border-b border-white/10 p-3 text-[11px] uppercase tracking-wide text-zinc-400">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {["All", "72h"].map((tab, index) => (
            <button
              key={tab}
              className={`rounded-full px-3 py-1 ${
                index === 0 ? "bg-white/10 text-white" : "text-zinc-500"
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="ml-2 hidden flex-1 items-center gap-2 border-l border-white/10 pl-4 lg:flex">
            {["Completed trades", "Model chat", "Positions", "Readme.txt"].map(
              (tab, index) => (
                <button
                  key={tab}
                  className={`whitespace-nowrap text-[11px] uppercase tracking-wide ${
                    index === 0
                      ? "text-white"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Filter:</span>
            <button className="flex items-center gap-1 rounded border border-white/10 bg-black/40 px-2 py-1">
              <span>All models</span>
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
          <span className="text-zinc-500">Streaming latest trades</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {trades.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-zinc-500">
            No trades yet — run a backtest to populate the feed.
          </div>
        )}
        {trades.map((trade) => {
          const meta = getModelMeta(trade.modelId, trade.modelName);
          const actionInfo = classifyAction(trade.action);
          return (
            <div
              key={`${trade.modelId}-${trade.timestamp}-${trade.ticker}-${trade.action}-${trade.shares}`}
              className="border-b border-white/5 px-4 py-3 text-xs text-zinc-300"
            >
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="h-5 w-5">{meta.icon}</span>
                  <span className="font-semibold text-white">
                    {meta.name}
                  </span>
                  <span className="text-zinc-500">executed a</span>
                  <span className={`font-semibold ${actionInfo.tone}`}>
                    {actionInfo.label}
                  </span>
                  <span className="text-zinc-500">order on</span>
                  <span className="font-semibold text-white">
                    {trade.ticker}
                  </span>
                </div>
                <span className="whitespace-nowrap text-[10px] text-zinc-500">
                  {formatTimestamp(trade.timestamp)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-7 text-[11px] text-zinc-400">
                <span>Shares: {formatNumber(trade.shares)}</span>
                <span>
                  Cash: ₹{formatNumber(trade.cash, { maximumFractionDigits: 0 })}
                </span>
                {typeof trade.price === "number" && (
                  <span>
                    Fill price: ₹
                    {formatNumber(trade.price, { maximumFractionDigits: 2 })}
                  </span>
                )}
                <span>
                  Equity: ₹
                  {formatNumber(trade.totalValue, { maximumFractionDigits: 0 })}
                </span>
              </div>
              {trade.leverage && (
                <div className="pl-7 pt-2 text-[11px] text-indigo-300">
                  Leveraged {trade.leverage.toFixed(1)}x exposure
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
