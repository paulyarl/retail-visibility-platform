import { PrismaClient } from '@prisma/client';

// Ensure a single PrismaClient in dev (nodemon hot reload safe)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Force new instance to pick up schema changes
export const prisma = new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
