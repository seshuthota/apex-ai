/**
 * Trading Engine
 * 
 * Main trading loop that orchestrates:
 * 1. Model decision making
 * 2. Decision validation
 * 3. Trade execution
 * 4. Portfolio updates
 * 5. Snapshot creation
 */

import { prisma } from '@/lib/db/prisma';
import { ModelManager } from './model-manager';
import { PortfolioCalculator } from './portfolio-calculator';
import type { TradeDecision } from '@/lib/types';
import type { BrokerOrderResult, IBrokerService, IDataService } from '@/lib/types';
import type { EventPublisher } from '@/lib/backtest/publisher';

// ANSI color helpers for concise, readable logs in TTY
const useColors = typeof process !== 'undefined' && process.stdout && process.stdout.isTTY;
const color = (s: string, code: number) => (useColors ? `\x1b[${code}m${s}\x1b[0m` : s);
const blue = (s: string) => color(s, 34);
const green = (s: string) => color(s, 32);
const red = (s: string) => color(s, 31);

interface TradingEngineOptions {
  dataService: IDataService;
  brokerService: IBrokerService;
  useMockData?: boolean;
}

export class TradingEngine {
  private modelManager: ModelManager;
  private portfolioCalc: PortfolioCalculator;
  private dataService: IDataService;
  private brokerService: IBrokerService;
  private useMockData: boolean;
  private publisher?: EventPublisher;

  constructor(options: TradingEngineOptions) {
    this.dataService = options.dataService;
    this.brokerService = options.brokerService;
    this.useMockData = options.useMockData || false;
    
    this.modelManager = new ModelManager();
    this.portfolioCalc = new PortfolioCalculator(this.dataService);
    this.modelManager.setPublisher(this.publisher);
  }

  setPublisher(p?: EventPublisher) {
    this.publisher = p;
    this.modelManager.setPublisher(p);
  }

