/**
 * Public Directory Service
 * 
 * Handles public directory search, sitemap, and browsing operations
 * Uses PublicApiSingleton for public directory operations
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface DirectoryItem {
  id: string;
  name: string;
  slug: string;
  businessName?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  email?: string;
  category?: string;
  primaryCategory?: string;
  rating?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  isPublished?: boolean;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  distance?: number; // in km/miles
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DirectorySearchParams {
  query?: string;
  category?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in km
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'rating' | 'distance' | 'newest' | 'featured';
  featured?: boolean;
  published?: boolean;
}

export interface DirectorySearchResponse {
  items: DirectoryItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  facets?: {
    categories: Array<{ name: string; count: number }>;
    locations: Array<{ name: string; count: number }>;
  };
}

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export interface LastViewedItem {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  category?: string;
  viewedAt: string;
  tenantId: string;
}

class PublicDirectoryService extends PublicApiSingleton {
  private static instance: PublicDirectoryService;

  private constructor() {
    super('public-directory-service', {
      ttl: 15 * 60 * 1000 // 15 minutes for directory data
    });
  }

  public static getInstance(): PublicDirectoryService {
    if (!PublicDirectoryService.instance) {
      PublicDirectoryService.instance = new PublicDirectoryService();
    }
    return PublicDirectoryService.instance;
  }

  /**
   * Search directory listings
   */
  async searchDirectory(params: DirectorySearchParams): Promise<DirectorySearchResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      // Add all search parameters
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const result = await this.makeDefaultRequest<DirectorySearchResponse>(
        `/api/directory/search?${queryParams.toString()}`,
        {},
        `directory-search-${queryParams.toString()}`,
        10 * 60 * 1000 // 10 minutes cache for search results
      );
      
      if (!result.success || !result.data) {
        return {
          items: [],
          total: 0,
          limit: params.limit || 20,
          offset: params.offset || 0,
          hasMore: false
        };
      }
      
      return result.data;
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to search directory:', error);
      return {
        items: [],
        total: 0,
        limit: params.limit || 20,
        offset: params.offset || 0,
        hasMore: false
      };
    }
  }

  /**
   * Get directory item by slug or ID
   */
  async getDirectoryItem(identifier: string): Promise<DirectoryItem | null> {
    try {
      const result = await this.makeDefaultRequest<DirectoryItem>(
        `/api/directory/item/${encodeURIComponent(identifier)}`,
        {},
        `directory-item-${identifier}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get directory item:', error);
      return null;
    }
  }

  /**
   * Get featured listings
   */
  async getFeaturedListings(limit: number = 10, category?: string): Promise<DirectoryItem[]> {
    try {
      const queryParams = new URLSearchParams({ limit: limit.toString() });
      if (category) {
        queryParams.append('category', category);
      }
      
      const result = await this.makeDefaultRequest<{ items: DirectoryItem[] }>(
        `/api/directory/featured?${queryParams.toString()}`,
        {},
        `directory-featured-${category || 'all'}-${limit}`,
        20 * 60 * 1000 // 20 minutes cache for featured items
      );
      
      return result.data?.items || [];
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get featured listings:', error);
      return [];
    }
  }

  /**
   * Get nearby listings
   */
  async getNearbyListings(latitude: number, longitude: number, radius: number = 10, limit: number = 20): Promise<DirectoryItem[]> {
    try {
      const queryParams = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: radius.toString(),
        limit: limit.toString()
      });
      
      const result = await this.makeDefaultRequest<{ items: DirectoryItem[] }>(
        `/api/directory/nearby?${queryParams.toString()}`,
        {},
        `directory-nearby-${latitude}-${longitude}-${radius}`,
        5 * 60 * 1000 // 5 minutes cache for location-based results
      );
      
      return result.data?.items || [];
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get nearby listings:', error);
      return [];
    }
  }

  /**
   * Get directory categories
   */
  async getCategories(): Promise<Array<{ name: string; count: number; slug?: string }>> {
    try {
      const result = await this.makeDefaultRequest<{ categories: Array<{ name: string; count: number; slug?: string }> }>(
        '/api/directory/categories',
        {},
        'directory-categories',
        30 * 60 * 1000 // 30 minutes cache for categories
      );
      
      return result.data?.categories || [];
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Get directory locations/cities
   */
  async getLocations(): Promise<Array<{ name: string; count: number; slug?: string }>> {
    try {
      const result = await this.makeDefaultRequest<{ locations: Array<{ name: string; count: number; slug?: string }> }>(
        '/api/directory/locations',
        {},
        'directory-locations',
        30 * 60 * 1000 // 30 minutes cache for locations
      );
      
      return result.data?.locations || [];
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get locations:', error);
      return [];
    }
  }

  /**
   * Generate sitemap data
   */
  async getSitemap(): Promise<SitemapEntry[]> {
    try {
      const result = await this.makeDefaultRequest<{ entries: SitemapEntry[] }>(
        '/api/directory/sitemap',
        {},
        'directory-sitemap',
        60 * 60 * 1000 // 1 hour cache for sitemap
      );
      
      return result.data?.entries || [];
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get sitemap:', error);
      return [];
    }
  }

  /**
   * Get recently viewed items for a user
   */
  async getLastViewed(limit: number = 10): Promise<LastViewedItem[]> {
    try {
      const result = await this.makeDefaultRequest<{ items: LastViewedItem[] }>(
        `/api/directory/recent?limit=${limit}`,
        {},
        'directory-recent-viewed',
        5 * 60 * 1000 // 5 minutes cache for recently viewed
      );
      
      return result.data?.items || [];
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get last viewed:', error);
      return [];
    }
  }

  /**
   * Track a directory item view
   */
  async trackView(itemIdentifier: string, itemType: 'shop' | 'product' = 'shop'): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/directory/track-view',
        {
          method: 'POST',
          body: JSON.stringify({
            identifier: itemIdentifier,
            itemType,
            timestamp: new Date().toISOString()
          })
        },
        `track-view-${itemIdentifier}`,
        0 // No caching for tracking
      );
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to track view:', error);
      // Don't throw error for tracking failures
    }
  }

  /**
   * Get directory statistics
   */
  async getStatistics(): Promise<{
    totalShops: number;
    totalProducts: number;
    totalCategories: number;
    totalLocations: number;
    featuredShops: number;
    publishedShops: number;
  }> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/directory/stats',
        {},
        'directory-stats',
        15 * 60 * 1000 // 15 minutes cache for stats
      );
      
      return result.data || {
        totalShops: 0,
        totalProducts: 0,
        totalCategories: 0,
        totalLocations: 0,
        featuredShops: 0,
        publishedShops: 0
      };
    } catch (error) {
      console.error('[PublicDirectoryService] Failed to get statistics:', error);
      return {
        totalShops: 0,
        totalProducts: 0,
        totalCategories: 0,
        totalLocations: 0,
        featuredShops: 0,
        publishedShops: 0
      };
    }
  }

  /**
   * Get directory items by location slug
   */
  async getItemsByLocation(locationSlug: string, params?: Omit<DirectorySearchParams, 'location'>): Promise<DirectorySearchResponse> {
    return this.searchDirectory({
      ...params,
      location: locationSlug
    });
  }

  /**
   * Get directory items by category slug
   */
  async getItemsByCategory(categorySlug: string, params?: Omit<DirectorySearchParams, 'category'>): Promise<DirectorySearchResponse> {
    return this.searchDirectory({
      ...params,
      category: categorySlug
    });
  }
}

// Export the singleton instance
export const publicDirectoryService = PublicDirectoryService.getInstance();
