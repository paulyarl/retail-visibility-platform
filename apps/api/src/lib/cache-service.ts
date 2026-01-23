/**
 * Unified Cache Service
 * Provides Redis caching with graceful fallback to in-memory cache
 * Used across the application for performance optimization
 */

import { createClient } from 'redis';

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  SHORT: 5 * 60,        // 5 minutes
  MEDIUM: 15 * 60,      // 15 minutes
  LONG: 60 * 60,       // 1 hour
  VERY_LONG: 4 * 60 * 60, // 4 hours
  DAILY: 24 * 60 * 60,  // 1 day
  FEATURED_PRODUCTS: 10 * 60, // 10 minutes for featured products
} as const;

// Cache key patterns
export const CacheKeys = {
  // Tenant data
  TENANT_INFO: (tenantId: string) => `tenant:${tenantId}:info`,
  TENANT_LIMITS: (tenantId: string) => `tenant:${tenantId}:limits`,
  TENANT_USAGE: (tenantId: string) => `tenant:${tenantId}:usage`,
  
  // Directory data
  DIRECTORY_LISTINGS: (location?: string) => `directory:listings:${location || 'global'}`,
  DIRECTORY_CATEGORIES: () => `directory:categories`,
  DIRECTORY_SEARCH: (query: string) => `directory:search:${query}`,
  
  // Product data
  PRODUCTS: (tenantId: string, category?: string) => `products:${tenantId}:${category || 'all'}`,
  FEATURED_PRODUCTS: (location?: string) => `featured:${location || 'global'}`,
  PRODUCT_SEARCH: (tenantId: string, query: string) => `products:${tenantId}:search:${query}`,
  
  // User data
  USER_PREFERENCES: (userId: string) => `user:${userId}:preferences`,
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  USER_SESSION: (sessionId: string) => `session:${sessionId}`,
  
  // Admin data
  ADMIN_DASHBOARD: () => `admin:dashboard`,
  ADMIN_STATS: () => `admin:stats`,
  ADMIN_TENANTS: () => `admin:tenants`,
  
  // Business hours
  BUSINESS_HOURS: (tenantId: string) => `business:${tenantId}:hours`,
  BUSINESS_HOURS_STATUS: (tenantId: string) => `business:${tenantId}:status`,
  
  // Quick start data
  QUICK_START_PRODUCTS: () => `quickstart:products`,
  QUICK_START_CATEGORIES: () => `quickstart:categories`,
} as const;

// Redis client
let redisClient: ReturnType<typeof createClient> | null = null;
let isRedisConnected = false;

// Fallback in-memory cache
const fallbackCache = new Map<string, CacheEntry>();

// Cache entry interface
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl?: number; // TTL in seconds
}

/**
 * Initialize Redis connection
 */
const initRedis = async (): Promise<void> => {
  if (isRedisConnected && redisClient) return;

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
      },
    });

    await redisClient.connect();
    isRedisConnected = true;
    console.log('[CacheService] Redis connected successfully');
  } catch (error) {
    console.warn('[CacheService] Redis connection failed, using fallback cache:', error);
    redisClient = null;
    isRedisConnected = false;
  }
};

/**
 * Get cached data
 * @param key - Cache key
 * @returns Cached data or null if not found/expired
 */
export const get = async (key: string): Promise<any | null> => {
  // Initialize Redis if not already done
  if (!isRedisConnected) {
    await initRedis();
  }

  // Try Redis first
  if (redisClient) {
    try {
      const cached = await redisClient.get(key);
      if (cached && typeof cached === 'string') {
        const parsed = JSON.parse(cached);
        return parsed.data;
      }
    } catch (error) {
      console.warn('[CacheService] Redis get failed, using fallback:', error);
    }
  }

  // Fallback to in-memory cache
  const entry = fallbackCache.get(key);
  if (!entry) return null;

  // Check TTL (default to 10 minutes if not specified)
  const ttl = entry.ttl || CACHE_TTL.MEDIUM;
  if (Date.now() - entry.timestamp > ttl * 1000) {
    fallbackCache.delete(key);
    return null;
  }

  return entry.data;
};

/**
 * Set cached data
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in seconds (optional)
 */
export const set = async (key: string, data: any, ttl?: number): Promise<void> => {
  // Initialize Redis if not already done
  if (!isRedisConnected) {
    await initRedis();
  }

  const cacheTtl = ttl || CACHE_TTL.MEDIUM;

  // Try Redis first
  if (redisClient) {
    try {
      await redisClient.setEx(key, cacheTtl, JSON.stringify({ data, timestamp: Date.now() }));
      return;
    } catch (error) {
      console.warn('[CacheService] Redis set failed, using fallback:', error);
    }
  }

  // Fallback to in-memory cache
  fallbackCache.set(key, { data, timestamp: Date.now(), ttl: cacheTtl });
};

/**
 * Delete cached data
 * @param key - Cache key to delete
 */
export const del = async (key: string): Promise<void> => {
  // Initialize Redis if not already done
  if (!isRedisConnected) {
    await initRedis();
  }

  // Try Redis first
  if (redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (error) {
      console.warn('[CacheService] Redis del failed, using fallback:', error);
    }
  }

  // Fallback to in-memory cache
  fallbackCache.delete(key);
};

/**
 * Clear cache by pattern
 * @param pattern - Pattern to match (supports wildcards)
 */
export const clear = async (pattern: string): Promise<void> => {
  // Initialize Redis if not already done
  if (!isRedisConnected) {
    await initRedis();
  }

  // Try Redis first
  if (redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return;
    } catch (error) {
      console.warn('[CacheService] Redis clear failed, using fallback:', error);
    }
  }

  // Fallback to in-memory cache
  for (const [key] of fallbackCache.entries()) {
    if (key.startsWith(pattern)) {
      fallbackCache.delete(key);
    }
  }
};

/**
 * Get cache statistics
 * @returns Cache stats object
 */
export const getStats = async (): Promise<{
  redisConnected: boolean;
  fallbackSize: number;
  redisMemory?: string;
}> => {
  let redisMemory = undefined;
  
  if (redisClient && isRedisConnected) {
    try {
      const info = await redisClient.info('memory');
      redisMemory = info.split('\n').find(line => line.startsWith('used_memory:'));
    } catch (error) {
      console.warn('[CacheService] Redis info failed:', error);
    }
  }

  return {
    redisConnected: isRedisConnected,
    fallbackSize: fallbackCache.size,
    redisMemory,
  };
};

/**
 * Warm up cache with commonly accessed data
 */
export const warmup = async (): Promise<void> => {
  console.log('[CacheService] Starting cache warmup...');
  
  // Initialize Redis if not already done
  if (!isRedisConnected) {
    await initRedis();
  }

  // Add commonly accessed data to cache
  // This would be expanded based on your application needs
  const warmupKeys = [
    CacheKeys.ADMIN_DASHBOARD(),
    CacheKeys.DIRECTORY_CATEGORIES(),
    CacheKeys.QUICK_START_PRODUCTS(),
  ];

  for (const key of warmupKeys) {
    try {
      await get(key); // This will populate the cache if data exists
    } catch (error) {
      console.warn(`[CacheService] Warmup failed for key ${key}:`, error);
    }
  }

  console.log('[CacheService] Cache warmup completed');
};

export default {
  get,
  set,
  del,
  clear,
  getStats,
  warmup,
  CACHE_TTL,
  CacheKeys,
};