  /**
   * Execute full trading cycle for all active models
   */
  async executeTradingCycle(options?: { simulatedTime?: Date }): Promise<{
    success: boolean;
    processed: number;
    executed: number;
    errors: number;
  }> {
    const startTime = Date.now();
    let processed = 0;
    let executed = 0;
    let errors = 0;

    try {
      // Check if market is open (skip check in mock mode)
      if (!this.useMockData && this.dataService.isMarketOpen && !this.dataService.isMarketOpen()) {
        await this.logSystemEvent('INFO', 'Trading cycle skipped - market closed', {
          istTime: (this.dataService.getCurrentISTTime ? this.dataService.getCurrentISTTime() : new Date()).toISOString(),
        });
        
        return { success: true, processed: 0, executed: 0, errors: 0 };
      }

      // Get all active models
      const activeModels = await prisma.model.findMany({
        where: { isActive: true },
        include: {
          portfolio: { include: { positions: true } },
          config: true,
        },
      });

      if (activeModels.length === 0) {
        return { success: true, processed: 0, executed: 0, errors: 0 };
      }

      // Fetch market data once for all models
      const allWatchlists = activeModels
        .map(m => m.config?.watchlist || [])
        .flat();
      const uniqueTickers = [...new Set(allWatchlists)];
      const marketData = await this.dataService.getMarketData(uniqueTickers);

      // Process each model
      for (const model of activeModels) {
        try {
          await this.processModel(model.id, marketData, options?.simulatedTime);
          processed++;
        } catch (error) {
          console.error(`Error processing model ${model.displayName}:`, error instanceof Error ? error.message : String(error));
          errors++;
          
          await this.logSystemEvent('ERROR', `Failed to process model ${model.name}`, {
            modelId: model.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      await this.logSystemEvent('INFO', 'Trading cycle completed', {
        duration: `${duration}s`,
        processed,
        errors,
      });

      return {
        success: errors === 0,
        processed,
        executed,
        errors,
      };
    } catch (error) {
      console.error('❌ FATAL: Trading cycle failed:', error);
      
      await this.logSystemEvent('ERROR', 'Trading cycle failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        processed,
        executed,
        errors: errors + 1,
      };
    }
  }

  /**
   * Process a single model with agentic loop for decision refinement
   */
  private async processModel(modelId: string, marketData: any[], simulatedTime?: Date): Promise<void> {
    const maxAttempts = 3; // Allow model to refine decision up to 3 times
    let attempt = 1;
    let decision: any;
    let validation: { isValid: boolean; reason?: string };
    let previousDecision: any = null;
    let validationFeedback: string | undefined = undefined;

    // Get model info for logging
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: {
        portfolio: {
          include: {
            positions: true,
          },
        },
      },
    });

    if (!model) return;

    // Agentic loop: Keep asking until we get a valid decision or max attempts
    while (attempt <= maxAttempts) {
      // Get LLM decision (with feedback if this is a retry)
      const result = await this.modelManager.getModelDecision(
        modelId,
        marketData,
        validationFeedback,
        previousDecision
      );

      decision = result.decision;

      // Validate decision
      validation = await this.validateDecision(modelId, decision);
      
      if (validation.isValid) {
        break; // Valid decision, exit loop
      } else {
        // Prepare for next iteration
        previousDecision = decision;
        validationFeedback = validation.reason;
        attempt++;
      }
    }

    // After loop: check final validation
    if (!validation!.isValid) {
      decision = {
        action: 'HOLD',
        ticker: null,
        shares: 0,
        reasoning: `Could not find valid trade after ${maxAttempts} attempts: ${validation!.reason}`,
      };
    }

    // Execute trade if not HOLD
    if (decision.action !== 'HOLD') {
      // Capture pre-trade position for SELL P/L
      const preModel = await prisma.model.findUnique({
        where: { id: modelId },
        include: { portfolio: { include: { positions: true } } },
      });
      const prePos = preModel?.portfolio?.positions.find(p => p.ticker === decision.ticker);

      const exec = await this.executeTrade(modelId, decision, simulatedTime);
      
      // Get updated portfolio after trade
      const updatedModel = await prisma.model.findUnique({
        where: { id: modelId },
        include: {
          portfolio: {
            include: {
              positions: true,
            },
          },
        },
      });

      if (updatedModel?.portfolio) {
        const cash = Number(updatedModel.portfolio.cashBalance);
        const positionsValue = updatedModel.portfolio.positions.reduce(
          (sum, pos) => sum + pos.shares * Number(pos.avgCost),
          0
        );
        const totalValue = cash + positionsValue;
        let line = `${blue('[TRADE]')} ${model.displayName}: ${decision.action} ${decision.shares} ${decision.ticker}`;
        if (decision.action === 'SELL' && exec.status === 'FILLED' && exec.filledPrice && prePos) {
          const realized = (exec.filledPrice - Number(prePos.avgCost)) * decision.shares;
          const plText = `${realized >= 0 ? '+' : ''}₹${Math.abs(realized).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
          line += ` | P/L ${realized >= 0 ? green(plText) : red(plText)}`;
        }
        line += ` | Cash ₹${cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        line += ` | Value ₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        line += ` | Positions: ${updatedModel.portfolio.positions.map(p => `${p.shares} ${p.ticker}`).join(', ') || 'None'}`;
        console.log(line);
        this.publisher?.publish('trade', {
          modelId: model.id,
          modelName: model.displayName,
          action: decision.action,
          ticker: decision.ticker,
          shares: decision.shares,
          leverage: decision.leverage ?? 1,
          price: exec.filledPrice,
          cash,
          totalValue,
          positions: updatedModel.portfolio.positions.map(p => ({ ticker: p.ticker, shares: p.shares })),
        });
      }
    } else {
      const cash = Number(model.portfolio?.cashBalance || 0);
      const positionsValue = model.portfolio?.positions.reduce(
        (sum, pos) => sum + pos.shares * Number(pos.avgCost),
        0
      ) || 0;
      const totalValue = cash + positionsValue;
      console.log(
        `[PORTFOLIO] ${model.displayName}: HOLD | ` +
        `Cash ₹${cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })} | ` +
        `Value ₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} | ` +
        `Positions: ${model.portfolio?.positions.map(p => `${p.shares} ${p.ticker}`).join(', ') || 'None'}`
      );
      this.publisher?.publish('portfolio', {
        modelId: model.id,
        modelName: model.displayName,
        cash,
        totalValue,
        positions: model.portfolio?.positions.map(p => ({ ticker: p.ticker, shares: p.shares })) || [],
      });
    }

    // Create portfolio snapshot
    const portfolio = await prisma.portfolio.findUnique({
      where: { modelId },
    });

    if (portfolio) {
      await this.portfolioCalc.createSnapshot(portfolio.id, simulatedTime);
    }
  }

  /**
   * Validate a trading decision
   */
  private async validateDecision(
    modelId: string,
    decision: TradeDecision
  ): Promise<{ isValid: boolean; reason?: string }> {
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: {
        portfolio: { include: { positions: true } },
        config: true,
      },
    });

    if (!model || !model.config || !model.portfolio) {
      return { isValid: false, reason: 'Model configuration incomplete' };
    }

    // HOLD is always valid
    if (decision.action === 'HOLD') {
      return { isValid: true };
    }

    // Check if ticker is provided
    if (!decision.ticker) {
      return { isValid: false, reason: 'Ticker is required for BUY/SELL' };
    }

    // Check if ticker is in watchlist
    if (!model.config.watchlist.includes(decision.ticker)) {
      return { isValid: false, reason: `${decision.ticker} not in watchlist` };
    }

    // Check shares > 0
    if (decision.shares <= 0) {
      return { isValid: false, reason: 'Shares must be greater than 0' };
    }

    // Validate BUY (supports optional leverage)
    if (decision.action === 'BUY') {
      const allowedLeverages = [1, 5, 10, 20];
      const leverage = decision.leverage ?? 1;
      if (!allowedLeverages.includes(leverage)) {
        return { isValid: false, reason: `Invalid leverage ${leverage}x. Allowed: 1, 5, 10, 20` };
      }
      const currentPrice = await this.brokerService.getCurrentPrice(decision.ticker);
      const totalCost = currentPrice * decision.shares;
      const cashBalance = Number(model.portfolio.cashBalance);
      const initialValue = Number(model.portfolio.initialValue);
      const maxBorrow = (leverage - 1) * initialValue;
      const newCash = cashBalance - totalCost;

      if (newCash < -maxBorrow) {
        return { isValid: false, reason: `Insufficient margin at ${leverage}x: borrowing exceeds limit (max borrow ₹${maxBorrow.toFixed(2)})` };
      }

      // Check position size limit
      const portfolioValue = await this.portfolioCalc.calculateTotalValue(model.portfolio.id);
      const positionPct = totalCost / portfolioValue.totalValue;
      const maxPositionSize = Number(model.config.maxPositionSize);

      if (positionPct > maxPositionSize) {
        return {
          isValid: false,
          reason: `Position size ${(positionPct * 100).toFixed(1)}% exceeds limit ${(maxPositionSize * 100).toFixed(1)}%`,
        };
      }
    }

    // Validate SELL
    if (decision.action === 'SELL') {
      const position = model.portfolio.positions.find(p => p.ticker === decision.ticker);

      if (!position) {
        return { isValid: false, reason: `No position in ${decision.ticker} to sell` };
      }

      if (position.shares < decision.shares) {
        return {
          isValid: false,
          reason: `Insufficient shares: trying to sell ${decision.shares}, have ${position.shares}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Execute a trade
   */
  private async executeTrade(
    modelId: string,
    decision: TradeDecision,
    simulatedTime?: Date
  ): Promise<{ status: 'FILLED' | 'REJECTED'; filledPrice?: number }> {
    // Create trade record
    const trade = await prisma.trade.create({
      data: {
        modelId,
        ticker: decision.ticker!,
        action: decision.action as 'BUY' | 'SELL',
        shares: decision.shares,
        price: 0, // Will update after fill
        totalValue: 0,
        status: 'PENDING',
        ...(simulatedTime ? { createdAt: simulatedTime } : {}),
      },
    });

    try {
      // Submit order to broker
      const result: BrokerOrderResult = await this.brokerService.submitOrder({
        ticker: decision.ticker!,
        action: decision.action as 'BUY' | 'SELL',
        shares: decision.shares,
      });

      // Update trade record
      await prisma.trade.update({
        where: { id: trade.id },
        data: {
          price: result.filledPrice || 0,
          totalValue: (result.filledPrice || 0) * decision.shares,
          status: result.status === 'COMPLETE' ? 'FILLED' : 'REJECTED',
          brokerOrderId: result.orderId,
          executedAt: simulatedTime ?? new Date(),
        },
      });

      if (result.status === 'COMPLETE' && result.filledPrice) {
        // Update portfolio (silent)
        await this.updatePortfolio(modelId, decision, result.filledPrice);
        return { status: 'FILLED', filledPrice: result.filledPrice };
      }
      return { status: 'REJECTED' };
    } catch (error) {
      // Mark trade as rejected
      await prisma.trade.update({
        where: { id: trade.id },
        data: { status: 'REJECTED' },
      });
      
      console.error('❌ Trade execution failed:', error);
      throw error;
    }
  }

  /**
   * Update portfolio after successful trade
   */
  private async updatePortfolio(
    modelId: string,
    decision: TradeDecision,
    filledPrice: number
  ): Promise<void> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { modelId },
      include: { positions: true },
    });

    if (!portfolio) throw new Error('Portfolio not found');

    const totalValue = filledPrice * decision.shares;

    if (decision.action === 'BUY') {
      // Deduct cash
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: {
          cashBalance: { decrement: totalValue },
        },
      });

      // Update or create position
      const existingPosition = portfolio.positions.find(p => p.ticker === decision.ticker);

      if (existingPosition) {
        const newShares = existingPosition.shares + decision.shares;
        const newAvgCost =
          (Number(existingPosition.avgCost) * existingPosition.shares + filledPrice * decision.shares) / newShares;

        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            shares: newShares,
            avgCost: newAvgCost,
          },
        });
      } else {
        await prisma.position.create({
          data: {
            portfolioId: portfolio.id,
            ticker: decision.ticker!,
            shares: decision.shares,
            avgCost: filledPrice,
          },
        });
      }
    }

    if (decision.action === 'SELL') {
      // Add cash
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: {
          cashBalance: { increment: totalValue },
        },
      });

      // Update or remove position
      const position = portfolio.positions.find(p => p.ticker === decision.ticker);

      if (position) {
        if (position.shares === decision.shares) {
          // Sell entire position
          await prisma.position.delete({
            where: { id: position.id },
          });
        } else {
          // Partial sell
          await prisma.position.update({
            where: { id: position.id },
            data: {
              shares: { decrement: decision.shares },
            },
          });
        }
      }
    }
  }

  /**
   * Log system event
   */
  private async logSystemEvent(level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: any): Promise<void> {
    try {
      await prisma.systemLog.create({
        data: {
          level,
          message,
          metadata: metadata || {},
        },
      });
    } catch (error) {
      console.error('Failed to log system event:', error);
    }
  }
}
