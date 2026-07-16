/**
 * Public Reviews Service
 * 
 * Extends PublicApiSingleton to provide public reviews operations
 * Used for public pages where authentication is not required
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { type ReviewSummary, type Review } from './ReviewsSingletonService';
import { clientLogger } from '@/lib/client-logger';

class PublicReviewsService extends PublicApiSingleton {
  private static instance: PublicReviewsService;

  // TTL constants for different data types
  private readonly RATING_SUMMARY_TTL = 15 * 60 * 1000; // 15 minutes for rating summary
  private readonly REVIEWS_TTL = 10 * 60 * 1000; // 10 minutes for reviews

  private constructor() {
    super('public-reviews-service');
  }

  public static getInstance(): PublicReviewsService {
    if (!PublicReviewsService.instance) {
      PublicReviewsService.instance = new PublicReviewsService();
    }
    return PublicReviewsService.instance;
  }

  /**
   * Get rating summary for a tenant with caching
   * Uses the /api/public/tenants/:tenantId/reviews/summary endpoint
   */
  async getRatingSummary(tenantId: string): Promise<ReviewSummary | null> {
    if (!tenantId) {
      clientLogger.error('[PublicReviewsService] getRatingSummary: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<ReviewSummary>(
        `/api/public/tenants/${tenantId}/reviews/summary`,
        {},
        `public-rating-summary-${tenantId}`,
        this.RATING_SUMMARY_TTL
      );

      if (!result.success || !result.data) {
        clientLogger.error('[PublicReviewsService] Failed to get rating summary:', { detail: result.error });
        return null;
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[PublicReviewsService] Error getting rating summary:', { detail: error });
      return null;
    }
  }

  /**
   * Get reviews for a tenant with caching
   * Uses the /api/public/tenants/:tenantId/reviews endpoint
   */
  async getReviews(tenantId: string, limit: number = 10): Promise<Review[]> {
    if (!tenantId) {
      clientLogger.error('[PublicReviewsService] getReviews: tenantId is required');
      return [];
    }

    try {
      const result = await this.makeDefaultRequest<Review[]>(
        `/api/public/tenants/${tenantId}/reviews?limit=${limit}`,
        {},
        `public-reviews-${tenantId}-${limit}`,
        this.REVIEWS_TTL
      );

      if (!result.success || !result.data) {
        clientLogger.error('[PublicReviewsService] Failed to get reviews:', { detail: result.error });
        return [];
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[PublicReviewsService] Error getting reviews:', { detail: error });
      return [];
    }
  }

  /**
   * Get approved reviews for a tenant with caching
   * Uses the /api/public/tenants/:tenantId/reviews/approved endpoint
   */
  async getApprovedReviews(tenantId: string, options?: {
    limit?: number;
    page?: number;
    sort?: 'newest' | 'rating_high' | 'rating_low' | 'helpful';
  }): Promise<Review[]> {
    if (!tenantId) {
      clientLogger.error('[PublicReviewsService] getApprovedReviews: tenantId is required');
      return [];
    }

    const { limit = 10, page = 1, sort = 'newest' } = options || {};
    const params = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
      sort
    });

    try {
      const result = await this.makeDefaultRequest<Review[]>(
        `/api/public/tenants/${tenantId}/reviews/approved?${params}`,
        {},
        `public-approved-reviews-${tenantId}-${limit}-${page}-${sort}`,
        this.REVIEWS_TTL
      );

      if (!result.success || !result.data) {
        clientLogger.error('[PublicReviewsService] Failed to get approved reviews:', { detail: result.error });
        return [];
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[PublicReviewsService] Error getting approved reviews:', { detail: error });
      return [];
    }
  }

  /**
   * Get approved product reviews
   * Uses the /api/public/products/:productId/reviews/approved endpoint
   */
  async getProductApprovedReviews(productId: string, options?: {
    limit?: number;
    page?: number;
    sort?: 'newest' | 'rating_high' | 'rating_low' | 'helpful';
  }): Promise<Review[]> {
    if (!productId) {
      clientLogger.error('[PublicReviewsService] getProductApprovedReviews: productId is required');
      return [];
    }

    const { limit = 10, page = 1, sort = 'newest' } = options || {};
    const params = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
      sort
    });

    try {
      const result = await this.makeDefaultRequest<Review[]>(
        `/api/public/products/${productId}/reviews/approved?${params}`,
        {},
        `public-product-reviews-${productId}-${limit}-${page}-${sort}`,
        this.REVIEWS_TTL
      );

      if (!result.success || !result.data) {
        clientLogger.error('[PublicReviewsService] Failed to get product reviews:', { detail: result.error });
        return [];
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[PublicReviewsService] Error getting product reviews:', { detail: error });
      return [];
    }
  }
}

// Export singleton instance
export const publicReviewsService = PublicReviewsService.getInstance();
