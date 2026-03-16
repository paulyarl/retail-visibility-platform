/**
 * Recommendations Singleton Service
 * 
 * Extends ApiSystemSingleton to provide cached recommendations operations
 * Uses the platform's system singleton architecture for automatic authentication and caching
 */

import { ApiSystemSingleton } from '@/providers/base/ApiSystemSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

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

class RecommendationsSingletonService extends ApiSystemSingleton {

  protected defaultContext: AppContext = AppContext.DIRECTORY;
  protected defaultIsolation: CacheIsolation = CacheIsolation.DIRECTORY;
  private static instance: RecommendationsSingletonService;

  // Different TTL for different recommendation types
  private readonly PERSONALIZED_TTL = 1 * 60 * 1000; // 1 minute for personalized
  private readonly STATIC_TTL = 30 * 60 * 1000; // 30 minutes for static
  private readonly SEMI_STATIC_TTL = 10 * 60 * 1000; // 10 minutes for semi-static

  private constructor() {
    super('recommendations-singleton', {
      enableCache: true,
      enableEncryption: true, // Enable encryption for recommendation data
      enablePrivateCache: true,
      authenticationLevel: 'public', // Public recommendations
      defaultTTL: 15 * 60 * 1000, // 15 minutes default
      enableMetrics: true,
      enableLogging: false
    });
  }

  public static getInstance(): RecommendationsSingletonService {
    if (!RecommendationsSingletonService.instance) {
      RecommendationsSingletonService.instance = new RecommendationsSingletonService();
    }
    return RecommendationsSingletonService.instance;
  }

