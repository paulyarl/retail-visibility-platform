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
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  // In development, always create a new pool to ensure SSL config is applied
  // In production, reuse the existing pool
  if (!directPool || !isProduction) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    console.log('[DB Pool] Creating new connection pool (is production?): '+isProduction);
    //console.log('[DB Pool] Environment:', process.env.NODE_ENV);
    //console.log('[DB Pool] Is Production:', isProduction);

    // Check if we need SSL (cloud databases or production)
    const needsSSL = connectionString.includes('supabase.co') || 
                     connectionString.includes('railway.app') ||
                     connectionString.includes('sslmode=require') ||
                     isProduction;

    // Remove sslmode parameter from connection string if present
    const cleanConnectionString = connectionString.split('?')[0];

    directPool = new Pool({
      connectionString: cleanConnectionString,
      ssl: needsSSL ? {
        rejectUnauthorized: false,
        // Disable SSL verification for development with cloud databases
        checkServerIdentity: () => undefined
      } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    //console.log('[DB Pool] Pool created with SSL:', needsSSL ? 'enabled (no verification)' : 'disabled');
  }

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
