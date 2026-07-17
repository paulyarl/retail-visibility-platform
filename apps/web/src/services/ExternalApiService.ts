import { ExternalApiSingleton } from '@/providers/base/ExternalApiSingleton';
import { RequestTarget, RequestType, ExternalRequestOptions, ExternalApiResponse } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface GeolocationResponse {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset?: string;
  org?: string;
  asn?: string;
}

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
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    suburb?: string;
    district?: string;
    road?: string;
    house_number?: string;
  };
}

class ExternalApiService extends ExternalApiSingleton {
  private static instance: ExternalApiService;

  protected defaultRequestType = RequestType.EXTERNAL;
  protected defaultRequestTarget = RequestTarget.EXTERNAL;
  protected defaultContext = AppContext.SYSTEM;
  protected defaultIsolation = CacheIsolation.SYSTEM;

  private constructor() {
    super('external-api-service');
  }

  public static getInstance(): ExternalApiService {
    if (!ExternalApiService.instance) {
      ExternalApiService.instance = new ExternalApiService();
    }
    return ExternalApiService.instance;
  }

  /**
   * Get IP geolocation information
   * Uses ip-api.com service (free, CORS-friendly)
   */
  async getIpGeolocation(cacheKey?: string): Promise<GeolocationResponse | null> {
    try {
      const response = await this.makeExternalRequest<any>(
        'http://ip-api.com/json/',
        {
          signal: AbortSignal.timeout(5000) // 5 seconds timeout
        },
        {
          cacheKey: cacheKey || 'ip-geolocation',
          ttl: 5 * 60 * 1000 // 5 minutes cache
        }
      );

      // Transform ip-api.com response to match our interface
      const data = response.data;
      if (data) {
        return {
          ip: data.query || data.ip,
          city: data.city,
          region: data.regionName || data.region,
          country: data.country,
          country_name: data.country,
          postal: data.zip,
          latitude: data.lat,
          longitude: data.lon,
          timezone: data.timezone,
          utc_offset: data.timezone ? `UTC${data.timezone}` : undefined,
          org: data.org,
          asn: data.as
        };
      }

      return null;
    } catch (error) {
      console.log('[ExternalApiService] Failed to get IP geolocation:', error);
      return null;
    }
  }

