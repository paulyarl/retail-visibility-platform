/**
 * Tier Catalog Service
 * 
 * Manages tier-based catalog permissions and access control.
 * Determines what catalog features are available to each subscription tier.
 */

import { FlexibleApiSingleton, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface TierCatalogPermissions {
  tier_id: string;
  tier_key: string;
  tier_type: 'individual' | 'organization';
  can_browse_global_catalog: boolean;
  can_add_from_global_catalog: boolean;
  can_override_global_inclusion: boolean;
  default_global_inclusion: boolean;
  can_opt_out_global_inclusion: boolean;
  catalog_visibility_level: 'public' | 'organization' | 'private';
  max_catalog_products: number | null;
}

export interface CatalogAccessCheck {
  canAccess: boolean;
  reason?: string;
  remainingSlots?: number;
  maxProducts?: number | null;
}

/**
 * TierCatalogService
 * 
 * Provides tier-based permission checking for catalog features
 */
class TierCatalogService extends FlexibleApiSingleton {
  private static instance: TierCatalogService;
  
  // Local cache for permissions
  private permissionsCache: Map<string, TierCatalogPermissions> = new Map();

  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;
  protected defaultContext = AppContext.TENANT;
  protected defaultIsolation = CacheIsolation.TENANT;

  protected constructor() {
    super('tier-catalog-service', {
      ttl: 60 * 60 * 1000 // 1 hour for tier permissions
    });
  }

  public static getInstance(): TierCatalogService {
    if (!TierCatalogService.instance) {
      TierCatalogService.instance = new TierCatalogService();
    }
    return TierCatalogService.instance;
  }

  /**
   * Get catalog permissions for a specific tier
   */
  async getTierPermissions(tierId: string): Promise<TierCatalogPermissions | null> {
    // Check local cache first
    if (this.permissionsCache.has(tierId)) {
      return this.permissionsCache.get(tierId)!;
    }

    try {
      const result = await this.makePublicRequest<TierCatalogPermissions>(
        `/api/catalog/permissions/${tierId}`,
        { method: 'GET' },
        `tier-catalog-permissions:${tierId}`,
        this.cacheTTL
      );

      const permissions = result.data;
      if (permissions) {
        this.permissionsCache.set(tierId, permissions);
      }
      return permissions;
    } catch (error) {
      clientLogger.error('[TierCatalogService] Error fetching tier permissions:', { detail: error });
      return null;
    }
  }

  /**
   * Check if a tenant can access the global catalog
   */
  async canBrowseGlobalCatalog(tierId: string): Promise<boolean> {
    const permissions = await this.getTierPermissions(tierId);
    return permissions?.can_browse_global_catalog ?? false;
  }

  /**
   * Check if a tenant can add products from the global catalog
   */
  async canAddFromGlobalCatalog(
    tierId: string,
    currentProductCount: number
  ): Promise<CatalogAccessCheck> {
    const permissions = await this.getTierPermissions(tierId);

    if (!permissions) {
      return {
        canAccess: false,
        reason: 'Unable to verify tier permissions'
      };
    }

    if (!permissions.can_add_from_global_catalog) {
      return {
        canAccess: false,
        reason: 'Your tier does not allow adding products from the global catalog'
      };
    }

    // Check product limit
    if (permissions.max_catalog_products !== null) {
      const remaining = permissions.max_catalog_products - currentProductCount;
      
      if (remaining <= 0) {
        return {
          canAccess: false,
          reason: `Maximum product limit (${permissions.max_catalog_products}) reached`,
          remainingSlots: 0,
          maxProducts: permissions.max_catalog_products
        };
      }

      return {
        canAccess: true,
        remainingSlots: remaining,
        maxProducts: permissions.max_catalog_products
      };
    }

    // No limit
    return {
      canAccess: true,
      remainingSlots: Infinity,
      maxProducts: null
    };
  }

  /**
   * Check if a tenant can override global inclusion settings
   */
  async canOverrideGlobalInclusion(tierId: string): Promise<boolean> {
    const permissions = await this.getTierPermissions(tierId);
    return permissions?.can_override_global_inclusion ?? false;
  }

  /**
   * Get default global inclusion setting for a tier
   */
  async getDefaultGlobalInclusion(tierId: string): Promise<boolean> {
    const permissions = await this.getTierPermissions(tierId);
    return permissions?.default_global_inclusion ?? true;
  }

  /**
   * Check if a tenant can opt out of global inclusion
   */
  async canOptOutOfGlobalInclusion(tierId: string): Promise<boolean> {
    const permissions = await this.getTierPermissions(tierId);
    return permissions?.can_opt_out_global_inclusion ?? false;
  }

  /**
   * Get catalog visibility level for a tier
   */
  async getCatalogVisibilityLevel(tierId: string): Promise<'public' | 'organization' | 'private'> {
    const permissions = await this.getTierPermissions(tierId);
    return permissions?.catalog_visibility_level ?? 'public';
  }

  /**
   * Get maximum catalog products for a tier
   */
  async getMaxCatalogProducts(tierId: string): Promise<number | null> {
    const permissions = await this.getTierPermissions(tierId);
    return permissions?.max_catalog_products ?? null;
  }

  /**
   * Clear local permissions cache
   */
  clearLocalCache(): void {
    this.permissionsCache.clear();
  }

  /**
   * Clear cache for a specific tier
   */
  clearTierCache(tierId: string): void {
    this.permissionsCache.delete(tierId);
  }
}

// Export singleton instance
export const tierCatalogService = TierCatalogService.getInstance();
export default tierCatalogService;
