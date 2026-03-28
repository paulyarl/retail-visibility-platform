import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { getErrorMessage, RequestType } from '../providers/base/FlexibleApiSingleton';

export interface DbTier {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  maxSkus: number;
  maxLocations: number;
  type: string;
  sortOrder: number;
  features: string[];
}

export interface Tier {
  id: string;
  tierKey: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  maxSkus: number;
  maxLocations: number;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  subscription_tier?: string;
  subscription_status?: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  created_at?: string;
  metadata?: {
    businessName?: string;
    city?: string;
    state?: string;
  };
  organization_id?: string;
  organization?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Service for managing tenant tiers and tier system
 * Handles tier operations, tier management, and tenant tier assignments
 */
export class TenantTierService extends AdminApiSingleton {
  private static instance: TenantTierService;

  private constructor() {
    super('TenantTierService');
  }

  static getInstance(): TenantTierService {
    if (!TenantTierService.instance) {
      TenantTierService.instance = new TenantTierService();
    }
    return TenantTierService.instance;
  }

  /**
   * Get admin tier system tiers
   */
  async getAdminTiers(): Promise<DbTier[] | null> {
    const result = await this.makeDefaultRequest<{ individual: DbTier[], organization: DbTier[] }>(
      '/api/admin/tiers/tiers',
      {},
      'platform-admin-tiers',
      this.cacheTTL,
      {
        context: AppContext.TENANT,
        isolation: CacheIsolation.TENANT,
        requestType: RequestType.AUTHENTICATED
      }
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to get admin tiers:', result.error);
      return null;
    }

    // Transform grouped response to flat array
    if (result.data?.individual && result.data?.organization) {
      return [...result.data.individual, ...result.data.organization];
    }

    return [];
  }

  /**
   * Get admin tier tenants
   */
  async getAdminTierTenants(): Promise<Tenant[] | null> {
    const result = await this.makeDefaultRequest<{ tenants: Tenant[] }>(
      '/api/admin/tiers/tenants',
      {},
      'platform-admin-tier-tenants',
      this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to get admin tier tenants:', result.error);
      return null;
    }

    return result.data?.tenants || null;
  }

  /**
   * Update tenant tier and status
   */
  async updateTenantTier(tenantId: string, updates: {
    subscriptionTier: string;
    subscriptionStatus: string;
    reason?: string;
  }): Promise<Tenant | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Map tier values to match API validation
    const tierMapping: Record<string, string> = {
      'individual': 'starter',
      // Add other mappings as needed
    };

    const mappedTier = tierMapping[updates.subscriptionTier] || updates.subscriptionTier;

