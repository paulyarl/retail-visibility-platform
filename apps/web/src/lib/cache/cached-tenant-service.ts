/**
 * Cached Tenant API Service
 * Consolidates tenant info, tier, and usage calls with local storage caching
 */

import { tenantInfoService } from '@/services/TenantInfoService';
import { tenantManagementService, type TenantUsage } from '@/services/TenantManagementService';
import { LocalStorageCache } from './local-storage-cache';
import type { TenantInfo, TenantTier } from '@/services/PublicTenantInfoService';
import { clientLogger } from '@/lib/client-logger';

export interface CachedTenantData {
  tenant: TenantInfo | null;
  tier: TenantTier | null;
  usage: TenantUsage | null;
  _timestamp: string;
  _cacheVersion: number;
}

export class CachedTenantService {
  private static readonly CACHE_VERSION = 1;
  private static readonly TENANT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly TIER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly USAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get consolidated tenant data with local storage caching
   * Falls back to individual API calls if consolidated endpoint fails
   */
  static async getTenantData(tenantId: string, useCache = true, userId?: string): Promise<CachedTenantData> {
    const cacheKey = `tenant-data`;

    // Try to get from cache first
    if (useCache) {
      const cached = await LocalStorageCache.get<CachedTenantData>(cacheKey, { tenantId, userId });
      if (cached && cached._cacheVersion === this.CACHE_VERSION) {
        // console.log(`[CachedTenantService] Cache hit for tenant ${tenantId}`);
        return cached;
      }
    }

    // console.log(`[CachedTenantService] Cache miss for tenant ${tenantId}, fetching fresh data`);

    try {
      // Get tenant info and usage separately using tenant-scoped service
      const [tenantData, usageData] = await Promise.all([
        tenantInfoService.getCompleteTenantInfo(tenantId),
        tenantManagementService.getTenantUsage(tenantId)
      ]);

      const cachedData: CachedTenantData = {
        tenant: tenantData.tenant,
        tier: null, // Would need to get from TenantInfoService.getTenantTier if needed
        usage: usageData,
        _timestamp: new Date().toISOString(),
        _cacheVersion: this.CACHE_VERSION
      };

      // Cache the consolidated data
      await LocalStorageCache.set(cacheKey, cachedData, {
        ttl: Math.min(this.TENANT_CACHE_TTL, this.TIER_CACHE_TTL, this.USAGE_CACHE_TTL),
        userId
      });

      return cachedData;
    } catch (error) {
      clientLogger.error('[CachedTenantService] Failed to fetch consolidated tenant data:', { detail: error });
      throw error;
    }
  }

  /**
   * Get basic tenant information with caching
   */
  static async getTenantInfo(tenantId: string, useCache = true): Promise<TenantInfo> {
    const cacheKey = `tenant-info`;

    if (useCache) {
      const cached = await LocalStorageCache.get<TenantInfo>(cacheKey, { tenantId });
      if (cached) {
        return cached;
      }
    }

    const tenant = await tenantInfoService.getTenantInfo(tenantId);
    
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    await LocalStorageCache.set(cacheKey, tenant, { ttl: this.TENANT_CACHE_TTL, tenantId });

    return tenant;
  }

  /**
   * Get tenant tier information with caching
   */
  static async getTenantTier(tenantId: string, useCache = true): Promise<TenantTier> {
    const cacheKey = `tenant-tier`;

    if (useCache) {
      const cached = await LocalStorageCache.get<TenantTier>(cacheKey, { tenantId });
      if (cached) {
        return cached;
      }
    }

    const data = await tenantInfoService.getTenantTier(tenantId);
    
    if (!data) {
      throw new Error(`Tier data not found for tenant: ${tenantId}`);
    }

    await LocalStorageCache.set(cacheKey, data, { ttl: this.TIER_CACHE_TTL, tenantId });

    return data;
  }

  /**
   * Get tenant usage statistics with caching
   */
  static async getTenantUsage(tenantId: string, useCache = true): Promise<TenantUsage> {
    const cacheKey = `tenant-usage`;

    if (useCache) {
      const cached = await LocalStorageCache.get<TenantUsage>(cacheKey, { tenantId });
      if (cached) {
        return cached;
      }
    }

    const data = await tenantManagementService.getTenantUsage(tenantId);
    
    if (!data) {
      throw new Error(`Usage data not found for tenant: ${tenantId}`);
    }

    await LocalStorageCache.set(cacheKey, data, { ttl: this.USAGE_CACHE_TTL, tenantId });

    return data;
  }

  /**
   * Invalidate cache for a specific tenant
   */
  static invalidateTenantCache(tenantId: string): void {
    console.log(`[CachedTenantService] Invalidating cache for tenant ${tenantId}`);
    LocalStorageCache.clear(tenantId);
  }

  /**
   * Invalidate all tenant caches
   */
  static invalidateAllCaches(): void {
    console.log('[CachedTenantService] Invalidating all tenant caches');
    LocalStorageCache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  static getCacheStats(tenantId?: string): { entries: number; size: number; tenantId?: string } {
    const stats = LocalStorageCache.getStats(tenantId);
    return { ...stats, tenantId };
  }

  /**
   * Force refresh tenant data (bypass cache)
   */
  static async refreshTenantData(tenantId: string): Promise<CachedTenantData> {
    // Clear cache first
    this.invalidateTenantCache(tenantId);

    // Fetch fresh data
    return this.getTenantData(tenantId, false);
  }
}
