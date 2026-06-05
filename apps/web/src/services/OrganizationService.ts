import { OrganizationApiSingleton, AuthorizationGroup, type OrganizationRequestOptions } from '../providers/base/OrganizationApiSingleton';

/**
 * Service for managing organization operations
 * Handles organization requests, assignments, and management with next-level security
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

export class OrganizationService extends OrganizationApiSingleton {
  private static instance: OrganizationService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'organization-service*',
      'organization-details*',
      'organization-members*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(organizationId?: string): Promise<void> {
    await this.invalidateCachePattern('organization-service*');
    await this.invalidateCachePattern('organization-details*');
    await this.invalidateCachePattern('organization-members*');
  }

  private constructor() {
    super('organization-service', {
      defaultOrganizationValidation: {
        // Basic organization access
        requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
        platformUsersBypassMembership: true,
        allowSupportOverride: true
      },
      autoValidateOrganization: true,
      cacheEnabled: true,
      cacheTTL: 10 * 60 * 1000, // 10 minutes cache
      defaultRetryAttempts: 2,
      retryDelay: 1000
    });
  }

  public static getInstance(): OrganizationService {
    if (!OrganizationService.instance) {
      OrganizationService.instance = new OrganizationService();
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
    const result = await this.makeDefaultRequest<any>(
      '/api/organization-requests',
      { 
        method: 'POST',
        body: JSON.stringify(requestData),
        organizationValidation: {
          // Use basic organization validation for this request
          requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
          platformUsersBypassMembership: true
        }
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
   * Get organization requests
   */
  async getOrganizationRequests(params: {
    status?: string;
    tenantId?: string;
    organizationId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PendingRequest[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.set('status', params.status);
      if (params.tenantId) queryParams.set('tenantId', params.tenantId);
      if (params.organizationId) queryParams.set('organizationId', params.organizationId);
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.limit) queryParams.set('limit', params.limit.toString());

      const queryString = queryParams.toString();
      const endpoint = `/organization-requests${queryString ? `?${queryString}` : ''}`;

      const result = await this.makeDefaultRequest<PendingRequest[]>(
        endpoint,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=300', // 5 minutes for requests
            'X-Service-Worker': 'org-cache',
            'X-Platform-Cache': 'enabled'
          }
        },
        `organization-requests-${JSON.stringify(params)}`
      );

      if (!result.success) {
        console.error('[OrganizationService] Failed to get organization requests:', result.error);
        throw result.error;
      }

      return result.data || [];
    } catch (error) {
      console.error('[OrganizationService] Failed to get organization requests:', error);
      throw error;
    }
  }

  /**
   * Get specific organization request
   */
  async getOrganizationRequest(requestId: string): Promise<PendingRequest | null> {
    if (!requestId) {
      console.error('[OrganizationService] Request ID is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<PendingRequest>(
        `/organization-requests/${requestId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=300', // 5 minutes for request details
            'X-Service-Worker': 'org-cache',
            'X-Platform-Cache': 'enabled'
          }
        },
        `organization-request-${requestId}`
      );

      if (!result.success) {
        console.error('[OrganizationService] Failed to get organization request:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[OrganizationService] Failed to get organization request:', error);
      return null;
    }
  }

  /**
   * Assign tenant to organization
   */
  async assignTenantToOrganization(organizationId: string, tenantId: string): Promise<void> {
    if (!organizationId || !tenantId) {
      throw new Error('Organization ID and Tenant ID are required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/organizations/${organizationId}/tenants/${tenantId}`,
      { 
        method: 'POST',
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
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

    const result = await this.makeDefaultRequest<void>(
      `/api/organizations/${organizationId}/tenants/${tenantId}`,
      { 
        method: 'DELETE',
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
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
  async deletePendingRequest(requestId: string, options: OrganizationRequestOptions = {}): Promise<void> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/organization-requests/${requestId}`,
      {
        method: 'DELETE',
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true,
          ...options.organizationValidation
        }
      },
      `platform-delete-request-${requestId}`
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
  async updatePendingRequest(requestId: string, updateData: Partial<any>, options: OrganizationRequestOptions = {}): Promise<any> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/organization-requests/${requestId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true,
          ...options.organizationValidation
        }
      },
      `platform-update-request-${requestId}`
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
      {
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
      `platform-organization-${organizationId}`,
      this.options.cacheTTL || 10 * 60 * 1000
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

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations?${params}`,
      {
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
      'platform-organizations',
      this.options.cacheTTL || 10 * 60 * 1000
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
    const result = await this.makeDefaultRequest<any>(
      '/api/organizations',
      { 
        method: 'POST',
        body: JSON.stringify(orgData),
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
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
  async updateOrganization(organizationId: string, updateData: Partial<any>): Promise<any> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify(updateData),
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
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

    const result = await this.makeDefaultRequest<void>(
      `/api/organizations/${organizationId}`,
      { 
        method: 'DELETE',
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
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

    const result = await this.makeDefaultRequest<any[]>(
      `/api/organizations/${organizationId}/members`,
      {
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
      `platform-org-members-${organizationId}`,
      this.options.cacheTTL || 10 * 60 * 1000
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

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/members`,
      { 
        method: 'POST',
        body: JSON.stringify(memberData),
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
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

    const result = await this.makeDefaultRequest<void>(
      `/api/organizations/${organizationId}/members/${userId}`,
      { 
        method: 'DELETE',
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
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

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/settings`,
      {
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
          platformUsersBypassMembership: true
        }
      },
      `platform-org-settings-${organizationId}`,
      this.options.cacheTTL || 10 * 60 * 1000
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

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${organizationId}/settings`,
      { 
        method: 'PATCH',
        body: JSON.stringify(settings),
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_MANAGE_ORGANIZATION],
          platformUsersBypassMembership: true
        }
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
