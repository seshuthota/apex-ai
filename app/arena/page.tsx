import {
  ArenaHeader,
  CompetitionSidebarContainer,
  ModelSummary,
  PerformanceChartContainer,
  PositionsPanel,
  TickerStrip,
  TradeFeed,
} from "@/components/arena";
import { getModelMeta } from "@/components/arena/modelMeta";
import type {
  PortfolioEvent,
  RunSummary,
  TradeEvent,
} from "@/components/arena/types";
import type { SeriesMeta } from "@/components/arena/PerformanceChart";
import { getArenaOverview } from "@/lib/arena/overview";

export default async function ArenaPage() {
  const overview = await getArenaOverview();

  const activeModels = overview.models.filter(model => model.portfolioId);
  const modelSummaryRows = activeModels
    .sort((a, b) => b.valuation.totalValue - a.valuation.totalValue)
    .map(model => {
      const meta = getModelMeta(model.id, model.name);
      return {
        id: model.id,
        name: meta.name,
        value: model.valuation.totalValue,
        icon: meta.icon,
        color: meta.color,
      };
    });

  const tickerItems = [
    {
      id: "total-equity",
      label: "Total Equity",
      value: overview.summary.totalEquity,
      color: "#22d3ee",
    },
    {
      id: "total-cash",
      label: "Cash On Hand",
      value: overview.summary.totalCash,
      color: "#a855f7",
    },
    ...modelSummaryRows.map(row => ({
      id: `model-${row.id}`,
      label: row.name,
      value: row.value,
      icon: row.icon,
      color: row.color,
    })),
  ];

  const portfolioEvents: PortfolioEvent[] = activeModels.map(model => ({
    modelId: model.id,
    modelName: model.name,
    cash: model.valuation.cashBalance,
    totalValue: model.valuation.totalValue,
    positions: model.positions,
  }));

  const tradeFeed: TradeEvent[] = overview.trades.map(trade => ({
    runId: undefined,
    modelId: trade.modelId,
    modelName: trade.modelName,
    action: trade.action,
    ticker: trade.ticker,
    shares: trade.shares,
    price: trade.price,
    cash: trade.cashAfter ?? 0,
    totalValue: trade.portfolioValueAfter ?? trade.totalValue,
    timestamp: trade.executedAt ?? trade.createdAt,
  }));

  const runSummaries: RunSummary[] = overview.runs.map(run => ({
    id: run.id,
    status: run.status as RunSummary["status"],
    startDate: run.startDate,
    endDate: run.endDate,
    intervalMinutes: run.intervalMinutes,
    enriched: run.enriched,
    useTools: run.useTools,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    failedAt: run.failedAt,
    failureReason: run.failureReason,
    tradingDays: run.tradingDays,
    totalTrades: run.totalTrades,
    durationMs: run.durationMs,
    models: run.models.map(model => ({
      modelId: model.modelId,
      modelName: model.modelName,
      finalCash: model.finalCash,
      finalPositionsValue: model.finalPositionsValue,
      finalTotalValue: model.finalTotalValue,
      returnPct: model.returnPct,
      rank: model.rank,
      finalPositions: model.finalPositions,
    })),
  }));

  const chartSeries: SeriesMeta[] = activeModels.map(model => {
    const meta = getModelMeta(model.id, model.name);
    return {
      id: model.id,
      name: meta.name,
      color: meta.color,
      value: model.valuation.totalValue,
    };
  });

  const chartDataMap = new Map<number, Record<string, number>>();
  for (const snapshot of overview.snapshots) {
    const timestamp = new Date(snapshot.timestamp).getTime();
    if (!chartDataMap.has(timestamp)) {
      chartDataMap.set(timestamp, {});
    }
    chartDataMap.get(timestamp)![snapshot.modelId] = snapshot.totalValue;
  }

  const chartData = Array.from(chartDataMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([date, values]) => ({ date, ...values }));

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <ArenaHeader />
      <TickerStrip items={tickerItems} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8">
        <section className="flex-1 space-y-6">
          <ModelSummary rows={modelSummaryRows} />
          <section className="rounded-lg border border-white/10 bg-[#181818] p-4">
            <PerformanceChartContainer
              data={chartData}
              series={chartSeries}
              baseline={100000}
            />
          </section>
          <PositionsPanel portfolios={portfolioEvents} />
        </section>
        <aside className="w-full shrink-0 space-y-6 lg:w-[360px]">
          <CompetitionSidebarContainer
            runs={runSummaries}
            currentRunId={overview.summary.currentRunId}
          />
          <div className="h-[520px]">
            <TradeFeed trades={tradeFeed} />
          </div>
        </aside>
      </main>
    </div>
  );
}
