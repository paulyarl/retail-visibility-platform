/**
 * Admin Deletion Requests Service
 * 
 * Extends AdminApiSingleton to provide cached admin deletion request operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

interface DeletionRequest {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  userCreatedAt: string;
  reason: string | null;
  status: 'pending' | 'cancelled' | 'completed';
  preserveData: boolean;
  requestedAt: string;
  scheduledDeletionDate: string;
  cancelledAt?: string;
  completedAt?: string;
  ipAddress?: string;
  adminNotes?: string;
  cancelledByAdmin?: boolean;
}

interface DeletionStats {
  pendingCount: number;
  cancelledCount: number;
  completedCount: number;
  last7Days: number;
  last30Days: number;
  expiringIn7Days: number;
  topReasons: Array<{ reason: string; count: number }>;
}

interface DeletionRequestsResponse {
  data: DeletionRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

class AdminDeletionRequestsService extends AdminApiSingleton {
  private static instance: AdminDeletionRequestsService;

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes cache for deletion requests
      ...cacheOptions
    });
  }

  static getInstance(): AdminDeletionRequestsService {
    if (!AdminDeletionRequestsService.instance) {
      AdminDeletionRequestsService.instance = new AdminDeletionRequestsService('admin-deletion-requests-service');
    }
    return AdminDeletionRequestsService.instance;
  }

  /**
   * Get deletion requests by status
   */
  async getDeletionRequests(status: string = 'pending', page: number = 1, limit: number = 50): Promise<DeletionRequestsResponse> {
    // Use default request type (ADMIN) for primary operation
    const response = await this.makeDefaultRequest<DeletionRequestsResponse>(
      `/api/admin/deletion-requests?status=${status}&page=${page}&limit=${limit}`,
      {},
      `admin-deletion-requests-${status}-${page}-${limit}` 
    );

    if (!response.success) {
      console.error('[AdminDeletionRequestsService] Failed to get deletion requests:', response.error);
      
      // Handle specific database errors
      const errorMessage = typeof response.error === 'string' ? response.error : response.error?.message || '';
      if (errorMessage.includes('42P01') || errorMessage.includes('account_deletion_requests')) {
        console.warn('[AdminDeletionRequestsService] Account deletion requests table not found - feature not available');
        return { 
          data: [], 
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          error: 'Account deletion requests table not found. Please run database migrations.'
        };
      }
      
      return { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }

    return response.data || { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }

  /**
   * Get deletion requests statistics
   */
  async getDeletionStats(): Promise<DeletionStats | null> {
    const response = await this.makeDefaultRequest<{ success: boolean; data: DeletionStats }>(
      '/api/admin/deletion-requests/stats',
      {},
      'admin-deletion-stats'
    );

    if (!response.success) {
      console.error('[AdminDeletionRequestsService] Failed to get deletion stats:', response.error);

      // Handle specific database errors
      const errorMessage = typeof response.error === 'string' ? response.error : response.error?.message || '';
      if (errorMessage.includes('42P01') || errorMessage.includes('account_deletion_requests')) {
        console.warn('[AdminDeletionRequestsService] Account deletion requests table not found - feature not available');
        return null;
      }
      
      return null;
    }

    // Extract data from nested response structure
    return response.data?.data || null;
  }

  /**
   * Update deletion request (cancel/approve)
   */
  async updateDeletionRequest(requestId: string, action: 'cancel' | 'approve', adminNotes?: string): Promise<DeletionRequest | null> {
    const response = await this.makeDefaultRequest<DeletionRequest>(
      `/api/admin/deletion-requests/${requestId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          action,
          adminNotes: adminNotes || (action === 'cancel' ? 'Cancelled by admin' : 'Approved by admin')
        })
      },
      `admin-deletion-request-${requestId}`
    );

    if (!response.success) {
      console.error('[AdminDeletionRequestsService] Failed to update deletion request:', response.error);
      return null;
    }

    // Invalidate related caches
    await this.invalidateCache('admin-deletion-requests*');
    await this.invalidateCache('admin-deletion-stats');

    return response.data || null;
  }

  /**
   * Cancel deletion request
   */
  async cancelDeletionRequest(requestId: string, adminNotes?: string): Promise<DeletionRequest | null> {
    return this.updateDeletionRequest(requestId, 'cancel', adminNotes);
  }

  /**
   * Approve deletion request
   */
  async approveDeletionRequest(requestId: string, adminNotes?: string): Promise<DeletionRequest | null> {
    return this.updateDeletionRequest(requestId, 'approve', adminNotes);
  }

  /**
   * Get single deletion request by ID
   */
  async getDeletionRequest(requestId: string): Promise<DeletionRequest | null> {
    const response = await this.makeDefaultRequest<DeletionRequest>(
      `/api/admin/deletion-requests/${requestId}`,
      {},
      `admin-deletion-request-${requestId}`
    );

    if (!response.success) {
      console.error('[AdminDeletionRequestsService] Failed to get deletion request:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get all deletion requests (all statuses)
   */
  async getAllDeletionRequests(page: number = 1, limit: number = 50): Promise<DeletionRequestsResponse> {
    return this.getDeletionRequests('all', page, limit);
  }

  /**
   * Search deletion requests
   */
  async searchDeletionRequests(query: string, page: number = 1, limit: number = 50): Promise<DeletionRequestsResponse> {
    const response = await this.makeDefaultRequest<DeletionRequestsResponse>(
      `/api/admin/deletion-requests/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      {},
      `admin-deletion-requests-search-${query}-${page}-${limit}`
    );

    if (!response.success) {
      console.error('[AdminDeletionRequestsService] Failed to search deletion requests:', response.error);
      return { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }

    return response.data || { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }
}

// Export singleton instance
export const adminDeletionRequestsService = AdminDeletionRequestsService.getInstance();

// Export types
export type { DeletionRequest, DeletionStats, DeletionRequestsResponse };
