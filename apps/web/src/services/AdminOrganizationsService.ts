/**
 * Admin Organizations Service
 * 
 * Handles admin organization management operations
 * Extends AdminApiSingleton for proper caching and context management
 * 
 * MIGRATION: Replaces direct fetch calls in:
 * - /src/app/api/organizations/route.ts
 * - /src/app/api/organizations/[organizationId]/route.ts
 * - /src/app/api/organizations/[organizationId]/tenants/route.ts
 * - /src/app/api/organizations/[organizationId]/tenants/[tenantId]/route.ts
 * - /src/app/api/organizations/[organizationId]/items/propagate/route.ts
 * - /src/components/settings/EditBusinessProfileModal.tsx
 * - /src/app/settings/admin/feature-overrides/page.tsx
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  subscriptionTier?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  settings?: {
    allowUserInvitation?: boolean;
    requireApproval?: boolean;
    defaultUserRole?: string;
  };
  stats?: {
    totalUsers: number;
    totalTenants: number;
    totalItems: number;
  };
}

export interface CreateOrganizationRequest {
  name: string;
  description?: string;
  domain?: string;
  website?: string;
  industry?: string;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  settings?: {
    allowUserInvitation?: boolean;
    requireApproval?: boolean;
    defaultUserRole?: string;
  };
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  domain?: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  subscriptionTier?: string;
  isActive?: boolean;
  settings?: {
    allowUserInvitation?: boolean;
    requireApproval?: boolean;
    defaultUserRole?: string;
  };
}

export interface OrganizationListResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
}

export interface OrganizationTenant {
  id: string;
  name: string;
  domain?: string;
  subscriptionTier: string;
  isActive: boolean;
  createdAt: string;
  users?: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
  }>;
}

export class AdminOrganizationsService extends AdminApiSingleton {
  private static instance: AdminOrganizationsService;

  private constructor() {
    super('AdminOrganizationsService');
  }

  static getInstance(): AdminOrganizationsService {
    if (!AdminOrganizationsService.instance) {
      AdminOrganizationsService.instance = new AdminOrganizationsService();
    }
    return AdminOrganizationsService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'admin-organizations-*',
      'admin-organization-*',
      'admin-organization-tenants-*',
      'admin-organization-stats-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(organizationId?: string, ...params: any[]): Promise<void> {
    if (organizationId) {
      await this.invalidateCache(`admin-organization-${organizationId}`);
      await this.invalidateCache(`admin-organization-tenants-${organizationId}`);
      await this.invalidateCache(`admin-organization-stats-${organizationId}`);
    } else {
      await this.invalidateCache('admin-organizations-*');
      await this.invalidateCache('admin-organization-*');
      await this.invalidateCache('admin-organization-tenants-*');
      await this.invalidateCache('admin-organization-stats-*');
    }
  }

  /**
   * Get all organizations (paginated)
   */
  async getOrganizations(options?: { page?: number; limit?: number; search?: string; isActive?: boolean }): Promise<OrganizationListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    if (options?.isActive !== undefined) params.append('isActive', options.isActive.toString());
    
    const result = await this.makeDefaultRequest<OrganizationListResponse>(
      `/api/organizations${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'admin-organizations-list'
    );
    
    if (!result.success) {
      console.log(`Failed to get organizations: ${result.error}`);
      return { organizations: [], total: 0, page: 1, limit: 20 };
    }
    
    return result.data || { organizations: [], total: 0, page: 1, limit: 20 };
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId: string): Promise<Organization | null> {
    const result = await this.makeDefaultRequest<Organization>(
      `/api/organizations/${organizationId}`,
      {},
      `admin-organization-${organizationId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get organization: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Create new organization
   */
  async createOrganization(organization: CreateOrganizationRequest): Promise<Organization | null> {
    const result = await this.makeDefaultRequest<Organization>(
      '/api/organizations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(organization),
      },
      'admin-organizations-create'
    );
    
    if (!result.success) {
      console.log(`Failed to create organization: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after creation
    await this.invalidateServiceCaches();
    
    return result.data || null;
  }

  /**
   * Update organization
   */
  async updateOrganization(organizationId: string, updates: UpdateOrganizationRequest): Promise<Organization | null> {
    const result = await this.makeDefaultRequest<Organization>(
      `/api/organizations/${organizationId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      },
      `admin-organization-update-${organizationId}`
    );
    
    if (!result.success) {
      console.log(`Failed to update organization: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after update
    await this.invalidateServiceCaches(organizationId);
    
    return result.data || null;
  }

  /**
   * Delete organization
   */
  async deleteOrganization(organizationId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/organizations/${organizationId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `admin-organization-delete-${organizationId}`
    );
    
    if (!result.success) {
      console.log(`Failed to delete organization: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after deletion
    await this.invalidateServiceCaches();
    
    return result.data?.success || false;
  }

  /**
   * Get organization tenants
   */
  async getOrganizationTenants(organizationId: string): Promise<OrganizationTenant[]> {
    const result = await this.makeDefaultRequest<{ tenants: OrganizationTenant[] }>(
      `/api/organizations/${organizationId}/tenants`,
      {},
      `admin-organization-tenants-${organizationId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get organization tenants: ${result.error}`);
      return [];
    }
    
    return result.data?.tenants || [];
  }

  /**
   * Add tenant to organization
   */
  async addOrganizationTenant(organizationId: string, tenantData: { tenantId: string; role?: string }): Promise<OrganizationTenant | null> {
    const result = await this.makeDefaultRequest<OrganizationTenant>(
      `/api/organizations/${organizationId}/tenants`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tenantData),
      },
      `admin-organization-tenant-add-${organizationId}`
    );
    
    if (!result.success) {
      console.log(`Failed to add tenant to organization: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after adding tenant
    await this.invalidateServiceCaches(organizationId);
    
    return result.data || null;
  }

  /**
   * Remove tenant from organization
   */
  async removeOrganizationTenant(organizationId: string, tenantId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/organizations/${organizationId}/tenants/${tenantId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `admin-organization-tenant-remove-${organizationId}-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to remove tenant from organization: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after removing tenant
    await this.invalidateServiceCaches(organizationId);
    
    return result.data?.success || false;
  }

  /**
   * Update organization tenant
   */
  async updateOrganizationTenant(organizationId: string, tenantId: string, updates: { role?: string; isActive?: boolean }): Promise<OrganizationTenant | null> {
    const result = await this.makeDefaultRequest<OrganizationTenant>(
      `/api/organizations/${organizationId}/tenants/${tenantId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      },
      `admin-organization-tenant-update-${organizationId}-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to update organization tenant: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after updating tenant
    await this.invalidateServiceCaches(organizationId);
    
    return result.data || null;
  }

  /**
   * Propagate items to organization tenants
   */
  async propagateItemsToTenants(organizationId: string, itemData: { itemIds: string[]; tenantIds?: string[] }): Promise<{ success: boolean; results?: any[] }> {
    const result = await this.makeDefaultRequest<{ success: boolean; results?: any[] }>(
      `/api/organizations/${organizationId}/items/propagate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      },
      `admin-organization-propagate-${organizationId}`
    );
    
    if (!result.success) {
      console.log(`Failed to propagate items to tenants: ${result.error}`);
      return { success: false };
    }
    
    return result.data || { success: false };
  }

  /**
   * Get product type summary for all organizations
   */
  async getProductTypeSummary(): Promise<Record<string, {
    orgId: string;
    orgName: string;
    productTypes: Array<{ type: string; count: number }>;
    totalItems: number;
  }>> {
    const result = await this.makeDefaultRequest<{
      organizations: Array<{
        orgId: string;
        orgName: string;
        productTypes: Array<{ type: string; count: number }>;
        totalItems: number;
      }>;
    }>(
      '/api/organizations/product-type-summary',
      {},
      'admin-organizations-product-type-summary'
    );

    if (!result.success || !result.data) {
      return {};
    }

    const map: Record<string, {
      orgId: string;
      orgName: string;
      productTypes: Array<{ type: string; count: number }>;
      totalItems: number;
    }> = {};
    for (const org of result.data.organizations || []) {
      map[org.orgId] = org;
    }
    return map;
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(organizationId?: string): Promise<{
    totalOrganizations: number;
    activeOrganizations: number;
    totalTenants: number;
    totalUsers: number;
    totalItems: number;
  }> {
    const url = organizationId 
      ? `/api/organizations/${organizationId}/stats`
      : '/api/organizations/stats';
    
    const cacheKey = organizationId 
      ? `admin-organization-stats-${organizationId}`
      : 'admin-organizations-stats';
    
    const result = await this.makeDefaultRequest<{
      totalOrganizations: number;
      activeOrganizations: number;
      totalTenants: number;
      totalUsers: number;
      totalItems: number;
    }>(
      url,
      {},
      cacheKey
    );
    
    if (!result.success) {
      console.log(`Failed to get organization stats: ${result.error}`);
      return { totalOrganizations: 0, activeOrganizations: 0, totalTenants: 0, totalUsers: 0, totalItems: 0 };
    }
    
    return result.data || { totalOrganizations: 0, activeOrganizations: 0, totalTenants: 0, totalUsers: 0, totalItems: 0 };
  }
}

// Export singleton instance
export default AdminOrganizationsService.getInstance();
