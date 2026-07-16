/**
 * Storefront Singleton Service V2 - Test Migration
 * 
 * Migrated to use FlexibleApiSingletonV2 with delegation pattern
 * Testing the new clean architecture
 */

import { FlexibleApiSingletonV2, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingletonV2';
import { clientLogger } from '@/lib/client-logger';

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
  is_primary?: boolean;
  type?: string;
}

export interface StorefrontProduct {
  id: string;
  sku: string;
  name: string;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  payment_gateway_type?: string | null;
  has_active_payment_gateway?: boolean;
  [key: string]: any;
}

export interface DirectoryListing {
  listing?: {
    slug?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * StorefrontSingletonServiceV2 - Test migration to new architecture
 * 
 * This service tests the delegation pattern with FlexibleApiSingletonV2
 * Much cleaner than the original with unified execution
 */
class StorefrontSingletonServiceV2 extends FlexibleApiSingletonV2 {
  private static instance: StorefrontSingletonServiceV2;

  // Define defaults for this service
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  protected constructor() {
    super('storefront-singleton-v2', {
      ttl: 5 * 60 * 1000 // 5 minutes for storefront data
    });
  }

  public static getInstance(): StorefrontSingletonServiceV2 {
    if (!StorefrontSingletonServiceV2.instance) {
      StorefrontSingletonServiceV2.instance = new StorefrontSingletonServiceV2();
    }
    return StorefrontSingletonServiceV2.instance;
  }

  /**
   * Get storefront categories with product counts
   * Uses the delegation pattern: setup → execution
   */
  async getStorefrontCategories(tenantId: string): Promise<{
    categories: StorefrontCategory[];
    uncategorizedCount: number;
  }> {
    if (!tenantId) {
      clientLogger.error('[StorefrontSingletonV2] getStorefrontCategories: tenantId is required');
      return { categories: [], uncategorizedCount: 0 };
    }

    try {
      // Using makeDefaultRequest with delegation pattern
      const result = await this.makeDefaultRequest<{
        categories: StorefrontCategory[];
        uncategorizedCount: number;
      }>(
        `/api/storefront/${tenantId}/categories`,
        {},
        `storefront-categories-${tenantId}`,
        this.cacheTTL,
        {
          requestType: RequestType.PUBLIC,
          requestTarget: RequestTarget.API
        }
      );
      
      return {
        categories: result.data?.categories || [],
        uncategorizedCount: result.data?.uncategorizedCount || 0
      };
    } catch (error) {
      clientLogger.error('[StorefrontSingletonV2] Failed to get storefront categories:', { detail: error });
      return { categories: [], uncategorizedCount: 0 };
    }
  }

  /**
   * Get storefront products with pagination and filtering
   * Tests the delegation pattern with more complex parameters
   */
  async getStorefrontProducts(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    products: StorefrontProduct[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    if (!tenantId) {
      clientLogger.error('[StorefrontSingletonV2] getStorefrontProducts: tenantId is required');
      return { products: [], total: 0, page: 1, limit: 20, hasMore: false };
    }

    try {
      // Build query string
      const params = new URLSearchParams();
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.search) params.append('search', options.search);
      if (options.category) params.append('category', options.category);
      if (options.sortBy) params.append('sortBy', options.sortBy);
      if (options.sortOrder) params.append('sortOrder', options.sortOrder);

      const url = `/api/storefront/${tenantId}/products${params.toString() ? '?' + params.toString() : ''}`;
      
      // Test delegation pattern with makeDefaultRequest
      const result = await this.makeDefaultRequest<{
        products: StorefrontProduct[];
        total: number;
        page: number;
        limit: number;
        hasMore: boolean;
      }>(
        url,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        },
        `storefront-products-${tenantId}-${JSON.stringify(options)}`,
        this.cacheTTL,
        { requestTarget: RequestTarget.API }
      );
      
      return {
        products: result.data?.products || [],
        total: result.data?.total || 0,
        page: result.data?.page || 1,
        limit: result.data?.limit || 20,
        hasMore: result.data?.hasMore || false
      };
    } catch (error) {
      clientLogger.error('[StorefrontSingletonV2] Failed to get storefront products:', { detail: error });
      return { products: [], total: 0, page: 1, limit: 20, hasMore: false };
    }
  }

  /**
   * Test hook method customization
   * Demonstrates how subclasses can customize request behavior
   */
  protected async onPublicRequest<T>(
    url: string,
    options: any,
    cacheKey?: string,
    ttl?: number
  ): Promise<any> {
    console.log(`[StorefrontSingletonV2] Customizing public request for: ${url}`);
    
    // Add custom headers for storefront requests
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Storefront-Version': 'v2',
        'X-Request-Timestamp': Date.now().toString()
      }
    };
  }
}

// Export the singleton instance
export const storefrontServiceV2 = StorefrontSingletonServiceV2.getInstance();
