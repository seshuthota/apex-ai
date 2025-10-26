/**
 * Portfolio Calculator
 * 
 * Calculates portfolio valuations and creates historical snapshots
 */

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import type { IDataService, PortfolioValuation } from '@/lib/types';

type PortfolioWithPositions = Prisma.PortfolioGetPayload<{
  include: { positions: true };
}>;

export class PortfolioCalculator {
  private dataService: IDataService; // Will be injected
  private priceCache = new Map<string, number>();

  constructor(dataService: IDataService) {
    this.dataService = dataService;
  }

  /**
   * Calculate total portfolio value
   */
  async calculateTotalValue(
    portfolioOrId: string | PortfolioWithPositions,
  ): Promise<PortfolioValuation> {
    const portfolio =
      typeof portfolioOrId === 'string'
        ? await prisma.portfolio.findUnique({
            where: { id: portfolioOrId },
            include: { positions: true },
          })
        : portfolioOrId;

    if (!portfolio) {
      throw new Error(
        typeof portfolioOrId === 'string'
          ? `Portfolio ${portfolioOrId} not found`
          : 'Portfolio not found',
      );
    }

    let positionsValue = 0;

    if (portfolio.positions.length > 0) {
      const tickers = portfolio.positions.map(position => position.ticker);
      const priceMap = await this.resolvePriceMap(tickers);

      for (const position of portfolio.positions) {
        const currentPrice = priceMap.get(position.ticker);
        if (typeof currentPrice === 'number') {
          positionsValue += currentPrice * position.shares;
        } else {
          console.warn(`Price not available for ${position.ticker}`);
        }
      }
    }

    const cashBalance = Number(portfolio.cashBalance);
    const totalValue = cashBalance + positionsValue;
    const initialValue = Number(portfolio.initialValue || 0);
    const returnPct =
      initialValue > 0 ? ((totalValue - initialValue) / initialValue) * 100 : 0;

    return {
      totalValue,
      cashBalance,
      positionsValue,
      returnPct,
    };
  }

  /**
   * Warm the price cache for downstream calculations
   */
  async primePriceCache(tickers: string[]): Promise<void> {
    if (tickers.length === 0) return;
    await this.resolvePriceMap(tickers);
  }

  /**
   * Clear cached prices (useful for long-lived processes)
   */
  clearPriceCache(): void {
    this.priceCache.clear();
  }

  /**
   * Create a portfolio snapshot
   */
  async createSnapshot(
    portfolioId: string,
    timestamp?: Date,
    backtestRunId?: string,
  ): Promise<void> {
    const valuation = await this.calculateTotalValue(portfolioId);

    await prisma.portfolioSnapshot.create({
      data: {
        portfolioId,
        totalValue: valuation.totalValue,
        cashBalance: valuation.cashBalance,
        positionsValue: valuation.positionsValue,
        returnPct: valuation.returnPct,
        ...(backtestRunId ? { backtestRunId } : {}),
        ...(timestamp ? { timestamp } : {}),
      },
    });
  }

