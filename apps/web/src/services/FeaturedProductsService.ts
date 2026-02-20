import { AdminApiSingleton } from '../providers/base/UniversalSingleton';

export interface FeaturedProduct {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  price_cents: number;
  image_url: string;
  is_featured: boolean;
  featured_at: string;
  featured_until: string | null;
  featured_priority: number;
  tenants: {
    id: string;
    name: string;
    subscription_tier: string;
  };
}

export interface FeaturingStats {
  totalFeatured: number;
  activeFeatured: number;
  expiredFeatured: number;
  recentlyFeatured: number;
}

/**
 * Service for managing featured products
 * Handles product featuring operations and statistics
 */
export class FeaturedProductsService extends AdminApiSingleton {
  private static instance: FeaturedProductsService;

  private constructor() {
    super('FeaturedProductsService');
  }

  static getInstance(): FeaturedProductsService {
    if (!FeaturedProductsService.instance) {
      FeaturedProductsService.instance = new FeaturedProductsService();
    }
    return FeaturedProductsService.instance;
  }

  /**
   * Get featuring statistics
   */
  async getFeaturingStats(): Promise<FeaturingStats | null> {
    const result = await this.makeAdminRequest<FeaturingStats>(
      '/api/admin/products/featuring/stats',
      {},
      'platform-featuring-stats',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[FeaturedProductsService] Failed to get featuring stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get featured products with pagination
   */
  async getFeaturedProducts(limit: number, offset: number): Promise<FeaturedProduct[] | null> {
    const result = await this.makeAdminRequest<any>(
      `/api/admin/products/featured?limit=${limit}&offset=${offset}`,
      {},
      'platform-featured-products',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[FeaturedProductsService] Failed to get featured products:', result.error);
      return null;
    }

    // API returns { products: [...], total: 13, limit: 20, offset: 0 }
    // Extract the products array from the nested response
    return result.data?.products || null;
  }

  /**
   * Unfeature a product
   */
  async unfeatureProduct(productId: string): Promise<void> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const result = await this.makeAdminRequest<void>(
      `/api/admin/products/featured/${productId}`,
      { method: 'DELETE' },
      `platform-unfeature-product-${productId}`
    );

    if (!result.success) {
      console.error('[FeaturedProductsService] Failed to unfeature product:', result.error);
      throw result.error;
    }

    // Invalidate featured products cache
    await this.invalidateCache('platform-featured-products*');
    await this.invalidateCache('platform-featuring-stats*');
  }

  /**
   * Update product priority in featuring
   */
  async updateProductPriority(productId: string, priority: number): Promise<FeaturedProduct | null> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const result = await this.makeAdminRequest<FeaturedProduct>(
      `/api/admin/products/featured/${productId}/priority`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ priority })
      },
      `platform-update-priority-${productId}`
    );

    if (!result.success) {
      console.error('[FeaturedProductsService] Failed to update product priority:', result.error);
      throw result.error;
    }

    // Invalidate featured products cache
    await this.invalidateCache('platform-featured-products*');

    return result.data || null;
  }

  /**
   * Feature a product
   */
  async featureProduct(productId: string, priority?: number): Promise<FeaturedProduct | null> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const result = await this.makeAdminRequest<FeaturedProduct>(
      `/api/admin/products/featured`,
      { 
        method: 'POST',
        body: JSON.stringify({ productId, priority })
      },
      `platform-feature-product-${productId}`
    );

    if (!result.success) {
      console.error('[FeaturedProductsService] Failed to feature product:', result.error);
      throw result.error;
    }

    // Invalidate featured products cache
    await this.invalidateCache('platform-featured-products*');
    await this.invalidateCache('platform-featuring-stats*');

    return result.data || null;
  }

  /**
   * Bulk update product priorities
   */
  async bulkUpdatePriorities(updates: { productId: string; priority: number }[]): Promise<void> {
    const result = await this.makeAdminRequest<void>(
      '/api/admin/products/featured/bulk-priority',
      { 
        method: 'PATCH',
        body: JSON.stringify({ updates })
      },
      'platform-bulk-update-priorities'
    );

    if (!result.success) {
      console.error('[FeaturedProductsService] Failed to bulk update priorities:', result.error);
      throw result.error;
    }

    // Invalidate featured products cache
    await this.invalidateCache('platform-featured-products*');
  }
}

// Export singleton instance
export const featuredProductsService = FeaturedProductsService.getInstance();
