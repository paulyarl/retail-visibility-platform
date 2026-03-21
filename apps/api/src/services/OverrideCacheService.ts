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
  mode: 'redis' | 'memory' | 'disabled'; // Add cache mode switch
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
  private redis: Redis | null = null;
  private prisma: PrismaClient;
  private config: CacheConfig;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private lastErrorTime: number = 0;
  private errorCooldown: number = 30000; // 30 seconds
  private mode: 'redis' | 'memory' | 'disabled';
  
  // In-memory cache for memory mode
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map();

  constructor(config: CacheConfig) {
    this.config = config;
    this.mode = config.mode;
    this.prisma = new PrismaClient();
    
    if (this.mode === 'redis') {
      this.initRedis();
    } else if (this.mode === 'memory') {
      console.log('[Cache] Using in-memory cache mode');
    } else {
      console.log('[Cache] Cache disabled');
    }
  }

  private initRedis(): void {
    try {
      this.redis = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db,
        maxRetriesPerRequest: 0, // Disable automatic retries
        lazyConnect: true,
      });

      // Handle connection events
      this.redis.on('connect', () => {
        console.log('[Cache] Redis connected successfully');
        this.connected = true;
        this.reconnectAttempts = 0;
      });

      this.redis.on('error', (error) => {
        const now = Date.now();
        // Only log errors if we haven't logged recently (to prevent spam)
        if (now - this.lastErrorTime > this.errorCooldown) {
          console.error('[Cache] Redis connection error:', (error as Error).message);
          this.lastErrorTime = now;
        }
        this.connected = false;
      });

      this.redis.on('close', () => {
        if (this.connected) { // Only log if we were previously connected
          console.warn('[Cache] Redis connection closed');
        }
        this.connected = false;
        this.scheduleReconnect();
      });

      // Attempt initial connection
      this.connect();
    } catch (error) {
      // console.error('[Cache] Redis initialization failed:', error);
      this.connected = false;
      // Fallback to memory cache
      this.mode = 'memory';
      console.log('[Cache] Falling back to memory cache mode');
    }
  }

  private async connect(): Promise<void> {
    if (!this.redis) {
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // console.warn('[Cache] Max reconnect attempts reached, switching to memory cache');
      this.mode = 'memory';
      return;
    }

    try {
      await this.redis.connect();
    } catch (error) {
      this.reconnectAttempts++;
      // console.error(`[Cache] Failed to connect to Redis (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, (error as Error).message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    setTimeout(() => this.connect(), delay);
  }

  private setMemoryCache(key: string, data: any, ttlSeconds: number): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.memoryCache.set(key, { data, expiry });
  }

  private getMemoryCache(key: string): any {
    const item = this.memoryCache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.data;
  }

  private cleanExpiredMemoryCache(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }
    
    if (!this.connected) {
      try {
        await this.redis.connect();
        return this.connected;
      } catch (error) {
        // console.warn('[Cache] Redis not available, operating without cache');
        return false;
      }
    }
    return true;
  }

  /**
   * Get override from cache
   */
  async getOverride(tenantId: string, overrideId: string): Promise<OverrideCacheEntry | null> {
    if (this.mode === 'disabled') {
      return null;
    }

    if (this.mode === 'memory') {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      return this.getMemoryCache(key);
    }

    // Redis mode
    if (!(await this.ensureConnection()) || !this.redis) {
      return null;
    }

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
    if (this.mode === 'disabled') {
      return;
    }

    if (this.mode === 'memory') {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      this.setMemoryCache(key, override, this.config.ttl.overrides);
      return;
    }

    // Redis mode
    if (!(await this.ensureConnection()) || !this.redis) {
      return; // Silently fail if Redis is not available
    }

    try {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      const value = JSON.stringify(override);
      await this.redis!.setex(key, this.config.ttl.overrides, value);
      
      // Also add to tenant's override list
      const tenantListKey = `tenant_overrides:${tenantId}`;
      await this.redis!.sadd(tenantListKey, overrideId);
      await this.redis!.expire(tenantListKey, this.config.ttl.overrides);
      
    } catch (error) {
      console.error('[Cache] Set override error:', error);
    }
  }

  /**
   * Get all overrides for a tenant
   */
  async getTenantOverrides(tenantId: string): Promise<OverrideCacheEntry[]> {
    if (this.mode === 'disabled') {
      return [];
    }

    if (this.mode === 'memory') {
      return [];
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return [];
    }

    try {
      const tenantListKey = `tenant_overrides:${tenantId}`;
      const overrideIds = await this.redis!.smembers(tenantListKey);
      
      if (overrideIds.length === 0) {
        return [];
      }
      
      const keys = overrideIds.map((id: string) => `feature_overrides:${tenantId}:${id}`);
      const values = await this.redis!.mget(...keys);
      
      const overrides: OverrideCacheEntry[] = [];
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value) {
          const override = JSON.parse(value) as OverrideCacheEntry;
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
    if (this.mode === 'disabled') {
      return;
    }

    if (this.mode === 'memory') {
      const keysToDelete: string[] = [];
      for (const [key] of this.memoryCache.entries()) {
        if (key.includes(tenantId)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.memoryCache.delete(key));
      return;
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return;
    }

    try {
      const tenantListKey = `tenant_overrides:${tenantId}`;
      const overrideIds = await this.redis!.smembers(tenantListKey);
      
      if (overrideIds.length > 0) {
        const keys = overrideIds.map((id: string) => `feature_overrides:${tenantId}:${id}`);
        await this.redis!.del(...keys);
      }
      
      await this.redis!.del(tenantListKey);
      
      const analyticsKeys = await this.redis!.keys(`analytics:*:*:${tenantId}`);
      if (analyticsKeys.length > 0) {
        await this.redis!.del(...analyticsKeys);
      }
    } catch (error) {
      console.error('[Cache] Invalidate tenant error:', error);
    }
  }

  /**
   * Invalidate a specific override
   */
  async invalidateOverride(tenantId: string, overrideId: string): Promise<void> {
    if (this.mode === 'disabled') {
      return;
    }

    if (this.mode === 'memory') {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      this.memoryCache.delete(key);
      return;
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return;
    }

    try {
      const key = `feature_overrides:${tenantId}:${overrideId}`;
      await this.redis!.del(key);
      
      const tenantListKey = `tenant_overrides:${tenantId}`;
      await this.redis!.srem(tenantListKey, overrideId);
    } catch (error) {
      console.error('[Cache] Invalidate override error:', error);
    }
  }

  /**
   * Get analytics data from cache
   */
  async getAnalytics(type: string, period: string, tenantId?: string): Promise<AnalyticsCacheEntry | null> {
    if (this.mode === 'disabled') {
      return null;
    }

    if (this.mode === 'memory') {
      const key = tenantId 
        ? `analytics:${type}:${period}:${tenantId}`
        : `analytics:${type}:${period}`;
      return this.getMemoryCache(key);
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return null;
    }

    try {
      const key = tenantId 
        ? `analytics:${type}:${period}:${tenantId}`
        : `analytics:${type}:${period}`;
      
      const cached = await this.redis!.get(key);
      
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
    if (this.mode === 'disabled') {
      return;
    }

    if (this.mode === 'memory') {
      const key = tenantId 
        ? `analytics:${type}:${period}:${tenantId}`
        : `analytics:${type}:${period}`;
      
      const entry: AnalyticsCacheEntry = {
        type,
        period,
        data,
        timestamp: new Date()
      };
      
      this.setMemoryCache(key, entry, this.config.ttl.analytics);
      return;
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return;
    }

    try {
      const key = tenantId 
        ? `analytics:${type}:${period}:${tenantId}`
        : `analytics:${type}:${period}`;
      
      const entry: AnalyticsCacheEntry = {
        type,
        period,
        data,
        timestamp: new Date()
      };
      
      await this.redis!.setex(key, this.config.ttl.analytics, JSON.stringify(entry));
    } catch (error) {
      console.error('[Cache] Set analytics error:', error);
    }
  }

  /**
   * Get approval requests from cache
   */
  async getApprovalRequests(status: string = 'pending'): Promise<any[]> {
    if (this.mode === 'disabled') {
      return [];
    }

    if (this.mode === 'memory') {
      const key = `approval_requests:${status}`;
      return this.getMemoryCache(key) || [];
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return [];
    }

    try {
      const key = `approval_requests:${status}`;
      const cached = await this.redis!.get(key);
      
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
  async setApprovalRequests(requests: any[], status: string = 'pending'): Promise<void> {
    if (this.mode === 'disabled') {
      return;
    }

    if (this.mode === 'memory') {
      const key = `approval_requests:${status}`;
      this.setMemoryCache(key, requests, this.config.ttl.approvals);
      return;
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return;
    }

    try {
      const key = `approval_requests:${status}`;
      const value = JSON.stringify(requests);
      await this.redis!.setex(key, this.config.ttl.approvals, value);
    } catch (error) {
      console.error('[Cache] Set approval requests error:', error);
    }
  }

  /**
   * Warm cache for a tenant
   */
  async warmTenantCache(tenantId: string): Promise<void> {
    if (this.mode === 'disabled') {
      return;
    }

    try {
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
  async getStats(): Promise<any> {
    if (this.mode === 'disabled') {
      return {
        totalKeys: 0,
        memoryUsage: 'disabled',
        hitRate: 0,
        info: {},
      };
    }

    if (this.mode === 'memory') {
      this.cleanExpiredMemoryCache();
      return {
        totalKeys: this.memoryCache.size,
        memoryUsage: 'in-memory',
        hitRate: 0,
        info: {
          mode: 'memory',
          cacheSize: this.memoryCache.size
        },
      };
    }

    if (!(await this.ensureConnection()) || !this.redis) {
      return {
        totalKeys: 0,
        memoryUsage: 'unknown',
        hitRate: 0,
        info: {},
      };
    }

    try {
      const info = await this.redis!.info('memory');
      const keyspace = await this.redis!.info('keyspace');
      return {
        totalKeys: parseInt(keyspace.match(/db0:keys=(\d+)/)?.[1] || '0'),
        memoryUsage: info.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'unknown',
        hitRate: 0,
        info: {
          memory: info,
          keyspace,
        },
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
   * Alias for getStats for backward compatibility
   */
  async getCacheStats(): Promise<any> {
    return this.getStats();
  }

  /**
   * Clear all cache (for testing/maintenance)
   */
  async clearCache(): Promise<void> {
    if (this.mode === 'memory') {
      this.memoryCache.clear();
      console.log('[Cache] Memory cache cleared');
      return;
    }
    
    if (!this.redis) {
      return;
    }
    
    try {
      await this.redis.flushdb();
      console.log('[Cache] Redis cache cleared');
    } catch (error) {
      console.error('[Cache] Clear cache error:', error);
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.error('[Cache] Disconnect error:', error);
      }
    }
    
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      console.error('[Cache] Prisma disconnect error:', error);
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
      mode: (process.env.CACHE_MODE as 'redis' | 'memory' | 'disabled') || 'redis',
    };
    
    console.log(`[Cache] Initializing cache service in ${config.mode} mode`);
    cacheService = new OverrideCacheService(config);
  }
  
  return cacheService;
}
