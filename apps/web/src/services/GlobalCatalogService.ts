/**
 * Global Catalog Service
 * 
 * Manages global product catalog browsing, search, and product retrieval
 */

import { FlexibleApiSingleton, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface GlobalProduct {
  id: string;
  product_slug: string;
  universal_sku?: string;
  name: string;
  brand?: string;
  category_path?: string[];
  gtin_upc?: string;
  description?: string;
  specifications?: Record<string, any>;
  images?: Array<{
    url: string;
    alt?: string;
    type?: string;
  }>;
  status: string;
  source: 'platform' | 'merchant' | 'partner';
  catalog_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CatalogBrowseOptions {
  category?: string;
  brand?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'brand' | 'created_at' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface CatalogBrowseResult {
  products: GlobalProduct[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  categories: string[];
  brands: string[];
}

export interface SearchFilters {
  category?: string;
  brand?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  inStock?: boolean;
  source?: 'platform' | 'merchant' | 'partner';
}

export interface SearchResult {
  products: GlobalProduct[];
  total: number;
  query: string;
  filters: SearchFilters;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * GlobalCatalogService
 * 
 * Provides public access to the global product catalog
 */
class GlobalCatalogService extends FlexibleApiSingleton {
  private static instance: GlobalCatalogService;

  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;
  protected defaultContext = AppContext.PRODUCT;
  protected defaultIsolation = CacheIsolation.GLOBAL;

  protected constructor() {
    super('global-catalog-service', {
      ttl: 30 * 60 * 1000 // 30 minutes for catalog data
    });
  }

  public static getInstance(): GlobalCatalogService {
    if (!GlobalCatalogService.instance) {
      GlobalCatalogService.instance = new GlobalCatalogService();
    }
    return GlobalCatalogService.instance;
  }

  /**
   * Browse the global catalog with pagination and filters
   */
  async browseCatalog(options: CatalogBrowseOptions = {}): Promise<CatalogBrowseResult> {
    try {
      const {
        category,
        brand,
        page = 1,
        limit = 20,
        sortBy = 'name',
        sortOrder = 'asc'
      } = options;

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
        ...(category && { category }),
        ...(brand && { brand })
      });

      const result = await this.makePublicRequest<CatalogBrowseResult>(
        `/api/catalog/browse?${params.toString()}`,
        { method: 'GET' },
        `catalog-browse:${category || 'all'}:${brand || 'all'}:${page}:${limit}`,
        this.cacheTTL
      );

      return result.data || {
        products: [],
        total: 0,
        page,
        limit,
        hasMore: false,
        categories: [],
        brands: []
      };
    } catch (error) {
      console.error('[GlobalCatalogService] Error browsing catalog:', error);
      return {
        products: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
        categories: [],
        brands: []
      };
    }
  }

  /**
   * Get a product by its slug
   */
  async getProductBySlug(slug: string): Promise<GlobalProduct | null> {
    try {
      const result = await this.makePublicRequest<GlobalProduct>(
        `/api/catalog/products/${encodeURIComponent(slug)}`,
        { method: 'GET' },
        `catalog-product:${slug}`,
        this.cacheTTL
      );

      return result.data || null;
    } catch (error) {
      console.error('[GlobalCatalogService] Error fetching product by slug:', error);
      return null;
    }
  }

  /**
   * Get a product by UPC/GTIN
   */
  async getProductByUPC(upc: string): Promise<GlobalProduct | null> {
    try {
      const result = await this.makePublicRequest<GlobalProduct>(
        `/api/catalog/products/upc/${encodeURIComponent(upc)}`,
        { method: 'GET' },
        `catalog-product-upc:${upc}`,
        this.cacheTTL
      );

      return result.data || null;
    } catch (error) {
      console.error('[GlobalCatalogService] Error fetching product by UPC:', error);
      return null;
    }
  }

  /**
   * Search the global catalog
   */
  async searchCatalog(
    query: string,
    filters: SearchFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResult> {
    try {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: String(limit),
        ...(filters.category && { category: filters.category }),
        ...(filters.brand && { brand: filters.brand }),
        ...(filters.source && { source: filters.source })
      });

      const result = await this.makePublicRequest<SearchResult>(
        `/api/catalog/search?${params.toString()}`,
        { method: 'GET' },
        `catalog-search:${query}:${JSON.stringify(filters)}:${page}:${limit}`,
        this.cacheTTL
      );

      return result.data || {
        products: [],
        total: 0,
        query,
        filters,
        page,
        limit,
        hasMore: false
      };
    } catch (error) {
      console.error('[GlobalCatalogService] Error searching catalog:', error);
      return {
        products: [],
        total: 0,
        query,
        filters,
        page,
        limit,
        hasMore: false
      };
    }
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(
    categorySlug: string,
    page: number = 1,
    limit: number = 20
  ): Promise<CatalogBrowseResult> {
    return this.browseCatalog({
      category: categorySlug,
      page,
      limit
    });
  }

  /**
   * Get products by brand
   */
  async getProductsByBrand(
    brandName: string,
    page: number = 1,
    limit: number = 20
  ): Promise<CatalogBrowseResult> {
    return this.browseCatalog({
      brand: brandName,
      page,
      limit
    });
  }

  /**
   * Get popular products (most adopted/viewed)
   */
  async getPopularProducts(limit: number = 10): Promise<GlobalProduct[]> {
    try {
      const result = await this.makePublicRequest<GlobalProduct[]>(
        `/api/catalog/popular?limit=${limit}`,
        { method: 'GET' },
        `catalog-popular:${limit}`,
        this.cacheTTL
      );

      return result.data || [];
    } catch (error) {
      console.error('[GlobalCatalogService] Error fetching popular products:', error);
      return [];
    }
  }

  /**
   * Get recently added products
   */
  async getRecentProducts(limit: number = 10): Promise<GlobalProduct[]> {
    try {
      const result = await this.makePublicRequest<GlobalProduct[]>(
        `/api/catalog/recent?limit=${limit}`,
        { method: 'GET' },
        `catalog-recent:${limit}`,
        this.cacheTTL
      );

      return result.data || [];
    } catch (error) {
      console.error('[GlobalCatalogService] Error fetching recent products:', error);
      return [];
    }
  }

  /**
   * Get catalog statistics
   */
  async getCatalogStats(): Promise<{
    totalProducts: number;
    totalBrands: number;
    totalCategories: number;
    lastUpdated: string;
  } | null> {
    try {
      const result = await this.makePublicRequest<{
        totalProducts: number;
        totalBrands: number;
        totalCategories: number;
        lastUpdated: string;
      }>(
        '/api/catalog/stats',
        { method: 'GET' },
        'catalog-stats',
        this.cacheTTL
      );

      return result.data || null;
    } catch (error) {
      console.error('[GlobalCatalogService] Error fetching catalog stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const globalCatalogService = GlobalCatalogService.getInstance();
export default globalCatalogService;
