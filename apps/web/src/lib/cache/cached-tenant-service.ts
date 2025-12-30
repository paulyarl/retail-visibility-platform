/**
 * Cached Tenant API Service
 * Consolidates tenant info, tier, and usage calls with local storage caching
 */

import { api } from '@/lib/api';
import { LocalStorageCache } from './local-storage-cache';

export interface TenantInfo {
  id: string;
  name: string;
  organizationId?: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  locationStatus: string;
  subdomain?: string;
  createdAt: string;
  statusInfo?: any;
  stats?: {
    productCount: number;
    userCount: number;
  };
}

export interface TenantTier {
  tenantId: string;
  tenantName: string;
  tier: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  isChain: boolean;
  organizationId?: string;
  organizationName?: string;
  organizationTier?: any;
  tenantTier?: any;
  effective?: any;
}

export interface TenantUsage {
  tenantId: string;
  currentItems: number;
  activeItems: number;
  monthlySkuQuota?: number;
  skusAddedThisMonth: number;
  quotaRemaining?: number;
  // Additional fields expected by useTenantTier
  products: number;
  locations: number;
  users: number;
  apiCalls: number;
  storageGB: number;
}

export interface CachedTenantData {
  tenant: TenantInfo;
  tier: TenantTier;
  usage: TenantUsage;
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
  static async getTenantData(tenantId: string, useCache = true): Promise<CachedTenantData> {
    const cacheKey = `tenant-data`;

    // Try to get from cache first
    if (useCache) {
      const cached = LocalStorageCache.get<CachedTenantData>(cacheKey, tenantId);
      if (cached && cached._cacheVersion === this.CACHE_VERSION) {
        console.log(`[CachedTenantService] Cache hit for tenant ${tenantId}`);
        return cached;
      }
    }

    console.log(`[CachedTenantService] Cache miss for tenant ${tenantId}, fetching fresh data`);

    try {
      // Try the consolidated endpoint first
      const consolidatedResponse = await api.get(`/api/tenants/${tenantId}/complete`);
      if (consolidatedResponse.ok) {
        const data = await consolidatedResponse.json();

        const cachedData: CachedTenantData = {
          tenant: data.tenant,
          tier: data.tier,
          usage: data.usage,
          _timestamp: data._timestamp || new Date().toISOString(),
          _cacheVersion: this.CACHE_VERSION
        };

        // Cache the consolidated data
        LocalStorageCache.set(cacheKey, cachedData, {
          ttl: Math.min(this.TENANT_CACHE_TTL, this.TIER_CACHE_TTL, this.USAGE_CACHE_TTL),
          tenantId
        });

        return cachedData;
      }
    } catch (error) {
      console.warn('[CachedTenantService] Consolidated endpoint failed, falling back to individual calls:', error);
    }

    // Fallback to individual API calls
    const [tenant, tier, usage] = await Promise.all([
      this.getTenantInfo(tenantId, useCache),
      this.getTenantTier(tenantId, useCache),
      this.getTenantUsage(tenantId, useCache)
    ]);

    const cachedData: CachedTenantData = {
      tenant,
      tier,
      usage,
      _timestamp: new Date().toISOString(),
      _cacheVersion: this.CACHE_VERSION
    };

    // Cache the assembled data
    LocalStorageCache.set(cacheKey, cachedData, {
      ttl: Math.min(this.TENANT_CACHE_TTL, this.TIER_CACHE_TTL, this.USAGE_CACHE_TTL),
      tenantId
    });

    return cachedData;
  }

  /**
   * Get basic tenant information with caching
   */
  static async getTenantInfo(tenantId: string, useCache = true): Promise<TenantInfo> {
    const cacheKey = `tenant-info`;

    if (useCache) {
      const cached = LocalStorageCache.get<TenantInfo>(cacheKey, tenantId);
      if (cached) {
        return cached;
      }
    }

    const response = await api.get(`/api/tenants/${tenantId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tenant info: ${response.status}`);
    }

    const data = await response.json();

    LocalStorageCache.set(cacheKey, data, { ttl: this.TENANT_CACHE_TTL, tenantId });

    return data;
  }

  /**
   * Get tenant tier information with caching
   */
  static async getTenantTier(tenantId: string, useCache = true): Promise<TenantTier> {
    const cacheKey = `tenant-tier`;

    if (useCache) {
      const cached = LocalStorageCache.get<TenantTier>(cacheKey, tenantId);
      if (cached) {
        return cached;
      }
    }

    const response = await api.get(`/api/tenants/${tenantId}/tier`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tenant tier: ${response.status}`);
    }

    const data = await response.json();

    LocalStorageCache.set(cacheKey, data, { ttl: this.TIER_CACHE_TTL, tenantId });

    return data;
  }

  /**
   * Get tenant usage statistics with caching
   */
  static async getTenantUsage(tenantId: string, useCache = true): Promise<TenantUsage> {
    const cacheKey = `tenant-usage`;

    if (useCache) {
      const cached = LocalStorageCache.get<TenantUsage>(cacheKey, tenantId);
      if (cached) {
        return cached;
      }
    }

    const response = await api.get(`/api/tenants/${tenantId}/usage`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tenant usage: ${response.status}`);
    }

    const data = await response.json();

    // Transform API response to match TenantUsage interface
    const usage: TenantUsage = {
      tenantId: data.tenantId,
      currentItems: data.currentItems || 0,
      activeItems: data.activeItems || 0,
      monthlySkuQuota: data.monthlySkuQuota,
      skusAddedThisMonth: data.skusAddedThisMonth || 0,
      quotaRemaining: data.quotaRemaining,
      // Additional fields for compatibility
      products: data.currentItems || 0,
      locations: data.locations || 1,
      users: data.users || 0,
      apiCalls: data.apiCalls || 0,
      storageGB: data.storageGB || 0
    };

    LocalStorageCache.set(cacheKey, usage, { ttl: this.USAGE_CACHE_TTL, tenantId });

    return usage;
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
