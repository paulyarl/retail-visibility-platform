/**
 * Base Permission Service
 * 
 * Core permission logic with override integration.
 * Provides the foundation for context-aware permission checking across all platform layers.
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Extends UniversalSingleton for consistent caching and metrics
 * - Follows singleton pattern with getInstance()
 * - Integrates with existing API request architecture
 * 
 * Layer 3: Base Permission Layer
 * - Perfect alignment with existing API request services
 * - Override-first logic with priority system
 * - Redis-based caching with tenant isolation
 * - Performance optimized (< 100ms cached checks)
 */

import { UniversalSingleton, SingletonCacheOptions } from '../../lib/UniversalSingleton';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface PermissionResult {
  granted: boolean;
  source: 'override' | 'tier' | 'default';
  expiresAt?: Date | null;
  metadata?: Record<string, any>;
}

export interface FeaturePermission extends PermissionResult {
  feature: string;
}

export interface LimitPermission extends PermissionResult {
  limitType: string;
  limit: number;
  current?: number;
  remaining?: number;
}

export interface AccessPermission extends PermissionResult {
  resource: string;
  action: string;
}

export interface PermissionCacheEntry {
  granted: boolean;
  source: 'override' | 'tier' | 'default';
  expiresAt?: string | null;
  timestamp: number;
  ttl: number;
}

export interface PermissionCheckOptions {
  skipCache?: boolean;
  includeMetadata?: boolean;
  timeout?: number;
}

// Cache options for permission services
const PERMISSION_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 10000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'authenticated'
};

/**
 * Base Permission Service - Extends UniversalSingleton
 * 
 * Follows the platform singleton hierarchy pattern for consistency
 */
export abstract class BasePermissionService extends UniversalSingleton {
  protected prisma: PrismaClient;
  protected redis: Redis | null;
  protected cachePrefix: string = 'perm';
  protected defaultTTL: number = 300; // 5 minutes

  constructor(singletonKey: string, options?: SingletonCacheOptions) {
    super(singletonKey, { ...PERMISSION_CACHE_OPTIONS, ...options });
    this.prisma = new PrismaClient();
    this.redis = null; // Will be initialized when Redis is available
  }

