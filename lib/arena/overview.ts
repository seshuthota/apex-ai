import { prisma } from '@/lib/db/prisma';
import { getDataService } from '@/lib/services';
import { PortfolioCalculator } from '@/lib/services/portfolio-calculator';
import type { PortfolioValuation } from '@/lib/types';

type PortfolioPosition = {
  ticker: string;
  shares: number;
};

export type ArenaModelOverview = {
  id: string;
  name: string;
  provider: string;
  portfolioId?: string;
  valuation: PortfolioValuation;
  positions: PortfolioPosition[];
};

export type ArenaTradeOverview = {
  id: string;
  modelId: string;
  modelName: string;
  action: string;
  ticker: string;
  shares: number;
  price: number;
  totalValue: number;
  cashAfter: number | null;
  portfolioValueAfter: number | null;
  status: string;
  createdAt: string;
  executedAt: string | null;
};

export type ArenaRunModelOverview = {
  modelId: string;
  modelName: string;
  finalCash: number;
  finalPositionsValue: number;
  finalTotalValue: number;
  returnPct: number;
  rank: number | null;
  finalPositions: PortfolioPosition[];
};

export type ArenaRunOverview = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  intervalMinutes: number;
  enriched: boolean;
  useTools: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  tradingDays: number | null;
  totalTrades: number | null;
  durationMs: number | null;
  models: ArenaRunModelOverview[];
};

export type ArenaSnapshotPoint = {
  portfolioId: string;
  modelId: string;
  timestamp: string;
  totalValue: number;
  returnPct: number | null;
};

export type ArenaSummary = {
  totalEquity: number;
  totalCash: number;
  activeModels: number;
  lastTradeAt: string | null;
  currentRunId: string | null;
};

export type ArenaOverview = {
  models: ArenaModelOverview[];
  trades: ArenaTradeOverview[];
  runs: ArenaRunOverview[];
  snapshots: ArenaSnapshotPoint[];
  summary: ArenaSummary;
};

const MAX_TRADES = 25;
const MAX_RUNS = 10;
const SNAPSHOTS_PER_PORTFOLIO = 120;

function normalizePositions(value: unknown): PortfolioPosition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const ticker = 'ticker' in item ? String((item as { ticker?: unknown }).ticker ?? '') : '';
      const sharesRaw = 'shares' in item ? (item as { shares?: unknown }).shares : undefined;
      const shares = typeof sharesRaw === 'number' ? sharesRaw : Number(sharesRaw);

      if (!ticker || Number.isNaN(shares)) {
        return null;
      }

      return { ticker, shares } satisfies PortfolioPosition;
    })
    .filter((position): position is PortfolioPosition => position !== null);
}

export async function getArenaOverview(): Promise<ArenaOverview> {
  const [models, tradesRaw, runsRaw] = await Promise.all([
    prisma.model.findMany({
      where: { isActive: true },
      include: {
        portfolio: {
          include: { positions: true },
        },
      },
      orderBy: { displayName: 'asc' },
    }),
    prisma.trade.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_TRADES,
      include: {
        model: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.backtestRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_RUNS,
      include: {
        models: true,
      },
    }),
  ]);

  const dataService = getDataService();
  const calculator = new PortfolioCalculator(dataService);

  const portfolios = models
    .filter(model => model.portfolio)
    .map(model => ({
      modelId: model.id,
      modelName: model.displayName,
      portfolio: model.portfolio!,
    }));

  const allTickers = Array.from(
    new Set(
      portfolios.flatMap(({ portfolio }) =>
        portfolio.positions.map(position => position.ticker),
      ),
    ),
  );
  await calculator.primePriceCache(allTickers);

  const modelOverviews: ArenaModelOverview[] = [];

  for (const model of models) {
    if (!model.portfolio) {
      modelOverviews.push({
        id: model.id,
        name: model.displayName,
        provider: model.provider,
        valuation: {
          totalValue: 0,
          cashBalance: 0,
          positionsValue: 0,
          returnPct: 0,
        },
        positions: [],
      });
      continue;
    }

    const valuation = await calculator.calculateTotalValue(model.portfolio);
    modelOverviews.push({
      id: model.id,
      name: model.displayName,
      provider: model.provider,
      portfolioId: model.portfolio.id,
      valuation,
      positions: model.portfolio.positions.map(position => ({
        ticker: position.ticker,
        shares: position.shares,
      })),
    });
  }

  const trades: ArenaTradeOverview[] = tradesRaw.map(trade => ({
    id: trade.id,
    modelId: trade.modelId,
    modelName: trade.model.displayName,
    action: trade.action,
    ticker: trade.ticker,
    shares: trade.shares,
    price: Number(trade.price),
    totalValue: Number(trade.totalValue),
    cashAfter: trade.cashAfter !== null ? Number(trade.cashAfter) : null,
    portfolioValueAfter:
      trade.portfolioValueAfter !== null ? Number(trade.portfolioValueAfter) : null,
    status: trade.status,
    createdAt: trade.createdAt.toISOString(),
    executedAt: trade.executedAt ? trade.executedAt.toISOString() : null,
  }));

  const runs: ArenaRunOverview[] = runsRaw.map(run => ({
    id: run.id,
    status: run.status,
    startDate: run.startDate.toISOString(),
    endDate: run.endDate.toISOString(),
    intervalMinutes: run.intervalMinutes,
    enriched: run.enriched,
    useTools: run.useTools,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    failedAt: run.failedAt ? run.failedAt.toISOString() : null,
    failureReason: run.failureReason,
    tradingDays: run.tradingDays,
    totalTrades: run.totalTrades,
    durationMs: run.durationMs,
    models: run.models.map(model => ({
      modelId: model.modelId,
      modelName: model.modelName,
      finalCash: Number(model.finalCash),
      finalPositionsValue: Number(model.finalPositionsValue),
      finalTotalValue: Number(model.finalTotalValue),
      returnPct: Number(model.returnPct),
      rank: model.rank,
      finalPositions: normalizePositions(model.finalPositions),
    })),
  }));

  const snapshotPromises = portfolios.map(async ({ modelId, portfolio }) => {
    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { timestamp: 'desc' },
      take: SNAPSHOTS_PER_PORTFOLIO,
    });

    return snapshots
      .reverse()
      .map(snapshot => ({
        portfolioId: portfolio.id,
        modelId,
        timestamp: snapshot.timestamp.toISOString(),
        totalValue: Number(snapshot.totalValue),
        returnPct:
          snapshot.returnPct !== null ? Number(snapshot.returnPct) : null,
      }));
  });

  const snapshotResults = await Promise.all(snapshotPromises);
  const snapshots = snapshotResults.flat();

  const totalEquity = modelOverviews.reduce(
    (acc, model) => acc + model.valuation.totalValue,
    0,
  );
  const totalCash = modelOverviews.reduce(
    (acc, model) => acc + model.valuation.cashBalance,
    0,
  );

  const summary: ArenaSummary = {
    totalEquity,
    totalCash,
    activeModels: modelOverviews.filter(model => model.portfolioId).length,
    lastTradeAt: trades.length > 0 ? trades[0].createdAt : null,
    currentRunId:
      runs.find(run => run.status === 'RUNNING')?.id ?? null,
  };

  return {
    models: modelOverviews,
    trades,
    runs,
    snapshots,
    summary,
  };
}
