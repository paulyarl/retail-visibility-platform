/**
 * Public Reviews Singleton Service
 * 
 * Extends PublicApiSingleton for public review access
 * Uses the platform's singleton architecture for public requests without authentication
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

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
  product_id?: string | null; // For product reviews
  approval_status?: 'pending' | 'approved' | 'rejected'; // Review status
}

export interface ReviewsResponse {
  reviews: Review[];
}

export interface HelpfulVoteRequest {
  isHelpful: boolean;
}

class PublicReviewsSingletonService extends PublicApiSingleton {

  protected defaultContext: AppContext = AppContext.STORE;
  protected defaultIsolation: CacheIsolation = CacheIsolation.STORE;
  private static instance: PublicReviewsSingletonService;

  private constructor() {
    super('public-reviews-singleton', {
      ttl: 5 * 60 * 1000 // 5 minutes for reviews data
    });
  }

  public static getInstance(): PublicReviewsSingletonService {
    if (!PublicReviewsSingletonService.instance) {
      PublicReviewsSingletonService.instance = new PublicReviewsSingletonService();
    }
    return PublicReviewsSingletonService.instance;
  }

  /**
   * Get rating summary for a store with caching
   * Uses the /api/stores/:tenantId/reviews/summary endpoint
   */
  async getRatingSummary(tenantId: string): Promise<ReviewSummary | null> {
    if (!tenantId) {
      clientLogger.error('[PublicReviewsSingleton] getRatingSummary: tenantId is required');
      return null;
    }

    try {
      const result = await super.makeDefaultRequest<any>(
        `/api/stores/${tenantId}/reviews/summary`,
        {},
        `reviews-summary-${tenantId}`
      );

      if (!result.success){
        clientLogger.error('[PublicReviewsSingleton] Failed to get rating summary:', { detail: result.error });
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
      clientLogger.error('[PublicReviewsSingleton] Failed to get rating summary:', { detail: error });
      return null;
    }
  }

  /**
   * Get reviews for a store with caching
   * Uses the /api/stores/:tenantId/reviews endpoint
   */
  async getReviews(tenantId: string, limit: number = 10): Promise<Review[]> {
    if (!tenantId) {
      clientLogger.error('[PublicReviewsSingleton] getReviews: tenantId is required');
      return [];
    }

    try {
      const result = await super.makeDefaultRequest<{ data: { reviews: Review[] } }>(
        `/api/stores/${tenantId}/reviews?limit=${limit}`,
        {},
        `reviews-${tenantId}-${limit}`
      );

      if (!result.success){
        clientLogger.error('[PublicReviewsSingleton] Failed to get reviews:', { detail: result.error });
        return [];

      }     
      
      return result.data?.data?.reviews || [];
    } catch (error) {
      clientLogger.error('[PublicReviewsSingleton] Failed to get reviews:', { detail: error });
      return [];
    }
  }

  /**
   * Get approved reviews for a store with caching
   * Uses the /api/stores/:tenantId/reviews/approved endpoint
   */
  async getApprovedReviews(tenantId: string, options?: {
    limit?: number;
    page?: number;
    sort?: 'newest' | 'rating_high' | 'rating_low' | 'helpful';
    reviewType?: 'store' | 'product' | 'all';
  }): Promise<{ reviews: Review[]; summary: any; pagination: any } | null> {
    if (!tenantId) {
      clientLogger.error('[PublicReviewsSingleton] getApprovedReviews: tenantId is required');
      return null;
    }

    const limit = options?.limit || 20;
    const page = options?.page || 1;
    const sort = options?.sort || 'newest';
    const reviewType = options?.reviewType || 'all';
    const offset = (page - 1) * limit;

    try {
      // Build query string with reviewType
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        page: page.toString(),
        sort: sort
      });
      
      if (reviewType !== 'all') {
        queryParams.append('reviewType', reviewType);
      }

      const result = await super.makeDefaultRequest<{
        success: boolean;
        data: {
          reviews: Review[];
          summary: any;
          pagination: any;
        };
      }>(
        `/api/stores/${tenantId}/reviews/approved?${queryParams.toString()}`,
        {},
        `approved-reviews-${tenantId}-${limit}-${page}-${sort}-${reviewType}`
      );

      if (!result.success) {
        clientLogger.error('[PublicReviewsSingleton] Failed to get approved reviews:', { detail: result.error });
        return null;
      }

      return result.data?.data || null;
    } catch (error) {
      clientLogger.error('[PublicReviewsSingleton] Failed to get approved reviews:', { detail: error });
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
      clientLogger.error('[PublicReviewsSingleton] submitHelpfulVote: reviewId is required');
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
      clientLogger.error('[PublicReviewsSingleton] Failed to submit helpful vote:', { detail: error });
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
      clientLogger.error('[PublicReviewsSingleton] submitReview: tenantId is required');
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
        console.log('[PublicReviewsSingleton] User not authenticated, cannot submit review');
        return null;
      }
      clientLogger.error('[PublicReviewsSingleton] Failed to submit review:', { detail: error });
      return null;
    }
  }
}

// Export singleton instance
export const publicReviewsService = PublicReviewsSingletonService.getInstance();
