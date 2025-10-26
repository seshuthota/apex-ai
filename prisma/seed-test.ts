import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting test database seed...');

  // Clear existing data for clean test
  console.log('🧹 Cleaning existing test data...');
  await prisma.backtestRunSnapshot.deleteMany();
  await prisma.backtestRunModel.deleteMany();
  await prisma.backtestRun.deleteMany();
  
  const existingModels = await prisma.model.findMany({
    where: {
      name: {
        in: ['minimax-trader', 'deepseek-trader']
      }
    },
    include: {
      portfolio: true,
      config: true,
    }
  });

  for (const model of existingModels) {
    // Delete related records first
    if (model.portfolio) {
      await prisma.position.deleteMany({ where: { portfolioId: model.portfolio.id } });
      await prisma.portfolioSnapshot.deleteMany({ where: { portfolioId: model.portfolio.id } });
    }
    await prisma.trade.deleteMany({ where: { modelId: model.id } });
    await prisma.decisionLog.deleteMany({ where: { modelId: model.id } });
    if (model.config) {
      await prisma.modelConfig.delete({ where: { id: model.config.id } });
    }
    if (model.portfolio) {
      await prisma.portfolio.delete({ where: { id: model.portfolio.id } });
    }
    await prisma.model.delete({ where: { id: model.id } });
  }

  // Create test models with OpenRouter
  const models = [
    {
      name: 'minimax-trader',
      displayName: 'MiniMax M2 Trader (Free)',
      provider: 'OPENROUTER_MINIMAX' as const,
      isActive: true,
    },
    {
      name: 'deepseek-trader',
      displayName: 'DeepSeek Chat v3.1 Trader (Free)',
      provider: 'OPENROUTER_DEEPSEEK' as const,
      isActive: true,
    },
  ];

  for (const modelData of models) {
    const model = await prisma.model.create({
      data: {
        ...modelData,
        portfolio: {
          create: {
            cashBalance: 100000,
            initialValue: 100000,
          },
        },
        config: {
          create: {
            systemPrompt: 'You are an AI trader competing in the NSE market. Make intelligent trading decisions based on market data and news.',
            temperature: 0.7,
            maxTokens: 1000,
            maxPositionSize: 0.3,
            maxTradesPerDay: 10,
            watchlist: [
              'RELIANCE',
              'TCS',
              'INFY',
              'HDFCBANK',
              'ICICIBANK',
              'SBIN',
              'BHARTIARTL',
              'ITC',
              'KOTAKBANK',
              'LT',
            ],
          },
        },
      },
    });

    console.log(`✅ Created model: ${model.displayName}`);

    // Create initial portfolio snapshot
    const portfolio = await prisma.portfolio.findUnique({
      where: { modelId: model.id },
    });

    if (portfolio) {
      await prisma.portfolioSnapshot.create({
        data: {
          portfolioId: portfolio.id,
          totalValue: 100000,
          cashBalance: 100000,
          positionsValue: 0,
          returnPct: 0,
        },
      });
    }
  }

  console.log('✅ Created initial portfolio snapshots');

  // Create system log
  await prisma.systemLog.create({
    data: {
      level: 'INFO',
      message: 'Test database seeded successfully with MiniMax and DeepSeek',
      metadata: {
        timestamp: new Date().toISOString(),
        modelsCreated: models.length,
      },
    },
  });

  console.log('🎉 Test database seed completed successfully!');
  console.log('\nCreated models:');
  console.log('  1. MiniMax M2 Trader (Free) - minimax/minimax-m2:free via OpenRouter');
  console.log('  2. DeepSeek Chat v3.1 Trader (Free) - deepseek/deepseek-chat-v3.1:free via OpenRouter');
  console.log('\nReady to test with real APIs!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding test database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
