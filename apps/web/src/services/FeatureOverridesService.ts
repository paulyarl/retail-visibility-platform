/**
 * Feature Overrides Service
 * 
 * Extends AdminApiSingleton to provide feature override management
 * Handles CRUD operations for feature, pricing, and limit overrides
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';

// Override types
export type OverrideType = 'feature' | 'pricing' | 'limits' | 'featured_products' | 'tenant_limits';
export type OverrideStatus = 'active' | 'expired' | 'revoked' | 'pending';

// Base override interface
export interface BaseOverride {
  id: string;
  organizationId?: string;
  tenantId?: string;
  organizationName?: string;
  tenantName?: string;
  type: OverrideType;
  status: OverrideStatus;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

// Feature override
export interface FeatureOverride extends BaseOverride {
  type: 'feature';
  feature: string;
  featureName: string;
}

// Pricing override
export interface PricingOverride extends BaseOverride {
  type: 'pricing';
  subscriptionTier: string;
  originalPrice: number;
  customPrice: number;
  discountPercent: number;
  currency: string;
  billingInterval: 'monthly' | 'yearly';
}

// Limits override
export interface LimitsOverride extends BaseOverride {
  type: 'limits';
  limitType: 'locations' | 'skus';
  subscriptionTier: string;
  originalLimit: number;
  customLimit: number;
}

// Featured products override
export interface FeaturedProductsOverride extends BaseOverride {
  type: 'featured_products';
  subscriptionTier: string;
  featuredType: string;
  originalLimit: number;
  customLimit: number;
}

// Tenant limits override
export interface TenantLimitsOverride extends BaseOverride {
  type: 'tenant_limits';
  subscriptionTier: string;
  originalLimit: number;
  customLimit: number;
}

// Union type for all overrides
export type Override = FeatureOverride | PricingOverride | LimitsOverride | FeaturedProductsOverride | TenantLimitsOverride;

// Create override data types
export interface CreateFeatureOverrideData {
  organizationId?: string;
  tenantId?: string;
  feature: string;
  featureName: string;
  reason: string;
  expiresAt?: string | null;
}

export interface CreatePricingOverrideData {
  organizationId?: string;
  tenantId?: string;
  subscriptionTier: string;
  customPrice: number;
  currency: string;
  billingInterval: 'monthly' | 'yearly';
  reason: string;
  expiresAt?: string | null;
}

export interface CreateLimitsOverrideData {
  organizationId?: string;
  tenantId?: string;
  subscriptionTier: string;
  limitType: 'locations' | 'skus';
  customLimit: number;
  reason: string;
  expiresAt?: string | null;
}

export interface CreateFeaturedProductsOverrideData {
  organizationId?: string;
  tenantId?: string;
  subscriptionTier: string;
  featuredType: string;
  customLimit: number;
  reason: string;
  expiresAt?: string | null;
}

export interface CreateTenantLimitsOverrideData {
  organizationId?: string;
  tenantId?: string;
  subscriptionTier: string;
  customLimit: number;
  reason: string;
  expiresAt?: string | null;
}

// Update override data
export interface UpdateOverrideData {
  status?: OverrideStatus;
  reason?: string;
  expiresAt?: string | null;
}

/**
 * Service for managing feature overrides
 * Handles CRUD operations for all override types
 */
export class FeatureOverridesService extends AdminApiSingleton {
  private static instance: FeatureOverridesService;

  protected constructor() {
    super('feature-overrides-service', {
      ttl: 15 * 60 * 1000 // 15 minutes for override data
    });
  }

  static getInstance(): FeatureOverridesService {
    if (!FeatureOverridesService.instance) {
      FeatureOverridesService.instance = new FeatureOverridesService();
    }
    return FeatureOverridesService.instance;
  }

  /**
   * Get all overrides
   */
  async getOverrides(): Promise<Override[] | null> {
    const response = await this.makeDefaultRequest<{overrides: Override[], count: number}>(
      '/api/admin/feature-overrides',
      {},
      'feature-overrides-all',
      15 * 60 * 1000 // 15 minutes cache
    );

    if (response?.data) {
      const data = response.data;
      // Handle both response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data.overrides && Array.isArray(data.overrides)) {
        return data.overrides;
      }
    }

