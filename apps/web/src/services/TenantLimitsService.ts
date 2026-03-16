/**
 * Tenant Limits Service
 * 
 * Handles tenant limits and tier management operations
 * Extends AdminApiSingleton for proper caching and context management
 * 
 * MIGRATION: Replaces direct fetch calls in:
 * - /src/app/settings/admin/feature-overrides/page.tsx
 * - /src/app/api/tenant-limits/tiers/route.ts
 * - /src/app/api/tenant-limits/featured-products/route.ts
 * - /src/app/api/tenant-limits/featured-products/all/route.ts
 * - /src/app/api/tenant-limits/status/route.ts
 * - /src/hooks/useTenantLimits.ts
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface TenantTier {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  price?: number;
  features: {
    maxProducts: number;
    maxFeaturedProducts: number;
    maxUsers: number;
    maxTenants: number;
    customDomain: boolean;
    analytics: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeaturedProductLimit {
  tenantId: string;
  tenantName: string;
  tierName: string;
  currentFeatured: number;
  maxFeatured: number;
  availableSlots: number;
  isActive: boolean;
  lastUpdated: string;
}

export interface TenantLimitsStatus {
  tenantId: string;
  tierId: string;
  tierName: string;
  currentUsage: {
    products: number;
    featuredProducts: number;
    users: number;
    tenants: number;
  };
  limits: {
    maxProducts: number;
    maxFeaturedProducts: number;
    maxUsers: number;
    maxTenants: number;
  };
  utilization: {
    products: number; // percentage
    featuredProducts: number; // percentage
    users: number; // percentage
    tenants: number; // percentage
  };
  warnings: string[];
  restrictions: string[];
}

export interface CreateTierRequest {
  name: string;
  displayName: string;
  description?: string;
  price?: number;
  features: {
    maxProducts: number;
    maxFeaturedProducts: number;
    maxUsers: number;
    maxTenants: number;
    customDomain: boolean;
    analytics: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
}

export interface UpdateTierRequest {
  name?: string;
  displayName?: string;
  description?: string;
  price?: number;
  features?: {
    maxProducts?: number;
    maxFeaturedProducts?: number;
    maxUsers?: number;
    maxTenants?: number;
    customDomain?: boolean;
    analytics?: boolean;
    prioritySupport?: boolean;
    apiAccess?: boolean;
    whiteLabel?: boolean;
  };
  isActive?: boolean;
}

export class TenantLimitsService extends AdminApiSingleton {
  private static instance: TenantLimitsService;

  private constructor() {
    super('TenantLimitsService');
  }

  static getInstance(): TenantLimitsService {
    if (!TenantLimitsService.instance) {
      TenantLimitsService.instance = new TenantLimitsService();
    }
    return TenantLimitsService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-limits-*',
      'tenant-tiers-*',
      'featured-limits-*',
      'tenant-status-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(tenantId?: string, tierId?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`tenant-status-${tenantId}`);
      await this.invalidateCache(`featured-limits-${tenantId}`);
    }
    if (tierId) {
      await this.invalidateCache(`tenant-tiers-${tierId}`);
    } else {
      await this.invalidateCache('tenant-limits-*');
      await this.invalidateCache('tenant-tiers-*');
      await this.invalidateCache('featured-limits-*');
      await this.invalidateCache('tenant-status-*');
    }
  }

  /**
   * Get all tenant tiers
   */
  async getTiers(): Promise<TenantTier[]> {
    const result = await this.makeDefaultRequest<TenantTier[]>(
      '/api/tenant-limits/tiers',
      {},
      'tenant-tiers-all'
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant tiers: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get tier by ID
   */
  async getTierById(tierId: string): Promise<TenantTier | null> {
    const result = await this.makeDefaultRequest<TenantTier>(
      `/api/tenant-limits/tiers/${tierId}`,
      {},
      `tenant-tiers-${tierId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant tier: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Create new tier
   */
  async createTier(tier: CreateTierRequest): Promise<TenantTier | null> {
    const result = await this.makeDefaultRequest<TenantTier>(
      '/api/tenant-limits/tiers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tier),
      },
      'tenant-tiers-create'
    );
    
    if (!result.success) {
      console.log(`Failed to create tenant tier: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after creation
    await this.invalidateServiceCaches();
    
    return result.data || null;
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, updates: UpdateTierRequest): Promise<TenantTier | null> {
    const result = await this.makeDefaultRequest<TenantTier>(
      `/api/tenant-limits/tiers/${tierId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      },
      `tenant-tiers-update-${tierId}`
    );
    
    if (!result.success) {
      console.log(`Failed to update tenant tier: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after update
    await this.invalidateServiceCaches(undefined, tierId);
    
    return result.data || null;
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenant-limits/tiers/${tierId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `tenant-tiers-delete-${tierId}`
    );
    
    if (!result.success) {
      console.log(`Failed to delete tenant tier: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after deletion
    await this.invalidateServiceCaches();
    
    return result.data?.success || false;
  }

  /**
   * Get featured product limits for all tenants
   */
  async getFeaturedProductLimits(): Promise<FeaturedProductLimit[]> {
    const result = await this.makeDefaultRequest<FeaturedProductLimit[]>(
      '/api/tenant-limits/featured-products/all',
      {},
      'featured-limits-all'
    );
    
    if (!result.success) {
      console.log(`Failed to get featured product limits: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get featured product limits for specific tenant
   */
  async getTenantFeaturedLimits(tenantId: string): Promise<FeaturedProductLimit | null> {
    const result = await this.makeDefaultRequest<FeaturedProductLimit>(
      `/api/tenant-limits/featured-products/${tenantId}`,
      {},
      `featured-limits-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant featured limits: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Update featured product limit for tenant
   */
  async updateTenantFeaturedLimits(tenantId: string, limits: { maxFeatured: number }): Promise<FeaturedProductLimit | null> {
    const result = await this.makeDefaultRequest<FeaturedProductLimit>(
      `/api/tenant-limits/featured-products/${tenantId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(limits),
      },
      `featured-limits-update-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to update tenant featured limits: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after update
    await this.invalidateServiceCaches(tenantId);
    
    return result.data || null;
  }

  /**
   * Get tenant limits status
   */
  async getTenantLimitsStatus(tenantId: string): Promise<TenantLimitsStatus | null> {
    const result = await this.makeDefaultRequest<TenantLimitsStatus>(
      `/api/tenant-limits/status/${tenantId}`,
      {},
      `tenant-status-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant limits status: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Get all tenants with their limits status
   */
  async getAllTenantsLimitsStatus(): Promise<TenantLimitsStatus[]> {
    const result = await this.makeDefaultRequest<TenantLimitsStatus[]>(
      '/api/tenant-limits/status',
      {},
      'tenant-status-all'
    );
    
    if (!result.success) {
      console.log(`Failed to get all tenants limits status: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Check if tenant can add featured products
   */
  async canTenantAddFeaturedProducts(tenantId: string, count: number = 1): Promise<{
    canAdd: boolean;
    current: number;
    max: number;
    available: number;
    message?: string;
  }> {
    const limits = await this.getTenantFeaturedLimits(tenantId);
    
    if (!limits) {
      return {
        canAdd: false,
        current: 0,
        max: 0,
        available: 0,
        message: 'Tenant limits not found'
      };
    }
    
    const available = limits.availableSlots;
    const canAdd = available >= count;
    
    return {
      canAdd,
      current: limits.currentFeatured,
      max: limits.maxFeatured,
      available,
      message: canAdd ? undefined : `Only ${available} featured product slots available`
    };
  }

  /**
   * Get tier statistics
   */
  async getTierStats(): Promise<{
    totalTiers: number;
    activeTiers: number;
    totalTenants: number;
    tenantsByTier: Array<{
      tierId: string;
      tierName: string;
      count: number;
    }>;
  }> {
    const result = await this.makeDefaultRequest<{
      totalTiers: number;
      activeTiers: number;
      totalTenants: number;
      tenantsByTier: Array<{
        tierId: string;
        tierName: string;
        count: number;
      }>;
    }>(
      '/api/tenant-limits/stats',
      {},
      'tenant-limits-stats'
    );
    
    if (!result.success) {
      console.log(`Failed to get tier stats: ${result.error}`);
      return { totalTiers: 0, activeTiers: 0, totalTenants: 0, tenantsByTier: [] };
    }
    
    return result.data || { totalTiers: 0, activeTiers: 0, totalTenants: 0, tenantsByTier: [] };
  }
}

// Export singleton instance
export default TenantLimitsService.getInstance();
