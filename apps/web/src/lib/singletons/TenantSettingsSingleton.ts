/**
 * Tenant Settings Singleton
 * 
 * Manages tenant configuration and settings with automatic caching.
 * Extends UniversalSingleton for consistent architecture.
 * 
 * Features:
 * - Tenant info (name, slug, status, tier)
 * - Tenant profile (logo, branding, colors)
 * - Tenant tier information
 * - Featured products limits
 * - Automatic 15-minute cache TTL
 * - Cache invalidation on updates
 */

import { UniversalSingleton } from '@/providers/base/UniversalSingleton';

// ====================
// TYPES
// ====================

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionTier?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantProfile {
  logo_url?: string;
  banner_url?: string;
  primary_color?: string;
  secondary_color?: string;
  description?: string;
  business_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface TenantTier {
  id: string;
  name: string;
  displayName?: string;
  features?: string[];
  limits?: {
    skus?: number;
    locations?: number;
    featuredProducts?: number;
    users?: number;
  };
  effective?: {
    id: string;
    name: string;
    source: 'tenant' | 'organization';
  };
}

export interface FeaturedProductsLimits {
  tier: string;
  limits: Record<string, number>;
  current: Record<string, number>;
  available: Record<string, number>;
}

// ====================
// TENANT SETTINGS SINGLETON
// ====================

class TenantSettingsSingleton extends UniversalSingleton {
  protected static instances: Map<string, TenantSettingsSingleton> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly tenantId: string;

  private constructor(tenantId: string) {
    super(`tenant-settings-${tenantId}`);
    this.tenantId = tenantId;
    this.cacheTTL = this.CACHE_TTL;
  }

  static getInstance(tenantId: string): TenantSettingsSingleton {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, new TenantSettingsSingleton(tenantId));
    }
    return this.instances.get(tenantId)!;
  }

  static destroyInstance(tenantId: string): void {
    this.instances.delete(tenantId);
  }

  // ====================
  // FETCH METHODS
  // ====================

  /**
   * Fetch tenant info with caching
   */
  async fetchTenantInfo(): Promise<TenantInfo> {
    const cacheKey = `tenant-info-${this.tenantId}`;
    
    try {
      const data = await this.makeApiRequest<TenantInfo>(
        `/api/tenants/${this.tenantId}`,
        { method: 'GET' },
        cacheKey,
        this.CACHE_TTL
      );

      console.log('[TenantSettingsSingleton] Fetched tenant info:', this.tenantId);
      return data;
    } catch (error) {
      console.error('[TenantSettingsSingleton] Error fetching tenant info:', error);
      throw error;
    }
  }

  /**
   * Fetch tenant profile with caching
   */
  async fetchTenantProfile(): Promise<TenantProfile> {
    const cacheKey = `tenant-profile-${this.tenantId}`;
    
    try {
      const data = await this.makeApiRequest<TenantProfile>(
        `/api/tenant/profile?tenant_id=${this.tenantId}`,
        { method: 'GET' },
        cacheKey,
        this.CACHE_TTL
      );

      console.log('[TenantSettingsSingleton] Fetched tenant profile:', this.tenantId);
      return data;
    } catch (error) {
      console.error('[TenantSettingsSingleton] Error fetching tenant profile:', error);
      throw error;
    }
  }

  /**
   * Fetch tenant tier information with caching
   */
  async fetchTenantTier(): Promise<TenantTier> {
    const cacheKey = `tenant-tier-${this.tenantId}`;
    
    try {
      const data = await this.makeApiRequest<TenantTier>(
        `/api/tenants/${this.tenantId}/tier/public`,
        { method: 'GET' },
        cacheKey,
        this.CACHE_TTL
      );

      console.log('[TenantSettingsSingleton] Fetched tenant tier:', this.tenantId);
      return data;
    } catch (error) {
      console.error('[TenantSettingsSingleton] Error fetching tenant tier:', error);
      throw error;
    }
  }

  /**
   * Fetch featured products limits with caching
   */
  async fetchFeaturedProductsLimits(): Promise<FeaturedProductsLimits> {
    const cacheKey = `featured-limits-${this.tenantId}`;
    
    try {
      const data = await this.makeApiRequest<FeaturedProductsLimits>(
        `/api/tenant-limits/featured-products?tenantId=${this.tenantId}`,
        { method: 'GET' },
        cacheKey,
        this.CACHE_TTL
      );

      console.log('[TenantSettingsSingleton] Fetched featured products limits:', this.tenantId);
      return data;
    } catch (error) {
      console.error('[TenantSettingsSingleton] Error fetching featured products limits:', error);
      throw error;
    }
  }

  /**
   * Fetch all tenant settings at once (optimized)
   */
  async fetchAllSettings(): Promise<{
    info: TenantInfo;
    profile: TenantProfile;
    tier: TenantTier;
    featuredLimits: FeaturedProductsLimits;
  }> {
    try {
      const [info, profile, tier, featuredLimits] = await Promise.all([
        this.fetchTenantInfo(),
        this.fetchTenantProfile(),
        this.fetchTenantTier(),
        this.fetchFeaturedProductsLimits(),
      ]);

      console.log('[TenantSettingsSingleton] Fetched all settings:', this.tenantId);
      return { info, profile, tier, featuredLimits };
    } catch (error) {
      console.error('[TenantSettingsSingleton] Error fetching all settings:', error);
      throw error;
    }
  }

  // ====================
  // UPDATE METHODS
  // ====================

  /**
   * Update tenant profile
   * Automatically invalidates cache
   */
  async updateTenantProfile(updates: Partial<TenantProfile>): Promise<TenantProfile> {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      this.apiCalls++;
      const data = await this.makeApiRequest<TenantProfile>(
        `/api/tenant/profile?tenant_id=${this.tenantId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      ) as TenantProfile;

      // Invalidate cache
      await this.clearCache(`tenant-profile-${this.tenantId}`);

      console.log('[TenantSettingsSingleton] Tenant profile updated:', this.tenantId);
      return data;
    } catch (error) {
      console.error('[TenantSettingsSingleton] Error updating tenant profile:', error);
      throw error;
    }
  }

  // ====================
  // CACHE MANAGEMENT
  // ====================

  /**
   * Invalidate all tenant-related caches
   */
  async invalidateAllCaches(): Promise<void> {
    await this.clearCache();
    console.log('[TenantSettingsSingleton] All caches invalidated for tenant:', this.tenantId);
  }

  /**
   * Invalidate specific cache
   */
  async invalidateCache(type: 'info' | 'profile' | 'tier' | 'featured-limits'): Promise<void> {
    const cacheKey = `tenant-${type}-${this.tenantId}`;
    await this.clearCache(cacheKey);
    console.log('[TenantSettingsSingleton] Cache invalidated:', type);
  }

  // ====================
  // METRICS
  // ====================

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.cacheHits + this.cacheMisses > 0 
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 
        : 0,
      apiCalls: this.apiCalls,
      cacheSize: this.cache.size,
      inMemoryCacheSize: this.cache.size,
      persistentCacheSize: 0, // Managed by CacheManager
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiCalls = 0;
    console.log('[TenantSettingsSingleton] Metrics reset');
  }
}

export default TenantSettingsSingleton;