    const result = await this.makeDefaultRequest<Tenant>(
      `/api/admin/tiers/tenants/${tenantId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify({
          subscriptionTier: mappedTier,
          subscriptionStatus: updates.subscriptionStatus,
          reason: updates.reason || 'Updated via admin tiers page'
        })
      },
      `platform-update-tenant-tier-${tenantId}`
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to update tenant tier:', result.error);
      const errorMessage = getErrorMessage(result.error) || 'Failed to update tenant tier';
      throw new Error(errorMessage);
    }

    // Invalidate tenant and tier caches
    // await this.invalidateCache(`platform-tenant-${tenantId}*`);
    // await this.invalidateCache(`platform-update-tenant-tier-${tenantId}*`);
    // await this.invalidateCache(`platform-tenant-tier-${tenantId}*`);
    // await this.invalidateCache('platform-admin-tier-tenants*');
    // await this.invalidateCache('admin-tier-tenants');
    // await this.invalidateCache('platform-admin-tier-tenants');

      // Invalidate tier system cache
    await this.invalidateTierCachePatterns();


    return result.data || null;
  }

   /**
   * PILOT: Get all tier cache patterns for this service
   * Documents all tier cache keys that this service manages
   * Separates exact keys from pattern keys for optimal invalidation
   */
  public getTierCachePatterns(): string[] {
    return [
      // === EXACT KEYS (No pattern matching needed) ===
      // These are fixed keys that don't contain tenant IDs or variables
      `tenant-cache-tenant-store-platform-admin-tier-tenants:tenant:tenant`,
      `user-cache-user-store-platform-tenants:user:user`,
      `admin-cache-admin-store-platform-admin-tier-tenants:admin:admin`,
      
      // === PATTERN KEYS (Require wildcard matching) ===
      // Generic patterns (existing)
      `platform-tenants`,
      `platform-tenant-tier`,
      `platform-admin-tier-tenants`,
      `platform-admin-tiers`,
      `/api/admin/tiers/tiers`,
      `/api/featured-products/tenants/all-with-featured-access-status`,
      `/api/admin/products/featuring/stats`,
      `/api/admin/products/featured?limit=20&offset=0&is_active=true`,
      `platform-tier-system-tiers`,
      
      // Context-specific patterns (match variations)
      `platform-tenants:*:*`,           // Matches platform-tenants:admin:admin, etc.
      `platform-admin-tier-tenants:*:*`, // Matches tenant-specific variations
      `/api/featured-products/tenants/all-with-featured-access-status:*:*`, // Matches admin:admin context
      `/api/admin/tiers/tiers:*:*`,     // Matches admin:admin context
      `/api/admin/products/featuring/stats:*:*`,
      `/api/admin/products/featured*:*:*`,
      `platform-tier-system-tiers:*:*`,
    ];
  }

   /**
   * PILOT: Get all tier cache patterns for this service
   * Documents all tier cache keys that this service manages
   */
  async invalidateTierCachePatterns(): Promise<void> {
    const cacheKeys = this.getTierCachePatterns();

     await Promise.all (
      cacheKeys.map(key => this.invalidateCacheWithContext(key))
     );
     await Promise.all (
      cacheKeys.map(key => this.invalidateCacheAcrossContexts(key, [AppContext.TENANT,AppContext.USER,AppContext.ADMIN], [CacheIsolation.TENANT,CacheIsolation.USER,CacheIsolation.ADMIN]))
     );
  }

  /**
   * Get tier system tiers
   */
  async getTierSystemTiers(): Promise<Tier[] | null> {
    const result = await this.makeDefaultRequest<{ individual: any[], organization: any[] }>(
      '/api/admin/tiers/tiers',
      {},
      'platform-tier-system-tiers',
      this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to get tier system tiers:', result.error);
      return [];
    }

    // Transform grouped response to flat array and map to Tier format
    if (result.data?.individual && result.data?.organization) {
      const allTiers = [...result.data.individual, ...result.data.organization];
      return allTiers.map(tier => ({
        id: tier.id,
        tierKey: tier.id,
        name: tier.name,
        displayName: tier.displayName,
        description: tier.description,
        priceMonthly: tier.price,
        maxSkus: tier.maxSkus,
        maxLocations: tier.maxLocations,
        tierType: tier.type,
        isActive: true, // API only returns active tiers
        sortOrder: tier.sortOrder,
        features: tier.features || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
    
    return [];
  }

  /**
   * Update tier active status
   */
  async updateTierStatus(tierId: string, isActive: boolean): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeDefaultRequest<Tier>(
      `/api/admin/tier-system/tiers/${tierId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      },
      `platform-update-tier-status-${tierId}`
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to update tier status:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateCache('platform-tier-system-tiers*');

    return result.data || null;
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, tierData: Partial<Tier>): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeDefaultRequest<Tier>(
      `/api/admin/tier-system/tiers/${tierId}`,
      { 
        method: 'PUT',
        body: JSON.stringify(tierData)
      },
      `platform-update-tier-${tierId}`
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to update tier:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateTierCachePatterns();


    return result.data || null;
  }

  /**
   * Update tier sort order
   */
  async updateTierSortOrder(tierId: string, sortOrder: number): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/tier-system/tiers/${tierId}/sort-order`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ sortOrder })
      },
      `platform-update-tier-sort-order-${tierId}`
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to update tier sort order:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateCache('platform-tier-system-tiers*');
  }

  /**
   * Create tier
   */
  async createTier(tierData: Omit<Tier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tier | null> {
    const result = await this.makeDefaultRequest<Tier>(
      '/api/admin/tier-system/tiers',
      { 
        method: 'POST',
        body: JSON.stringify({
          ...tierData,
          id: `tier_${tierData.tierKey}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      },
      'platform-create-tier'
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to create tier:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateTierCachePatterns();


    return result.data || null;
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/tier-system/tiers/${tierId}`,
      { method: 'DELETE' },
      `platform-delete-tier-${tierId}`
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to delete tier:', result.error);
      throw result.error;
    }
 // Invalidate tier system cache
    await this.invalidateTierCachePatterns();

  }

  /**
   * Get tenant tier information
   */
  async getTenantTier(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/tier`,
      {},
      `platform-tenant-tier-${tenantId}`,
      this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to get tenant tier:', result.error);
      throw result.error;
    }

    return result.data;
  }
}

// Export singleton instance
export const tenantTierService = TenantTierService.getInstance();
