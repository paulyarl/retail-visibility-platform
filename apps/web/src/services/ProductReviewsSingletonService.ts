import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface ProductReviewSummary {
  rating_avg: number;
  rating_count: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ProductReview {
  id: string;
  productId: string;
  tenantId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  verified: boolean;
  helpful: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
}

class ProductReviewsSingletonService extends PublicApiSingleton {
  private static instance: ProductReviewsSingletonService;

  private constructor() {
    super('product-reviews-service');
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes for reviews data
  }

  static getInstance(): ProductReviewsSingletonService {
    if (!ProductReviewsSingletonService.instance) {
      ProductReviewsSingletonService.instance = new ProductReviewsSingletonService();
    }
    return ProductReviewsSingletonService.instance;
  }

  /**
   * Get product review summary
   * Public endpoint for product browsing
   */
  async getProductReviewSummary(tenantId: string, productId: string): Promise<ProductReviewSummary | null> {
    try {
      if (!tenantId || !productId) {
        throw new Error('Tenant ID and Product ID are required');
      }

      const result = await this.makeDefaultRequest<ProductReviewSummary>(
        `/api/stores/${tenantId}/products/${productId}/reviews/summary`,
        {},
        `product-review-summary-${tenantId}-${productId}`
      );

      return result?.data || null;
    } catch (error) {
      console.error('[ProductReviewsSingleton] Failed to get product review summary:', error);
      return null;
    }
  }

  /**
   * Get product reviews
   * Public endpoint for product browsing
   */
  async getProductReviews(tenantId: string, productId: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'oldest' | 'rating' | 'helpful';
  }): Promise<ProductReview[]> {
    try {
      if (!tenantId || !productId) {
        throw new Error('Tenant ID and Product ID are required');
      }

      const result = await this.makeDefaultRequest<{
        reviews: ProductReview[];
        pagination: {
          page: number;
          limit: number;
          total: number;
        };
        timestamp: string;
      }>(
        `/api/reviews-singleton/product/${productId}`,
        {},
        `product-reviews-${tenantId}-${productId}-${options?.limit || 'default'}`
      );

      return result?.data?.reviews || [];
    } catch (error) {
      console.error('[ProductReviewsSingleton] Failed to get product reviews:', error);
      return [];
    }
  }

  /**
   * Get user's review for a product
   * Public endpoint for product browsing
   */
  async getUserProductReview(tenantId: string, productId: string, userId?: string): Promise<ProductReview | null> {
    try {
      if (!tenantId || !productId) {
        throw new Error('Tenant ID and Product ID are required');
      }

      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      const result = await this.makeDefaultRequest<ProductReview>(
        `/api/stores/${tenantId}/products/${productId}/reviews/user?${params.toString()}`,
        {},
        `user-product-review-${tenantId}-${productId}-${userId || 'anonymous'}`
      );

      return result?.data || null;
    } catch (error) {
      console.error('[ProductReviewsSingleton] Failed to get user product review:', error);
      return null;
    }
  }

  /**
   * Create or update product review
   * Public endpoint for product interactions
   */
  async createOrUpdateProductReview(tenantId: string, productId: string, reviewData: {
    rating: number;
    title: string;
    content: string;
    userId?: string;
  }): Promise<ProductReview | null> {
    try {
      if (!tenantId || !productId) {
        throw new Error('Tenant ID and Product ID are required');
      }

      const result = await this.makeDefaultRequest<ProductReview>(
        `/api/stores/${tenantId}/products/${productId}/reviews`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData)
        },
        `product-review-create-${tenantId}-${productId}`
      );

      return result?.data || null;
    } catch (error) {
      console.error('[ProductReviewsSingleton] Failed to create/update product review:', error);
      return null;
    }
  }

  /**
   * Mark review as helpful
   * Public endpoint for product interactions
   */
  async markReviewHelpful(tenantId: string, productId: string, reviewId: string): Promise<boolean> {
    try {
      if (!tenantId || !productId || !reviewId) {
        throw new Error('Tenant ID, Product ID, and Review ID are required');
      }

      await this.makeDefaultRequest<void>(
        `/api/stores/${tenantId}/products/${productId}/reviews/${reviewId}/helpful`,
        {
          method: 'PUT'
        },
        `review-helpful-${reviewId}`
      );

      return true;
    } catch (error) {
      console.error('[ProductReviewsSingleton] Failed to mark review as helpful:', error);
      return false;
    }
  }
}

// Export singleton instance
export const productReviewsService = ProductReviewsSingletonService.getInstance();
