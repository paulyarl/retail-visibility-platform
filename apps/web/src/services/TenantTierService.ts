import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

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
  // ... other tenant properties
}

/**
 * Service for managing tenant tiers and tier system
 * Handles tier operations, tier management, and tenant tier assignments
 */
export class TenantTierService extends AuthenticatedApiSingleton {
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
    const result = await this.makeAuthenticatedRequest<{ individual: DbTier[], organization: DbTier[] }>(
      '/api/admin/tiers/tiers',
      {},
      'platform-admin-tiers',
      this.cacheTTL
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
    const result = await this.makeAuthenticatedRequest<{ tenants: Tenant[] }>(
      '/api/admin/tiers/tenants',
      {},
      'platform-admin-tier-tenants',
      this.cacheTTL
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

    const result = await this.makeAuthenticatedRequest<Tenant>(
      `/api/tenants/${tenantId}/tier`,
      { 
        method: 'PATCH',
        body: JSON.stringify(updates)
      },
      `platform-update-tenant-tier-${tenantId}`
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to update tenant tier:', result.error);
      throw result.error;
    }

    // Invalidate tenant and tier caches
    await this.invalidateCache(`platform-tenant-${tenantId}*`);
    await this.invalidateCache(`platform-tenant-tier-${tenantId}*`);
    await this.invalidateCache('platform-admin-tier-tenants*');

    return result.data || null;
  }

  /**
   * Get tier system tiers
   */
  async getTierSystemTiers(): Promise<Tier[] | null> {
    const result = await this.makeAuthenticatedRequest<{ individual: any[], organization: any[] }>(
      '/api/admin/tiers/tiers',
      {},
      'platform-tier-system-tiers',
      this.cacheTTL
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

    const result = await this.makeAuthenticatedRequest<Tier>(
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

    const result = await this.makeAuthenticatedRequest<Tier>(
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
    await this.invalidateCache('platform-tier-system-tiers*');

    return result.data || null;
  }

  /**
   * Update tier sort order
   */
  async updateTierSortOrder(tierId: string, sortOrder: number): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
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
    const result = await this.makeAuthenticatedRequest<Tier>(
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
    await this.invalidateCache('platform-tier-system-tiers*');

    return result.data || null;
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
      `/api/admin/tier-system/tiers/${tierId}`,
      { method: 'DELETE' },
      `platform-delete-tier-${tierId}`
    );

    if (!result.success) {
      console.error('[TenantTierService] Failed to delete tier:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateCache('platform-tier-system-tiers*');
  }

  /**
   * Get tenant tier information
   */
  async getTenantTier(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/${tenantId}/tier`,
      {},
      `platform-tenant-tier-${tenantId}`,
      this.cacheTTL
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
