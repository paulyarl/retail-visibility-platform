/**
 * Upgrade Requests Service
 * 
 * Extends AuthenticatedApiSingleton to provide upgrade request management
 * Handles upgrade request processing, approval, and tracking
 */

import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

export interface UpgradeRequest {
  id: string;
  tenantId: string;
  business_name?: string;
  currentTier: string;
  requestedTier: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  adminNotes?: string;
  costAgreed?: boolean;
  estimatedCost?: number;
  costCurrency?: string;
  organization?: {
    id: string;
    name: string;
  };
  tenant?: {
    id: string;
    name: string;
  };
  requester?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PendingRequest {
  id: string;
  tenantId: string;
  requestedTier: string;
  currentTier: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  notes?: string;
  costAgreed?: boolean;
  estimatedCost?: number;
  costCurrency?: string;
  organization?: {
    id: string;
    name: string;
  };
}

export interface UpgradeRequestsResponse {
  data: UpgradeRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface UpgradeRequestFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'processed';
  currentTier?: string;
  requestedTier?: string;
  organizationId?: string;
  tenantId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'processedAt' | 'estimatedCost';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Service for managing upgrade request operations
 * Handles upgrade request processing, approval, and tracking
 */
export class UpgradeRequestsService extends AuthenticatedApiSingleton {
  private static instance: UpgradeRequestsService;

  protected constructor() {
    super('upgrade-requests-service', {
      ttl: 10 * 60 * 1000 // 10 minutes for upgrade requests
    });
  }

  public static getInstance(): UpgradeRequestsService {
    if (!UpgradeRequestsService.instance) {
      UpgradeRequestsService.instance = new UpgradeRequestsService();
    }
    return UpgradeRequestsService.instance;
  }