  /**
   * Initialize Redis connection (can be called after construction)
   */
  protected async initializeRedis(redis?: Redis): Promise<void> {
    if (redis) {
      this.redis = redis;
    } else if (!this.redis) {
      // Create default Redis connection if not provided
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: 3,
      });
    }
  }

  // ==========================================
  // Abstract Methods - Implemented by Contexts
  // ==========================================

  /**
   * Check if a tenant has access to a specific feature
   */
  abstract hasFeature(tenantId: string, feature: string, options?: PermissionCheckOptions): Promise<boolean>;

  /**
   * Get the limit value for a specific limit type
   */
  abstract getLimit(tenantId: string, limitType: string, options?: PermissionCheckOptions): Promise<number>;

  /**
   * Check if a tenant can access a specific resource with an action
   */
  abstract canAccess(tenantId: string, resource: string, action: string, options?: PermissionCheckOptions): Promise<boolean>;

  /**
   * Get detailed permission result for a feature
   */
  abstract getFeaturePermission(tenantId: string, feature: string, options?: PermissionCheckOptions): Promise<FeaturePermission>;

  /**
   * Get detailed permission result for a limit
   */
  abstract getLimitPermission(tenantId: string, limitType: string, options?: PermissionCheckOptions): Promise<LimitPermission>;

  // ==========================================
  // Override Integration - Core Logic
  // ==========================================

  /**
   * Apply override-first logic to permission checks
   * Priority: Override > Tier > Default
   */
  protected async applyOverrideLogic<T>(
    tenantId: string,
    permissionType: 'feature' | 'limit' | 'access',
    permissionKey: string,
    baseValueFetcher: () => Promise<T>
  ): Promise<{ value: T; source: 'override' | 'tier' | 'default'; override?: any }> {
    try {
      // 1. Check for override first (highest priority)
      const override = await this.getOverride(tenantId, permissionType, permissionKey);
      
      if (override && override.granted !== null && override.granted !== undefined) {
        this.logInfo(`Override found for ${permissionType}:${permissionKey}`, { tenantId });
        return {
          value: override.value as T,
          source: 'override',
          override
        };
      }

      // 2. Fall back to base value (tier or default)
      const baseValue = await baseValueFetcher();
      
      return {
        value: baseValue,
        source: override ? 'override' : 'tier'
      };
    } catch (error) {
      this.logError(`Error in override logic for ${permissionType}:${permissionKey}`, error);
      throw error;
    }
  }

  /**
   * Get override from database for a specific permission
   */
  protected async getOverride(
    tenantId: string,
    permissionType: 'feature' | 'limit' | 'access',
    permissionKey: string
  ): Promise<any | null> {
    try {
      const override = await this.prisma.tenant_feature_overrides_list.findFirst({
        where: {
          tenant_id: tenantId,
          feature: permissionKey,
          granted: true,
          OR: [
            { expires_at: null },
            { expires_at: { gt: new Date() } }
          ]
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return override;
    } catch (error) {
      this.logError('Error fetching override', error);
      return null;
    }
  }

  // ==========================================
  // Caching Layer - Uses UniversalSingleton caching
  // ==========================================

  /**
   * Get permission from cache (uses UniversalSingleton caching)
   */
  protected async getCachedPermission(
    tenantId: string,
    permissionType: string,
    permissionKey: string
  ): Promise<PermissionCacheEntry | null> {
    const cacheKey = this.getCacheKey(tenantId, permissionType, permissionKey);
    return await this.getFromCache<PermissionCacheEntry>(cacheKey);
  }

  /**
   * Set permission in cache (uses UniversalSingleton caching)
   */
  protected async setCachedPermission(
    tenantId: string,
    permissionType: string,
    permissionKey: string,
    value: PermissionCacheEntry
  ): Promise<void> {
    const cacheKey = this.getCacheKey(tenantId, permissionType, permissionKey);
    await this.setCache(cacheKey, value, { ttl: value.ttl || this.defaultTTL });
  }

  /**
   * Invalidate cache for a specific tenant
   */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    try {
      // Use Redis directly for pattern matching if available
      if (this.redis) {
        const pattern = this.getCacheKey(tenantId, '*', '*');
        const keys = await this.redis.keys(pattern);
        
        if (keys.length > 0) {
          await this.redis.del(...keys);
          this.logInfo(`Invalidated ${keys.length} cache entries for tenant`, { tenantId });
        }
      } else {
        // Fall back to clearing all cache
        await this.clearCache();
        this.logInfo('Cleared all permission cache (no Redis)');
      }
    } catch (error) {
      this.logError('Cache invalidation error', error);
    }
  }

  /**
   * Invalidate cache for a specific permission
   */
  async invalidatePermissionCache(
    tenantId: string,
    permissionType: string,
    permissionKey: string
  ): Promise<void> {
    const cacheKey = this.getCacheKey(tenantId, permissionType, permissionKey);
    await this.clearCache(cacheKey);
    this.logInfo(`Invalidated cache for ${permissionType}:${permissionKey}`);
  }

  /**
   * Generate cache key with tenant isolation
   */
  protected getCacheKey(tenantId: string, permissionType: string, permissionKey: string): string {
    return `${this.cachePrefix}:${tenantId}:${permissionType}:${permissionKey}`;
  }

  // ==========================================
  // Batch Operations - Performance Optimization
  // ==========================================

  /**
   * Get multiple permissions in batch
   */
  protected async getMultiplePermissions(
    tenantId: string,
    permissionType: string,
    permissionKeys: string[]
  ): Promise<Record<string, PermissionCacheEntry>> {
    const results: Record<string, PermissionCacheEntry> = {};

    for (const key of permissionKeys) {
      const cached = await this.getCachedPermission(tenantId, permissionType, key);
      if (cached) {
        results[key] = cached;
      }
    }

    return results;
  }

  /**
   * Set multiple permissions in batch
   */
  protected async setMultiplePermissions(
    tenantId: string,
    permissionType: string,
    permissions: Record<string, PermissionCacheEntry>
  ): Promise<void> {
    for (const [key, value] of Object.entries(permissions)) {
      await this.setCachedPermission(tenantId, permissionType, key, value);
    }
    this.logInfo(`Cached ${Object.keys(permissions).length} permissions in batch`);
  }

  // ==========================================
  // Performance Monitoring & Metrics
  // ==========================================

  /**
   * Get cache statistics (extends UniversalSingleton metrics)
   */
  async getPermissionCacheStats(): Promise<{
    totalKeys: number;
    hitRate: number;
    memoryUsage: string;
  }> {
    const metrics = this.getMetrics();
    
    return {
      totalKeys: metrics.cacheSize,
      hitRate: metrics.cacheHitRate,
      memoryUsage: 'N/A' // Would need Redis info for actual memory
    };
  }

  /**
   * Clear all permission cache
   */
  async clearAllPermissionCache(): Promise<void> {
    await this.clearCache();
    this.logInfo('Cleared all permission cache');
  }

  // ==========================================
  // Error Handling & Logging (uses UniversalSingleton methods)
  // ==========================================

  /**
   * Log permission check for debugging
   */
  protected logPermissionCheck(
    tenantId: string,
    permissionType: string,
    permissionKey: string,
    result: boolean,
    source: string,
    duration: number
  ): void {
    this.logInfo(
      `Permission check: ${permissionType}:${permissionKey}`,
      {
        tenantId,
        result: result ? 'GRANTED' : 'DENIED',
        source,
        duration: `${duration}ms`
      }
    );
  }

  /**
   * Handle permission check error
   */
  protected handlePermissionError(
    tenantId: string,
    permissionType: string,
    permissionKey: string,
    error: any
  ): never {
    this.logError(
      `Error checking ${permissionType}:${permissionKey}`,
      { tenantId, error }
    );
    throw new Error(`Permission check failed: ${permissionType}:${permissionKey}`);
  }

  // ==========================================
  // Cleanup
  // ==========================================

  /**
   * Cleanup permission service resources
   */
  async cleanupPermissionService(): Promise<void> {
    await this.cleanup();
    if (this.redis) {
      await this.redis.quit();
    }
    await this.prisma.$disconnect();
  }
}

export default BasePermissionService;
