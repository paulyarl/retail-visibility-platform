import { PrismaClient } from '@prisma/client';

declare global {
  // This prevents multiple instances of Prisma Client in development
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export { prisma };