  /**
   * Get pending upgrade request for tenant
   */
  async getPendingUpgradeRequest(tenantId: string): Promise<PendingRequest | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<PendingRequest>(
      `/api/upgrade-requests/pending/${tenantId}`,
      {},
      `pending-upgrade-${tenantId}`,
      5 * 60 * 1000 // 5 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Get all upgrade requests
   */
  async getUpgradeRequests(filters: UpgradeRequestFilters = {}): Promise<UpgradeRequestsResponse | null> {
    // Build query string from filters
    const queryParams = new URLSearchParams();
    
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.currentTier) queryParams.append('currentTier', filters.currentTier);
    if (filters.requestedTier) queryParams.append('requestedTier', filters.requestedTier);
    if (filters.organizationId) queryParams.append('organizationId', filters.organizationId);
    if (filters.tenantId) queryParams.append('tenantId', filters.tenantId);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/api/upgrade-requests${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeDefaultRequest<UpgradeRequestsResponse>(
      endpoint,
      {},
      `upgrade-requests-${JSON.stringify(filters)}`,
      5 * 60 * 1000 // 5 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Create upgrade request
   */
  async createUpgradeRequest(requestData: {
    tenantId: string;
    requestedTier: string;
    business_name?: string;
    notes?: string;
    costAgreed?: boolean;
  }): Promise<UpgradeRequest | null> {
    const response = await this.makeDefaultRequest<UpgradeRequest>(
      '/api/upgrade-requests',
      {
        method: 'POST',
        body: JSON.stringify(requestData),
      },
      'create-upgrade-request',
      0 // No cache for creation
    );

    // Invalidate upgrade requests cache
    this.invalidateCache('upgrade-requests');

    return response?.data || null;
  }

  /**
   * Process upgrade request (approve/reject)
   */
  async processUpgradeRequest(
    requestId: string,
    action: 'approve' | 'reject',
    adminNotes?: string
  ): Promise<UpgradeRequest | null> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const response = await this.makeDefaultRequest<UpgradeRequest>(
      `/api/upgrade-requests/${requestId}/process`,
      {
        method: 'POST',
        body: JSON.stringify({ action, adminNotes }),
      },
      `process-upgrade-${requestId}`,
      0 // No cache for processing
    );

    // Invalidate upgrade requests cache
    this.invalidateCache('upgrade-requests');

    return response?.data || null;
  }

  /**
   * Get upgrade request by ID
   */
  async getUpgradeRequest(requestId: string): Promise<UpgradeRequest | null> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const response = await this.makeDefaultRequest<UpgradeRequest>(
      `/api/upgrade-requests/${requestId}`,
      {},
      `upgrade-request-${requestId}`,
      10 * 60 * 1000 // 10 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Update upgrade request
   */
  async updateUpgradeRequest(
    requestId: string,
    updates: Partial<UpgradeRequest>
  ): Promise<UpgradeRequest | null> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const response = await this.makeDefaultRequest<UpgradeRequest>(
      `/api/upgrade-requests/${requestId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      },
      `update-upgrade-${requestId}`,
      0 // No cache for updates
    );

    // Invalidate upgrade requests cache
    this.invalidateCache('upgrade-requests');

    return response?.data || null;
  }

  /**
   * Delete upgrade request
   */
  async deleteUpgradeRequest(requestId: string): Promise<void> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/upgrade-requests/${requestId}`,
      {
        method: 'DELETE',
      },
      `delete-upgrade-${requestId}`,
      0 // No cache for deletion
    );

    // Invalidate upgrade requests cache
    this.invalidateCache('upgrade-requests');
  }

  /**
   * Get upgrade request statistics
   */
  async getUpgradeRequestStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    processed: number;
    byRequestedTier: Array<{
      tier: string;
      count: number;
      percentage: number;
    }>;
    byCurrentTier: Array<{
      tier: string;
      count: number;
      percentage: number;
    }>;
    monthlyTrends: Array<{
      month: string;
      requests: number;
      approved: number;
      rejected: number;
    }>;
  } | null> {
    const response = await this.makeDefaultRequest<{
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      processed: number;
      byRequestedTier: Array<{
        tier: string;
        count: number;
        percentage: number;
      }>;
      byCurrentTier: Array<{
        tier: string;
        count: number;
        percentage: number;
      }>;
      monthlyTrends: Array<{
        month: string;
        requests: number;
        approved: number;
        rejected: number;
      }>;
    }>(
      '/api/upgrade-requests/stats',
      {},
      'upgrade-request-stats',
      15 * 60 * 1000 // 15 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Bulk process upgrade requests
   */
  async bulkProcessUpgradeRequests(
    requestIds: string[],
    action: 'approve' | 'reject',
    adminNotes?: string
  ): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const response = await this.makeDefaultRequest<{
      processed: number;
      failed: number;
      errors: string[];
    }>(
      '/api/upgrade-requests/bulk-process',
      {
        method: 'POST',
        body: JSON.stringify({ requestIds, action, adminNotes }),
      },
      'bulk-process-upgrades',
      0 // No cache for bulk processing
    );

    // Invalidate upgrade requests cache
    this.invalidateCache('upgrade-requests');

    return response?.data || {
      processed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Get upgrade requests for organization
   */
  async getOrganizationUpgradeRequests(
    organizationId: string,
    filters: UpgradeRequestFilters = {}
  ): Promise<UpgradeRequestsResponse | null> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Add organization filter
    const enhancedFilters = { ...filters, organizationId };

    const response = await this.makeDefaultRequest<UpgradeRequestsResponse>(
      `/api/organizations/${organizationId}/upgrade-requests`,
      {
        method: 'POST',
        body: JSON.stringify(enhancedFilters),
      },
      `org-upgrade-requests-${organizationId}`,
      5 * 60 * 1000 // 5 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Export upgrade requests
   */
  async exportUpgradeRequests(
    format: 'csv' | 'json' | 'xlsx' = 'csv',
    filters?: UpgradeRequestFilters
  ): Promise<{
    downloadUrl: string;
    expiresAt: string;
  }> {
    const response = await this.makeDefaultRequest<{
      downloadUrl: string;
      expiresAt: string;
    }>(
      `/api/upgrade-requests/export?format=${format}`,
      {
        method: 'POST',
        body: JSON.stringify(filters || {}),
      },
      `export-upgrade-requests-${format}`,
      0 // No cache for exports
    );

    return response?.data || {
      downloadUrl: '',
      expiresAt: ''
    };
  }
}

// Export singleton instance
export const upgradeRequestsService = UpgradeRequestsService.getInstance();
