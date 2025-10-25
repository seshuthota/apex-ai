/**
 * Portfolio Calculator
 * 
 * Calculates portfolio valuations and creates historical snapshots
 */

import { prisma } from '@/lib/db/prisma';
import type { PortfolioValuation } from '@/lib/types';

export class PortfolioCalculator {
  private dataService: any; // Will be injected

  constructor(dataService: any) {
    this.dataService = dataService;
  }

  /**
   * Calculate total portfolio value
   */
  async calculateTotalValue(portfolioId: string): Promise<PortfolioValuation> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    let positionsValue = 0;

    // Calculate value of all positions
    if (portfolio.positions.length > 0) {
      const tickers = portfolio.positions.map(p => p.ticker);
      
      try {
        // Fetch current prices
        const marketData = await this.dataService.getMarketData(tickers);
        const priceMap = new Map(marketData.map((d: any) => [d.ticker, d.price]));

        // Calculate total positions value
        for (const position of portfolio.positions) {
          const currentPrice = priceMap.get(position.ticker);
          if (currentPrice) {
            positionsValue += currentPrice * position.shares;
          } else {
            console.warn(`Price not available for ${position.ticker}`);
          }
        }
      } catch (error) {
        console.error('Error fetching prices for portfolio calculation:', error);
        // Use last known prices from database cache if available
        positionsValue = await this.calculatePositionsValueFromCache(portfolio.positions);
      }
    }

    const cashBalance = Number(portfolio.cashBalance);
    const totalValue = cashBalance + positionsValue;
    const initialValue = Number(portfolio.initialValue);
    const returnPct = ((totalValue - initialValue) / initialValue) * 100;

    return {
      totalValue,
      cashBalance,
      positionsValue,
      returnPct,
    };
  }

  /**
   * Calculate positions value from cached market data
   */
  private async calculatePositionsValueFromCache(positions: any[]): Promise<number> {
    let total = 0;

    for (const position of positions) {
      // Get most recent cached price
      const cached = await prisma.marketData.findFirst({
        where: { ticker: position.ticker },
        orderBy: { timestamp: 'desc' },
      });

      if (cached) {
        total += Number(cached.price) * position.shares;
      } else {
        console.warn(`No cached price for ${position.ticker}`);
      }
    }

    return total;
  }

  /**
   * Create a portfolio snapshot
   */
  async createSnapshot(portfolioId: string): Promise<void> {
    const valuation = await this.calculateTotalValue(portfolioId);

    await prisma.portfolioSnapshot.create({
      data: {
        portfolioId,
        totalValue: valuation.totalValue,
        cashBalance: valuation.cashBalance,
        positionsValue: valuation.positionsValue,
        returnPct: valuation.returnPct,
      },
    });

    console.log(`📸 Portfolio snapshot created for ${portfolioId}: ₹${valuation.totalValue.toFixed(2)} (${valuation.returnPct.toFixed(2)}%)`);
  }

  /**
   * Get portfolio performance history
   */
  async getPerformanceHistory(portfolioId: string, days: number = 30): Promise<any[]> {
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

    return snapshots.map(s => ({
      timestamp: s.timestamp,
      totalValue: Number(s.totalValue),
      returnPct: Number(s.returnPct),
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
      models.map(async (model) => {
        if (!model.portfolio) return null;

        const valuation = await this.calculateTotalValue(model.portfolio.id);

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
      })
    );

    // Filter out nulls and sort by total value
    const sorted = leaderboard
      .filter(item => item !== null)
      .sort((a, b) => b!.totalValue - a!.totalValue);

    // Add ranks
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

    const tickers = portfolio.positions.map(p => p.ticker);
    const marketData = await this.dataService.getMarketData(tickers);
    const priceMap = new Map(marketData.map((d: any) => [d.ticker, d.price]));

    return portfolio.positions.map(position => {
      const currentPrice = priceMap.get(position.ticker) || 0;
      const avgCost = Number(position.avgCost);
      const shares = position.shares;
      const currentValue = currentPrice * shares;
      const costBasis = avgCost * shares;
      const profitLoss = currentValue - costBasis;
      const profitLossPct = ((currentPrice - avgCost) / avgCost) * 100;

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
      daysActive: portfolio.history.length > 0 
        ? Math.ceil((Date.now() - portfolio.history[0].timestamp.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
    };
  }
}
