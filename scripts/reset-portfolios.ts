/**
 * Reset Portfolios Script
 * 
 * Resets all portfolios to initial state for clean backtesting
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetPortfolios() {
  console.log('🔄 Resetting portfolios to initial state...\n');

  // Get all models with their portfolios
  const models = await prisma.model.findMany({
    include: {
      portfolio: {
        include: {
          positions: true,
        },
      },
    },
  });

  for (const model of models) {
    if (!model.portfolio) {
      console.log(`⚠️  ${model.displayName}: No portfolio found, skipping`);
      continue;
    }

    const portfolioId = model.portfolio.id;
    const initialValue = Number(model.portfolio.initialValue);

    // Delete all positions
    const deletedPositions = await prisma.position.deleteMany({
      where: { portfolioId },
    });

    // Reset cash balance
    await prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        cashBalance: initialValue,
      },
    });

    console.log(`✅ ${model.displayName}:`);
    console.log(`   Cash reset to: ₹${initialValue.toLocaleString('en-IN')}`);
    console.log(`   Positions cleared: ${deletedPositions.count}`);
  }

  // Delete all trades
  const deletedTrades = await prisma.trade.deleteMany({});
  console.log(`\n🗑️  Deleted ${deletedTrades.count} trades`);

  // Delete all decision logs
  const deletedLogs = await prisma.decisionLog.deleteMany({});
  console.log(`🗑️  Deleted ${deletedLogs.count} decision logs`);

  // Delete all portfolio snapshots
  const deletedSnapshots = await prisma.portfolioSnapshot.deleteMany({});
  console.log(`🗑️  Deleted ${deletedSnapshots.count} snapshots`);

  console.log('\n✅ Portfolio reset complete! Ready for backtesting.\n');
}

resetPortfolios()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('❌ Reset failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
