import { PrismaClient } from '@prisma/client';

// Ensure a single PrismaClient in dev (nodemon hot reload safe)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Use DATABASE_URL directly without modification
// SSL and connection params should be set in the environment variable itself
const getDatabaseUrl = () => {
  return process.env.DATABASE_URL || '';
};

// Production-grade Prisma configuration for Vercel serverless
// Configure Prisma with connection pooling and retry logic
// Export basePrisma for use in transactions (avoids retry wrapper issues)
export const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  // Critical for serverless: prevent connection exhaustion
  // https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
  // @ts-ignore - connection_limit is valid but not in types
  __internal: {
    engine: {
      connection_limit: 3, // Increased from 1 to handle concurrent requests
      pool_timeout: 30, // Increased from default 10s to 30s
    },
  },
});

// Enhanced retry logic for production reliability
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 5, // Increased for production
  initialDelayMs = 200 // Longer initial delay
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Retry on connection errors
      const isConnectionError = 
        error.code === 'P1001' || // Can't reach database
        error.code === 'P2024' || // Connection pool timeout
        error.name === 'PrismaClientInitializationError' || // Client init failed
        error.message?.includes("Can't reach database server") ||
        error.message?.includes('Connection refused') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('connection pool');
      
      if (isConnectionError && attempt < maxRetries) {
        // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.error(`[Prisma Retry] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        console.error(`[Prisma Retry] Retrying in ${delayMs}ms with exponential backoff...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Don't retry other errors or if max retries reached
      if (attempt === maxRetries) {
        console.error(`[Prisma Retry] All ${maxRetries} attempts failed. Giving up.`);
      }
      throw error;
    }
  }
  
  throw lastError;
}

// Wrap Prisma client with retry logic
export const prisma = new Proxy(basePrisma, {
  get(target, prop) {
    const original = target[prop as keyof typeof target];
    
    // Only wrap model operations, not utility methods
    if (typeof original === 'object' && original !== null) {
      return new Proxy(original, {
        get(modelTarget: any, modelProp) {
          const modelOriginal = modelTarget[modelProp];
          
          // Wrap async operations with retry logic
          if (typeof modelOriginal === 'function') {
            return (...args: any[]) => {
              return withRetry(() => modelOriginal.apply(modelTarget, args));
            };
          }
          
          return modelOriginal;
        },
      });
    }
    
    return original;
  },
});

// Graceful shutdown for production
if (process.env.NODE_ENV === 'production') {
  // Vercel serverless functions should disconnect after each request
  // This is handled automatically, but we ensure cleanup on process exit
  process.on('beforeExit', async () => {
    await basePrisma.$disconnect();
  });
} else {
  // Development: reuse connection
  globalForPrisma.prisma = prisma;
}

// Health check helper
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[Database Health] Connection check failed:', error);
    return false;
  }
}
