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

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

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
  
  // Different TTLs for different data types
  private readonly CACHE_TTL_SHORT = 5 * 60 * 1000; // 5 minutes for dynamic data
  private readonly CACHE_TTL_MEDIUM = 10 * 60 * 1000; // 10 minutes for semi-static data
  private readonly CACHE_TTL_LONG = 30 * 60 * 1000; // 30 minutes for static data

  static getInstance(): DirectorySingletonService {
    if (!DirectorySingletonService.instance) {
      DirectorySingletonService.instance = new DirectorySingletonService('directory-service');
    }
    return DirectorySingletonService.instance;
  }

  constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes cache
      ...cacheOptions
    });
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
   * Get directory categories for MV (Most Valuable)
   * Optimized for category browsing
   */
  async getDirectoryMVCategories(): Promise<DirectoryCategory[] | null> {
    const response = await super.makeDefaultRequest<any>(
      '/api/directory/mv/categories',
      {},
      'directory-mv-categories',
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
   */
  async getDirectoryCategories(): Promise<DirectoryCategory[] | null> {
    const response = await super.makeDefaultRequest<any>(
      '/api/directory/mv/categories',
      {},
      'directory-categories',
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
   * Get public shops for directory browsing
   * Used for shops page and public shop listings
   */
  async getPublicShops(): Promise<any[]> {
    const response = await super.makeDefaultRequest<{
      success: boolean;
      shops: any[];
    }>(
      '/api/public/shops',
      {},
      'public-shops',
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingletonService] Failed to get public shops:', response.error);
      return [];
    }

    return response.data?.shops || [];
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
   */
  async getLocations(): Promise<DirectoryLocation[] | null> {
    const response = await super.makeDefaultRequest<any>(
      '/api/directory/locations',
      {},
      'directory-locations',
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
   */
  async getDirectoryStoreTypes(): Promise<any[] | null> {
    try {
      const response = await super.makeDefaultRequest<any>(
        '/api/directory/store-types',
        {},
        'directory-store-types',
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
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get tenant directory slug:', response.error);
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
      `search-directory-stores-${JSON.stringify(params)}`,
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
      `featured-stores-${JSON.stringify(params)}`,
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
   */
  async getDirectorySitemap(limit: number = 1000): Promise<any> {
    const response = await super.makeDefaultRequest<any>(
      `/api/directory/search?limit=${limit}`,
      {},
      'directory-sitemap',
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
      `business-hours-${tenantId}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[DirectorySingleton] Failed to get business hours:', response.error);
      return null;
    }

    return response.data || null;
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