  /**
   * Reverse geocoding to get address from coordinates
   * Uses OpenStreetMap Nominatim service with PUBLIC context for behavior tracking
   */
  async reverseGeocode(latitude: number, longitude: number, options?: {
    usePublicContext?: boolean;
    cacheKey?: string;
  }): Promise<ReverseGeocodingResponse | null> {
    try {
      // If usePublicContext is true, use makePublicRequest for proper public flow
      if (options?.usePublicContext) {
        const result = await this.makeDefaultRequest<ReverseGeocodingResponse>(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          {
            method: 'GET',
            // Don't set User-Agent - it's a forbidden header in browser CORS requests
            signal: AbortSignal.timeout(10000) // 10 seconds timeout
          },
          options.cacheKey || `geocode-${latitude}-${longitude}`, // Cache key
          60 * 60 * 1000, // 1 hour cache
          {
            context: AppContext.PUBLIC,
            isolation: CacheIsolation.PUBLIC
          }
        );
        
        return result.data || null;
      }
      
      // Original implementation for server-side calls
      const response = await this.makeDefaultRequest<ReverseGeocodingResponse>(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          signal: AbortSignal.timeout(10000) // 10 seconds timeout
        },
        `reverse-geocode-${latitude}-${longitude}`,
        60 * 60 * 1000, // 1 hour cache
        {
          context: AppContext.PUBLIC,
          isolation: CacheIsolation.PUBLIC
        }
      );

      return response.data || null;
    } catch (error) {
      clientLogger.error('[ExternalApiService] Failed to reverse geocode:', { detail: error });
      return null;
    }
  }

  /**
   * Get weather information
   * Uses OpenWeatherMap API (requires API key)
   */
  async getWeather(latitude: number, longitude: number, apiKey: string): Promise<any | null> {
    try {
      const response = await this.makeExternalRequest<any>(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`,
        {
          signal: AbortSignal.timeout(10000)
        },
        {
          cacheKey: `weather-${latitude}-${longitude}`,
          ttl: 10 * 60 * 1000 // 10 minutes cache
        }
      );

      return response.data || null;
    } catch (error) {
      clientLogger.error('[ExternalApiService] Failed to get weather:', { detail: error });
      return null;
    }
  }

  /**
   * Get timezone information
   * Uses timezoneapi.io service
   */
  async getTimezone(latitude: number, longitude: number): Promise<any | null> {
    try {
      const response = await this.makeExternalRequest<any>(
        `https://timezoneapi.io/api/timezone?latitude=${latitude}&longitude=${longitude}`,
        {
          signal: AbortSignal.timeout(10000)
        },
        {
          cacheKey: `timezone-${latitude}-${longitude}`,
          ttl: 24 * 60 * 60 * 1000 // 24 hours cache
        }
      );

      return response.data || null;
    } catch (error) {
      clientLogger.error('[ExternalApiService] Failed to get timezone:', { detail: error });
      return null;
    }
  }

  /**
   * Geocode address using Google Maps API
   * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable
   */
  async geocodeAddress(address: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country_code: string;
  }): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        clientLogger.error('[ExternalApiService] Google Maps API key not found');
        return null;
      }

      const fullAddress = [
        address.address_line1,
        address.address_line2,
        address.city,
        address.state,
        address.postal_code,
        address.country_code,
      ]
        .filter(Boolean)
        .join(', ');

      const response = await this.makeExternalRequest<any>(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`,
        {
          signal: AbortSignal.timeout(10000)
        },
        {
          cacheKey: `geocode-${encodeURIComponent(fullAddress)}`,
          ttl: 7 * 24 * 60 * 60 * 1000 // 7 days cache
        }
      );

      if (response.data?.status === 'OK' && response.data?.results?.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng,
        };
      }

      return null;
    } catch (error) {
      clientLogger.error('[ExternalApiService] Failed to geocode address:', { detail: error });
      return null;
    }
  }

  /**
   * Get timezone from coordinates
   * Uses coordinate-based approximation with caching
   */
  async getTimezoneFromCoordinates(latitude: number, longitude: number): Promise<string | null> {
    try {
      // Round coordinates to 2 decimal places for caching (approximately 1km precision)
      const roundedLat = Math.round(latitude * 100) / 100;
      const roundedLng = Math.round(longitude * 100) / 100;
      const cacheKey = `timezone-${roundedLat}-${roundedLng}`;
      
      // Check cache first
      const cached = await this.getFromCache<string>(cacheKey);
      if (cached) {
        console.log('[ExternalApiService] Using cached timezone:', cached, { roundedLat, roundedLng });
        return cached;
      }
      
      // Calculate timezone from coordinates
      const timezone = this.approximateTimezoneFromCoordinates(latitude, longitude);
      if (timezone) {
        // Cache for 24 hours (timezone rarely changes)
        await this.setCache(cacheKey, timezone, { ttl: 24 * 60 * 60 * 1000 });
        console.log('[ExternalApiService] Calculated and cached timezone:', timezone, { roundedLat, roundedLng });
        return timezone;
      }
      
      return null;
    } catch (error) {
      clientLogger.error('[ExternalApiService] Failed to get timezone from coordinates:', { detail: error });
      return null;
    }
  }

  /**
   * Approximate timezone from coordinates using longitude ranges
   * This provides a reasonable approximation for most locations
   */
  private approximateTimezoneFromCoordinates(latitude: number, longitude: number): string | null {
    // North America timezones (rough boundaries)
    if (latitude >= 25 && latitude <= 70) {
      if (longitude >= -180 && longitude < -130) return 'America/Anchorage'; // Alaska
      if (longitude >= -130 && longitude < -115) return 'America/Los_Angeles'; // Pacific
      if (longitude >= -115 && longitude < -105) return 'America/Denver'; // Mountain
      if (longitude >= -105 && longitude < -90) return 'America/Chicago'; // Central
      if (longitude >= -90 && longitude < -75) return 'America/New_York'; // Eastern
      if (longitude >= -75 && longitude < -65) return 'America/New_York'; // Eastern extended
    }
    
    // Hawaii
    if (latitude >= 18 && latitude <= 23 && longitude >= -161 && longitude <= -154) {
      return 'Pacific/Honolulu';
    }
    
    // Arizona (doesn't observe DST, stays on MST)
    if (latitude >= 31 && latitude <= 37 && longitude >= -115 && longitude <= -109) {
      return 'America/Phoenix';
    }
    
    // Europe (rough approximation)
    if (latitude >= 35 && latitude <= 70 && longitude >= -10 && longitude <= 40) {
      if (longitude < 0) return 'Europe/London';
      if (longitude < 10) return 'Europe/Paris';
      if (longitude < 20) return 'Europe/Berlin';
      return 'Europe/Madrid';
    }
    
    // Asia (rough approximation)
    if (latitude >= 0 && latitude <= 50 && longitude >= 100 && longitude <= 150) {
      if (longitude < 120) return 'Asia/Hong_Kong';
      if (longitude < 135) return 'Asia/Tokyo';
      return 'Asia/Tokyo';
    }
    
    // Australia (rough approximation)
    if (latitude >= -45 && latitude <= -10 && longitude >= 110 && longitude <= 155) {
      return 'Australia/Sydney';
    }
    
    // Singapore
    if (latitude >= 1 && latitude <= 1.5 && longitude >= 103.5 && longitude <= 104.5) {
      return 'Asia/Singapore';
    }
    
    // Default to UTC if no match
    return 'UTC';
  }

  /**
   * Generic external API request
   * For any other external API not covered by specific methods
   */
  async request<T>(
    url: string,
    options: ExternalRequestOptions = {}
  ): Promise<ExternalApiResponse<T>> {
    return this.makeExternalRequest<T>(url, options, options);
  }

  /**
   * Batch multiple external API requests
   * Useful for loading multiple external data points in parallel
   */
  async batchRequest<T>(
    requests: Array<{ url: string; options?: ExternalRequestOptions }>
  ): Promise<Array<ExternalApiResponse<T>>> {
    const promises = requests.map(({ url, options }) => 
      this.makeExternalRequest<T>(url, options, options)
    );

    return Promise.allSettled(promises).then(results => 
      results.map(result => 
        result.status === 'fulfilled' ? result.value : { 
          success: false, 
          error: {
            status: 500,
            message: 'Request failed',
            code: 'BATCH_REQUEST_ERROR'
          },
          status: 500,
          data: undefined
        } as ExternalApiResponse<T>
      )
    );
  }

  /**
   * Override health check for external services
   * Tests connectivity to common external services
   */
  async healthCheck(services: Array<{ name: string; url: string; timeout?: number }>): Promise<{
    results: { [key: string]: boolean };
    timestamp: string;
  }> {
    // Default services if not provided
    const defaultServices = [
      { name: 'ipapi', url: 'http://ip-api.com/json/', timeout: 3000 },
      { name: 'nominatim', url: 'https://nominatim.openstreetmap.org/search?format=json&q=test', timeout: 5000 }
    ];
    
    const servicesToCheck = services.length > 0 ? services : defaultServices;
    
    // Perform health check directly
    const results = await Promise.allSettled(
      servicesToCheck.map(service => 
        this.makeExternalRequest(service.url, { signal: AbortSignal.timeout(service.timeout || 5000) })
          .catch(() => null)
      )
    );

    // Build results object
    const healthResults: Record<string, boolean> = {};
    results.forEach((result, index) => {
      const serviceName = servicesToCheck[index].name;
      if (result.status === 'fulfilled' && result.value !== null && 'data' in result.value) {
        healthResults[serviceName] = !!result.value.data;
      } else {
        healthResults[serviceName] = false;
      }
    });

    return {
      results: healthResults,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Convenience health check method for default services
   */
  async healthCheckDefault(): Promise<{
    ipapi: boolean;
    nominatim: boolean;
    timestamp: string;
  }> {
    const results = await this.healthCheck([]);
    
    return {
      ipapi: results.results.ipapi || false,
      nominatim: results.results.nominatim || false,
      timestamp: results.timestamp
    };
  }

  /**
   * Fetch an image from URL and return as Blob
   * Used for downloading external images (e.g., pasted URLs in galleries)
   */
  async fetchImageAsBlob(url: string): Promise<Blob | null> {
    try {
      const response = await this.makeExternalRequest<Blob>(url, {
        signal: AbortSignal.timeout(30000) // 30 seconds for images
      }, {
        cacheKey: `image-${url.substring(0, 100)}`,
        ttl: 60 * 60 * 1000 // 1 hour cache
      });

      return response.data || null;
    } catch (error) {
      clientLogger.error('[ExternalApiService] Failed to fetch image:', { detail: error });
      return null;
    }
  }

  /**
   * Clear external API cache
   * Note: Cache clearing would need to be implemented in the base class
   * For now, we'll just log the intent
   */
  async clearCache(pattern?: string): Promise<void> {
    console.log(`[ExternalApiService] Cache clear requested for pattern: ${pattern || 'all'}`);
  }
}

// Export the singleton instance
export const externalApiService = ExternalApiService.getInstance();
