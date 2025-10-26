import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
// Prevents multiple instances in development due to hot reloading

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Keep Prisma quiet in all environments; we only want our own app logs.
    // If you ever need verbose Prisma logs, set explicitly when instantiating a client in that script.
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
