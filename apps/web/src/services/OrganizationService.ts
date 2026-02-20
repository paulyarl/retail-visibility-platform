import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

/**
 * Service for managing organization operations
 * Handles organization requests, assignments, and management
 */
export interface Organization {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  logo?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingRequest {
  id: string;
  organizationId: string;
  tenantId: string;
  type: 'upgrade' | 'organization';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
  data: Record<string, any>;
}

export interface Tenant {
  id: string;
  name: string;
  // ... other tenant properties
}

export class OrganizationService extends TenantApiSingleton {
  private static instance: OrganizationService;

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes cache
      ...cacheOptions
    });
  }

  public static getInstance(): OrganizationService {
    if (!OrganizationService.instance) {
      OrganizationService.instance = new OrganizationService('organization-service');
    }
    return OrganizationService.instance;
  }

  /**
   * Create organization request
   */
  async createOrganizationRequest(requestData: {
    tenantId: string;
    organizationId: string;
    requestedBy: string;
    notes?: string;
    requestType?: string;
  }): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      '/api/organization-requests',
      { 
        method: 'POST',
        body: JSON.stringify(requestData)
      },
      `platform-create-org-request-${requestData.tenantId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to create organization request:', result.error);
      throw result.error;
    }

    // Invalidate pending request cache
    await this.invalidateCache(`platform-pending-request-${requestData.tenantId}*`);

    return result.data || null;
  }

  /**
   * Assign tenant to organization
   */
  async assignTenantToOrganization(organizationId: string, tenantId: string): Promise<void> {
    if (!organizationId || !tenantId) {
      throw new Error('Organization ID and Tenant ID are required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
      `/api/organizations/${organizationId}/tenants/${tenantId}`,
      { method: 'POST' },
      `platform-assign-tenant-${tenantId}-to-org-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to assign tenant to organization:', result.error);
      throw result.error;
    }

    // Invalidate relevant caches
    await this.invalidateCache(`platform-organization-${organizationId}*`);
    await this.invalidateCache(`platform-tenant-${tenantId}*`);
  }

  /**
   * Remove tenant from organization
   */
  async removeTenantFromOrganization(organizationId: string, tenantId: string): Promise<void> {
    if (!organizationId || !tenantId) {
      throw new Error('Organization ID and Tenant ID are required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
      `/api/organizations/${organizationId}/tenants/${tenantId}`,
      { method: 'DELETE' },
      `platform-remove-tenant-${tenantId}-from-org-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to remove tenant from organization:', result.error);
      throw result.error;
    }

    // Invalidate relevant caches
    await this.invalidateCache(`platform-organization-${organizationId}*`);
    await this.invalidateCache(`platform-tenant-${tenantId}*`);
  }

  /**
   * Delete pending request
   */
  async deletePendingRequest(requestId: string): Promise<void> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
      `/api/organization-requests/${requestId}`,
      { method: 'DELETE' },
      `platform-delete-pending-request-${requestId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to delete pending request:', result.error);
      throw result.error;
    }

    // Invalidate pending request cache
    await this.invalidateCache(`platform-pending-request-*`);
  }

  /**
   * Update pending request
   */
  async updatePendingRequest(requestId: string, updates: Partial<any>): Promise<any> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organization-requests/${requestId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates)
      },
      `platform-pending-request-${requestId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to update pending request:', result.error);
      throw result.error;
    }

    // Invalidate pending request cache
    await this.invalidateCache(`platform-pending-request-*`);

    return result.data || null;
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId: string): Promise<any> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Use default request type (TENANT) for primary operation
    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}`,
      {},
      `platform-organization-${organizationId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to get organization:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get all organizations
   */
  async getOrganizations(filters: {
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organizations?${params}`,
      {},
      'platform-organizations',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to get organizations:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Create organization
   */
  async createOrganization(orgData: {
    name: string;
    description?: string;
    domain?: string;
    settings?: any;
  }): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      '/api/organizations',
      { 
        method: 'POST',
        body: JSON.stringify(orgData)
      },
      'platform-create-organization'
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to create organization:', result.error);
      throw result.error;
    }

    // Invalidate organizations cache
    await this.invalidateCache('platform-organizations*');

    return result.data || null;
  }

  /**
   * Update organization
   */
  async updateOrganization(organizationId: string, updates: Partial<any>): Promise<any> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organizations/${organizationId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify(updates)
      },
      `platform-update-organization-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to update organization:', result.error);
      throw result.error;
    }

    // Invalidate organization cache
    await this.invalidateCache(`platform-organization-${organizationId}*`);
    await this.invalidateCache('platform-organizations*');

    return result.data || null;
  }

  /**
   * Delete organization
   */
  async deleteOrganization(organizationId: string): Promise<void> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
      `/api/organizations/${organizationId}`,
      { method: 'DELETE' },
      `platform-delete-organization-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to delete organization:', result.error);
      throw result.error;
    }

    // Invalidate organization cache
    await this.invalidateCache(`platform-organization-${organizationId}*`);
    await this.invalidateCache('platform-organizations*');
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(organizationId: string): Promise<any[]> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any[]>(
      `/api/organizations/${organizationId}/members`,
      {},
      `platform-org-members-${organizationId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to get organization members:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Add member to organization
   */
  async addOrganizationMember(organizationId: string, memberData: {
    userId: string;
    role: string;
  }): Promise<any> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organizations/${organizationId}/members`,
      { 
        method: 'POST',
        body: JSON.stringify(memberData)
      },
      `platform-add-org-member-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to add organization member:', result.error);
      throw result.error;
    }

    // Invalidate organization members cache
    await this.invalidateCache(`platform-org-members-${organizationId}*`);

    return result.data || null;
  }

  /**
   * Remove member from organization
   */
  async removeOrganizationMember(organizationId: string, userId: string): Promise<void> {
    if (!organizationId || !userId) {
      throw new Error('Organization ID and User ID are required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
      `/api/organizations/${organizationId}/members/${userId}`,
      { method: 'DELETE' },
      `platform-remove-org-member-${organizationId}-${userId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to remove organization member:', result.error);
      throw result.error;
    }

    // Invalidate organization members cache
    await this.invalidateCache(`platform-org-members-${organizationId}*`);
  }

  /**
   * Get organization settings
   */
  async getOrganizationSettings(organizationId: string): Promise<any> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organizations/${organizationId}/settings`,
      {},
      `platform-org-settings-${organizationId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to get organization settings:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Update organization settings
   */
  async updateOrganizationSettings(organizationId: string, settings: any): Promise<any> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/organizations/${organizationId}/settings`,
      { 
        method: 'PATCH',
        body: JSON.stringify(settings)
      },
      `platform-update-org-settings-${organizationId}`
    );

    if (!result.success) {
      console.error('[OrganizationService] Failed to update organization settings:', result.error);
      throw result.error;
    }

    // Invalidate organization settings cache
    await this.invalidateCache(`platform-org-settings-${organizationId}*`);

    return result.data || null;
  }
}

// Export singleton instance
export const organizationService = OrganizationService.getInstance();
