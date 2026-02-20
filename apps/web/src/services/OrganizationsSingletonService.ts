/**
 * Organizations Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached organizations operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
}

class OrganizationsSingletonService extends AuthenticatedApiSingleton {
  private static instance: OrganizationsSingletonService;

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
    const result = await this.makeAuthenticatedRequest<Organization[]>(
      `/api/organizations?page=${page}&limit=${limit}`,
      {},
      `organizations-${page}-${limit}`
    );

    if (!result.success) {
      console.error('[OrganizationsSingleton] Failed to get organizations:', result.error);
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
      console.error('[OrganizationsSingleton] getOrganizationById: id is required');
      return null;
    }

    const result = await this.makeAuthenticatedRequest<Organization>(
      `/api/organizations/${id}`,
      {},
      `organization-${id}`
    );

    if (!result.success) {
      console.error('[OrganizationsSingleton] Failed to get organization by ID:', result.error);
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
      console.error('[OrganizationsSingleton] getOrganizationBySlug: slug is required');
      return null;
    }

    const result = await this.makeAuthenticatedRequest<Organization>(
      `/api/organizations/slug/${slug}`,
      {},
      `organization-slug-${slug}`
    );

    if (!result.success) {
      console.error('[OrganizationsSingleton] Failed to get organization by slug:', result.error);
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
      console.error('[OrganizationsSingleton] searchOrganizations: query is required');
      return [];
    }

    const result = await this.makeAuthenticatedRequest<OrganizationsResponse>(
      `/api/organizations/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      {},
      `organizations-search-${query}-${page}-${limit}`
    );

    if (!result.success) {
      console.error('[OrganizationsSingleton] Failed to search organizations:', result.error);
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
      console.error('[OrganizationsSingleton] updateHeroLocation: organizationId and tenantId are required');
      return null;
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organizations/${organizationId}/hero-location`,
      {
        method: 'PUT',
        body: JSON.stringify({ tenantId })
      },
      `org-hero-location-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationsSingleton] Failed to update hero location:', result.error);
      return null;
    }

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
      console.error('[OrganizationsSingleton] mirrorCategories: scope and strategy are required');
      return null;
    }

    if (requestData.scope === 'tenant' && !requestData.tenantId) {
      console.error('[OrganizationsSingleton] mirrorCategories: tenantId is required for tenant scope');
      return null;
    }

    if (requestData.scope === 'organization' && !requestData.organizationId) {
      console.error('[OrganizationsSingleton] mirrorCategories: organizationId is required for organization scope');
      return null;
    }

    const result = await this.makeAuthenticatedRequest<any>(
      '/api/categories/mirror',
      {
        method: 'POST',
        body: JSON.stringify(requestData)
      },
      `org-mirror-categories-${requestData.scope}-${requestData.organizationId || requestData.tenantId}`
    );

    if (!result.success) {
      console.error('[OrganizationsSingleton] Failed to mirror categories:', result.error);
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
      console.error('[OrganizationsSingleton] syncFromHero: organizationId is required');
      return null;
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organizations/${organizationId}/sync-from-hero`,
      {
        method: 'POST',
        body: JSON.stringify({})
      },
      `org-sync-from-hero-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationsSingleton] Failed to sync from hero:', result.error);
      return null;
    }

    return result.data || null;
  }

}

// Export singleton instance
export const organizationsService = OrganizationsSingletonService.getInstance();
