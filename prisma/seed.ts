import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.systemLog.deleteMany();
  await prisma.marketData.deleteMany();
  await prisma.decisionLog.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.position.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.modelConfig.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.model.deleteMany();

  // Create initial models
  const models = [
    {
      name: 'gemini-trader',
      displayName: 'Gemini Pro Trader',
      provider: 'GEMINI_PRO' as const,
      isActive: true,
    },
    {
      name: 'gpt4-trader',
      displayName: 'GPT-4 Trader',
      provider: 'GPT4' as const,
      isActive: true,
    },
    {
      name: 'claude-trader',
      displayName: 'Claude Sonnet Trader',
      provider: 'CLAUDE_SONNET' as const,
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
            systemPrompt: 'You are an AI trader competing in the NSE market.',
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
  }

  // Create initial portfolio snapshot for each model
  const allModels = await prisma.model.findMany({
    include: { portfolio: true },
  });

  for (const model of allModels) {
    if (model.portfolio) {
      await prisma.portfolioSnapshot.create({
        data: {
          portfolioId: model.portfolio.id,
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
      message: 'Database seeded successfully',
      metadata: {
        timestamp: new Date().toISOString(),
        modelsCreated: models.length,
      },
    },
  });

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
