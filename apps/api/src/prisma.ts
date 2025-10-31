import { PrismaClient } from '@prisma/client';

// Ensure a single PrismaClient in dev (nodemon hot reload safe)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Configure Prisma with connection pooling and retry logic
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
