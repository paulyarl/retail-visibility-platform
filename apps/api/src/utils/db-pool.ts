import { Pool } from 'pg';

/**
 * Centralized database connection pool for direct SQL queries
 * Used across the application for raw SQL operations that bypass Prisma
 */

let directPool: Pool | null = null;

/**
 * Get or create a database connection pool
 * Handles SSL configuration for both development and production environments
 * 
 * @returns Pool instance for direct database queries
 */
export const getDirectPool = (): Pool => {
  // ALWAYS reuse the existing pool - creating new pools causes connection exhaustion
  if (directPool) {
    return directPool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  console.log('[DB Pool] Creating singleton connection pool (production:', isProduction, ')');

  // Check if we need SSL (cloud databases or production)
  const needsSSL = connectionString.includes('supabase.com') || 
                   connectionString.includes('supabase.co') || 
                   connectionString.includes('railway.app') ||
                   connectionString.includes('sslmode=require') ||
                   isProduction;

  // Parse connection string to preserve pgbouncer and other important params
  // Only remove sslmode since we handle SSL separately via the ssl option
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode'); // Remove sslmode, we set it via ssl option
  const cleanConnectionString = url.toString();

  // Get connection limits from URL params or use defaults
  const connectionLimit = parseInt(url.searchParams.get('connection_limit') || '5');
  const poolTimeout = parseInt(url.searchParams.get('pool_timeout') || '10') * 1000; // Convert to ms

  directPool = new Pool({
    connectionString: cleanConnectionString,
    ssl: needsSSL ? {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    } : false,
    max: connectionLimit,
    idleTimeoutMillis: poolTimeout,
    connectionTimeoutMillis: 10000,
  });

  return directPool;
};

/**
 * Close the database connection pool
 * Should be called during application shutdown
 */
export const closeDirectPool = async (): Promise<void> => {
  if (directPool) {
    console.log('[DB Pool] Closing connection pool');
    await directPool.end();
    directPool = null;
  }
};
