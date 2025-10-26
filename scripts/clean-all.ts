/**
 * Clean All Data Script
 * 
 * Deletes ALL data from the database for a fresh start
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAll() {
  console.log('🧹 Cleaning ALL data from database...\n');

  try {
    // Delete in correct order (respecting foreign keys)
    
    console.log('Deleting system logs...');
    const systemLogs = await prisma.systemLog.deleteMany({});
    console.log(`  ✓ Deleted ${systemLogs.count} system logs`);

    console.log('Deleting market data...');
    const marketData = await prisma.marketData.deleteMany({});
    console.log(`  ✓ Deleted ${marketData.count} market data entries`);

    console.log('Deleting decision logs...');
    const decisionLogs = await prisma.decisionLog.deleteMany({});
    console.log(`  ✓ Deleted ${decisionLogs.count} decision logs`);

    console.log('Deleting trades...');
    const trades = await prisma.trade.deleteMany({});
    console.log(`  ✓ Deleted ${trades.count} trades`);

    console.log('Deleting portfolio snapshots...');
    const snapshots = await prisma.portfolioSnapshot.deleteMany({});
    console.log(`  ✓ Deleted ${snapshots.count} snapshots`);

    console.log('Deleting positions...');
    const positions = await prisma.position.deleteMany({});
    console.log(`  ✓ Deleted ${positions.count} positions`);

    console.log('Deleting model configs...');
    const configs = await prisma.modelConfig.deleteMany({});
    console.log(`  ✓ Deleted ${configs.count} configs`);

    console.log('Deleting portfolios...');
    const portfolios = await prisma.portfolio.deleteMany({});
    console.log(`  ✓ Deleted ${portfolios.count} portfolios`);

    console.log('Deleting models...');
    const models = await prisma.model.deleteMany({});
    console.log(`  ✓ Deleted ${models.count} models`);

    console.log('\n✅ Database completely cleaned!');
    console.log('Ready to seed fresh data.\n');

  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    throw error;
  }
}

cleanAll()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Fatal error:', error);
    prisma.$disconnect();
    process.exit(1);
  });