    return null;
  }

  /**
   * Get overrides by type
   */
  async getOverridesByType(type: OverrideType): Promise<Override[] | null> {
    const response = await this.makeDefaultRequest<Override[]>(
      `/api/admin/feature-overrides?type=${type}`,
      {},
      `feature-overrides-${type}`,
      15 * 60 * 1000
    );

    return response?.data || null;
  }

  /**
   * Get overrides for specific organization
   */
  async getOrganizationOverrides(organizationId: string): Promise<Override[] | null> {
    const response = await this.makeDefaultRequest<Override[]>(
      `/api/admin/feature-overrides?organizationId=${organizationId}`,
      {},
      `feature-overrides-org-${organizationId}`,
      15 * 60 * 1000
    );

    return response?.data || null;
  }

  /**
   * Get overrides for specific tenant
   */
  async getTenantOverrides(tenantId: string): Promise<Override[] | null> {
    const response = await this.makeDefaultRequest<Override[]>(
      `/api/admin/feature-overrides?tenantId=${tenantId}`,
      {},
      `feature-overrides-tenant-${tenantId}`,
      15 * 60 * 1000
    );

    return response?.data || null;
  }

  /**
   * Create feature override
   */
  async createFeatureOverride(data: CreateFeatureOverrideData): Promise<FeatureOverride | null> {
    const response = await this.makeDefaultRequest<FeatureOverride>(
      '/api/admin/feature-overrides/feature',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'feature-overrides-create',
      0 // No cache for create operations
    );

    // Invalidate cache
    await this.invalidateCacheAcrossContexts('feature-overrides', [AppContext.ADMIN], [CacheIsolation.ADMIN]);

    return response?.data || null;
  }

  /**
   * Create pricing override
   */
  async createPricingOverride(data: CreatePricingOverrideData): Promise<PricingOverride | null> {
    const response = await this.makeDefaultRequest<PricingOverride>(
      '/api/admin/feature-overrides/pricing',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'feature-overrides-create',
      0
    );

    // Invalidate cache
    await this.invalidateCacheAcrossContexts('feature-overrides', [AppContext.ADMIN], [CacheIsolation.ADMIN]);

    return response?.data || null;
  }

  /**
   * Create limits override
   */
  async createLimitsOverride(data: CreateLimitsOverrideData): Promise<LimitsOverride | null> {
    const response = await this.makeDefaultRequest<LimitsOverride>(
      '/api/admin/feature-overrides/limits',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'feature-overrides-create',
      0
    );

    // Invalidate cache
    await this.invalidateCacheAcrossContexts('feature-overrides', [AppContext.ADMIN], [CacheIsolation.ADMIN]);

    return response?.data || null;
  }

  /**
   * Create featured products override
   */
  async createFeaturedProductsOverride(data: CreateFeaturedProductsOverrideData): Promise<FeaturedProductsOverride | null> {
    const response = await this.makeDefaultRequest<FeaturedProductsOverride>(
      '/api/admin/feature-overrides/featured-products',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'feature-overrides-create',
      0
    );

    // Invalidate cache
    await this.invalidateCacheAcrossContexts('feature-overrides', [AppContext.ADMIN], [CacheIsolation.ADMIN]);

    return response?.data || null;
  }

  /**
   * Create tenant limits override
   */
  async createTenantLimitsOverride(data: CreateTenantLimitsOverrideData): Promise<TenantLimitsOverride | null> {
    const response = await this.makeDefaultRequest<TenantLimitsOverride>(
      '/api/admin/feature-overrides/tenant-limits',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'feature-overrides-create',
      0
    );

    // Invalidate cache
    await this.invalidateCacheAcrossContexts('feature-overrides', [AppContext.ADMIN], [CacheIsolation.ADMIN]);

    return response?.data || null;
  }

  /**
   * Update override status
   */
  async updateOverrideStatus(overrideId: string, status: OverrideStatus, reason?: string): Promise<Override | null> {
    const response = await this.makeDefaultRequest<Override>(
      `/api/admin/feature-overrides/${overrideId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
      },
      `feature-overrides-update-${overrideId}`,
      0
    );

    // Invalidate cache
    await this.invalidateCacheAcrossContexts('feature-overrides', [AppContext.ADMIN], [CacheIsolation.ADMIN]);

    return response?.data || null;
  }

  /**
   * Delete override
   */
  async deleteOverride(overrideId: string): Promise<void> {
    await this.makeDefaultRequest<void>(
      `/api/admin/feature-overrides/${overrideId}`,
      { method: 'DELETE' },
      'feature-overrides-delete',
      0
    );

    // Invalidate cache
    await this.invalidateCacheAcrossContexts('feature-overrides', [AppContext.ADMIN], [CacheIsolation.ADMIN]);
  }

  /**
   * Get active override for specific tenant and feature
   */
  async getActiveOverride(
    tenantId: string, 
    overrideType: OverrideType, 
    target: string // feature key, featured type, etc.
  ): Promise<Override | null> {
    const response = await this.makeDefaultRequest<{overrides: Override[], count: number}>(
      `/api/admin/feature-overrides?tenantId=${tenantId}&type=${overrideType}`,
      {},
      `feature-overrides-tenant-${tenantId}-${overrideType}`,
      5 * 60 * 1000 // 5 minutes cache
    );

    const overrides = response?.data?.overrides || [];
    
    // Find active override for this specific target
    return overrides.find((override: Override) => {
      if (override.type === 'feature') {
        return (override as FeatureOverride).feature === target && override.status === 'active';
      }
      if (override.type === 'featured_products') {
        return (override as FeaturedProductsOverride).featuredType === target && override.status === 'active';
      }
      if (override.type === 'tenant_limits') {
        return override.status === 'active'; // Tenant limits apply to all
      }
      if (override.type === 'pricing') {
        return (override as PricingOverride).subscriptionTier === target && override.status === 'active';
      }
      if (override.type === 'limits') {
        return (override as LimitsOverride).limitType === target && override.status === 'active';
      }
      return false;
    }) || null;
  }

  /**
   * Check if tenant has feature (including overrides)
   */
  async tenantHasFeature(tenantId: string, feature: string): Promise<boolean> {
    // Check for active feature override first
    const override = await this.getActiveOverride(tenantId, 'feature', feature);
    
    if (override) {
      return true; // Override grants the feature
    }
    
    // Fall back to tier-based check (this would need to be implemented)
    return false; // Placeholder - would integrate with tenant service
  }

  /**
   * Get tenant's custom featured product limits
   */
  async getTenantFeaturedLimits(tenantId: string): Promise<Record<string, number> | null> {
    const response = await this.makeDefaultRequest<{overrides: Override[], count: number}>(
      `/api/admin/feature-overrides?tenantId=${tenantId}&type=featured_products`,
      {},
      `feature-overrides-featured-${tenantId}`,
      5 * 60 * 1000
    );

    const overrides = response?.data?.overrides || [];
    const activeOverrides = overrides.filter((o: Override) => o.status === 'active') as FeaturedProductsOverride[];
    
    if (activeOverrides.length === 0) return null;
    
    // Build limits object from overrides
    const limits: Record<string, number> = {};
    activeOverrides.forEach(override => {
      limits[override.featuredType] = override.customLimit;
    });
    
    return limits;
  }

  /**
   * Get tenant's custom location limit
   */
  async getTenantLocationLimit(tenantId: string): Promise<number | null> {
    const override = await this.getActiveOverride(tenantId, 'tenant_limits', 'locations');
    
    if (override) {
      return (override as TenantLimitsOverride).customLimit;
    }
    
    return null; // Fall back to tier-based limits
  }

  /**
   * Get override statistics
   */
  async getOverrideStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
    pending: number;
    byType: Record<OverrideType, number>;
  } | null> {
    const response = await this.makeDefaultRequest<{
      total: number;
      active: number;
      expired: number;
      revoked: number;
      pending: number;
      byType: Record<OverrideType, number>;
    }>(
      '/api/admin/feature-overrides/stats',
      {},
      'feature-overrides-stats',
      5 * 60 * 1000 // 5 minutes cache for stats
    );

    return response?.data || null;
  }
}

// Export singleton instance
export const featureOverridesService = FeatureOverridesService.getInstance();
