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
import type { TradeDecision } from '@/lib/llm/response-parser';
import type { BrokerOrderResult } from '@/lib/types';

interface TradingEngineOptions {
  dataService: any;
  brokerService: any;
  useMockData?: boolean;
}

export class TradingEngine {
  private modelManager: ModelManager;
  private portfolioCalc: PortfolioCalculator;
  private dataService: any;
  private brokerService: any;
  private useMockData: boolean;

  constructor(options: TradingEngineOptions) {
    this.dataService = options.dataService;
    this.brokerService = options.brokerService;
    this.useMockData = options.useMockData || false;
    
    this.modelManager = new ModelManager();
    this.portfolioCalc = new PortfolioCalculator(this.dataService);

    console.log(`🚀 Trading Engine initialized (${this.useMockData ? 'MOCK' : 'REAL'} mode)`);
  }

  /**
   * Execute full trading cycle for all active models
   */
  async executeTradingCycle(): Promise<{
    success: boolean;
    processed: number;
    executed: number;
    errors: number;
  }> {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎯 STARTING TRADING CYCLE');
    console.log('═══════════════════════════════════════════════════════');

    const startTime = Date.now();
    let processed = 0;
    let executed = 0;
    let errors = 0;

    try {
      // Check if market is open (skip check in mock mode)
      if (!this.useMockData && !this.dataService.isMarketOpen()) {
        const istTime = this.dataService.getCurrentISTTime();
        console.log(`⏰ Market is closed at ${istTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
        
        await this.logSystemEvent('INFO', 'Trading cycle skipped - market closed', {
          istTime: istTime.toISOString(),
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

      console.log(`📊 Found ${activeModels.length} active trading models`);

      if (activeModels.length === 0) {
        console.log('⚠️  No active models found');
        return { success: true, processed: 0, executed: 0, errors: 0 };
      }

      // Fetch market data once for all models
      const allWatchlists = activeModels
        .map(m => m.config?.watchlist || [])
        .flat();
      const uniqueTickers = [...new Set(allWatchlists)];

      console.log(`📈 Fetching market data for ${uniqueTickers.length} tickers...`);
      const marketData = await this.dataService.getMarketData(uniqueTickers);
      console.log(`✅ Market data fetched: ${marketData.length} stocks`);

      // Fetch news once for all models
      console.log('📰 Fetching latest news...');
      const news = await this.dataService.getNews(10);
      console.log(`✅ News fetched: ${news.length} articles`);

      // Process each model
      for (const model of activeModels) {
        try {
          console.log(`\n┌─────────────────────────────────────────────────────┐`);
          console.log(`│ Processing: ${model.displayName.padEnd(43)} │`);
          console.log(`└─────────────────────────────────────────────────────┘`);

          await this.processModel(model.id, marketData, news);
          processed++;
        } catch (error) {
          console.error(`❌ Error processing model ${model.displayName}:`, error);
          errors++;
          
          await this.logSystemEvent('ERROR', `Failed to process model ${model.name}`, {
            modelId: model.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('✅ TRADING CYCLE COMPLETED');
      console.log(`   Duration: ${duration}s`);
      console.log(`   Processed: ${processed}/${activeModels.length} models`);
      console.log(`   Errors: ${errors}`);
      console.log('═══════════════════════════════════════════════════════\n');

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
   * Process a single model
   */
  private async processModel(modelId: string, marketData: any[], news: any[]): Promise<void> {
    // Get LLM decision
    console.log('🤖 Getting AI decision...');
    const { decision, rawResponse } = await this.modelManager.getModelDecision(
      modelId,
      marketData,
      news
    );

    console.log(`💭 Decision: ${decision.action}`);
    console.log(`💡 Reasoning: ${decision.reasoning.substring(0, 100)}...`);

    // Validate decision
    const validation = await this.validateDecision(modelId, decision);
    if (!validation.isValid) {
      console.log(`❌ Invalid decision: ${validation.reason}`);
      return;
    }

    // Execute trade if not HOLD
    if (decision.action !== 'HOLD') {
      console.log(`🔄 Executing ${decision.action} trade...`);
      await this.executeTrade(modelId, decision);
    } else {
      console.log('⏸️  Holding - no trade executed');
    }

    // Create portfolio snapshot
    const portfolio = await prisma.portfolio.findUnique({
      where: { modelId },
    });

    if (portfolio) {
      await this.portfolioCalc.createSnapshot(portfolio.id);
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

    // Validate BUY
    if (decision.action === 'BUY') {
      const currentPrice = await this.brokerService.getCurrentPrice(decision.ticker);
      const totalCost = currentPrice * decision.shares;
      const cashBalance = Number(model.portfolio.cashBalance);

      if (totalCost > cashBalance) {
        return {
          isValid: false,
          reason: `Insufficient cash: need ₹${totalCost.toFixed(2)}, have ₹${cashBalance.toFixed(2)}`,
        };
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
  private async executeTrade(modelId: string, decision: TradeDecision): Promise<void> {
    // Create trade record
    const trade = await prisma.trade.create({
      data: {
        modelId,
        ticker: decision.ticker!,
        action: decision.action,
        shares: decision.shares,
        price: 0, // Will update after fill
        totalValue: 0,
        status: 'PENDING',
      },
    });

    try {
      // Submit order to broker
      const result: BrokerOrderResult = await this.brokerService.submitOrder({
        ticker: decision.ticker!,
        action: decision.action,
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
          executedAt: new Date(),
        },
      });

      if (result.status === 'COMPLETE' && result.filledPrice) {
        // Update portfolio
        await this.updatePortfolio(modelId, decision, result.filledPrice);
        console.log(`✅ Trade executed: ${decision.action} ${decision.shares} ${decision.ticker} @ ₹${result.filledPrice.toFixed(2)}`);
      } else {
        console.log(`❌ Trade rejected: ${result.orderId}`);
      }
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
