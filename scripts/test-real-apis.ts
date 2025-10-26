/**
 * Test Real APIs Script
 * 
 * Tests the trading engine with real APIs:
 * - OpenRouter for LLM decisions
 * - Zerodha Kite Connect for market data (or fallback to Yahoo)
 * 
 * Run with: tsx scripts/test-real-apis.ts
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { getTradingEngine } from '../lib/services';
import { DataService } from '../lib/services/data-service';
import { prisma } from '../lib/db/prisma';

async function main() {
  console.log('🚀 Starting Real API Test\n');

  // Force use of real services
  process.env.USE_MOCK_SERVICES = 'false';

  // Check API keys
  console.log('1️⃣  Checking API keys...');
  const checks = {
    openrouter: !!process.env.OPENROUTER_API_KEY,
    zerodhaPrimary: !!(
      process.env.ZERODHA_API_KEY && process.env.ZERODHA_ACCESS_TOKEN
    ),
    zerodhaLegacy: !!(
      process.env.KITE_API_KEY && process.env.KITE_ACCESS_TOKEN
    ),
    news: !!process.env.NEWS_API_KEY,
  };
  const brokerConfigured = checks.zerodhaPrimary || checks.zerodhaLegacy;

  console.log(`   OpenRouter: ${checks.openrouter ? '✅' : '❌'} ${checks.openrouter ? 'Configured' : 'Missing'}`);
  console.log(
    `   Zerodha: ${brokerConfigured ? '✅' : '❌'} ${
      checks.zerodhaPrimary
        ? 'Configured (ZERODHA_* env vars)'
        : checks.zerodhaLegacy
          ? 'Configured via legacy KITE_* env vars'
          : 'Missing — will use Yahoo fallback'
    }`,
  );
  console.log(`   NewsAPI: ${checks.news ? '✅' : '❌'} ${checks.news ? 'Configured' : 'Optional'}`);

  if (!checks.openrouter) {
    console.error('\n❌ OPENROUTER_API_KEY is required for this test');
    console.log('   Get your key from: https://openrouter.ai/keys');
    process.exit(1);
  }

  console.log();

  try {
    // Check database connection
    console.log('2️⃣  Checking database connection...');
    await prisma.$connect();
    console.log('   ✅ Database connected\n');

    // Check if test models exist
    console.log('3️⃣  Checking for test models...');
    const models = await prisma.model.findMany({
      where: {
        name: {
          in: ['minimax-trader', 'gemini-25-pro-trader']
        }
      },
      include: {
        portfolio: {
          include: { positions: true }
        },
        config: true,
      },
    });

    if (models.length === 0) {
      console.log('   ⚠️  No test models found. Creating them now...');
      console.log('   Run: tsx prisma/seed-test.ts\n');
      
      // Run seed
      await new Promise((resolve, reject) => {
        const seed = spawn('tsx', ['prisma/seed-test.ts'], { stdio: 'inherit' });
        seed.on('close', (code: number) => {
          if (code === 0) resolve(true);
          else reject(new Error(`Seed failed with code ${code}`));
        });
      });

      // Reload models
      const newModels = await prisma.model.findMany({
        where: {
          name: {
            in: ['minimax-trader', 'gemini-25-pro-trader']
          }
        },
        include: {
          portfolio: {
            include: { positions: true }
          },
          config: true,
        },
      });
      models.push(...newModels);
    }

    console.log(`   ✅ Found ${models.length} test models:`);
    models.forEach(m => {
      console.log(`      - ${m.displayName} (${m.provider})`);
    });
    console.log();

    // Display portfolio states before trading
    console.log('4️⃣  Portfolio states BEFORE trading:\n');
    for (const model of models) {
      if (model.portfolio) {
        console.log(`   ${model.displayName}:`);
        console.log(`      Cash: ₹${Number(model.portfolio.cashBalance).toLocaleString('en-IN')}`);
        console.log(`      Positions: ${model.portfolio.positions.length}`);
        if (model.portfolio.positions.length > 0) {
          model.portfolio.positions.forEach(p => {
            console.log(`         - ${p.shares} x ${p.ticker} @ ₹${Number(p.avgCost).toFixed(2)}`);
          });
        }
        console.log();
      }
    }

    // Check if market is open
    console.log('5️⃣  Checking market hours...');
    const dataService = new DataService();
    const isOpen = dataService.isMarketOpen();
    const istTime = dataService.getCurrentISTTime();
    
    console.log(`   Current IST time: ${istTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Market status: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
    
    if (!isOpen) {
      console.log('   ⚠️  NSE is closed. Trading will proceed anyway for testing purposes.\n');
    } else {
      console.log('   ✅ NSE is open. Ready to trade!\n');
    }

    // Run trading cycle with real APIs
    console.log('6️⃣  Running trading cycle with REAL APIs...\n');
    console.log('   ⚠️  This will use real API calls and may incur costs!');
    console.log('   ⏳ Please wait, this may take 30-60 seconds...\n');
    
    const startTime = Date.now();
    const engine = getTradingEngine();
    const result = await engine.executeTradingCycle();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n7️⃣  Trading cycle completed in ${duration}s!`);
    console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Processed: ${result.processed} models`);
    console.log(`   Errors: ${result.errors}\n`);

    // Display portfolio states after trading
    console.log('8️⃣  Portfolio states AFTER trading:\n');
    const updatedModels = await prisma.model.findMany({
      where: {
        name: {
          in: ['minimax-trader', 'gemini-25-pro-trader']
        }
      },
      include: {
        portfolio: {
          include: { positions: true }
        },
      },
    });

    for (const model of updatedModels) {
      if (model.portfolio) {
        console.log(`   ${model.displayName}:`);
        console.log(`      Cash: ₹${Number(model.portfolio.cashBalance).toLocaleString('en-IN')}`);
        console.log(`      Positions: ${model.portfolio.positions.length}`);
        if (model.portfolio.positions.length > 0) {
          model.portfolio.positions.forEach(p => {
            console.log(`         - ${p.shares} x ${p.ticker} @ ₹${Number(p.avgCost).toFixed(2)}`);
          });
        }
        console.log();
      }
    }

    // Show recent trades
    console.log('9️⃣  Recent trades:\n');
    const recentTrades = await prisma.trade.findMany({
      where: {
        model: {
          name: {
            in: ['minimax-trader', 'gemini-25-pro-trader']
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        model: {
          select: {
            displayName: true,
          },
        },
      },
    });

    if (recentTrades.length === 0) {
      console.log('   No trades executed\n');
    } else {
      recentTrades.forEach(trade => {
        const status = trade.status === 'FILLED' ? '✅' : trade.status === 'REJECTED' ? '❌' : '⏳';
        console.log(`   ${status} ${trade.model.displayName}: ${trade.action} ${trade.shares} x ${trade.ticker} @ ₹${Number(trade.price).toFixed(2)}`);
      });
      console.log();
    }

    // Show AI decisions with full reasoning
    console.log('🔟 AI Decision Logs:\n');
    const recentDecisions = await prisma.decisionLog.findMany({
      where: {
        model: {
          name: {
            in: ['minimax-trader', 'gemini-25-pro-trader']
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: {
        model: {
          select: {
            displayName: true,
          },
        },
      },
    });

    recentDecisions.forEach(decision => {
      console.log(`   📊 ${decision.model.displayName}:`);
      console.log(`      ${decision.reasoning}`);
      console.log();
    });

    console.log('✅ Real API test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Duration: ${duration}s`);
    console.log(`   - Models tested: ${models.length}`);
    console.log(`   - Trades executed: ${recentTrades.length}`);
    console.log(`   - API calls made: ~${models.length * 3} (LLM, market data, news)`);
    
    console.log('\n📝 Next steps:');
    console.log('   - Review decision logs in Prisma Studio: pnpm run db:studio');
    console.log('   - Check portfolio snapshots for performance tracking');
    console.log('   - Run multiple cycles to see models compete');
    console.log('   - Build frontend to visualize the competition!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error details:', error.message);
      if (error.stack) {
        console.error('\n   Stack trace:');
        console.error(error.stack);
      }
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
