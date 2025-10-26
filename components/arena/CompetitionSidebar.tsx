"use client";

import type { BacktestRunStatus, RunSummary } from "./types";

type CompetitionSidebarProps = {
  runs: RunSummary[];
  selectedRunId: string | null;
  currentRunId: string | null;
  loadingHistory: boolean;
  loadingDetail: boolean;
  running: boolean;
  onSelectRun: (runId: string) => void;
  onRefresh: () => void;
};

const STATUS_LABEL: Record<BacktestRunStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLE: Record<BacktestRunStatus, string> = {
  PENDING: "bg-zinc-700/60 text-zinc-200",
  RUNNING: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-200",
  FAILED: "bg-red-500/20 text-red-200",
  CANCELLED: "bg-amber-500/20 text-amber-200",
};

export function CompetitionSidebar({
  runs,
  selectedRunId,
  currentRunId,
  loadingHistory,
  loadingDetail,
  running,
  onSelectRun,
  onRefresh,
}: CompetitionSidebarProps) {
  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-[#181818] p-4 text-xs text-zinc-300">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Recent Runs
          </h3>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loadingHistory}
            className="rounded border border-white/15 px-2 py-1 text-[11px] uppercase tracking-wide text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingHistory ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="space-y-2">
          {runs.length === 0 && !loadingHistory ? (
            <p className="rounded border border-dashed border-white/10 bg-black/30 p-3 text-[11px] text-zinc-400">
              No historical runs yet. Start a backtest to build the leaderboard.
            </p>
          ) : (
            runs.map((run) => {
              const isCurrent = currentRunId === run.id && running;
              const isSelected = selectedRunId === run.id;
              const disableSelection = running && currentRunId !== null && run.id !== currentRunId;
              const leader = getLeader(run);
              const range = formatRange(run.startDate, run.endDate);

              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => onSelectRun(run.id)}
                  disabled={disableSelection}
                  className={[
                    "w-full rounded border px-3 py-2 text-left transition",
                    isSelected ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-black/20 hover:border-emerald-500/40 hover:bg-emerald-500/5",
                    disableSelection ? "cursor-not-allowed opacity-55" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-zinc-100">{range}</span>
                    <span
                      className={[
                        "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        STATUS_STYLE[run.status],
                      ].join(" ")}
                    >
                      {STATUS_LABEL[run.status]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-zinc-400">
                    <span>
                      {leader
                        ? `${leader.modelName} • ${formatPercent(leader.returnPct)}`
                        : "No trades captured"}
                    </span>
                    {isCurrent ? (
                      <span className="text-emerald-300">Live</span>
                    ) : run.completedAt ? (
                      <span>{formatTime(run.completedAt)}</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
        {loadingDetail && (
          <p className="mt-3 text-[11px] text-emerald-300">
            Loading run detail…
          </p>
        )}
        {running && currentRunId !== null && (
          <p className="mt-3 text-[11px] text-zinc-500">
            Live run streaming. Finish or stop the session to inspect other runs.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-white/10 bg-[#181818] p-4 text-sm text-zinc-300">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
          A Better Benchmark
        </h3>
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          Each model begins with ₹100,000, identical prompts, and the same
          market data feed. We stream live results so you can benchmark model
          intelligence and risk discipline in real time.
        </p>
        <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Competition Rules
        </h4>
        <ul className="mt-2 space-y-1 text-xs text-zinc-300">
          <li>Starting Capital: ₹100,000 per model</li>
          <li>Market Source: NSE mock prices or configured live stream</li>
          <li>Objective: Maximize risk-adjusted returns</li>
          <li>Transparency: Every trade is logged for review</li>
          <li>Autonomy: Models manage entries, exits, and risk limits</li>
          <li>Leverage: Up to 20x with real-time margin checks</li>
        </ul>
      </section>

      <section className="rounded-lg border border-dashed border-white/10 bg-[#0f0f0f] p-4 text-xs text-zinc-500">
        <p>
          Looking for real capital deployment? Connect your brokerage credentials
          and promote your best runs for allocator review. Feature launching soon.
        </p>
      </section>
    </aside>
  );
}

function formatRange(startISO: string, endISO: string): string {
  const start = formatDate(startISO);
  const end = formatDate(endISO);
  return `${start} → ${end}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getLeader(run: RunSummary) {
  if (run.models.length === 0) {
    return null;
  }

  const sorted = [...run.models].sort((a, b) => {
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return b.finalTotalValue - a.finalTotalValue;
  });

  return sorted[0];
}
