/**
 * Directory Singleton Service
 * 
 * Comprehensive directory service for all directory-related operations.
 * Directory is a platform pillar alongside storefront, shops, and other core services.
 * 
 * Features:
 * - Directory browsing and search
 * - Store and category management
 * - Location-based directory operations
 * - Consolidated directory data
 * - Related stores and recommendations
 * - Automatic caching with appropriate TTLs
 * - Error handling and logging
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { RequestType, RequestTarget, ApiResult } from '../providers/base/FlexibleApiSingleton';
import { clientTenantContextManager } from '../lib/clientTenantContext';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';

export interface DirectoryStore {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  rating?: number;
  reviewCount?: number;
  categories?: string[];
  isVerified?: boolean;
  isFeatured?: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  businessHours?: any;
  distance?: number;
}

export interface DirectoryCategory {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  storeCount: number;
  productCount: number;
  description?: string;
  icon?: string;
  parentCategory?: string;
  subcategories?: DirectoryCategory[];
  // Enhanced fields from new API
  totalProducts?: number;
  totalInStock?: number;
  avgPriceCents?: number;
}

export interface DirectoryLocation {
  city: string;
  state: string;
  country?: string;
  storeCount: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface DirectorySearchResult {
  stores: DirectoryStore[];
  categories: DirectoryCategory[];
  locations: DirectoryLocation[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DirectoryConsolidated {
  listing: {
    id: string;
    tenantId: string;
    businessName: string;
    business_name: string; // For StructuredData compatibility
    slug: string;
    description?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone?: string;
    email?: string;
    website?: string;
    logo?: string;
    logoUrl?: string; // For image references
    coverImage?: string;
    rating?: number;
    reviewCount?: number;
    productCount?: number; // For product count display
    categories?: any[];
    keywords?: string[]; // For keyword tags
    isVerified?: boolean;
    isFeatured?: boolean;
    coordinates?: {
      lat: number;
      lng: number;
    };
    businessHours?: any;
  };
  storeTypes: any[];
  categoryCounts: any[];
  recommendations: any[];
  featuredProducts: any[]; // For featured products
  paymentGatewayStatus: {
    hasActiveGateway: boolean;
    defaultGatewayType?: string;
  };
}

class DirectorySingletonService extends PublicApiSingleton {
  private static instance: DirectorySingletonService;

  // Override base class defaults for directory operations
  protected defaultContext: AppContext = AppContext.DIRECTORY;
  protected defaultIsolation: CacheIsolation = CacheIsolation.DIRECTORY;

  // Cache TTL constants for different data types
  protected defaultRequestType: RequestType = RequestType.PUBLIC;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API; // Use API backend (port 4000)
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for public data
  //private readonly CACHE_TTL_SHORT = 2 * 60 * 1000; // 2 minutes
  private readonly CACHE_TTL_MEDIUM = 15 * 60 * 1000; // 15 minutes
  //private readonly CACHE_TTL_LONG = 60 * 60 * 1000; // 1 hour

  private constructor() {
    super('directory-singleton');
  }

  public static getInstance(): DirectorySingletonService {
    if (!DirectorySingletonService.instance) {
      DirectorySingletonService.instance = new DirectorySingletonService();
    }
    return DirectorySingletonService.instance;
  }

  /**
   * Get tenant-aware cache key
   * Uses centralized tenant context utility
   */
  private getTenantAwareCacheKey(baseKey: string, tenantId?: string): string {
    // Check if we're on the client side before accessing clientTenantContextManager
    if (typeof window !== 'undefined' && clientTenantContextManager) {
      return clientTenantContextManager.getTenantAwareCacheKey(baseKey, tenantId);
    }
    
    // Fallback for server side or when context manager is not available
    return tenantId ? `${baseKey}:${tenantId}` : baseKey;
  }

  /**
   * Get consolidated directory data for a slug
   * Main endpoint for directory pages
   */
  async getDirectoryConsolidated(slug: string): Promise<DirectoryConsolidated | null> {
    try {
      if (!slug) {
        throw new Error('Slug is required');
      }

      const response = await super.makeDefaultRequest<any>(
        `/api/directory/consolidated/${slug}`,
        {},
        `directory-consolidated-${slug}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.data?.data || response?.data || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory consolidated:', error);
      return null;
    }
  }

  /**
   * Get tenant slug by tenant ID
   * Utility function to resolve tenant ID to slug
   */
  async getTenantSlug(tenantId: string): Promise<string | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await super.makeDefaultRequest<any>(
        `/api/public/tenant/${tenantId}/slug`,
        {},
        `tenant-slug-${tenantId}`,
        this.CACHE_TTL_LONG
      );
      

      return response?.data?.slug || response?.data?.slug || null;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get tenant slug:', error);
      return null;
    }
  }

  /**
   * Get tenant ID by slug
   * Utility function to resolve slug to tenant ID
   */
  async getTenantId(slug: string): Promise<string | null> {
    try {
      if (!slug) {
        throw new Error('Slug is required');
      }

      const response = await super.makeDefaultRequest<any>(
        `/api/public/slug/${slug}/tenant`,
        {},
        `slug-tenant-${slug}`,
        this.CACHE_TTL_LONG
      );

      return response?.data?.tenantId || response?.data?.tenantId || null;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get tenant ID:', error);
      return null;
    }
  }

  /**
   * Get directory categories for MV (Most Valuable)
   * Optimized for category browsing
   * Now tenant-aware to prevent cross-tenant contamination
   */
  async getDirectoryMVCategories(tenantId?: string): Promise<DirectoryCategory[] | null> {
    // Automatically include tenant context in cache key
    const cacheKey = this.getTenantAwareCacheKey('directory-mv-categories', tenantId);
    
    const response = await super.makeDefaultRequest<any>(
      '/api/directory/mv/categories',
      {},
      cacheKey,
      this.CACHE_TTL_LONG
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get directory MV categories:', response.error);
      return null;
    }

    return response.data?.categories || response.data;
  }

  /**
   * Get all directory categories with full hierarchy
   * Now tenant-aware to prevent cross-tenant contamination
   */
  async getDirectoryCategories(tenantId?: string): Promise<DirectoryCategory[] | null> {
    // Automatically include tenant context in cache key
    const cacheKey = this.getTenantAwareCacheKey('directory-categories', tenantId);
    
    const response = await super.makeDefaultRequest<any>(
      '/api/directory/mv/categories',
      {},
      cacheKey,
      this.CACHE_TTL_LONG
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get directory categories:', response.error);
      return null;
    }

    return response.data?.categories || response.data;
  }

  /**
   * Get stores by category slug
   */
  async getStoresByCategory(categorySlug: string): Promise<DirectoryStore[] | null> {
    if (!categorySlug) {
      throw new Error('Category slug is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/directory/mv/categories/${categorySlug}`,
      {},
      `stores-by-category-${categorySlug}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get stores by category:', response.error);
      return null;
    }

    return response.data?.stores || response.data;
  }

  /**
   * Search directory by category
   */
  async searchByCategory(category: string, page: number = 1, limit: number = 20): Promise<DirectorySearchResult | null> {
    if (!category) {
      throw new Error('Category is required');
    }

    const response = await super.makeDefaultRequest<DirectorySearchResult>(
      `/api/directory/search?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`,
      {},
      `search-by-category-${category}-${page}-${limit}`,
      this.CACHE_TTL_SHORT
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to search by category:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Search directory by location
   */
  async searchByLocation(city: string, state: string, page: number = 1, limit: number = 20): Promise<DirectorySearchResult | null> {
    if (!city || !state) {
      throw new Error('City and state are required');
    }

    const response = await super.makeDefaultRequest<DirectorySearchResult>(
      `/api/directory/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&page=${page}&limit=${limit}`,
      {},
      `search-by-location-${city}-${state}-${page}-${limit}`,
      this.CACHE_TTL_SHORT
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to search by location:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get public shops with rich data
   * Uses /api/shops/directory for complete shop information including logos, addresses, etc.
   * Used for shops page and public shop listings
   * Now tenant-aware to prevent cross-tenant contamination
   */
  async getPublicShops(tenantId?: string): Promise<any[]> {
    // Automatically include tenant context in cache key
    const cacheKey = this.getTenantAwareCacheKey('public-shops', tenantId);
    
    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: any[];
    }>(
      '/api/shops/directory',
      {},
      cacheKey,
      this.CACHE_TTL_MEDIUM,
      {
        context: AppContext.SHOP,
        isolation: CacheIsolation.SHOP
      }
    );

    if (!response.success) {
      console.error('[DirectorySingletonService] Failed to get public shops:', response.error);
      return [];
    }

    // Handle doubly nested response structure
    let shopsData = response.data;
    // console.log(`[DirectorySingletonService] shopsData:`, shopsData);
    // If response.data is an object with a 'data' property, extract the inner data
    if (shopsData && typeof shopsData === 'object' && 'data' in shopsData) {
      shopsData = (shopsData as any).data;
    }

    // Check if shopsData is an array
    if (!Array.isArray(shopsData)) {
      // console.error('[DirectorySingletonService] shopsData is not an array:', typeof shopsData);
      return [];
    }

    // Transform data to match expected format
    const shops = shopsData;
    return shops.map((shop: any) => ({
      id: shop.tenantId,
      name: shop.name,
      slug: shop.slug || '',
      business_name: shop.name,
      logo_url: shop.imageUrl || null,
      address: shop.address || null,
      city: shop.city || null,
      state: shop.state || null,
      zip_code: shop.zip_code || null,
      phone: shop.phone || null,
      website: shop.website || null,
      product_count: parseInt(shop.productCount) || 0,
      is_published: shop.is_published || true,
      primary_category: shop.primary_category || null,
      rating: shop.rating,
      review_count: shop.reviewCount,
      is_featured: shop.is_featured || false,
      categories: shop.primary_category ? [shop.primary_category] : []
    }));
  }

  /**
   * Get directory map locations
   * Used for map display with coordinates
   */
  async getDirectoryMapLocations(filters: {
    category?: string;
    storeType?: string;
    city?: string;
    state?: string;
    q?: string;
    limit?: number;
  } = {}): Promise<{
    listings: any[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.storeType) params.append('storeType', filters.storeType);
    if (filters.city) params.append('city', filters.city);
    if (filters.state) params.append('state', filters.state);
    if (filters.q) params.append('q', filters.q);
    params.append('limit', (filters.limit || 100).toString());

    const response = await super.makeDefaultRequest<{
      data: {
        listings: any[];
      };
    }>(
      `/api/directory/map/locations?${params.toString()}`,
      {},
      `directory-map-locations-${params.toString()}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingletonService] Failed to get map locations:', response.error);
      return {
        listings: [],
        total: 0
      };
    }

    return {
      listings: response.data?.data?.listings || [],
      total: response.data?.data?.listings?.length || 0
    };
  }

  /**
   * Get all available locations
   * Now tenant-aware to prevent cross-tenant contamination
   */
  async getLocations(tenantId?: string): Promise<DirectoryLocation[] | null> {
    // Automatically include tenant context in cache key
    const cacheKey = this.getTenantAwareCacheKey('directory-locations', tenantId);
    
    const response = await super.makeDefaultRequest<any>(
      '/api/directory/locations',
      {},
      cacheKey,
      this.CACHE_TTL_LONG
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get directory locations:', response.error);
      return null;
    }

    return response.data?.locations || response.data;
  }

  /**
   * Get directory store types
   * Now tenant-aware to prevent cross-tenant contamination
   */
  async getDirectoryStoreTypes(tenantId?: string): Promise<any[] | null> {
    try {
      // Automatically include tenant context in cache key
      const cacheKey = this.getTenantAwareCacheKey('directory-store-types', tenantId);
      
      const response = await super.makeDefaultRequest<any>(
        '/api/directory/store-types',
        {},
        cacheKey,
        this.CACHE_TTL_LONG
      );
      if (!response.success) {
        console.error('[DirectorySingleton] Failed to get directory store types:', response.error);
        return null;
      }
      
      // API returns: { success: true, data: { storeTypes: [...] } }
      // makeDefaultRequest wraps this, so we need response.data.data.storeTypes
      return response.data?.data?.storeTypes || [];
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory store types:', error);
      return null;
    }
  }

  /**
   * Get tenant directory slug
   */
  async getTenantDirectorySlug(tenantId: string): Promise<{ slug: string } | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await super.makeDefaultRequest<{ slug: string }>(
      `/api/directory/tenant/${tenantId}`,
      {},
      `tenant-directory-slug-${tenantId}`,
      this.CACHE_TTL_MEDIUM,{
        context: AppContext.TENANT,
        isolation: CacheIsolation.TENANT
      }

    );

    if (!response.success) {
      console.log('[DirectorySingleton] Failed to get tenant directory slug:', response.error);
      return null;
    }
    // console.log(`[DirectorySingleton] Tenant directory slug response:`, response.data);

    // Handle case where tenant exists but has no published directory
    // This is expected behavior, not an error
    if (response.data && response.data.slug === null) {
      console.log('[DirectorySingleton] Tenant has no published directory:', tenantId);
      return null;
    }

    return response.data || null;
  }

  /**
   * Search categories with query
   */
  async searchCategories(query: string): Promise<any> {
    if (!query) {
      throw new Error('Query is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/directory/categories/search?q=${encodeURIComponent(query)}`,
      {},
      `search-categories-${query}`,
      this.CACHE_TTL_SHORT
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to search categories:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Comprehensive directory search with filters
   */
  async searchDirectoryStores(params: {
    search?: string;
    category?: string;
    lat?: number;
    lng?: number;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<DirectorySearchResult | null> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.category) searchParams.append('category', params.category);
    if (params.lat && params.lng) {
      searchParams.append('lat', params.lat.toString());
      searchParams.append('lng', params.lng.toString());
    }
    if (params.sort) searchParams.append('sort', params.sort);
    searchParams.append('page', (params.page || 1).toString());
    searchParams.append('limit', (params.limit || 20).toString());

    const response = await super.makeDefaultRequest<DirectorySearchResult>(
      `/api/directory/mv/search?${searchParams.toString()}`,
      {},
      this.getTenantAwareCacheKey(`search-directory-stores-${searchParams.toString()}`),
      this.CACHE_TTL_SHORT
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to search directory stores:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get featured stores with location filtering
   */
  async getFeaturedStores(params: {
    limit?: number;
    location?: {
      lat: number;
      lng: number;
    };
  }): Promise<DirectoryStore[] | null> {
    const searchParams = new URLSearchParams();
    searchParams.append('limit', (params.limit || 10).toString());
    
    if (params.location) {
      searchParams.append('lat', params.location.lat.toString());
      searchParams.append('lng', params.location.lng.toString());
      searchParams.append('maxDistance', '50'); // 50km radius
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/directory/featured-stores?${searchParams.toString()}`,
      {},
      this.getTenantAwareCacheKey(`featured-stores-${searchParams.toString()}`),
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get featured stores:', response.error);
      return null;
    }

    return response.data?.stores || response.data;
  }

  /**
   * Get related stores for a given store
   */
  async getRelatedStores(slug: string, limit: number = 5): Promise<DirectoryStore[]> {
    if (!slug) {
      throw new Error('Slug is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/directory/${slug}/related?limit=${limit}`,
      {},
      `related-stores-${slug}-${limit}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get related stores:', response.error);
      return [];
    }

    // The API returns { related: [...], count: ..., method: ... }
    return response.data?.related || response.data?.stores || response.data || [];
  }

  /**
   * Get directory sitemap data
   * Now tenant-aware to prevent cross-tenant contamination
   */
  async getDirectorySitemap(limit: number = 1000, tenantId?: string): Promise<any> {
    // Automatically include tenant context in cache key
    const cacheKey = this.getTenantAwareCacheKey(`directory-sitemap-${limit}`, tenantId);
    
    const response = await super.makeDefaultRequest<any>(
      `/api/directory/search?limit=${limit}`,
      {},
      cacheKey,
      this.CACHE_TTL_LONG
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get directory sitemap:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get storefront categories for a tenant
   * Used in directory context for store category display
   */
  async getStorefrontCategories(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/storefront/${tenantId}/categories`,
      {},
      `storefront-categories-${tenantId}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get storefront categories:', response.error);
      return { categories: [], uncategorizedCount: 0 };
    }

    return {
      categories: response.data?.categories || [],
      uncategorizedCount: response.data?.uncategorizedCount || 0,
    };
  }

  /**
   * Get storefront product count for a tenant
   * Used in directory context for product count display
   */
  async getStorefrontProductCount(tenantId: string): Promise<number> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/storefront/${tenantId}/products?limit=1`,
      {},
      `storefront-product-count-${tenantId}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get storefront product count:', response.error);
      return 0;
    }

    return response.data?.pagination?.totalItems || 0;
  }

  /**
   * Get business profile for a tenant
   * Used in directory context for store information display
   */
  async getBusinessProfile(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/public/tenant/${tenantId}/profile`,
      {},
      `business-profile-${tenantId}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get business profile:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get business hours for a tenant
   * Used in directory context for store hours display
   */
  async getBusinessHours(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    const response = await super.makeDefaultRequest<any>(
      `/api/tenant/${tenantId}/business-hours`,
      {},
      `business-hours-v2-${tenantId}`, // v2 for timezone enhancement
      this.CACHE_TTL_MEDIUM,
      {
        context: AppContext.SHOP,
        isolation: CacheIsolation.SHOP
      }
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get business hours:', response.error);
      return null;
    }

    return response.data || null;
  }


  /**
   * Get featured products across all shops with filtering
   * EnhancedFlexibleApi compliant with shop context and isolation
   * Used for the featured products page
   */
  async getAllFeaturedProducts(filters: {
    category?: string;
    location?: string;
    rating?: string;
    priceRange?: string;
    trending?: boolean;
    inStock?: boolean;
    sortBy?: string;
    limit?: number;
    shopId?: string; // For shop context isolation
  } = {}): Promise<{
    totalCount: number;
    buckets: Record<string, any[]>;
    bucketCounts: Record<string, number>;
    shops: Array<{
      id: string;
      name: string;
      slug: string;
      logo?: string;
      tier: string;
    }>;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.rating) queryParams.append('minRating', filters.rating);
      if (filters.priceRange) {
        const [min, max] = filters.priceRange.split('-');
        if (min) queryParams.append('minPrice', min);
        if (max) queryParams.append('maxPrice', max);
      }
      if (filters.trending) queryParams.append('trending', 'true');
      if (filters.inStock) queryParams.append('inStock', 'true');
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
      if (filters.shopId) queryParams.append('shopId', filters.shopId);

      const endpoint = `/api/directory/featured-products?${queryParams.toString()}`;
      
      // EnhancedFlexibleApi compliant cache options with shop context
      const cacheKey = `featured-products-all-${queryParams.toString()}`;
      
      // Use makePublicRequest with standard cache options
      // Note: Full EnhancedFlexibleApi features (context/isolation) would require
      // extending the inheritance chain or using makeEnhancedDefaultRequest
      const response = await this.makeDefaultRequest<{
        success: boolean;
        data: {
          totalCount: number;
          buckets: Record<string, any[]>;
          bucketCounts: Record<string, number>;
          shops: Array<{
            id: string;
            name: string;
            slug: string;
            logo?: string;
            tier: string;
          }>;
        };
      }>(endpoint, undefined, cacheKey, this.CACHE_TTL_MEDIUM);

      const actualData = response.data?.data; // Extract nested data

      if (!response.success) {
        console.error('[DirectorySingleton] Failed to get all featured products:', response.error);
        return {
          totalCount: 0,
          buckets: {},
          bucketCounts: {},
          shops: []
        };
      }

      const result = actualData || {
        totalCount: 0,
        buckets: {},
        bucketCounts: {},
        shops: []
      };
      
      return result;
    } catch (error) {
      console.error('[DirectorySingleton] Error fetching all featured products:', error);
      return {
        totalCount: 0,
        buckets: {},
        bucketCounts: {},
        shops: []
      };
    }
  }

  /**
   * Get featured products for a tenant (store_selection type)
   * Used in directory context for product showcase
   */
  async getFeaturedProducts(tenantId: string, limit: number = 6): Promise<any[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/storefront/${tenantId}/featured-products?type=store_selection&limit=${limit}`,
      {},
      `featured-products-${tenantId}-${limit}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get featured products:', response.error);
      return [];
    }

    return response.data?.items || [];
  }

  /**
   * Get stores by category for related products
   * Used in directory context for finding related stores
   */
  async getStoresByCategoryForProducts(categorySlug: string, limit: number = 10): Promise<any> {
    if (!categorySlug) {
      throw new Error('Category slug is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/directory/mv/search?category=${categorySlug}&limit=${limit}`,
      {},
      `stores-by-category-products-${categorySlug}-${limit}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get stores by category for products:', response.error);
      return [];
    }

    return response.data?.listings || [];
  }

  /**
   * Get storefront products for a tenant
   * Used in directory context for product display
   */
  async getStorefrontProducts(tenantId: string, limit: number = 2): Promise<any[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await super.makeDefaultRequest<any>(
      `/api/storefront/${tenantId}/products?limit=${limit}`,
      {},
      `storefront-products-${tenantId}-${limit}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get storefront products:', response.error);
      return [];
    }

    return response.data?.items || [];
  }
}

// Export singleton instance
export const directorySingletonService = DirectorySingletonService.getInstance();
export const directoryService = DirectorySingletonService.getInstance();