  // Helper method to convert old cache format to new format
  private getCacheOptions(cacheKey: string, ttl?: number) {
    return {
      cacheKey,
      ttl: ttl || 15 * 60 * 1000 // 15 minutes default TTL
    };
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

      const result = await this.makeSystemRequest<{
        recommendations: RecommendationGroup[];
      }>(
        `/api/recommendations/for-storefront/${tenantId}?${searchParams.toString()}`,
        {},
        {
          cacheKey: `storefront-recommendations-${tenantId}`,
          ttl: this.SEMI_STATIC_TTL
        }
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
      const result = await this.makeSystemRequest<{
        recommendations: RecommendationGroup[];
      }>(
        '/api/recommendations/for-storefront',
        {},
        {
          cacheKey: 'all-storefront-recommendations',
          ttl: this.STATIC_TTL
        }
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
   * Get directory recommendations
   * Public endpoint for directory browsing
   */
  async getDirectoryRecommendations(): Promise<any> {
    try {
      const response = await this.makeSystemRequest<any>(
        '/api/recommendations/for-directory',
        {},
        {
          cacheKey: 'directory-recommendations',
          ttl: this.SEMI_STATIC_TTL
        }
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
      const response = await this.makeDefaultRequest<any>(
        '/api/directory/categories-enhanced',
        {},
        'directory-categories-enhanced',
        this.STATIC_TTL
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
      const response = await this.makeDefaultRequest<any>(
        '/api/directory/categories-optimized/counts-by-name',
        {},
        'directory-categories-counts',
        this.STATIC_TTL
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
      const response = await this.makeDefaultRequest<any>(
        '/api/directory/store-types',
        {},
        'directory-store-types',
        this.STATIC_TTL
      );
      
      // console.log('[RecommendationsSingleton] before check response.data?.data?.storeTypes store types:', response.data?.data?.storeTypes);
      // console.log('[RecommendationsSingleton] before chedk response.data?.storeTypes store types:', response.data?.storeTypes);

      if (!response.success) {
        console.error('[RecommendationsSingleton] Failed to get store types:', response.error);
        return null;
      }

      // API returns: { success: true, data: { storeTypes: [...] } }
      // makeDefaultRequest wraps this, so we need response.data.data.storeTypes
      // console.log('[RecommendationsSingleton] response.data?.data?.storeTypes store types:', response.data?.data?.storeTypes);
      // console.log('[RecommendationsSingleton] response.data?.storeTypes store types:', response.data?.storeTypes);
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
      const response = await this.makeDefaultRequest<any>(
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
      const response = await this.makeDefaultRequest<any>(
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
      const response = await this.makeDefaultRequest<any>(
        `/api/directory/store-types/${storeTypeSlug}/stores`,
        {},
        `stores-by-store-type-${storeTypeSlug}`,
        this.STATIC_TTL
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
      // Transform camelCase to snake_case for API compatibility
      const transformedTrackData = {
        entity_type: trackData.entityType,
        entity_id: trackData.entityId,
        entity_name: trackData.entityName || null,
        context: trackData.context,
        page_type: trackData.pageType,
        duration_seconds: trackData.durationSeconds || null,
        session_id: trackData.sessionId,
        timestamp: trackData.timestamp,
        priority: trackData.priority || 'normal',
        location_lat: trackData.locationLat || null,
        location_lng: trackData.locationLng || null
      };

      // Debug logging for single tracking
      // console.log('[RecommendationsSingleton] === SINGLE TRACK DEBUG ===');
      // console.log('[RecommendationsSingleton] Original track data:', JSON.stringify(trackData, null, 2));
      // console.log('[RecommendationsSingleton] Transformed track data:', JSON.stringify(transformedTrackData, null, 2));
      // console.log('[RecommendationsSingleton] === END SINGLE DEBUG ===');

      await this.makeSystemRequest<void>(
        '/api/recommendations/track',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transformedTrackData)
        },
        {
          cacheKey: 'recommendations-track',
          ttl: 0 // No caching for tracking
        }
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

      const response = await this.makeDefaultRequest<any>(
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

      const response = await this.makeDefaultRequest<any>(
        `/api/recommendations/for-product-page/${productId}?${searchParams.toString()}`,
        {},
        `product-page-recommendations-${productId}`,
        this.STATIC_TTL
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
      const response = await this.makeDefaultRequest<any>(
        '/api/directory/mv/categories',
        {},
        'directory-mv-categories',
        this.STATIC_TTL
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
      const response = await this.makeDefaultRequest<any>(
        '/api/directory/categories',
        {},
        'directory-categories',
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/mv/categories/${categorySlug}`,
        {},
        `stores-by-category-${categorySlug}`,
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/search?${searchParams.toString()}`,
        {},
        `search-by-category-${category}-${page || 1}`,
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/search?${searchParams.toString()}`,
        {},
        `search-by-location-${city}-${state}-${page || 1}`,
        this.STATIC_TTL
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
      const response = await this.makeDefaultRequest<any>(
        '/api/directory/locations',
        {},
        'directory-locations',
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/tenant/${tenantId}`,
        {},
        `tenant-directory-slug-${tenantId}`,
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/categories/search?q=${encodeURIComponent(query)}`,
        {},
        `search-categories-${query}`,
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/mv/search?${searchParams.toString()}`,
        {},
        `search-directory-stores-${JSON.stringify(params)}`,
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/featured-stores?${searchParams.toString()}`,
        {},
        `featured-stores-${JSON.stringify(params)}`,
        this.STATIC_TTL
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

      const response = await this.makeDefaultRequest<any>(
        `/api/directory/consolidated/${slug}`,
        {},
        `directory-consolidated-${slug}`,
        this.STATIC_TTL
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

  /**
   * Track behavior events in batch
   * Uses the /api/recommendations/track-batch endpoint for analytics
   */
  async trackBehaviorBatch(batchData: {
    events: any[];
    batchMetadata?: any;
  }): Promise<void> {
    try {
      // Transform camelCase to snake_case for API compatibility
      const transformedBatchData = {
        events: batchData.events.map(event => ({
          entity_type: event.entityType,
          entity_id: event.entityId,
          entity_name: event.entityName || null, // Convert empty string to null
          context: event.context,
          page_type: event.pageType,
          duration_seconds: event.durationSeconds || null,
          session_id: event.sessionId,
          timestamp: event.timestamp,
          priority: event.priority || 'normal',
          location_lat: event.locationLat || null,
          location_lng: event.locationLng || null
        })).filter(event => {
          // Filter out events that don't have required fields
          return event.entity_id && event.entity_type && event.session_id;
        }),
        batch_metadata: batchData.batchMetadata
      };

      // Don't send empty batch
      if (transformedBatchData.events.length === 0) {
        console.log('[RecommendationsSingleton] No valid events to track');
        return;
      }

      // Detailed logging for debugging
      // console.log('[RecommendationsSingleton] === TRACKING DEBUG ===');
      // console.log('[RecommendationsSingleton] Original batch data:', JSON.stringify(batchData, null, 2));
      // console.log('[RecommendationsSingleton] Transformed batch data:', JSON.stringify(transformedBatchData, null, 2));
      // console.log('[RecommendationsSingleton] Events count:', transformedBatchData.events.length);
      // console.log('[RecommendationsSingleton] First event sample:', transformedBatchData.events[0]);
      // console.log('[RecommendationsSingleton] Request URL:', '/api/recommendations/track-batch');
      // console.log('[RecommendationsSingleton] Request method:', 'POST');
      // console.log('[RecommendationsSingleton] Request headers:', { 'Content-Type': 'application/json' });
      // console.log('[RecommendationsSingleton] === END DEBUG ===');

      const response = await this.makeSystemRequest<void>(
        '/api/recommendations/track-batch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transformedBatchData)
        },
        {
          cacheKey: 'recommendations-track',
          ttl: 0 // No caching for tracking
        }
      );
      
      // console.log('[RecommendationsSingleton] === RESPONSE DEBUG ===');
      // console.log('[RecommendationsSingleton] Response success:', response.success);
      // console.log('[RecommendationsSingleton] Response data:', response.data);
      // console.log('[RecommendationsSingleton] Response error:', response.error);
      // console.log('[RecommendationsSingleton] Response status:', response.status);
      // console.log('[RecommendationsSingleton] === END RESPONSE DEBUG ===');
      
      if (!response.success) {
        console.log('[RecommendationsSingleton] Failed to track behavior batch:', response.error);
        const errorMessage = typeof response.error === 'string' ? response.error : 
                           (response.error?.message) || 'Tracking failed';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to track behavior batch:', error);
      throw error;
    }
  }

  /**
   * Send tracking data on page unload using beacon API
   * For reliable delivery when page is closing
   * Uses platform-aligned URL construction and base class beacon method
   */
  sendUnloadTrackingBeacon(events: any[]): void {
    // Transform events to snake_case format for API compatibility
    const transformedEvents = events.map(event => ({
      entity_type: event.entityType,
      entity_id: event.entityId,
      entity_name: event.entityName || null,
      context: event.context,
      page_type: event.pageType,
      duration_seconds: event.durationSeconds || null,
      session_id: event.sessionId,
      timestamp: event.timestamp,
      priority: event.priority || 'normal',
      location_lat: event.locationLat || null,
      location_lng: event.locationLng || null,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      unload_tracking: true // Mark as unload tracking for analytics
    }));

    const data = {
      events: transformedEvents,
      batch_metadata: {
        unload_batch: true,
        client_timestamp: Date.now(),
        beacon_used: true
      }
    };

    // console.log('[RecommendationsSingleton] === BEACON DEBUG ===');
    // console.log('[RecommendationsSingleton] Beacon data:', JSON.stringify(data, null, 2));
    // console.log('[RecommendationsSingleton] Beacon URL:', '/api/recommendations/track-batch');
    // console.log('[RecommendationsSingleton] === END BEACON DEBUG ===');

    this.sendBeacon('/api/recommendations/track-batch', data);
  }
}

// Export singleton instance
export const recommendationsService = RecommendationsSingletonService.getInstance();
