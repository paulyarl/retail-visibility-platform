/**
 * Recommendations Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached recommendations operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

export interface StoreRecommendation {
  id: string;
  name: string;
  slug?: string;
  [key: string]: any;
}

export interface RecommendationGroup {
  type: string;
  title: string;
  recommendations: StoreRecommendation[];
}

class RecommendationsSingletonService extends PublicApiSingleton {
  private static instance: RecommendationsSingletonService;

  // Different TTL for different recommendation types
  private readonly PERSONALIZED_TTL = 1 * 60 * 1000; // 1 minute for personalized
  private readonly STATIC_TTL = 30 * 60 * 1000; // 30 minutes for static
  private readonly SEMI_STATIC_TTL = 10 * 60 * 1000; // 10 minutes for semi-static

  private constructor() {
    super('recommendations-singleton');
  }

  public static getInstance(): RecommendationsSingletonService {
    if (!RecommendationsSingletonService.instance) {
      RecommendationsSingletonService.instance = new RecommendationsSingletonService();
    }
    return RecommendationsSingletonService.instance;
  }

  /**
   * Get storefront recommendations for a tenant
   * Uses the /api/recommendations/for-storefront/:tenantId endpoint
   */
  async getStorefrontRecommendations(tenantId: string, params?: {
    lat?: string;
    lng?: string;
    category?: string;
    limit?: number;
  }): Promise<StoreRecommendation[]> {
    if (!tenantId) {
      console.error('[RecommendationsSingleton] getStorefrontRecommendations: tenantId is required');
      return [];
    }

    try {
      const searchParams = new URLSearchParams();
      if (params?.lat) searchParams.append('lat', params.lat);
      if (params?.lng) searchParams.append('lng', params.lng);
      if (params?.category) searchParams.append('category', params.category);
      if (params?.limit) searchParams.append('limit', params.limit.toString());

      const result = await this.makePublicRequest<{
        recommendations: RecommendationGroup[];
      }>(
        `/api/recommendations/for-storefront/${tenantId}?${searchParams.toString()}`,
        {},
        `display:storefront-recommendations-${tenantId}`,
        this.SEMI_STATIC_TTL // 10 minutes for storefront recommendations
      );
      if (!result.success) {
        console.error('[RecommendationsSingleton] Failed to get storefront recommendations:', result.error);
        return [];
      }
      
      // API returns nested structure: { recommendations: [{ type, title, recommendations: [...stores] }] }
      // Flatten to get the actual store recommendations
      const allStores = (result.data?.recommendations || []).flatMap(
        (group: RecommendationGroup) => group.recommendations || []
      );
      
      return allStores;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get storefront recommendations:', error);
      return [];
    }
  }

  /**
   * Get all storefront recommendations
   * Uses the /api/recommendations/for-storefront endpoint
   */
  async getAllStorefrontRecommendations(): Promise<StoreRecommendation[]> {
    try {
      const result = await this.makePublicRequest<{
        recommendations: RecommendationGroup[];
      }>(
        '/api/recommendations/for-storefront',
        {},
        'recommendations-all-storefront',
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[RecommendationsSingleton] Failed to get storefront recommendations:', result.error);
        return [];
      }

      // Flatten all recommendation groups into a single array
      const allStores = (result.data?.recommendations || []).flatMap(
        (group: RecommendationGroup) => group.recommendations || []
      );
      
      return allStores;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get storefront recommendations:', error);
      return [];
    }
  }

  /**
   * Track behavior batch for recommendations
   * Uses the /api/recommendations/track-batch endpoint
   */
  async trackBehaviorBatch(batchData: any): Promise<void> {
    try {
      await this.makePublicRequest<void>(
        '/api/recommendations/track-batch',
        {
          method: 'POST',
          body: JSON.stringify(batchData)
        },
        undefined // Don't use cache for tracking requests
      );
    } catch (error) {
      console.warn('[RecommendationsSingleton] Behavior tracking batch failed:', error);
      // Don't throw - behavior tracking failures should be silent
    }
  }

  /**
   * Get directory recommendations
   * Public endpoint for directory browsing
   */
  async getDirectoryRecommendations(): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/recommendations/for-directory',
        {},
        'display:directory-recommendations',
        this.STATIC_TTL // 30 minutes for general directory recommendations
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get directory recommendations:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get directory recommendations:', error);
      return null;
    }
  }

  /**
   * Get enhanced directory categories with rich insights
   * Public endpoint for directory browsing
   */
  async getDirectoryCategoriesEnhanced(): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/categories-enhanced',
        {},
        'directory-categories-enhanced',
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get enhanced categories:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get enhanced categories:', error);
      return null;
    }
  }

  /**
   * Get directory categories with counts
   * Public endpoint for directory browsing
   */
  async getDirectoryCategoriesCounts(): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/categories-optimized/counts-by-name',
        {},
        'directory-categories-counts',
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get category counts:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get category counts:', error);
      return null;
    }
  }

  /**
   * Get directory store types
   * Public endpoint for directory browsing
   */
  async getDirectoryStoreTypes(): Promise<any> {
    try {
      console.log('[RecommendationsSingleton] before request');
      const response = await this.makePublicRequest<any>(
        '/api/directory/store-types',
        {},
        'directory-store-types',
        this.cacheTTL
      );
      
      console.log('[RecommendationsSingleton] before check response.data?.data?.storeTypes store types:', response.data?.data?.storeTypes);
      console.log('[RecommendationsSingleton] before chedk response.data?.storeTypes store types:', response.data?.storeTypes);

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get store types:', response.error);
        return null;
      }

      // API returns: { success: true, data: { storeTypes: [...] } }
      // makePublicRequest wraps this, so we need response.data.data.storeTypes
      console.log('[RecommendationsSingleton] response.data?.data?.storeTypes store types:', response.data?.data?.storeTypes);
      console.log('[RecommendationsSingleton] response.data?.storeTypes store types:', response.data?.storeTypes);
      return response.data?.data?.storeTypes || null;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get store types:', error);
      return null;
    }
  }

  /**
   * Get store type recommendations
   * Public endpoint for directory browsing
   */
  async getStoreTypeRecommendations(storeTypeSlug: string): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        `/api/recommendations/for-directory?storeType=${storeTypeSlug}`,
        {},
        `display:store-type-recommendations-${storeTypeSlug}`,
        this.SEMI_STATIC_TTL // 10 minutes for store type recommendations
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get store type recommendations:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get store type recommendations:', error);
      return null;
    }
  }

  /**
   * Get store type details
   * Public endpoint for directory browsing
   */
  async getStoreTypeDetails(storeTypeSlug: string): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        `/api/directory/store-types/${storeTypeSlug}`,
        {},
        `display:store-type-details-${storeTypeSlug}`,
        this.SEMI_STATIC_TTL // 10 minutes for store type details
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get store type details:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get store type details:', error);
      return null;
    }
  }

  /**
   * Get stores by store type
   * Public endpoint for directory browsing
   */
  async getStoresByStoreType(storeTypeSlug: string): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        `/api/directory/store-types/${storeTypeSlug}/stores`,
        {},
        `stores-by-store-type-${storeTypeSlug}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get stores by store type:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get stores by store type:', error);
      return null;
    }
  }

  /**
   * Track recommendations behavior
   * Public endpoint for recommendation tracking
   */
  async trackRecommendations(trackData: any): Promise<boolean> {
    try {
      await this.makePublicRequest<void>(
        '/api/recommendations/track',
        {
          method: 'POST',
          body: JSON.stringify(trackData)
        },
        'recommendations-track'
      );

      return true;
    } catch (error) {
      console.warn('[RecommendationsSingleton] Behavior tracking failed:', error);
      // Don't throw - behavior tracking failures should be silent
      return false;
    }
  }

  /**
   * Get last viewed recommendations
   * Public endpoint for recommendation tracking
   */
  async getLastViewed(params?: {
    sessionId?: string;
    userId?: string;
    limit?: number;
  }): Promise<any> {
    try {
      // Must have either userId or sessionId
      if (!params?.sessionId && !params?.userId) {
        console.warn('[RecommendationsSingleton] No sessionId or userId provided for getLastViewed');
        return null;
      }

      const searchParams = new URLSearchParams();
      if (params?.sessionId) searchParams.append('sessionId', params.sessionId);
      if (params?.userId) searchParams.append('userId', params.userId);
      if (params?.limit) searchParams.append('limit', params.limit.toString());

      const response = await this.makePublicRequest<any>(
        `/api/recommendations/last-viewed?${searchParams.toString()}`,
        {},
        `display:last-viewed-recommendations:${params.sessionId || params.userId || 'anonymous'}`,
        this.PERSONALIZED_TTL // 1 minute for personalized recommendations
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get last viewed recommendations:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get last viewed recommendations:', error);
      return null;
    }
  }

  /**
   * Get product page recommendations
   * Public endpoint for product browsing
   */
  async getProductPageRecommendations(productId: string, limit?: number): Promise<any> {
    try {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const searchParams = new URLSearchParams();
      if (limit) searchParams.append('limit', limit.toString());

      const response = await this.makePublicRequest<any>(
        `/api/recommendations/for-product-page/${productId}?${searchParams.toString()}`,
        {},
        `product-page-recommendations-${productId}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get product page recommendations:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get product page recommendations:', error);
      return null;
    }
  }

  /**
   * Get directory categories from materialized view
   * Public endpoint for directory browsing
   */
  async getDirectoryMVCategories(): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/mv/categories',
        {},
        'directory-mv-categories',
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get directory MV categories:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get directory MV categories:', error);
      return null;
    }
  }

  /**
   * Get directory categories
   * Public endpoint for directory browsing
   */
  async getDirectoryCategories(): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/categories',
        {},
        'directory-categories',
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get directory categories:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get directory categories:', error);
      return null;
    }
  }

  /**
   * Get stores by category slug
   * Public endpoint for directory browsing
   */
  async getStoresByCategory(categorySlug: string): Promise<any> {
    try {
      if (!categorySlug) {
        throw new Error('Category slug is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/mv/categories/${categorySlug}`,
        {},
        `stores-by-category-${categorySlug}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get stores by category:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get stores by category:', error);
      return null;
    }
  }

  /**
   * Search directory by category
   * Public endpoint for directory browsing
   */
  async searchByCategory(category: string, page?: number, limit?: number): Promise<any> {
    try {
      if (!category) {
        throw new Error('Category is required');
      }

      const searchParams = new URLSearchParams();
      searchParams.append('category', encodeURIComponent(category));
      if (page) searchParams.append('page', page.toString());
      if (limit) searchParams.append('limit', limit.toString());

      const response = await this.makePublicRequest<any>(
        `/api/directory/search?${searchParams.toString()}`,
        {},
        `search-by-category-${category}-${page || 1}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to search by category:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to search by category:', error);
      return null;
    }
  }

  /**
   * Search directory by location (city and state)
   * Public endpoint for directory browsing
   */
  async searchByLocation(city: string, state: string, page?: number, limit?: number): Promise<any> {
    try {
      if (!city || !state) {
        throw new Error('City and state are required');
      }

      const searchParams = new URLSearchParams();
      searchParams.append('city', encodeURIComponent(city));
      searchParams.append('state', encodeURIComponent(state));
      if (page) searchParams.append('page', page.toString());
      if (limit) searchParams.append('limit', limit.toString());

      const response = await this.makePublicRequest<any>(
        `/api/directory/search?${searchParams.toString()}`,
        {},
        `search-by-location-${city}-${state}-${page || 1}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to search by location:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to search by location:', error);
      return null;
    }
  }

  /**
   * Get directory locations
   * Public endpoint for directory browsing
   */
  async getLocations(): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/directory/locations',
        {},
        'directory-locations',
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get directory locations:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get directory locations:', error);
      return null;
    }
  }

  /**
   * Get tenant directory slug
   * Public endpoint for directory tenant lookup
   */
  async getTenantDirectorySlug(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/tenant/${tenantId}`,
        {},
        `tenant-directory-slug-${tenantId}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get tenant directory slug:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get tenant directory slug:', error);
      return null;
    }
  }

  /**
   * Search directory categories
   * Public endpoint for category search
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
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to search categories:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to search categories:', error);
      return null;
    }
  }

  /**
   * Search directory stores with comprehensive filtering
   * Public endpoint for directory store search
   */
  async searchDirectoryStores(params: {
    search?: string;
    category?: string;
    lat?: number;
    lng?: number;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
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

      const response = await this.makePublicRequest<any>(
        `/api/directory/mv/search?${searchParams.toString()}`,
        {},
        `search-directory-stores-${JSON.stringify(params)}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to search directory stores:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to search directory stores:', error);
      return null;
    }
  }

  /**
   * Get featured stores with location filtering
   * Public endpoint for featured stores
   */
  async getFeaturedStores(params: {
    limit?: number;
    location?: {
      lat: number;
      lng: number;
    };
  }): Promise<any> {
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
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get featured stores:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get featured stores:', error);
      return null;
    }
  }

  /**
   * Get consolidated directory data for a slug
   * Public endpoint for directory page consolidation
   */
  async getDirectoryConsolidated(slug: string): Promise<any> {
    try {
      if (!slug) {
        throw new Error('Slug is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/directory/consolidated/${slug}`,
        {},
        `directory-consolidated-${slug}`,
        this.cacheTTL
      );

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get directory consolidated:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get directory consolidated:', error);
      return null;
    }
  }
}

// Export singleton instance
export const recommendationsService = RecommendationsSingletonService.getInstance();
