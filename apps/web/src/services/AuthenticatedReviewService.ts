/**
 * Authenticated Review Service
 *
 * Handles admin review operations that require authentication
 * Extends AuthenticatedApiSingleton for proper token handling
 */

import { AuthenticatedApiSingleton } from '../providers/base/UniversalSingleton';

export interface Review {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  rating: number;
  title: string;
  content: string;
  isVerifiedPurchase: boolean;
  isAnonymous: boolean;
  isApproved: boolean;
  helpfulVotes: number;
  createdAt: string;
  updatedAt: string;
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
  async getPendingReviews(tenantId: string): Promise<Review[] | null> {
    if (!tenantId) {
      console.error('[AuthenticatedReviewService] getPendingReviews: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeAuthenticatedRequest<{
        success: boolean;
        reviews: Review[];
      }>(
        `/api/stores/${tenantId}/reviews/pending`,
        {},
        `pending-reviews-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[AuthenticatedReviewService] Failed to get pending reviews:', result.error);
        return null;
      }

      return result.data?.reviews || [];
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
      const result = await this.makeAuthenticatedRequest<{
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
      const result = await this.makeAuthenticatedRequest<{
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
}

// Export authenticated service instance
export const authenticatedReviewService = AuthenticatedReviewService.getInstance();
