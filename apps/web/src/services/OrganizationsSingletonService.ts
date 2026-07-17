/**
 * Organizations Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached organizations operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  tenants?: Array<{
    id: string;
    name: string;
    metadata?: Record<string, any>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
}

class OrganizationsSingletonService extends TenantApiSingleton {
  private static instance: OrganizationsSingletonService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'organizations-singleton*',
      'tenant-organizations*',
      'org-management*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('organizations-singleton*');
    await this.invalidateCachePattern('tenant-organizations*');
    await this.invalidateCachePattern('org-management*');
  }

  private constructor() {
    super('organizations-singleton', {
      ttl: 15 * 60 * 1000 // 15 minutes for organizations (changes rarely)
    });
  }

  public static getInstance(): OrganizationsSingletonService {
    if (!OrganizationsSingletonService.instance) {
      OrganizationsSingletonService.instance = new OrganizationsSingletonService();
    }
    return OrganizationsSingletonService.instance;
  }

  /**
   * Get all organizations with caching
   * Uses the /organizations endpoint
   */
  async getOrganizations(page: number = 1, limit: number = 50): Promise<Organization[]> {
    const result = await this.makeDefaultRequest<Organization[]>(
      `/api/organizations?page=${page}&limit=${limit}`,
      {},
      `organizations-${page}-${limit}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to get organizations:', { detail: result.error });
      return [];
    }

    return result.data || [];
  }

  /**
   * Get organization by ID with caching
   * Uses the /organizations/:id endpoint
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    if (!id) {
      clientLogger.error('[OrganizationsSingleton] getOrganizationById: id is required');
      return null;
    }

    const result = await this.makeDefaultRequest<Organization>(
      `/api/organizations/${id}`,
      {},
      `organization-${id}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to get organization by ID:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get organization by slug with caching
   * Uses the /organizations endpoint with slug filter
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    if (!slug) {
      clientLogger.error('[OrganizationsSingleton] getOrganizationBySlug: slug is required');
      return null;
    }

    const result = await this.makeDefaultRequest<Organization>(
      `/api/organizations/slug/${slug}`,
      {},
      `organization-slug-${slug}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to get organization by slug:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Search organizations with caching
   * Uses the /organizations/search endpoint
   */
  async searchOrganizations(query: string, page: number = 1, limit: number = 20): Promise<Organization[]> {
    if (!query) {
      clientLogger.error('[OrganizationsSingleton] searchOrganizations: query is required');
      return [];
    }

    const result = await this.makeDefaultRequest<OrganizationsResponse>(
      `/api/organizations/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      {},
      `organizations-search-${query}-${page}-${limit}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to search organizations:', { detail: result.error });
      return [];
    }

    return result.data?.organizations || [];
  }

  /**
   * Update organization hero location
   * Uses the /organizations/:id/hero-location endpoint
   */
  async updateHeroLocation(organizationId: string, tenantId: string): Promise<any> {
    if (!organizationId || !tenantId) {
      clientLogger.error('[OrganizationsSingleton] updateHeroLocation: organizationId and tenantId are required');
      return null;
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/hero-location`,
      {
        method: 'PUT',
        body: JSON.stringify({ tenantId })
      },
      `org-hero-location-${organizationId}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to update hero location:', { detail: result.error });
      return null;
    }
    
    this.invalidateOrganizationCache(organizationId);

    return result.data || null;
  }

  /**
   * Mirror categories from platform to GBP
   * Uses the /api/categories/mirror endpoint
   */
  async mirrorCategories(requestData: {
    strategy: 'platform_to_gbp';
    dryRun: boolean;
    scope: 'tenant' | 'organization';
    tenantId?: string;
    organizationId?: string;
  }): Promise<any> {
    if (!requestData.scope || !requestData.strategy) {
      clientLogger.error('[OrganizationsSingleton] mirrorCategories: scope and strategy are required');
      return null;
    }

    if (requestData.scope === 'tenant' && !requestData.tenantId) {
      clientLogger.error('[OrganizationsSingleton] mirrorCategories: tenantId is required for tenant scope');
      return null;
    }

    if (requestData.scope === 'organization' && !requestData.organizationId) {
      clientLogger.error('[OrganizationsSingleton] mirrorCategories: organizationId is required for organization scope');
      return null;
    }

    const result = await this.makeDefaultRequest<any>(
      '/api/categories/mirror',
      {
        method: 'POST',
        body: JSON.stringify(requestData)
      },
      `org-mirror-categories-${requestData.scope}-${requestData.organizationId || requestData.tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to mirror categories:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Sync from hero location
   * Uses the /api/organizations/:id/sync-from-hero endpoint
   */
  async syncFromHero(organizationId: string): Promise<any> {
    if (!organizationId) {
      clientLogger.error('[OrganizationsSingleton] syncFromHero: organizationId is required');
      return null;
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/sync-from-hero`,
      {
        method: 'POST',
        body: JSON.stringify({})
      },
      `org-sync-from-hero-${organizationId}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to sync from hero:', { detail: result.error });
      return null;
    }
    
    this.invalidateOrganizationCache(organizationId);

    return result.data || null;
  }

  /**
   * Propagate items to multiple tenants in an organization
   * Uses the /api/organizations/:id/items/propagate endpoint
   */
  async propagateItems(
    organizationId: string,
    options: {
      sourceItemId: string;
      targetTenantIds: string[];
      mode: 'create_only' | 'update_only' | 'create_or_update';
    }
  ): Promise<{
    success: boolean;
    summary: {
      created: number;
      updated: number;
      skipped: number;
      errors: number;
    };
    results: Array<{
      tenantId: string;
      action: 'created' | 'updated' | 'skipped' | 'error';
      itemId?: string;
      error?: string;
    }>;
  } | null> {
    if (!organizationId) {
      clientLogger.error('[OrganizationsSingleton] propagateItems: organizationId is required');
      return null;
    }

    if (!options.sourceItemId || !options.targetTenantIds?.length) {
      clientLogger.error('[OrganizationsSingleton] propagateItems: sourceItemId and targetTenantIds are required');
      return null;
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/items/propagate`,
      {
        method: 'POST',
        body: JSON.stringify({
          sourceItemId: options.sourceItemId,
          targetTenantIds: options.targetTenantIds,
          mode: options.mode,
        })
      },
      `org-propagate-items-${organizationId}-${options.sourceItemId}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to propagate items:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }


  /**
   * Get organization commerce settings
   */
  async getOrganizationCommerceSettings(organizationId: string): Promise<any | null> {
    if (!organizationId) {
      clientLogger.error('[OrganizationsSingleton] getOrganizationCommerceSettings: organizationId is required');
      return null;
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/commerce-settings`,
      {
        method: 'GET',
      },
      `org-commerce-settings-${organizationId}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to get commerce settings:', { detail: result.error });
      return null;
    }

    return result.data?.settings || null;
  }

  /**
   * Update organization commerce settings
   */
  async updateOrganizationCommerceSettings(organizationId: string, settings: any): Promise<any | null> {
    if (!organizationId) {
      clientLogger.error('[OrganizationsSingleton] updateOrganizationCommerceSettings: organizationId is required');
      return null;
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/commerce-settings`,
      {
        method: 'PUT',
        body: JSON.stringify(settings)
      },
      `org-commerce-settings-${organizationId}`
    );

    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to update commerce settings:', { detail: result.error });
      return null;
    }

    // Invalidate cache after update
    this.invalidateOrganizationCache(organizationId);

    return result.data?.settings || null;
  }

  async getAvailableTenants(organizationId: string): Promise<any[]> {
    if (!organizationId) return [];
    const result = await this.makeDefaultRequest<any[]>(
      `/api/organizations/${organizationId}/available-tenants`,
      { method: 'GET' },
      `org-available-tenants-${organizationId}`
    );
    if (!result.success) {
      clientLogger.error('[OrganizationsSingleton] Failed to get available tenants:', { detail: result.error });
      return [];
    }
    return result.data || [];
  }

  async addTenantSelf(organizationId: string, tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/tenants/self`,
      { method: 'POST', body: JSON.stringify({ tenantId }) },
      `org-add-tenant-${organizationId}`
    );
    if (!result.success) {
      const errMsg = typeof result.error === 'object' && result.error ? result.error.message : String(result.error || 'Failed to add location');
      throw new Error(errMsg);
    }
    this.invalidateOrganizationCache(organizationId);
    return result.data;
  }

  async removeTenantSelf(organizationId: string, tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/tenants/${tenantId}/self`,
      { method: 'DELETE' },
      `org-remove-tenant-${organizationId}`
    );
    if (!result.success) {
      const errMsg = typeof result.error === 'object' && result.error ? result.error.message : String(result.error || 'Failed to remove location');
      throw new Error(errMsg);
    }
    this.invalidateOrganizationCache(organizationId);
    return result.data;
  }

  async updateTenantStatus(tenantId: string, status: string, reason?: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status, reason }) },
    );
    if (!result.success) {
      const errMsg = typeof result.error === 'object' && result.error ? result.error.message : String(result.error || 'Failed to update status');
      throw new Error(errMsg);
    }
    return result.data;
  }

  async updateStandingMode(organizationId: string, tenantId: string, standingMode: 'independent' | 'inherited'): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/tenants/${tenantId}/standing-mode`,
      { method: 'PATCH', body: JSON.stringify({ standingMode }) },
    );
    if (!result.success) {
      const errMsg = typeof result.error === 'object' && result.error ? result.error.message : String(result.error || 'Failed to update standing mode');
      throw new Error(errMsg);
    }
    this.invalidateOrganizationCache(organizationId);
    return result.data;
  }

  private invalidateOrganizationCache(organizationId: string) {
    this.invalidateCache(`tenant-organization-${organizationId}`);
    this.invalidateCache(`organization-${organizationId}`);
    this.invalidateCache('organization-*');
    this.invalidateCache('organizations-*');
    this.invalidateCache('tenant-organization-*');
    this.invalidateCache(`org-commerce-settings-${organizationId}`);
  }
}

// Export singleton instance
export const organizationsService = OrganizationsSingletonService.getInstance();
