/**
 * Test Trading Script
 * 
 * Tests the trading engine end-to-end with mock services.
 * Run with: tsx scripts/test-trading.ts
 */

import 'dotenv/config';
import { getTradingEngine } from '../lib/services';
import { prisma } from '../lib/db/prisma';

async function main() {
  console.log('🧪 Starting Trading Engine Test\n');

  // Force use of mock services for testing
  process.env.USE_MOCK_SERVICES = 'true';

  try {
    // Check database connection
    console.log('1️⃣  Checking database connection...');
    await prisma.$connect();
    console.log('   ✅ Database connected\n');

    // Check if models exist
    console.log('2️⃣  Checking for trading models...');
    const models = await prisma.model.findMany({
      include: {
        portfolio: true,
        config: true,
      },
    });

    if (models.length === 0) {
      console.log('   ⚠️  No models found. Run: pnpm run db:seed');
      return;
    }

    console.log(`   ✅ Found ${models.length} models:`);
    models.forEach(m => {
      console.log(`      - ${m.displayName} (${m.provider})`);
    });
    console.log();

    // Display portfolio states before trading
    console.log('3️⃣  Portfolio states BEFORE trading:\n');
    for (const model of models) {
      if (model.portfolio) {
        const portfolio = await prisma.portfolio.findUnique({
          where: { id: model.portfolio.id },
          include: { positions: true },
        });

        console.log(`   ${model.displayName}:`);
        console.log(`      Cash: ₹${Number(portfolio?.cashBalance).toLocaleString('en-IN')}`);
        console.log(`      Positions: ${portfolio?.positions.length || 0}`);
        if (portfolio && portfolio.positions.length > 0) {
          portfolio.positions.forEach(p => {
            console.log(`         - ${p.shares} x ${p.ticker} @ ₹${Number(p.avgCost).toFixed(2)}`);
          });
        }
        console.log();
      }
    }

    // Run trading cycle
    console.log('4️⃣  Running trading cycle...\n');
    const engine = getTradingEngine();
    const result = await engine.executeTradingCycle();

    console.log('\n5️⃣  Trading cycle completed!');
    console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Processed: ${result.processed} models`);
    console.log(`   Errors: ${result.errors}\n`);

    // Display portfolio states after trading
    console.log('6️⃣  Portfolio states AFTER trading:\n');
    for (const model of models) {
      if (model.portfolio) {
        const portfolio = await prisma.portfolio.findUnique({
          where: { id: model.portfolio.id },
          include: { positions: true },
        });

        console.log(`   ${model.displayName}:`);
        console.log(`      Cash: ₹${Number(portfolio?.cashBalance).toLocaleString('en-IN')}`);
        console.log(`      Positions: ${portfolio?.positions.length || 0}`);
        if (portfolio && portfolio.positions.length > 0) {
          portfolio.positions.forEach(p => {
            console.log(`         - ${p.shares} x ${p.ticker} @ ₹${Number(p.avgCost).toFixed(2)}`);
          });
        }
        console.log();
      }
    }

    // Show recent trades
    console.log('7️⃣  Recent trades:\n');
    const recentTrades = await prisma.trade.findMany({
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
      console.log('   No trades executed yet\n');
    } else {
      recentTrades.forEach(trade => {
        const status = trade.status === 'FILLED' ? '✅' : trade.status === 'REJECTED' ? '❌' : '⏳';
        console.log(`   ${status} ${trade.model.displayName}: ${trade.action} ${trade.shares} x ${trade.ticker} @ ₹${Number(trade.price).toFixed(2)}`);
      });
      console.log();
    }

    // Show recent decisions
    console.log('8️⃣  Recent AI decisions:\n');
    const recentDecisions = await prisma.decisionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        model: {
          select: {
            displayName: true,
          },
        },
      },
    });

    recentDecisions.forEach(decision => {
      console.log(`   ${decision.model.displayName}:`);
      console.log(`      ${decision.reasoning.substring(0, 100)}...`);
      console.log();
    });

    console.log('✅ Test completed successfully!');
    console.log('\nNext steps:');
    console.log('  - Review decision logs in database');
    console.log('  - Check portfolio snapshots');
    console.log('  - Test with real APIs (set USE_MOCK_SERVICES=false)');
    console.log('  - Start dev server: pnpm dev');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
