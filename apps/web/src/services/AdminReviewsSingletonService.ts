/**
 * Admin Reviews Singleton Service
 * 
 * Extends AdminApiSingleton for admin-only review operations
 * Follows single responsibility principle - only admin review management
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

// Admin-specific interfaces
export interface AdminReview {
  id: string;
  rating: number;
  reviewText?: string;
  createdAt: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  helpfulCount: number;
  verifiedPurchase: boolean;
  userName?: string;
  userEmail?: string;
  locationLat?: number;
  locationLng?: number;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  productId?: string;
  productName?: string;
  productSku?: string;
  reviewType: 'store' | 'product' | 'google';
}

export interface AdminReviewStats {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  averageRating: number;
}

class AdminReviewsSingletonService extends AdminApiSingleton {
  private static instance: AdminReviewsSingletonService;

  private constructor() {
    super('admin-reviews-singleton');
  }

  public static getInstance(): AdminReviewsSingletonService {
    if (!AdminReviewsSingletonService.instance) {
      AdminReviewsSingletonService.instance = new AdminReviewsSingletonService();
    }
    return AdminReviewsSingletonService.instance;
  }

  /**
   * Get all reviews across all stores (admin only)
   * Uses the /api/admin/reviews endpoint
   * Note: Only platform admins can access this
   */
  async getAllAdminReviews(filters?: {
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    rating?: '1' | '2' | '3' | '4' | '5' | 'all';
    reviewType?: 'store' | 'product' | 'google' | 'all';
    search?: string;
    store?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminReview[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters?.status && filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }
      if (filters?.rating && filters.rating !== 'all') {
        queryParams.append('rating', filters.rating);
      }
      if (filters?.reviewType && filters.reviewType !== 'all') {
        queryParams.append('reviewType', filters.reviewType);
      }
      if (filters?.search) {
        queryParams.append('search', filters.search);
      }
      if (filters?.store) {
        queryParams.append('store', filters.store);
      }
      if (filters?.limit) {
        queryParams.append('limit', filters.limit.toString());
      }
      if (filters?.offset) {
        queryParams.append('offset', filters.offset.toString());
      }

      const url = `/api/reviews-singleton${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: {
          reviews: AdminReview[];
          pagination: any;
          timestamp: string;
        };
      }>(
        url,
        {},
        `admin-reviews-${JSON.stringify(filters)}`
      );

      return result.data?.data?.reviews || [];
    } catch (error: any) {
      // Handle 401/403 errors gracefully
      if (error?.status === 401 || error?.status === 403 || error?.code === 'UNAUTHORIZED') {
        console.log('[AdminReviewsSingleton] User not authorized for admin reviews');
        return [];
      }
      clientLogger.error('[AdminReviewsSingleton] Failed to get admin reviews:', { detail: error });
      return [];
    }
  }

  /**
   * Get admin review statistics (admin only)
   * Uses the /api/admin/reviews/stats endpoint
   * Note: Only platform admins can access this
   */
  async getAdminReviewStats(): Promise<AdminReviewStats | null> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: {
          stats: AdminReviewStats;
          timestamp: string;
        };
      }>(
        '/api/reviews-singleton/stats',
        {},
        'admin-review-stats'
      );

      return result.data?.data?.stats || null;
    } catch (error: any) {
      // Handle 401/403 errors gracefully
      if (error?.status === 401 || error?.status === 403 || error?.code === 'UNAUTHORIZED') {
        console.log('[AdminReviewsSingleton] User not authorized for admin stats');
        return null;
      }
      clientLogger.error('[AdminReviewsSingleton] Failed to get admin review stats:', { detail: error });
      return null;
    }
  }

  /**
   * Approve a pending review (admin only)
   * Uses the /api/admin/reviews/:reviewId/approve endpoint
   * Note: Only platform admins can approve reviews
   */
  async approveReview(reviewId: string): Promise<boolean> {
    if (!reviewId) {
      clientLogger.error('[AdminReviewsSingleton] approveReview: reviewId is required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message: string;
      }>(
        `/api/reviews-singleton/${reviewId}/approve`,
        { method: 'POST' },
        `approve-review-${reviewId}`
      );

      return result?.success || false;
    } catch (error) {
      clientLogger.error('[AdminReviewsSingleton] Failed to approve review:', { detail: error });
      return false;
    }
  }

  /**
   * Reject a pending review (admin only)
   * Uses the /api/admin/reviews/:reviewId/reject endpoint
   * Note: Only platform admins can reject reviews
   */
  async rejectReview(reviewId: string): Promise<boolean> {
    if (!reviewId) {
      clientLogger.error('[AdminReviewsSingleton] rejectReview: reviewId is required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message: string;
      }>(
        `/api/reviews-singleton/${reviewId}/reject`,
        { method: 'POST' },
        `reject-review-${reviewId}`
      );

      return result?.success || false;
    } catch (error) {
      clientLogger.error('[AdminReviewsSingleton] Failed to reject review:', { detail: error });
      return false;
    }
  }

  /**
   * Bulk approve multiple reviews (admin only)
   * Uses the /api/admin/reviews/bulk-approve endpoint
   */
  async bulkApproveReviews(reviewIds: string[]): Promise<boolean> {
    if (!reviewIds.length) {
      clientLogger.error('[AdminReviewsSingleton] bulkApproveReviews: reviewIds array is required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message: string;
      }>(
        '/api/admin/reviews/bulk-approve',
        {
          method: 'POST',
          body: JSON.stringify({ reviewIds })
        },
        `bulk-approve-${reviewIds.length}`
      );

      return result?.success || false;
    } catch (error) {
      clientLogger.error('[AdminReviewsSingleton] Failed to bulk approve reviews:', { detail: error });
      return false;
    }
  }

  /**
   * Bulk reject multiple reviews (admin only)
   * Uses the /api/admin/reviews/bulk-reject endpoint
   */
  async bulkRejectReviews(reviewIds: string[]): Promise<boolean> {
    if (!reviewIds.length) {
      clientLogger.error('[AdminReviewsSingleton] bulkRejectReviews: reviewIds array is required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message: string;
      }>(
        '/api/admin/reviews/bulk-reject',
        {
          method: 'POST',
          body: JSON.stringify({ reviewIds })
        },
        `bulk-reject-${reviewIds.length}`
      );

      return result?.success || false;
    } catch (error) {
      clientLogger.error('[AdminReviewsSingleton] Failed to bulk reject reviews:', { detail: error });
      return false;
    }
  }
}

// Export singleton instance
export const adminReviewsService = AdminReviewsSingletonService.getInstance();
