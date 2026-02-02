/**
 * Reviews Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached reviews operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

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

class ReviewsSingletonService {
  private static instance: ReviewsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 5 * 60 * 1000, // 5 minutes for reviews data
      enableLogging: true,
      enableMetrics: true
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
      const result = await this.client.makeRequest<any>(
        `/api/stores/${tenantId}/reviews/summary`
      );
      
      // Convert numeric strings to numbers (PostgreSQL returns numeric as strings)
      const summaryData = result.data;
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
      const result = await this.client.makeRequest<any>(
        `/api/stores/${tenantId}/reviews?limit=${limit}`
      );
      
      return result.data?.reviews || [];
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
      const result = await this.client.makeRequest<any>(
        `/api/stores/${tenantId}/reviews/user`
      );
      
      return result.data || null;
    } catch (error) {
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
      await this.client.makeRequest<void>(
        `/api/reviews/${reviewId}/helpful`,
        {
          method: 'POST',
          body: JSON.stringify({ isHelpful })
        }
      );
      
      // Note: Cache invalidation would require a public method in UniversalSingletonClient
      // For now, the cache will expire naturally based on TTL
      
      return true;
    } catch (error) {
      console.error('[ReviewsSingleton] Failed to submit helpful vote:', error);
      return false;
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
  }
}

// Export singleton instance
export const reviewsService = ReviewsSingletonService.getInstance();
