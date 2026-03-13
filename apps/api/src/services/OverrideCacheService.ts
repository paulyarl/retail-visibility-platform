/**
 * Override Cache Service
 * 
 * Provides intelligent caching for feature overrides with Redis backend.
 * Implements tenant-specific cache keys, TTL management, and cache invalidation.
 */

import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  ttl: {
    overrides: number; // 5 minutes
    analytics: number; // 1 hour
    approvals: number; // 30 minutes
  };
}

export interface OverrideCacheEntry {
  id: string;
  tenant_id: string;
  feature: string;
  granted: boolean;
  reason: string | null;
  expires_at: Date | null;
  granted_by: string;
  created_at: Date;
  updated_at: Date;
  tenants?: {
    id: string;
    name: string;
    subscription_tier: string | null;
    subscription_status: string | null;
  };
}

export interface AnalyticsCacheEntry {
  type: string;
  period: string;
  data: any;
  timestamp: Date;
}

export class OverrideCacheService {
  private redis: Redis;
  private prisma: PrismaClient;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: 3,
    });
    this.prisma = new PrismaClient();
  }

  /**
   * Get override from cache
   */
  async getOverride(tenantId: string, overrideId: string): Promise<OverrideCacheEntry | null> {
    try {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        const override = JSON.parse(cached) as OverrideCacheEntry;
        // Convert date strings back to Date objects
        override.created_at = new Date(override.created_at);
        override.updated_at = new Date(override.updated_at);
        if (override.expires_at) {
          override.expires_at = new Date(override.expires_at);
        }
        return override;
      }
      
      return null;
    } catch (error) {
      console.error('[Cache] Get override error:', error);
      return null;
    }
  }

  /**
   * Set override in cache
   */
  async setOverride(tenantId: string, overrideId: string, override: OverrideCacheEntry): Promise<void> {
    try {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      const value = JSON.stringify(override);
      
      await this.redis.setex(key, this.config.ttl.overrides, value);
      
      // Also add to tenant's override list
      const tenantListKey = `tenant_overrides:${tenantId}`;
      await this.redis.sadd(tenantListKey, overrideId);
      await this.redis.expire(tenantListKey, this.config.ttl.overrides);
      
    } catch (error) {
      console.error('[Cache] Set override error:', error);
    }
  }

  /**
   * Get all overrides for a tenant
   */
  async getTenantOverrides(tenantId: string): Promise<OverrideCacheEntry[]> {
    try {
      const tenantListKey = `tenant_overrides:${tenantId}`;
      const overrideIds = await this.redis.smembers(tenantListKey);
      
      if (overrideIds.length === 0) {
        return [];
      }
      
      const overrides: OverrideCacheEntry[] = [];
      
      // Batch get all overrides
      const keys = overrideIds.map((id: string) => `feature_overrides:${tenantId}:${id}`);
      const values = await this.redis.mget(...keys);
      
      for (let i = 0; i < values.length; i++) {
        if (values[i]) {
          const override = JSON.parse(values[i]!) as OverrideCacheEntry;
          // Convert date strings back to Date objects
          override.created_at = new Date(override.created_at);
          override.updated_at = new Date(override.updated_at);
          if (override.expires_at) {
            override.expires_at = new Date(override.expires_at);
          }
          overrides.push(override);
        }
      }
      
      return overrides.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      
    } catch (error) {
      console.error('[Cache] Get tenant overrides error:', error);
      return [];
    }
  }

  /**
   * Invalidate all cache entries for a tenant
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    try {
      const tenantListKey = `tenant_overrides:${tenantId}`;
      const overrideIds = await this.redis.smembers(tenantListKey);
      
      if (overrideIds.length > 0) {
        const keys = overrideIds.map((id: string) => `feature_overrides:${tenantId}:${id}`);
        await this.redis.del(...keys);
      }
      
      await this.redis.del(tenantListKey);
      
      // Also invalidate analytics for this tenant
      const analyticsKeys = await this.redis.keys(`analytics:*:*:${tenantId}`);
      if (analyticsKeys.length > 0) {
        await this.redis.del(...analyticsKeys);
      }
      
    } catch (error) {
      console.error('[Cache] Invalidate tenant error:', error);
    }
  }

  /**
   * Invalidate specific override
   */
  async invalidateOverride(tenantId: string, overrideId: string): Promise<void> {
    try {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      await this.redis.del(key);
      
      // Remove from tenant list
      const tenantListKey = `tenant_overrides:${tenantId}`;
      await this.redis.srem(tenantListKey, overrideId);
      
    } catch (error) {
      console.error('[Cache] Invalidate override error:', error);
    }
  }

  /**
   * Get analytics data from cache
   */
  async getAnalytics(type: string, period: string, tenantId?: string): Promise<AnalyticsCacheEntry | null> {
    try {
      const key = tenantId 
        ? `analytics:${type}:${period}:${tenantId}`
        : `analytics:${type}:${period}`;
      
      const cached = await this.redis.get(key);
      
      if (cached) {
        const analytics = JSON.parse(cached) as AnalyticsCacheEntry;
        analytics.timestamp = new Date(analytics.timestamp);
        return analytics;
      }
      
      return null;
    } catch (error) {
      console.error('[Cache] Get analytics error:', error);
      return null;
    }
  }

  /**
   * Set analytics data in cache
   */
  async setAnalytics(type: string, period: string, data: any, tenantId?: string): Promise<void> {
    try {
      const key = tenantId 
        ? `analytics:${type}:${period}:${tenantId}`
        : `analytics:${type}:${period}`;
      
      const analytics: AnalyticsCacheEntry = {
        type,
        period,
        data,
        timestamp: new Date(),
      };
      
      const value = JSON.stringify(analytics);
      await this.redis.setex(key, this.config.ttl.analytics, value);
      
    } catch (error) {
      console.error('[Cache] Set analytics error:', error);
    }
  }

  /**
   * Get approval requests from cache
   */
  async getApprovalRequests(status: string = 'pending'): Promise<any[]> {
    try {
      const key = `approvals:${status}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return [];
    } catch (error) {
      console.error('[Cache] Get approval requests error:', error);
      return [];
    }
  }

  /**
   * Set approval requests in cache
   */
  async setApprovalRequests(status: string, requests: any[]): Promise<void> {
    try {
      const key = `approvals:${status}`;
      const value = JSON.stringify(requests);
      await this.redis.setex(key, this.config.ttl.approvals, value);
    } catch (error) {
      console.error('[Cache] Set approval requests error:', error);
    }
  }

  /**
   * Warm cache for a tenant
   */
  async warmTenantCache(tenantId: string): Promise<void> {
    try {
      // Get overrides from database
      const overrides = await this.prisma.tenant_feature_overrides_list.findMany({
        where: { tenant_id: tenantId },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
              subscription_status: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      // Cache each override
      for (const override of overrides) {
        await this.setOverride(tenantId, override.id, override as OverrideCacheEntry);
      }
      
      console.log(`[Cache] Warmed cache for tenant ${tenantId} with ${overrides.length} overrides`);
      
    } catch (error) {
      console.error('[Cache] Warm tenant cache error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
    info: any;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      const memoryUsage = info.match(/used_memory_human:(.+)/)?.[1] || 'unknown';
      const totalKeys = parseInt(keyspace.match(/db0:keys=(\d+)/)?.[1] || '0');
      
      return {
        totalKeys,
        memoryUsage,
        hitRate: 0, // Would need to track hits/misses separately
        info: { memory: info, keyspace },
      };
    } catch (error) {
      console.error('[Cache] Get stats error:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'unknown',
        hitRate: 0,
        info: {},
      };
    }
  }

  /**
   * Clear all cache (for testing/maintenance)
   */
  async clearCache(): Promise<void> {
    try {
      await this.redis.flushdb();
      console.log('[Cache] Cache cleared');
    } catch (error) {
      console.error('[Cache] Clear cache error:', error);
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      await this.prisma.$disconnect();
    } catch (error) {
      console.error('[Cache] Disconnect error:', error);
    }
  }
}

// Singleton instance
let cacheService: OverrideCacheService | null = null;

export function getCacheService(): OverrideCacheService {
  if (!cacheService) {
    const config: CacheConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      },
      ttl: {
        overrides: 300, // 5 minutes
        analytics: 3600, // 1 hour
        approvals: 1800, // 30 minutes
      },
    };
    
    cacheService = new OverrideCacheService(config);
  }
  
  return cacheService;
}
