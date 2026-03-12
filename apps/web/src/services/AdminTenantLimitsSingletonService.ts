/**
 * Admin Tenant Limits Singleton Service
 *
 * Extends AdminApiSingleton to provide admin-level tenant limits operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Provides admin-specific operations for managing tenant limits across the platform
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface FeaturedProductsLimit {
  store_selection: number;
  new_arrival: number;
  seasonal: number;
  sale: number;
  staff_pick: number;
  random_featured: number;
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
    await this.invalidateCachePattern('admin-tenant-limits*');
    await this.invalidateCachePattern('admin-featured-products*');
    await this.invalidateCachePattern('admin-tier-system*');
    await this.invalidateCachePattern('platform-limits*');
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
        console.error('[AdminTenantLimits] Failed to get tier system tiers:', result.error);
        return null;
      }

      return result.data?.tiers || null;
    } catch (error) {
      console.error('[AdminTenantLimits] Failed to get tier system tiers:', error);
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
        console.error('[AdminTenantLimits] Failed to get tenant limits tiers:', result.error);
        return null;
      }

      return result.data?.tiers || null;
    } catch (error) {
      console.error('[AdminTenantLimits] Failed to get tenant limits tiers:', error);
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
        console.error('[AdminTenantLimits] Failed to get all featured products limits:', result.error);
        return null;
      }

      return result.data?.limits || null;
    } catch (error) {
      console.error('[AdminTenantLimits] Failed to get all featured products limits:', error);
      return null;
    }
  }

  /**
   * Update featured products limits for a tier
   * Uses the PUT /api/tenant-limits/featured-products endpoint
   */
  async updateFeaturedProductsLimits(tier: string, limits: FeaturedProductsLimit): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest(
        '/api/tenant-limits/featured-products',
        {
          method: 'PUT',
          body: JSON.stringify({ tier, limits })
        },
        `update-featured-products-${tier}`,
        0 // No cache for write operations
      );
      
      if (!result.success) {
        console.error('[AdminTenantLimits] Failed to update featured products limits:', result.error);
        return false;
      }

      // Invalidate relevant caches after update
      await this.invalidateServiceCaches();
      
      return true;
    } catch (error) {
      console.error('[AdminTenantLimits] Failed to update featured products limits:', error);
      return false;
    }
  }

  /**
   * Update tier field (for inline editing in the limits page)
   * Uses PATCH /api/admin/tier-system/tiers/{tierKey}
   */
  async updateTierField(tierKey: string, field: string, value: any, reason?: string): Promise<boolean> {
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
        console.error('[AdminTenantLimits] Failed to update tier field:', result.error);
        return false;
      }

      // Invalidate relevant caches after update
      await this.invalidateServiceCaches();
      
      return true;
    } catch (error) {
      console.error('[AdminTenantLimits] Failed to update tier field:', error);
      return false;
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
        console.error('[AdminTenantLimits] Failed to fetch complete limits data');
        return null;
      }

      // Use starter limits as default for featured limits display
      const defaultFeaturedLimits = allFeaturedLimits.starter || {
        store_selection: 8,
        new_arrival: 12,
        seasonal: 6,
        sale: 10,
        staff_pick: 6,
        random_featured: 12,
      };

      return {
        tenantLimits: tenantLimitsData,
        featuredLimits: defaultFeaturedLimits,
        currentTier: 'starter (guest)', // Default display for admin page
        tiers: tiersData
      };
    } catch (error) {
      console.error('[AdminTenantLimits] Failed to get limits data:', error);
      return null;
    }
  }
}

// Export singleton instance
export const adminTenantLimitsService = AdminTenantLimitsSingletonService.getInstance();
