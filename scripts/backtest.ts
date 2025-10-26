/**
 * Backtesting Script
 * 
 * Simulates trading over a historical date range to test AI model performance
 */

import { PrismaClient } from '@prisma/client';
import { getTradingEngine, getDataService } from '../lib/services';
import { PortfolioCalculator } from '../lib/services/portfolio-calculator';
import { format, addDays, parseISO, isWeekend } from 'date-fns';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  log: [], // Disable query logging
});

interface BacktestConfig {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  intervalMinutes?: number; // Trading interval in minutes (default: 1440 = once per day)
  modelNames?: string[]; // Optional: specific models to test
}

interface BacktestResults {
  date: string;
  duration: number;
  modelsProcessed: number;
  tradesExecuted: number;
  portfolios: {
    modelName: string;
    totalValue: number;
    cash: number;
    positionsValue: number;
    returnPct: number;
  }[];
}

async function runBacktest(config: BacktestConfig) {
  const intervalMinutes = config.intervalMinutes || 1440; // Default: once per day
  const cyclesPerDay = intervalMinutes < 1440 ? Math.floor(375 / intervalMinutes) : 1; // 375 min = NSE trading hours
  
  console.log('🔬 Starting Backtesting');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📅 Date Range: ${config.startDate} to ${config.endDate}`);
  console.log(`⏱️  Interval: Every ${intervalMinutes} minutes`);
  console.log(`🔄 Cycles per day: ${cyclesPerDay}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const startDate = parseISO(config.startDate);
  const endDate = parseISO(config.endDate);
  const results: BacktestResults[] = [];

  // Get trading engine (with services auto-initialized)
  const engine = getTradingEngine();
  const dataService = getDataService();
  const portfolioCalc = new PortfolioCalculator(dataService);

  let currentDate = startDate;
  let tradingDay = 1;

  while (currentDate <= endDate) {
    // Skip weekends (NSE closed)
    if (isWeekend(currentDate)) {
      console.log(`⏭️  Skipping ${format(currentDate, 'yyyy-MM-dd')} (Weekend)\n`);
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const dateStr = format(currentDate, 'yyyy-MM-dd');
    console.log(`\n📆 Day ${tradingDay}: ${format(currentDate, 'EEEE, MMM dd, yyyy')}`);

    try {
      // Get portfolios BEFORE trading
      const modelsBefore = await prisma.model.findMany({
        where: {
          isActive: true,
          ...(config.modelNames && { name: { in: config.modelNames } }),
        },
        include: {
          portfolio: {
            include: {
              positions: true,
            },
          },
        },
      });

      // Silent - portfolio states will be shown after trades

      // Run multiple trading cycles for this day if interval < 1 day
      const startTime = Date.now();
      
      let totalProcessed = 0;
      let totalErrors = 0;
      
      for (let cycle = 1; cycle <= cyclesPerDay; cycle++) {
        const cycleTime = 9 * 60 + 30 + (cycle - 1) * intervalMinutes; // Start at 9:30 AM
        const hours = Math.floor(cycleTime / 60);
        const minutes = cycleTime % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        if (cyclesPerDay > 1) {
          console.log(`\n⏰ ${timeStr} IST`);
        }
        
        // Run trading cycle
        const simulatedTime = new Date(`${dateStr}T${timeStr}:00`);
        const cycleResult = await engine.executeTradingCycle({ simulatedTime });
        totalProcessed += cycleResult.processed;
        totalErrors += cycleResult.errors;
      }
      
      const duration = (Date.now() - startTime) / 1000;

      // Get portfolios AFTER trading
      const modelsAfter = await prisma.model.findMany({
        where: {
          isActive: true,
          ...(config.modelNames && { name: { in: config.modelNames } }),
        },
        include: {
          portfolio: {
            include: {
              positions: true,
            },
          },
        },
      });

      // Calculate results
      const portfolios = [] as BacktestResults['portfolios'];
      for (const model of modelsAfter) {
        const portfolioId = model.portfolio?.id;
        if (!portfolioId) continue;
        const valuation = await portfolioCalc.calculateTotalValue(portfolioId);
        const initialValue = Number(model.portfolio?.initialValue || 100000);
        const returnPct = ((valuation.totalValue - initialValue) / initialValue) * 100;
        portfolios.push({
          modelName: model.displayName,
          totalValue: valuation.totalValue,
          cash: valuation.cashBalance,
          positionsValue: valuation.positionsValue,
          returnPct,
        });
      }

      // Get trades executed today
      const tradesCount = await prisma.trade.count({
        where: {
          createdAt: {
            gte: new Date(`${dateStr}T00:00:00`),
            lt: new Date(`${dateStr}T23:59:59`),
          },
        },
      });

      results.push({
        date: dateStr,
        duration,
        modelsProcessed: totalProcessed,
        tradesExecuted: tradesCount,
        portfolios,
      });

      console.log(`\n✅ Day ${tradingDay} complete (${duration.toFixed(0)}s, ${tradesCount} trades)`);
      // Print end-of-day portfolio tables per model
      printDailyPortfolioTables(modelsAfter);
      console.log(`─`.repeat(60));

    } catch (error) {
      console.error(`❌ Error on ${dateStr}:`, error);
    }

    currentDate = addDays(currentDate, 1);
    tradingDay++;
  }

  // Print final summary
  printBacktestSummary(results);
}

function printBacktestSummary(results: BacktestResults[]) {
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 BACKTEST SUMMARY');
  console.log('═'.repeat(60));

  if (results.length === 0) {
    console.log('No trading days processed.');
    return;
  }

  console.log(`\n📅 Trading Days: ${results.length}`);
  console.log(`📅 Date Range: ${results[0].date} to ${results[results.length - 1].date}`);

  // Total trades
  const totalTrades = results.reduce((sum, r) => sum + r.tradesExecuted, 0);
  console.log(`📈 Total Trades: ${totalTrades}`);

  // Average duration
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log(`⏱️  Average Cycle Duration: ${avgDuration.toFixed(2)}s`);

  // Get unique model names
  const modelNames = [...new Set(results[0].portfolios.map(p => p.modelName))];

  console.log('\n🏆 FINAL LEADERBOARD');
  console.log('─'.repeat(60));

  // Get final performance for each model
  const finalResults = results[results.length - 1];
  const sortedPortfolios = [...finalResults.portfolios].sort(
    (a, b) => b.totalValue - a.totalValue
  );

  sortedPortfolios.forEach((portfolio, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`\n${medal} #${index + 1} ${portfolio.modelName}`);
    console.log(`   Total Value: ₹${portfolio.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    console.log(`   Return: ${portfolio.returnPct >= 0 ? '+' : ''}${portfolio.returnPct.toFixed(2)}%`);
    console.log(`   Cash: ₹${portfolio.cash.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    console.log(`   Invested: ₹${portfolio.positionsValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  });

  // Performance over time
  console.log('\n\n📈 PERFORMANCE OVER TIME');
  console.log('─'.repeat(60));

  for (const modelName of modelNames) {
    console.log(`\n${modelName}:`);
    console.log('Date       | Total Value    | Return  | Trades');
    console.log('-'.repeat(50));
    
    results.forEach(result => {
      const portfolio = result.portfolios.find(p => p.modelName === modelName);
      if (portfolio) {
        const tradesForModel = result.tradesExecuted / result.modelsProcessed;
        console.log(
          `${result.date} | ₹${portfolio.totalValue.toFixed(2).padStart(11)} | ${
            (portfolio.returnPct >= 0 ? '+' : '') + portfolio.returnPct.toFixed(2) + '%'
          }`.padEnd(8) + ` | ${Math.round(tradesForModel)}`
        );
      }
    });
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Backtest Complete!');
  console.log('═'.repeat(60));
}

// Render end-of-day portfolio tables for each model
function printDailyPortfolioTables(modelsAfter: any[]) {
  for (const model of modelsAfter) {
    const positions = model.portfolio?.positions || [];
    const cash = Number(model.portfolio?.cashBalance || 0);
    const positionsValue = positions.reduce((sum: number, p: any) => sum + p.shares * Number(p.avgCost), 0);
    const totalValue = cash + positionsValue;
    const initialValue = Number(model.portfolio?.initialValue || 100000);
    const returnPct = ((totalValue - initialValue) / initialValue) * 100;

    console.log(`\n${model.displayName} — End of Day Portfolio`);
    console.log('Ticker'.padEnd(12) + 'Shares'.padStart(8) + '   ' + 'Avg Cost'.padStart(12) + '   ' + 'Value'.padStart(14));
    console.log('-'.repeat(52));
    for (const p of positions) {
      const value = Number(p.avgCost) * p.shares;
      console.log(
        String(p.ticker).padEnd(12) +
          String(p.shares).padStart(8) + '   ' +
          (`₹${Number(p.avgCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`).padStart(12) + '   ' +
          (`₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`).padStart(14)
      );
    }
    if (positions.length === 0) {
      console.log('(no positions)');
    }
    console.log('-'.repeat(52));
    console.log(`Cash: ₹${cash.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    console.log(`Positions: ₹${positionsValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    console.log(`Total: ₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })} | Return: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  let startDate = '2025-10-06';
  let endDate = '2025-10-10';
  let intervalMinutes = 1440; // Default: once per day
  
  // Parse command line arguments
  if (args.length >= 2) {
    startDate = args[0];
    endDate = args[1];
  }
  
  if (args.length >= 3) {
    intervalMinutes = parseInt(args[2]);
  } else {
    // Fallback to env or external config when CLI arg not provided
    const envInterval = process.env.BACKTEST_INTERVAL_MINUTES;
    if (envInterval && !Number.isNaN(Number(envInterval))) {
      intervalMinutes = parseInt(envInterval);
    } else {
      try {
        const cfgPath = path.resolve(process.cwd(), 'scripts/backtest.config.json');
        if (fs.existsSync(cfgPath)) {
          const raw = fs.readFileSync(cfgPath, 'utf-8');
          const cfg = JSON.parse(raw);
          if (cfg && typeof cfg.intervalMinutes === 'number') {
            intervalMinutes = cfg.intervalMinutes;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  console.log('🚀 AI Trading Backtest\n');
  console.log('Testing how AI models would have performed');
  console.log('over the specified date range.\n');

  await runBacktest({
    startDate,
    endDate,
    intervalMinutes,
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Backtest failed:', error);
  process.exit(1);
});
