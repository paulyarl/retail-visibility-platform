import { PrismaClient } from '@prisma/client';

// Ensure a single PrismaClient in dev (nodemon hot reload safe)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Build database URL with SSL configuration for production
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL || '';
  
  // In production, ensure SSL parameters are set correctly for Supabase
  if (process.env.NODE_ENV === 'production') {
    const url = new URL(baseUrl);
    // Remove any existing SSL params
    url.searchParams.delete('sslmode');
    url.searchParams.delete('sslaccept');
    // Add correct SSL params for Supabase
    url.searchParams.set('sslmode', 'require');
    // Note: sslaccept is not a standard PostgreSQL parameter
    // Instead, we rely on NODE_TLS_REJECT_UNAUTHORIZED or proper cert handling
    return url.toString();
  }
  
  return baseUrl;
};

// Configure Prisma with connection pooling and retry logic
// Export basePrisma for use in transactions (avoids retry wrapper issues)
export const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

// Retry logic for intermittent Supabase pooler connection issues
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on connection errors (P1001)
      if (error.code === 'P1001' && attempt < maxRetries) {
        console.log(`[Prisma Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Don't retry other errors or if max retries reached
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

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
