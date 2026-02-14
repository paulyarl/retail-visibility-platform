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

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

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
      DirectorySingletonService.instance = new DirectorySingletonService();
    }
    return DirectorySingletonService.instance;
  }

  constructor() {
    super('DirectorySingletonService');
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

      const response = await this.makePublicRequest<any>(
        `/api/directory/consolidated/${slug}`,
        {},
        `directory-consolidated-${slug}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.data || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory consolidated:', error);
      return null;
    }
  }

  /**
   * Get directory categories from materialized view
   * Optimized for category browsing
   */
  async getDirectoryMVCategories(): Promise<DirectoryCategory[] | null> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/mv/categories',
        {},
        'directory-mv-categories',
        this.CACHE_TTL_LONG
      );

      return response?.categories || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory MV categories:', error);
      return null;
    }
  }

  /**
   * Get all directory categories with full hierarchy
   */
  async getDirectoryCategories(): Promise<DirectoryCategory[] | null> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/categories',
        {},
        'directory-categories',
        this.CACHE_TTL_LONG
      );

      return response?.categories || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory categories:', error);
      return null;
    }
  }

  /**
   * Get stores by category slug
   */
  async getStoresByCategory(categorySlug: string): Promise<DirectoryStore[] | null> {
    try {
      if (!categorySlug) {
        throw new Error('Category slug is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/mv/categories/${categorySlug}`,
        {},
        `stores-by-category-${categorySlug}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.stores || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get stores by category:', error);
      return null;
    }
  }

  /**
   * Search directory by category
   */
  async searchByCategory(category: string, page: number = 1, limit: number = 20): Promise<DirectorySearchResult | null> {
    try {
      if (!category) {
        throw new Error('Category is required');
      }

      const response = await this.makePublicRequest<DirectorySearchResult>(
        `/api/directory/search?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`,
        {},
        `search-by-category-${category}-${page}-${limit}`,
        this.CACHE_TTL_SHORT
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to search by category:', error);
      return null;
    }
  }

  /**
   * Search directory by location
   */
  async searchByLocation(city: string, state: string, page: number = 1, limit: number = 20): Promise<DirectorySearchResult | null> {
    try {
      if (!city || !state) {
        throw new Error('City and state are required');
      }

      const response = await this.makePublicRequest<DirectorySearchResult>(
        `/api/directory/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&page=${page}&limit=${limit}`,
        {},
        `search-by-location-${city}-${state}-${page}-${limit}`,
        this.CACHE_TTL_SHORT
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to search by location:', error);
      return null;
    }
  }

  /**
   * Get public shops for directory browsing
   * Used for shops page and public shop listings
   */
  async getPublicShops(): Promise<any[]> {
    try {
      const response = await this.makePublicRequest<{
        success: boolean;
        shops: any[];
      }>(
        '/api/public/shops',
        {},
        'public-shops',
        this.CACHE_TTL_MEDIUM
      );

      return response?.shops || [];
    } catch (error) {
      console.error('[DirectorySingletonService] Failed to get public shops:', error);
      return [];
    }
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
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.storeType) params.append('storeType', filters.storeType);
      if (filters.city) params.append('city', filters.city);
      if (filters.state) params.append('state', filters.state);
      if (filters.q) params.append('q', filters.q);
      params.append('limit', (filters.limit || 100).toString());

      const response = await this.makePublicRequest<{
        data: {
          listings: any[];
        };
      }>(
        `/api/directory/map/locations?${params.toString()}`,
        {},
        `directory-map-locations-${params.toString()}`,
        this.CACHE_TTL_MEDIUM
      );

      return {
        listings: response?.data?.listings || [],
        total: response?.data?.listings?.length || 0
      };
    } catch (error) {
      console.error('[DirectorySingletonService] Failed to get map locations:', error);
      return {
        listings: [],
        total: 0
      };
    }
  }

  /**
   * Get all available locations
   */
  async getLocations(): Promise<DirectoryLocation[] | null> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/locations',
        {},
        'directory-locations',
        this.CACHE_TTL_LONG
      );

      return response?.locations || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory locations:', error);
      return null;
    }
  }

  /**
   * Get directory store types
   */
  async getDirectoryStoreTypes(): Promise<any[] | null> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/store-types',
        {},
        'directory-store-types',
        this.CACHE_TTL_LONG
      );

      return response?.storeTypes || response?.data?.storeTypes || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory store types:', error);
      return null;
    }
  }

  /**
   * Get tenant directory slug
   */
  async getTenantDirectorySlug(tenantId: string): Promise<{ slug: string } | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<{ slug: string }>(
        `/api/directory/tenant/${tenantId}`,
        {},
        `tenant-directory-slug-${tenantId}`,
        this.CACHE_TTL_MEDIUM
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get tenant directory slug:', error);
      return null;
    }
  }

  /**
   * Search categories with query
   */
  async searchCategories(query: string): Promise<any> {
    try {
      if (!query) {
        throw new Error('Query is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/categories/search?q=${encodeURIComponent(query)}`,
        {},
        `search-categories-${query}`,
        this.CACHE_TTL_SHORT
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to search categories:', error);
      return null;
    }
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
    try {
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

      const response = await this.makePublicRequest<DirectorySearchResult>(
        `/api/directory/mv/search?${searchParams.toString()}`,
        {},
        `search-directory-stores-${JSON.stringify(params)}`,
        this.CACHE_TTL_SHORT
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to search directory stores:', error);
      return null;
    }
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
    try {
      const searchParams = new URLSearchParams();
      searchParams.append('limit', (params.limit || 10).toString());
      
      if (params.location) {
        searchParams.append('lat', params.location.lat.toString());
        searchParams.append('lng', params.location.lng.toString());
        searchParams.append('maxDistance', '50'); // 50km radius
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/featured-stores?${searchParams.toString()}`,
        {},
        `featured-stores-${JSON.stringify(params)}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.stores || response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get featured stores:', error);
      return null;
    }
  }

  /**
   * Get related stores for a given store
   */
  async getRelatedStores(slug: string, limit: number = 5): Promise<DirectoryStore[]> {
    try {
      if (!slug) {
        throw new Error('Slug is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/${slug}/related?limit=${limit}`,
        {},
        `related-stores-${slug}-${limit}`,
        this.CACHE_TTL_MEDIUM
      );

      // The API returns { related: [...], count: ..., method: ... }
      return response?.related || response?.stores || response || [];
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get related stores:', error);
      return [];
    }
  }

  /**
   * Get directory sitemap data
   */
  async getDirectorySitemap(limit: number = 1000): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        `/api/directory/search?limit=${limit}`,
        {},
        'directory-sitemap',
        this.CACHE_TTL_LONG
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get directory sitemap:', error);
      return null;
    }
  }

  /**
   * Get storefront categories for a tenant
   * Used in directory context for store category display
   */
  async getStorefrontCategories(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/storefront/${tenantId}/categories`,
        {},
        `storefront-categories-${tenantId}`,
        this.CACHE_TTL_MEDIUM
      );

      return {
        categories: response?.categories || [],
        uncategorizedCount: response?.uncategorizedCount || 0,
      };
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get storefront categories:', error);
      return { categories: [], uncategorizedCount: 0 };
    }
  }

  /**
   * Get storefront product count for a tenant
   * Used in directory context for product count display
   */
  async getStorefrontProductCount(tenantId: string): Promise<number> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/storefront/${tenantId}/products?limit=1`,
        {},
        `storefront-product-count-${tenantId}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.pagination?.totalItems || 0;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get storefront product count:', error);
      return 0;
    }
  }

  /**
   * Get business profile for a tenant
   * Used in directory context for store information display
   */
  async getBusinessProfile(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/public/tenant/${tenantId}/profile`,
        {},
        `business-profile-${tenantId}`,
        this.CACHE_TTL_MEDIUM
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get business profile:', error);
      return null;
    }
  }

  /**
   * Get business hours for a tenant
   * Used in directory context for store hours display
   */
  async getBusinessHours(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/tenant/${tenantId}/business-hours`,
        {},
        `business-hours-${tenantId}`,
        this.CACHE_TTL_MEDIUM
      );

      return response;
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get business hours:', error);
      return null;
    }
  }

  /**
   * Get featured products for a tenant (store_selection type)
   * Used in directory context for product showcase
   */
  async getFeaturedProducts(tenantId: string, limit: number = 6): Promise<any[]> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/storefront/${tenantId}/featured-products?type=store_selection&limit=${limit}`,
        {},
        `featured-products-${tenantId}-${limit}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.items || [];
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get featured products:', error);
      return [];
    }
  }

  /**
   * Get stores by category for related products
   * Used in directory context for finding related stores
   */
  async getStoresByCategoryForProducts(categorySlug: string, limit: number = 10): Promise<any> {
    try {
      if (!categorySlug) {
        throw new Error('Category slug is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/mv/search?category=${categorySlug}&limit=${limit}`,
        {},
        `stores-by-category-products-${categorySlug}-${limit}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.listings || [];
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get stores by category for products:', error);
      return [];
    }
  }

  /**
   * Get storefront products for a tenant
   * Used in directory context for product display
   */
  async getStorefrontProducts(tenantId: string, limit: number = 2): Promise<any[]> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/storefront/${tenantId}/products?limit=${limit}`,
        {},
        `storefront-products-${tenantId}-${limit}`,
        this.CACHE_TTL_MEDIUM
      );

      return response?.items || [];
    } catch (error) {
      console.error('[DirectorySingleton] Failed to get storefront products:', error);
      return [];
    }
  }
}

// Export singleton instance
export const directorySingletonService = DirectorySingletonService.getInstance();
export const directoryService = DirectorySingletonService.getInstance();
