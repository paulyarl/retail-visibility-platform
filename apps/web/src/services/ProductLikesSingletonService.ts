import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface ProductLike {
  id: string;
  userId: string;
  sessionId: string;
  productId: string;
  createdAt: string;
}

export interface ProductLikeStatus {
  liked: boolean;
  likesCount: number;
  userLiked: boolean;
}

class ProductLikesSingletonService extends PublicApiSingleton {
  private static instance: ProductLikesSingletonService;

  private constructor() {
    super('product-likes-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for likes data
  }

  static getInstance(): ProductLikesSingletonService {
    if (!ProductLikesSingletonService.instance) {
      ProductLikesSingletonService.instance = new ProductLikesSingletonService();
    }
    return ProductLikesSingletonService.instance;
  }

  /**
   * Like a product
   * Public endpoint for product interactions
   */
  async likeProduct(productId: string, userId?: string, sessionId?: string): Promise<boolean> {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const response = await this.makeDefaultRequest<ProductLike>(
        `/api/products/${productId}/like`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId,
            sessionId
          })
        },
        `product-like-${productId}-${userId || 'anonymous'}-${sessionId || 'anonymous'}`
      );
      if (!response.success) {
        clientLogger.error('[ProductLikesSingleton] Failed to like product:', { detail: response.error });
        return false;
      }

      return response.data !== null;
    } catch (error) {
      clientLogger.error('[ProductLikesSingleton] Failed to like product:', { detail: error });
      return false;
    }
  }

  /**
   * Unlike a product
   * Public endpoint for product interactions
   */
  async unlikeProduct(productId: string, userId?: string, sessionId?: string): Promise<boolean> {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const response = await this.makeDefaultRequest<void>(
        `/api/products/${productId}/like`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            userId,
            sessionId
          })
        },
        `product-unlike-${productId}-${userId || 'anonymous'}-${sessionId || 'anonymous'}`
      );
      if (!response.success) {
        clientLogger.error('[ProductLikesSingleton] Failed to unlike product:', { detail: response.error });
        return false;
      }

      return true;
    } catch (error) {
      clientLogger.error('[ProductLikesSingleton] Failed to unlike product:', { detail: error });
      return false;
    }
  }

  /**
   * Get product like status
   * Public endpoint for product interactions
   */
  async getProductLikeStatus(productId: string, userId?: string, sessionId?: string): Promise<ProductLikeStatus | null> {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (sessionId) params.append('sessionId', sessionId);

      const response = await this.makeDefaultRequest<ProductLikeStatus>(
        `/api/products/${productId}/likes?${params.toString()}`,
        {},
        `product-like-status-${productId}-${userId || 'anonymous'}-${sessionId || 'anonymous'}`
      );
      if (!response.success) {
        clientLogger.error('[ProductLikesSingleton] Failed to get product like status:', { detail: response.error });
        return null;
      }

      return response.data || null;
    } catch (error) {
      clientLogger.error('[ProductLikesSingleton] Failed to get product like status:', { detail: error });
      return null;
    }
  }
}

// Export singleton instance
export const productLikesService = ProductLikesSingletonService.getInstance();
