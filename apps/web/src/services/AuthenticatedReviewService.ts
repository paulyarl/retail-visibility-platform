/**
 * Authenticated Review Service
 *
 * Handles admin review operations that require authentication
 * Extends AuthenticatedApiSingleton for proper token handling
 */

import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

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
  approval_status?: 'pending' | 'approved' | 'rejected';
  // Product information (optional, populated when product_id is present)
  product_name?: string;
  product_title?: string;
  product_description?: string;
  image_url?: string;
  image_urls?: string[];
  thumbnail_url?: string;
  featured_image_url?: string;
  product_category?: string;
  product_category_slug?: string;
  brand?: string;
  price?: string;
  current_price_cents?: number;
  currency?: string;
  product_metadata?: any;
  product_url?: string;
}

/**
 * Authenticated Review Management Service
 * Handles admin review operations that require authentication
 * Extends AuthenticatedApiSingleton for proper token handling
 */
class AuthenticatedReviewService extends TenantApiSingleton {
  private static instance: AuthenticatedReviewService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'authenticated-review-service*',
      'admin-reviews*',
      'review-moderation*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('authenticated-review-service*');
    await this.invalidateCachePattern('admin-reviews*');
    await this.invalidateCachePattern('review-moderation*');
  }

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
    status?: 'pending' | 'approved' | 'all';
  }): Promise<{ reviews: Review[]; pagination: any } | null> {
    if (!tenantId) {
      clientLogger.error('[AuthenticatedReviewService] getPendingReviews: tenantId is required');
      return null;
    }

    try {
      //console.log('[AuthenticatedReviewService] Fetching reviews for tenant:', tenantId, 'with options:', options);

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (options?.limit) {
        queryParams.append('limit', options.limit.toString());
      }
      if (options?.offset !== undefined) {
        queryParams.append('offset', options.offset.toString());
      }
      if (options?.reviewType && options.reviewType !== 'all') {
        queryParams.append('reviewType', options.reviewType);
      }

      const url = `/api/stores/${tenantId}/reviews/pending${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: {
          reviews: Review[];
          pagination: any;
        };
      }>(
        url,
        {},
        `pending-reviews-${tenantId}-${options?.limit || 'all'}-${options?.offset || '0'}-${options?.reviewType || 'all'}`,
        this.cacheTTL
      );

      /* console.log('[AuthenticatedReviewService] API result:', result); */

      if (!result.success) {
        clientLogger.error('[AuthenticatedReviewService] Failed to get pending reviews:', { detail: result.error });
        return null;
      }

      const responseData = result.data?.data;
      /* console.log('[AuthenticatedReviewService] Extracted response data:', responseData);
      console.log('[AuthenticatedReviewService] Reviews count:', responseData?.reviews?.length || 0);
 */
      return responseData || null;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to get pending reviews:', { detail: error });
      return null;
    }
  }

  /**
   * Approve a pending review (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/:reviewId/approve
   */
  async approveReview(tenantId: string, reviewId: string): Promise<boolean> {
    if (!tenantId || !reviewId) {
      clientLogger.error('[AuthenticatedReviewService] approveReview: tenantId and reviewId are required');
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
        clientLogger.error('[AuthenticatedReviewService] Failed to approve review:', { detail: result.error });
        return false;
      }

      console.log('[AuthenticatedReviewService] Review approved successfully:', reviewId);
      return true;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to approve review:', { detail: error });
      return false;
    }
  }

  /**
   * Reject a pending review (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/:reviewId/reject
   */
  async rejectReview(tenantId: string, reviewId: string): Promise<boolean> {
    if (!tenantId || !reviewId) {
      clientLogger.error('[AuthenticatedReviewService] rejectReview: tenantId and reviewId are required');
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
        clientLogger.error('[AuthenticatedReviewService] Failed to reject review:', { detail: result.error });
        return false;
      }

      console.log('[AuthenticatedReviewService] Review rejected successfully:', reviewId);
      return true;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to reject review:', { detail: error });
      return false;
    }
  }

  /**
   * Bulk approve multiple pending reviews (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/bulk-approve
   */
  async bulkApproveReviews(tenantId: string, reviewIds: string[]): Promise<boolean> {
    if (!tenantId || !reviewIds.length) {
      clientLogger.error('[AuthenticatedReviewService] bulkApproveReviews: tenantId and reviewIds are required');
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
        clientLogger.error('[AuthenticatedReviewService] Failed to bulk approve reviews:', { detail: result.error });
        return false;
      }

      console.log(`[AuthenticatedReviewService] ${reviewIds.length} reviews approved successfully`);
      return true;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to bulk approve reviews:', { detail: error });
      return false;
    }
  }

  /**
   * Bulk reject multiple pending reviews (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/bulk-reject
   */
  async bulkRejectReviews(tenantId: string, reviewIds: string[]): Promise<boolean> {
    if (!tenantId || !reviewIds.length) {
      clientLogger.error('[AuthenticatedReviewService] bulkRejectReviews: tenantId and reviewIds are required');
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
        clientLogger.error('[AuthenticatedReviewService] Failed to bulk reject reviews:', { detail: result.error });
        return false;
      }

      console.log(`[AuthenticatedReviewService] ${reviewIds.length} reviews rejected successfully`);
      return true;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to bulk reject reviews:', { detail: error });
      return false;
    }
  }

  /**
   * Get approved reviews for a store (admin only)
   * Uses authenticated endpoint: /api/stores/:tenantId/reviews/approved
   */
  async getApprovedReviews(tenantId: string, options?: {
    limit?: number;
    page?: number;
    sort?: 'newest' | 'rating_high' | 'rating_low' | 'helpful';
    reviewType?: 'store' | 'product' | 'all';
  }): Promise<{ reviews: Review[]; summary: any; pagination: any } | null> {
    if (!tenantId) {
      clientLogger.error('[AuthenticatedReviewService] getApprovedReviews: tenantId is required');
      return null;
    }

    try {
      const limit = options?.limit || 20;
      const page = options?.page || 1;
      const sort = options?.sort || 'newest';

      // Build query parameters
      let queryParams = `limit=${limit}&page=${page}&sort=${sort}`;
      if (options?.reviewType && options.reviewType !== 'all') {
        queryParams += `&reviewType=${options.reviewType}`;
      }

      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: {
          reviews: Review[];
          summary: any;
          pagination: any;
        };
      }>(
        `/api/stores/${tenantId}/reviews/approved?${queryParams}`,
        {},
        `approved-reviews-${tenantId}-${limit}-${page}-${sort}-${options?.reviewType || 'all'}`,
        this.cacheTTL
      );

      if (!result.success) {
        clientLogger.error('[AuthenticatedReviewService] Failed to get approved reviews:', { detail: result.error });
        return null;
      }

      return result.data?.data || null;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to get approved reviews:', { detail: error });
      return null;
    }
  }

  /**
   * Get pending product reviews for approval (admin only)
   * Uses authenticated endpoint: /api/products/:productId/reviews/pending
   */
  async getProductPendingReviews(productId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ reviews: Review[]; pagination: any } | null> {
    if (!productId) {
      clientLogger.error('[AuthenticatedReviewService] getProductPendingReviews: productId is required');
      return null;
    }

    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: {
          reviews: Review[];
          pagination: any;
        };
      }>(
        `/api/products/${productId}/reviews/pending?limit=${limit}&offset=${offset}`,
        {},
        `product-pending-reviews-${productId}-${limit}-${offset}`,
        this.cacheTTL
      );

      if (!result.success) {
        clientLogger.error('[AuthenticatedReviewService] Failed to get product pending reviews:', { detail: result.error });
        return null;
      }

      return result.data?.data || null;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to get product pending reviews:', { detail: error });
      return null;
    }
  }

  /**
   * Get approved product reviews (admin only)
   * Uses authenticated endpoint: /api/products/:productId/reviews/approved
   */
  async getProductApprovedReviews(productId: string, options?: {
    limit?: number;
    page?: number;
    sort?: 'newest' | 'rating_high' | 'rating_low' | 'helpful';
  }): Promise<{ reviews: Review[]; summary: any; pagination: any } | null> {
    if (!productId) {
      clientLogger.error('[AuthenticatedReviewService] getProductApprovedReviews: productId is required');
      return null;
    }

    try {
      const limit = options?.limit || 10;
      const page = options?.page || 1;
      const sort = options?.sort || 'newest';

      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: {
          reviews: Review[];
          summary: any;
          pagination: any;
        };
      }>(
        `/api/products/${productId}/reviews/approved?limit=${limit}&page=${page}&sort=${sort}`,
        {},
        `product-approved-reviews-${productId}-${limit}-${page}-${sort}`,
        this.cacheTTL
      );

      if (!result.success) {
        clientLogger.error('[AuthenticatedReviewService] Failed to get product approved reviews:', { detail: result.error });
        return null;
      }

      return result.data?.data || null;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to get product approved reviews:', { detail: error });
      return null;
    }
  }

  /**
   * Approve a product review (admin only)
   * Uses authenticated endpoint: /api/products/:productId/reviews/:reviewId/approve
   */
  async approveProductReview(productId: string, reviewId: string): Promise<boolean> {
    if (!productId || !reviewId) {
      clientLogger.error('[AuthenticatedReviewService] approveProductReview: productId and reviewId are required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message?: string;
      }>(
        `/api/products/${productId}/reviews/${reviewId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        `approve-product-review-${reviewId}`,
        0 // Don't cache this operation
      );

      if (!result.success) {
        clientLogger.error('[AuthenticatedReviewService] Failed to approve product review:', { detail: result.error });
        return false;
      }

      console.log('[AuthenticatedReviewService] Product review approved successfully:', reviewId);
      return true;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to approve product review:', { detail: error });
      return false;
    }
  }

  /**
   * Reject a product review (admin only)
   * Uses authenticated endpoint: /api/products/:productId/reviews/:reviewId/reject
   */
  async rejectProductReview(productId: string, reviewId: string, reason?: string): Promise<boolean> {
    if (!productId || !reviewId) {
      clientLogger.error('[AuthenticatedReviewService] rejectProductReview: productId and reviewId are required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        message?: string;
      }>(
        `/api/products/${productId}/reviews/${reviewId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        },
        `reject-product-review-${reviewId}`,
        0 // Don't cache this operation
      );

      if (!result.success) {
        clientLogger.error('[AuthenticatedReviewService] Failed to reject product review:', { detail: result.error });
        return false;
      }

      console.log('[AuthenticatedReviewService] Product review rejected successfully:', reviewId);
      return true;
    } catch (error) {
      clientLogger.error('[AuthenticatedReviewService] Failed to reject product review:', { detail: error });
      return false;
    }
  }
}

// Export authenticated service instance
export const authenticatedReviewService = AuthenticatedReviewService.getInstance();
