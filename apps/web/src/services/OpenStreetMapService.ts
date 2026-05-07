import { ExternalApiSingleton } from '@/providers/base/ExternalApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface ReverseGeocodingResponse {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    country?: string;
    country_code?: string;
    state?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    road?: string;
    house_number?: string;
  };
}

/**
 * OpenStreetMap Service - Specialized for OSM Nominatim API
 * 
 * Extends ExternalApiService to provide focused geocoding functionality
 * with proper PUBLIC context for behavior tracking
 */
export class OpenStreetMapService extends ExternalApiSingleton {
  protected defaultContext?: AppContext | AppContext.PUBLIC;
  protected defaultIsolation?: CacheIsolation | CacheIsolation.PUBLIC;
  private static instance: OpenStreetMapService;

  private constructor() {
    super('openstreetmap');
  }

  public static getInstance(): OpenStreetMapService {
    if (!OpenStreetMapService.instance) {
      OpenStreetMapService.instance = new OpenStreetMapService();
    }
    return OpenStreetMapService.instance;
  }

  /**
   * Reverse geocoding to get address from coordinates
   * Always uses PUBLIC context to avoid CORS issues in tenant scope
   * 
   * @param latitude - Latitude coordinate
   * @param longitude - Longitude coordinate  
   * @param cacheKey - Optional custom cache key
   * @returns Promise<ReverseGeocodingResponse | null>
   */
  async reverseGeocode(
    latitude: number, 
    longitude: number, 
    cacheKey?: string
  ): Promise<ReverseGeocodingResponse | null> {
    try {
      // console.log('[OpenStreetMapService] Reverse geocoding with PUBLIC context:', { latitude, longitude });
      
      const result = await this.makeDefaultRequest<ReverseGeocodingResponse>(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {},
        cacheKey || `osm-geocode-${latitude}-${longitude}`, // Cache key
        60 * 60 * 1000, // 1 hour cache
        {
          context: AppContext.PUBLIC,
          isolation: CacheIsolation.PUBLIC,
          includeCredentials: false // Explicitly disable credentials for external API
        }
      );
      
      if (!result.success) {
        console.error('[OpenStreetMapService] API error:', result.error);
        return null;
      }
      
      return result.data || null;
    } catch (error) {
      console.error('[OpenStreetMapService] Failed to reverse geocode:', error);
      return null;
    }
  }

  /**
   * Forward geocoding to get coordinates from address
   * Uses PUBLIC context for consistency
   * 
   * @param address - Address to geocode
   * @param cacheKey - Optional custom cache key
   * @returns Promise<any | null>
   */
  async forwardGeocode(address: string, cacheKey?: string): Promise<any | null> {
    try {
      // console.log('[OpenStreetMapService] Forward geocoding with PUBLIC context:', { address });
      
      const result = await this.makeDefaultRequest<any>(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1`,
        {},
        cacheKey || `osm-search-${encodeURIComponent(address)}`, // Cache key
        60 * 60 * 1000, // 1 hour cache
        {
          context: AppContext.PUBLIC,
          isolation: CacheIsolation.PUBLIC,
          includeCredentials: false // Explicitly disable credentials for external API
        }
      );
      
      if (!result.success) {
        console.error('[OpenStreetMapService] Search API error:', result.error);
        return null;
      }
      
      return result.data || null;
    } catch (error) {
      console.error('[OpenStreetMapService] Failed to forward geocode:', error);
      return null;
    }
  }

  /**
   * Extract city and state from geocoding response
   * Helper method for behavior tracking
   * 
   * @param geocodingData - Response from reverseGeocode
   * @returns Object with city and state
   */
  extractLocationData(geocodingData: ReverseGeocodingResponse | null): {
    city: string;
    state: string;
    country?: string;
  } {
    if (!geocodingData || !geocodingData.address) {
      return { city: 'Unknown', state: 'Unknown' };
    }

    const address = geocodingData.address;
    const city = address.city || address.town || address.village || 'Unknown';
    const state = address.state || 'Unknown';
    const country = address.country;

    return { city, state, country };
  }
}

// Export singleton instance
export const openStreetMapService = OpenStreetMapService.getInstance();
