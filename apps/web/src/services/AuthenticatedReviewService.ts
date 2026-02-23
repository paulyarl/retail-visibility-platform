/**
 * Authenticated Review Service
 *
 * Handles admin review operations that require authentication
 * Extends AuthenticatedApiSingleton for proper token handling
 */

import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

export interface Review {
  id: string;
  rating: number;
  review_text: string;
  helpful_count: number;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
  session_id: string | null;
  user_id: string;
  product_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Authenticated Review Management Service
 * Handles admin review operations that require authentication
 * Extends AuthenticatedApiSingleton for proper token handling
 */
class AuthenticatedReviewService extends AuthenticatedApiSingleton {
  private static instance: AuthenticatedReviewService;

  private constructor() {
    super('authenticated-review-service');
    this.cacheTTL = 2 * 60 * 1000; // 2 minutes for admin operations
  }

  public static getInstance(): AuthenticatedReviewService {
    if (!AuthenticatedReviewService.instance) {
      AuthenticatedReviewService.instance = new AuthenticatedReviewService();
    }
    return AuthenticatedReviewService.instance;
  }

  /**
   * Get pending reviews for moderation (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/pending
   */
  async getPendingReviews(tenantId: string, options?: {
    limit?: number;
    offset?: number;
    reviewType?: 'store' | 'product' | 'all';
  }): Promise<Review[] | null> {
    if (!tenantId) {
      console.error('[AuthenticatedReviewService] getPendingReviews: tenantId is required');
      return null;
    }

    try {
      console.log('[AuthenticatedReviewService] Fetching pending reviews for tenant:', tenantId);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (options?.limit) {
        queryParams.append('limit', options.limit.toString());
      }
      if (options?.offset) {
        queryParams.append('offset', options.offset.toString());
      }
      if (options?.reviewType && options.reviewType !== 'all') {
        queryParams.append('reviewType', options.reviewType);
      }
      
      const url = `/api/stores/${tenantId}/reviews/pending${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: any[];
      }>(
        url,
        {},
        `pending-reviews-${tenantId}-${options?.limit || 'all'}-${options?.offset || '0'}-${options?.reviewType || 'all'}`,
        this.cacheTTL
      );

      console.log('[AuthenticatedReviewService] API result:', result);

      if (!result.success) {
        console.error('[AuthenticatedReviewService] Failed to get pending reviews:', result.error);
        return null;
      }

      const reviews = (result.data?.data as unknown as Review[]) || [];
      console.log('[AuthenticatedReviewService] Extracted reviews:', reviews);
      console.log('[AuthenticatedReviewService] Reviews count:', reviews.length);
      
      return reviews;
    } catch (error) {
      console.error('[AuthenticatedReviewService] Failed to get pending reviews:', error);
      return null;
    }
  }

  /**
   * Approve a pending review (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/:reviewId/approve
   */
  async approveReview(tenantId: string, reviewId: string): Promise<boolean> {
    if (!tenantId || !reviewId) {
      console.error('[AuthenticatedReviewService] approveReview: tenantId and reviewId are required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message?: string;
      }>(
        `/api/stores/${tenantId}/reviews/${reviewId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        `approve-review-${reviewId}`,
        0 // Don't cache this operation
      );

      if (!result.success) {
        console.error('[AuthenticatedReviewService] Failed to approve review:', result.error);
        return false;
      }

      console.log('[AuthenticatedReviewService] Review approved successfully:', reviewId);
      return true;
    } catch (error) {
      console.error('[AuthenticatedReviewService] Failed to approve review:', error);
      return false;
    }
  }

  /**
   * Reject a pending review (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/:reviewId/reject
   */
  async rejectReview(tenantId: string, reviewId: string): Promise<boolean> {
    if (!tenantId || !reviewId) {
      console.error('[AuthenticatedReviewService] rejectReview: tenantId and reviewId are required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message?: string;
      }>(
        `/api/stores/${tenantId}/reviews/${reviewId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        `reject-review-${reviewId}`,
        0 // Don't cache this operation
      );

      if (!result.success) {
        console.error('[AuthenticatedReviewService] Failed to reject review:', result.error);
        return false;
      }

      console.log('[AuthenticatedReviewService] Review rejected successfully:', reviewId);
      return true;
    } catch (error) {
      console.error('[AuthenticatedReviewService] Failed to reject review:', error);
      return false;
    }
  }

  /**
   * Bulk approve multiple pending reviews (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/bulk-approve
   */
  async bulkApproveReviews(tenantId: string, reviewIds: string[]): Promise<boolean> {
    if (!tenantId || !reviewIds.length) {
      console.error('[AuthenticatedReviewService] bulkApproveReviews: tenantId and reviewIds are required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message?: string;
      }>(
        `/api/stores/${tenantId}/reviews/bulk-approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewIds })
        },
        `bulk-approve-reviews-${tenantId}`,
        0 // Don't cache this operation
      );

      if (!result.success) {
        console.error('[AuthenticatedReviewService] Failed to bulk approve reviews:', result.error);
        return false;
      }

      console.log(`[AuthenticatedReviewService] ${reviewIds.length} reviews approved successfully`);
      return true;
    } catch (error) {
      console.error('[AuthenticatedReviewService] Failed to bulk approve reviews:', error);
      return false;
    }
  }

  /**
   * Bulk reject multiple pending reviews (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/bulk-reject
   */
  async bulkRejectReviews(tenantId: string, reviewIds: string[]): Promise<boolean> {
    if (!tenantId || !reviewIds.length) {
      console.error('[AuthenticatedReviewService] bulkRejectReviews: tenantId and reviewIds are required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message?: string;
      }>(
        `/api/stores/${tenantId}/reviews/bulk-reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewIds })
        },
        `bulk-reject-reviews-${tenantId}`,
        0 // Don't cache this operation
      );

      if (!result.success) {
        console.error('[AuthenticatedReviewService] Failed to bulk reject reviews:', result.error);
        return false;
      }

      console.log(`[AuthenticatedReviewService] ${reviewIds.length} reviews rejected successfully`);
      return true;
    } catch (error) {
      console.error('[AuthenticatedReviewService] Failed to bulk reject reviews:', error);
      return false;
    }
  }
}

// Export authenticated service instance
export const authenticatedReviewService = AuthenticatedReviewService.getInstance();