  /**
   * Get portfolio performance history
   */
  async getPerformanceHistory(
    portfolioId: string,
    days: number = 30,
  ): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: {
        portfolioId,
        timestamp: {
          gte: startDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      totalValue: Number(snapshot.totalValue),
      returnPct: Number(snapshot.returnPct),
    }));
  }

  /**
   * Get all portfolios ranked by performance
   */
  async getLeaderboard(): Promise<any[]> {
    const models = await prisma.model.findMany({
      where: { isActive: true },
      include: {
        portfolio: {
          include: {
            positions: true,
          },
        },
      },
    });

    const leaderboard = await Promise.all(
      models.map(async model => {
        if (!model.portfolio) return null;

        const valuation = await this.calculateTotalValue(model.portfolio);

        return {
          id: model.id,
          name: model.displayName,
          provider: model.provider,
          logo: model.logo,
          totalValue: valuation.totalValue,
          returnPct: valuation.returnPct,
          cashBalance: valuation.cashBalance,
          positionsValue: valuation.positionsValue,
        };
      }),
    );

    const sorted = leaderboard
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.totalValue - a.totalValue);

    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  /**
   * Calculate position P&L
   */
  async getPositionPnL(portfolioId: string): Promise<any[]> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio || portfolio.positions.length === 0) {
      return [];
    }

    const tickers = portfolio.positions.map(position => position.ticker);
    const priceMap = await this.resolvePriceMap(tickers);

    return portfolio.positions.map(position => {
      const avgCost = Number(position.avgCost);
      const currentPrice = priceMap.get(position.ticker) ?? avgCost;
      const shares = position.shares;
      const currentValue = currentPrice * shares;
      const costBasis = avgCost * shares;
      const profitLoss = currentValue - costBasis;
      const profitLossPct =
        avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

      return {
        ticker: position.ticker,
        shares,
        avgCost,
        currentPrice,
        currentValue,
        profitLoss,
        profitLossPct,
      };
    });
  }

  /**
   * Get portfolio statistics
   */
  async getPortfolioStats(portfolioId: string): Promise<any> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        positions: true,
        history: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    });

    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    const valuation = await this.calculateTotalValue(portfolioId);

    // Calculate max drawdown
    let maxValue = Number(portfolio.initialValue);
    let maxDrawdown = 0;

    for (const snapshot of portfolio.history) {
      const value = Number(snapshot.totalValue);
      if (value > maxValue) {
        maxValue = value;
      }
      const drawdown = ((maxValue - value) / maxValue) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalValue: valuation.totalValue,
      returnPct: valuation.returnPct,
      cashBalance: valuation.cashBalance,
      positionsValue: valuation.positionsValue,
      positionsCount: portfolio.positions.length,
      maxDrawdown,
      daysActive:
        portfolio.history.length > 0
          ? Math.ceil(
              (Date.now() - portfolio.history[0].timestamp.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0,
    };
  }

  /**
   * Resolve latest price map with live fetch + cached fallback
   */
  private async resolvePriceMap(
    tickers: string[],
  ): Promise<Map<string, number>> {
    if (tickers.length === 0) {
      return new Map();
    }

    const uniqueTickers = Array.from(new Set(tickers));
    const resolved = new Map<string, number>();
    const missing: string[] = [];

    for (const ticker of uniqueTickers) {
      if (this.priceCache.has(ticker)) {
        resolved.set(ticker, this.priceCache.get(ticker)!);
      } else {
        missing.push(ticker);
      }
    }

    if (missing.length > 0) {
      try {
        const marketData = await this.dataService.getMarketData(missing);
        for (const dataPoint of marketData) {
          const price = Number(dataPoint.price);
          if (Number.isFinite(price)) {
            this.priceCache.set(dataPoint.ticker, price);
            resolved.set(dataPoint.ticker, price);
          }
        }
      } catch (error) {
        console.error('Error fetching prices for portfolio calculation:', error);
      }
    }

    const stillMissing = missing.filter(ticker => !resolved.has(ticker));
    if (stillMissing.length > 0) {
      const cachedPrices = await this.fetchLatestCachedPrices(stillMissing);
      for (const [ticker, price] of cachedPrices.entries()) {
        this.priceCache.set(ticker, price);
        resolved.set(ticker, price);
      }
    }

    return resolved;
  }

  /**
   * Fetch latest cached prices in a single batched query
   */
  private async fetchLatestCachedPrices(
    tickers: string[],
  ): Promise<Map<string, number>> {
    if (tickers.length === 0) {
      return new Map();
    }

    const rows = await prisma.marketData.findMany({
      where: { ticker: { in: tickers } },
      orderBy: { timestamp: 'desc' },
    });

    const map = new Map<string, number>();
    for (const row of rows) {
      if (!map.has(row.ticker)) {
        map.set(row.ticker, Number(row.price));
      }
    }

    return map;
  }
}
