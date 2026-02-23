/**
 * Reviews Singleton Service
 * 
 * Extends PublicApiSingleton to provide cached reviews operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface ReviewSummary {
  rating_avg: number;
  rating_count: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  verified_purchase_count: number;
  last_review_at: string | null;
}

export interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  helpful_count: number;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  user_vote?: boolean | null;
}

export interface ReviewsResponse {
  reviews: Review[];
}

export interface HelpfulVoteRequest {
  isHelpful: boolean;
}

class ReviewsSingletonService extends PublicApiSingleton {
  private static instance: ReviewsSingletonService;

  private constructor() {
    super('reviews-singleton', {
      ttl: 5 * 60 * 1000 // 5 minutes for reviews data
    });
  }

  public static getInstance(): ReviewsSingletonService {
    if (!ReviewsSingletonService.instance) {
      ReviewsSingletonService.instance = new ReviewsSingletonService();
    }
    return ReviewsSingletonService.instance;
  }

  /**
   * Get rating summary for a store with caching
   * Uses the /api/stores/:tenantId/reviews/summary endpoint
   */
  async getRatingSummary(tenantId: string): Promise<ReviewSummary | null> {
    if (!tenantId) {
      console.error('[ReviewsSingleton] getRatingSummary: tenantId is required');
      return null;
    }

    try {
      const result = await super.makeDefaultRequest<any>(
        `/api/stores/${tenantId}/reviews/summary`,
        {},
        `reviews-summary-${tenantId}`
      );

      if (!result.success){
        console.error('[ReviewsSingleton] Failed to get rating summary:', result.error);
        return null;
      }
      
      // Convert numeric strings to numbers (PostgreSQL returns numeric as strings)
      const summaryData = result.data.data;
      if (summaryData) {
        return {
          ...summaryData,
          rating_avg: parseFloat(summaryData.rating_avg) || 0,
          rating_count: parseInt(summaryData.rating_count) || 0,
          rating_1_count: parseInt(summaryData.rating_1_count) || 0,
          rating_2_count: parseInt(summaryData.rating_2_count) || 0,
          rating_3_count: parseInt(summaryData.rating_3_count) || 0,
          rating_4_count: parseInt(summaryData.rating_4_count) || 0,
          rating_5_count: parseInt(summaryData.rating_5_count) || 0,
          verified_purchase_count: parseInt(summaryData.verified_purchase_count) || 0,
          last_review_at: summaryData.last_review_at || null,
        };
      }
      
      return null;
    } catch (error) {
      console.error('[ReviewsSingleton] Failed to get rating summary:', error);
      return null;
    }
  }

  /**
   * Get reviews for a store with caching
   * Uses the /api/stores/:tenantId/reviews endpoint
   */
  async getReviews(tenantId: string, limit: number = 10): Promise<Review[]> {
    if (!tenantId) {
      console.error('[ReviewsSingleton] getReviews: tenantId is required');
      return [];
    }

    try {
      const result = await super.makeDefaultRequest<{ data: { reviews: Review[] } }>(
        `/api/stores/${tenantId}/reviews?limit=${limit}`,
        {},
        `reviews-${tenantId}-${limit}`
      );

      if (!result.success){
        console.error('[ReviewsSingleton] Failed to get reviews:', result.error);
        return [];

      }     
      
      return result.data?.data?.reviews || [];
    } catch (error) {
      console.error('[ReviewsSingleton] Failed to get reviews:', error);
      return [];
    }
  }

  /**
   * Get user's review for a store with caching
   * Uses the /api/stores/:tenantId/reviews/user endpoint (requires authentication)
   */
  async getUserReview(tenantId: string): Promise<Review | null> {
    if (!tenantId) {
      console.error('[ReviewsSingleton] getUserReview: tenantId is required');
      return null;
    }

    try {
      const result = await super.makeDefaultRequest<Review>(
        `/api/stores/${tenantId}/reviews/user`,
        {},
        `user-review-${tenantId}`
      );
      
      return result.data || null;
    } catch (error: any) {
      // Handle 401 errors gracefully for public pages
      if (error?.status === 401 || error?.code === 'UNAUTHORIZED') {
        console.log('[ReviewsSingleton] User not authenticated, skipping user review fetch');
        return null;
      }
      console.error('[ReviewsSingleton] Failed to get user review:', error);
      return null;
    }
  }

  /**
   * Submit helpful vote for a review (requires authentication)
   * Uses the /api/reviews/:reviewId/helpful endpoint
   * Note: This action invalidates cache for the affected reviews
   */
  async submitHelpfulVote(reviewId: string, isHelpful: boolean): Promise<boolean> {
    if (!reviewId) {
      console.error('[ReviewsSingleton] submitHelpfulVote: reviewId is required');
      return false;
    }

    try {
      await super.makeDefaultRequest<void>(
        `/api/reviews/${reviewId}/helpful`,
        {
          method: 'POST',
          body: JSON.stringify({ isHelpful })
        },
        `helpful-vote-${reviewId}`
      );
      
      return true;
    } catch (error) {
      console.error('[ReviewsSingleton] Failed to submit helpful vote:', error);
      return false;
    }
  }

  /**
   * Submit a review for a store
   * Uses the /api/stores/:tenantId/reviews endpoint
   * Note: This action invalidates cache for the affected reviews
   */
  async submitReview(tenantId: string, reviewData: {
    rating: number;
    content: string;
    locationLat?: number | null;
    locationLng?: number | null;
    sessionId?: string;
    userName?: string;
    userEmail?: string;
  }): Promise<Review | null> {
    if (!tenantId) {
      console.error('[ReviewsSingleton] submitReview: tenantId is required');
      return null;
    }

    try {
      const response = await super.makeDefaultRequest<{
        success: boolean;
        data: Review;
      }>(
        `/api/stores/${tenantId}/reviews`,
        {
          method: 'POST',
          body: JSON.stringify({
            rating: reviewData.rating,
            reviewText: reviewData.content,
            locationLat: reviewData.locationLat,
            locationLng: reviewData.locationLng,
            // For anonymous reviews
            ...(reviewData.sessionId && {
              sessionId: reviewData.sessionId,
              userName: reviewData.userName,
              userEmail: reviewData.userEmail,
            })
          })
        },
        `submit-review-${tenantId}`
      );

      return response?.data?.data || null;
    } catch (error: any) {
      // Handle 401 errors gracefully for public pages
      if (error?.status === 401 || error?.code === 'UNAUTHORIZED') {
        console.log('[ReviewsSingleton] User not authenticated, cannot submit review');
        return null;
      }
      console.error('[ReviewsSingleton] Failed to submit review:', error);
      return null;
    }
  }

  /**
   * Get pending reviews for a store (requires authentication)
   * Uses the /api/stores/:tenantId/reviews/pending endpoint
   * Note: Only store owners and platform admins can access this
   */
  async getPendingReviews(tenantId: string): Promise<Review[] | null> {
    if (!tenantId) {
      console.error('[ReviewsSingleton] getPendingReviews: tenantId is required');
      return null;
    }

    try {
      const result = await super.makeDefaultRequest<{
        success: boolean;
        data: Review[];
      }>(
        `/api/stores/${tenantId}/reviews/pending`,
        {},
        `pending-reviews-${tenantId}`
      );

      // Handle the response structure - if success, return the data array
      if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('[ReviewsSingleton] Failed to get pending reviews:', error);
      return null;
    }
  }

  /**
   * Approve a pending review (requires authentication)
   * Uses the /api/stores/:tenantId/reviews/:reviewId/approve endpoint
   * Note: Only store owners and platform admins can approve reviews
   */
  async approveReview(tenantId: string, reviewId: string): Promise<boolean> {
    if (!tenantId || !reviewId) {
      console.error('[ReviewsSingleton] approveReview: tenantId and reviewId are required');
      return false;
    }

    try {
      const result = await super.makeDefaultRequest<{
        success: boolean;
        message: string;
      }>(
        `/api/stores/${tenantId}/reviews/${reviewId}/approve`,
        { method: 'POST' },
        `approve-review-${reviewId}`
      );

      // Invalidate related caches
      await this.invalidateCache(`rating-summary-${tenantId}`);
      await this.invalidateCache(`reviews-${tenantId}`);

      return result?.success || false;
    } catch (error) {
      console.error('[ReviewsSingleton] Failed to approve review:', error);
      return false;
    }
  }

  /**
   * Reject a pending review (requires authentication)
   * Uses the /api/stores/:tenantId/reviews/:reviewId/reject endpoint
   * Note: Only store owners and platform admins can reject reviews
   */
  async rejectReview(tenantId: string, reviewId: string): Promise<boolean> {
    if (!tenantId || !reviewId) {
      console.error('[ReviewsSingleton] rejectReview: tenantId and reviewId are required');
      return false;
    }

    try {
      const result = await super.makeDefaultRequest<{
        success: boolean;
        message: string;
      }>(
        `/api/stores/${tenantId}/reviews/${reviewId}/reject`,
        { method: 'POST' },
        `reject-review-${reviewId}`
      );

      // Invalidate related caches
      await this.invalidateCache(`rating-summary-${tenantId}`);
      await this.invalidateCache(`reviews-${tenantId}`);

      return result?.success || false;
    } catch (error) {
      console.error('[ReviewsSingleton] Failed to reject review:', error);
      return false;
    }
  }
}

// Export singleton instance
export const reviewsService = ReviewsSingletonService.getInstance();
