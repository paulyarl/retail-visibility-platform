/**
 * Admin Tenant Limits Singleton Service
 *
 * Extends AdminApiSingleton to provide admin-level tenant limits operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Provides admin-specific operations for managing tenant limits across the platform
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface FeaturedProductsLimit {
  store_selection: number;
  new_arrival: number;
  seasonal: number;
  sale: number;
  staff_pick: number;
  random_featured: number;
  bestseller: number;
  clearance: number;
  trending: number;
  featured: number;
  recommended: number;
}

export interface TierLimits {
  [tier: string]: FeaturedProductsLimit;
}

export interface TierSystemTier {
  id: string;
  tierKey: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
  features: Array<{
    id: string;
    featureKey: string;
    featureName: string;
    isEnabled: boolean;
    isInherited: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantLimitConfig {
  limit: number;
  displayName: string;
  description: string;
  upgradeMessage: string;
  upgradeToTier?: string;
}

export interface LimitsData {
  tenantLimits: Record<string, TenantLimitConfig>;
  featuredLimits: FeaturedProductsLimit;
  currentTier: string;
  tiers: TierSystemTier[];
}

class AdminTenantLimitsSingletonService extends AdminApiSingleton {
  private static instance: AdminTenantLimitsSingletonService;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for admin limits

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'admin-tenant-limits*',
      'admin-featured-products*',
      'admin-tier-system*',
      'platform-limits*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    // console.log(`[AdminTenantLimits] Starting cache invalidation...`);
    
    const patterns = [
      'admin-tenant-limits*',
      'admin-featured-products*', 
      '/api/admin/tier-system/tiers*',
      '/api/tenant-limits/tiers*',
      '/api/tenant-limits/featured-products/all*',
      'platform-limits*'
    ];
    
    for (const pattern of patterns) {
      // console.log(`[AdminTenantLimits] Invalidating pattern: ${pattern}`);
      await this.invalidateCachePattern(pattern);
    }
    
    // console.log(`[AdminTenantLimits] Cache invalidation completed`);
  }

  /**
   * Invalidate a specific cache key with logging
   */
  public async invalidateCache(cacheKey: string): Promise<void> {
    // console.log(`[AdminTenantLimits] Invalidating specific cache key: ${cacheKey}`);
    await this.clearCache(cacheKey);
    // console.log(`[AdminTenantLimits] Cache key invalidated: ${cacheKey}`);
  }

  protected constructor() {
    super('admin-tenant-limits', {
      ttl: 5 * 60 * 1000 // 5 minutes for admin limits
    });
  }

  public static getInstance(): AdminTenantLimitsSingletonService {
    if (!AdminTenantLimitsSingletonService.instance) {
      AdminTenantLimitsSingletonService.instance = new AdminTenantLimitsSingletonService();
    }
    return AdminTenantLimitsSingletonService.instance;
  }

  /**
   * Force refresh all cached data
   */
  async forceRefreshAll(): Promise<void> {
    try {
      // console.log('[AdminTenantLimits] Force refreshing all cached data...');
      await this.invalidateServiceCaches();
      
      // Force refresh individual endpoints
      await this.getTierSystemTiers(false);
      await this.getTenantLimitsTiers();
      await this.getAllFeaturedProductsLimits();
      
      // console.log('[AdminTenantLimits] All cached data refreshed successfully');
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to force refresh cached data:', { detail: error });
    }
  }

  /**
   * Get tier system data with caching
   * Uses the /api/admin/tier-system/tiers endpoint
   */
  async getTierSystemTiers(includeInactive: boolean = false): Promise<TierSystemTier[] | null> {
    try {
      const result = await this.makeDefaultRequest<{ tiers: TierSystemTier[] }>(
        `/api/admin/tier-system/tiers${includeInactive ? '?includeInactive=true' : ''}`,
        {},
        `tier-system-tiers-${includeInactive}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        clientLogger.error('[AdminTenantLimits] Failed to get tier system tiers:', { detail: result.error });
        return null;
      }

      return result.data?.tiers || null;
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to get tier system tiers:', { detail: error });
      return null;
    }
  }

  /**
   * Get all tenant limits tiers with caching
   * Uses the /api/tenant-limits/tiers endpoint
   */
  async getTenantLimitsTiers(): Promise<Record<string, TenantLimitConfig> | null> {
    try {
      const result = await this.makeDefaultRequest<{ tiers: Record<string, TenantLimitConfig> }>(
        '/api/tenant-limits/tiers',
        {},
        'tenant-limits-tiers',
        this.cacheTTL
      );
      
      if (!result.success) {
        clientLogger.error('[AdminTenantLimits] Failed to get tenant limits tiers:', { detail: result.error });
        return null;
      }

      return result.data?.tiers || null;
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to get tenant limits tiers:', { detail: error });
      return null;
    }
  }

  /**
   * Get all featured products limits for all tiers with caching
   * Uses the /api/tenant-limits/featured-products/all endpoint
   */
  async getAllFeaturedProductsLimits(): Promise<TierLimits | null> {
    try {
      const result = await this.makeDefaultRequest<{ limits: TierLimits }>(
        '/api/tenant-limits/featured-products/all',
        {},
        'featured-products-all',
        this.cacheTTL
      );
      
      if (!result.success) {
        clientLogger.error('[AdminTenantLimits] Failed to get all featured products limits:', { detail: result.error });
        return null;
      }

      return result.data?.limits || null;
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to get all featured products limits:', { detail: error });
      return null;
    }
  }

  /**
   * Update featured products limits for a tier
   * Uses the PUT /api/tenant-limits/featured-products endpoint
   */
  async updateFeaturedProductsLimits(tier: string, limits: FeaturedProductsLimit): Promise<{ success: boolean; updatedLimits?: FeaturedProductsLimit; message?: string }> {
    try {
      // Ensure all required fields are present with defaults
      const completeLimits: FeaturedProductsLimit = {
        store_selection: limits.store_selection || 0,
        new_arrival: limits.new_arrival || 0,
        seasonal: limits.seasonal || 0,
        sale: limits.sale || 0,
        staff_pick: limits.staff_pick || 0,
        random_featured: limits.random_featured || 0, // Ensure this field is always included
        bestseller: limits.bestseller || 0,
        clearance: limits.clearance || 0,
        trending: limits.trending || 0,
        featured: limits.featured || 0,
        recommended: limits.recommended || 0,
      };

      const result = await this.makeDefaultRequest(
        '/api/tenant-limits/featured-products',
        {
          method: 'PUT',
          body: JSON.stringify({ tier, limits: completeLimits })
        },
        `update-featured-products-${tier}`,
        0 // No cache for write operations
      );
      
      if (!result.success) {
        clientLogger.error('[AdminTenantLimits] Failed to update featured products limits:', { detail: result.error });
        return { success: false };
      }

      // Invalidate relevant caches after update
      await this.invalidateServiceCaches();
      
      // Return success and the updated limits data
      return { 
        success: true, 
        updatedLimits: (result.data as any)?.limits,
        message: (result.data as any)?.message 
      };
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to update featured products limits:', { detail: error });
      return { success: false };
    }
  }

  /**
   * Update tier field (for inline editing in the limits page)
   * Uses PATCH /api/admin/tier-system/tiers/{tierKey}
   */
  async updateTierField(tierKey: string, field: string, value: any, reason?: string): Promise<{ success: boolean; updatedTier?: any }> {
    try {
      const updateData: any = { [field]: value };
      if (reason) {
        updateData.reason = reason;
      }

      const result = await this.makeDefaultRequest(
        `/api/admin/tier-system/tiers/${tierKey}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updateData)
        },
        `update-tier-${tierKey}-${field}`,
        0 // No cache for write operations
      );
      
      if (!result.success) {
        clientLogger.error('[AdminTenantLimits] Failed to update tier field:', { detail: result.error });
        return { success: false };
      }

      // Invalidate relevant caches after update
      await this.invalidateServiceCaches();
      
      // Return success and the updated tier data
      return { 
        success: true, 
        updatedTier: (result.data as any)?.tier 
      };
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to update tier field:', { detail: error });
      return { success: false };
    }
  }

  /**
   * Get comprehensive limits data for the admin limits page
   * Combines tier system data, tenant limits, and featured products limits
   */
  async getLimitsData(includeInactiveTiers: boolean = false): Promise<LimitsData | null> {
    try {
      // Fetch all data in parallel for better performance
      const [tiersData, tenantLimitsData, allFeaturedLimits] = await Promise.all([
        this.getTierSystemTiers(includeInactiveTiers),
        this.getTenantLimitsTiers(),
        this.getAllFeaturedProductsLimits()
      ]);

      if (!tiersData || !tenantLimitsData || !allFeaturedLimits) {
        // console.error('[AdminTenantLimits] Failed to fetch complete limits data', {
        //   tiersData: !!tiersData,
        //   tenantLimitsData: !!tenantLimitsData,
        //   allFeaturedLimits: !!allFeaturedLimits
        // });
        return null;
      }

      // Use actual starter limits from database, not hardcoded values
      const defaultFeaturedLimits = allFeaturedLimits.starter || {
        store_selection: 0,
        new_arrival: 0,
        seasonal: 0,
        sale: 0,
        staff_pick: 0,
        random_featured: 0,
      };

      // console.log('[AdminTenantLimits] Using actual database limits:', {
      //   allFeaturedLimits: Object.keys(allFeaturedLimits),
      //   starterLimits: allFeaturedLimits.starter,
      //   defaultFeaturedLimits
      // });

      return {
        tenantLimits: tenantLimitsData,
        featuredLimits: defaultFeaturedLimits,
        currentTier: 'starter (guest)', // Default display for admin page
        tiers: tiersData
      };
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to get limits data:', { detail: error });
      return null;
    }
  }

  /**
   * Get all user seat limits per tier
   * Uses GET /api/tenant-limits/user-seats
   */
  async getUserSeatLimits(): Promise<Record<string, { maxUsers: number | null; displayName: string; unlimited: boolean; tierName: string }> | null> {
    try {
      const result = await this.makeDefaultRequest<{ limits: Record<string, { maxUsers: number | null; displayName: string; unlimited: boolean; tierName: string }> }>(
        '/api/tenant-limits/user-seats',
        {},
        'user-seat-limits',
        this.cacheTTL
      );

      if (!result.success) {
        clientLogger.error('[AdminTenantLimits] Failed to get user seat limits:', { detail: result.error });
        return null;
      }

      return result.data?.limits || null;
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to get user seat limits:', { detail: error });
      return null;
    }
  }

  /**
   * Update user seat limit for a tier
   * Uses PUT /api/tenant-limits/user-seats
   */
  async updateUserSeatLimit(tier: string, maxUsers: number): Promise<{ success: boolean; maxUsers?: number | null; unlimited?: boolean; message?: string }> {
    try {
      const result = await this.makeDefaultRequest(
        '/api/tenant-limits/user-seats',
        {
          method: 'PUT',
          body: JSON.stringify({ tier, maxUsers })
        },
        `update-user-seat-${tier}`,
        0
      );

      if (!result.success) {
        clientLogger.error('[AdminTenantLimits] Failed to update user seat limit:', { detail: result.error });
        return { success: false };
      }

      await this.invalidateServiceCaches();

      return {
        success: true,
        maxUsers: (result.data as any)?.maxUsers,
        unlimited: (result.data as any)?.unlimited,
        message: (result.data as any)?.message
      };
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Failed to update user seat limit:', { detail: error });
      return { success: false };
    }
  }

  /**
   * Get all available featured types from database constraint
   */
  async getFeaturedTypes(): Promise<string[]> {
    try {
      // Query the database constraint to get all valid featured types
      const result = await this.makeDefaultRequest('/api/admin/products/featured', {}, 'admin-featured-types-all');
      
      // Get all featured products and extract unique types
      const featuredProducts = Array.isArray(result.data) ? result.data : [];
      const uniqueTypes = [...new Set(featuredProducts.map((fp: any) => fp.featured_type).filter((type: any): type is string => Boolean(type)))];
      
      return uniqueTypes.sort();
    } catch (error) {
      clientLogger.error('[AdminTenantLimits] Error fetching featured types:', { detail: error });
      // Fallback to hardcoded types if API fails
      return ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'bestseller', 'clearance', 'trending', 'featured', 'recommended'];
    }
  }
}

// Export singleton instance
export const adminTenantLimitsService = AdminTenantLimitsSingletonService.getInstance();
