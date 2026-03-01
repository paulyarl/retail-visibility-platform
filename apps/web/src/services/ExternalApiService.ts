import { ExternalApiSingleton } from '@/providers/base/ExternalApiSingleton';
import { RequestTarget, RequestType, ExternalRequestOptions, ExternalApiResponse } from '@/providers/base/FlexibleApiSingleton';

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
   * Uses ipapi.co service
   */
  async getIpGeolocation(cacheKey?: string): Promise<GeolocationResponse | null> {
    try {
      const response = await this.makeExternalRequest<GeolocationResponse>(
        'https://ipapi.co/json/',
        {
          signal: AbortSignal.timeout(5000) // 5 seconds timeout
        },
        {
          cacheKey: cacheKey || 'ip-geolocation',
          ttl: 5 * 60 * 1000 // 5 minutes cache
        }
      );

      return response.data || null;
    } catch (error) {
      console.error('[ExternalApiService] Failed to get IP geolocation:', error);
      return null;
    }
  }

  /**
   * Reverse geocoding to get address from coordinates
   * Uses OpenStreetMap Nominatim service
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResponse | null> {
    try {
      const response = await this.makeExternalRequest<ReverseGeocodingResponse>(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          signal: AbortSignal.timeout(10000) // 10 seconds timeout
        },
        {
          cacheKey: `reverse-geocode-${latitude}-${longitude}`,
          ttl: 60 * 60 * 1000 // 1 hour cache
        }
      );

      return response.data || null;
    } catch (error) {
      console.error('[ExternalApiService] Failed to reverse geocode:', error);
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
      console.error('[ExternalApiService] Failed to get weather:', error);
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
      console.error('[ExternalApiService] Failed to get timezone:', error);
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
        console.error('[ExternalApiService] Google Maps API key not found');
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
      console.error('[ExternalApiService] Failed to geocode address:', error);
      return null;
    }
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
      { name: 'ipapi', url: 'https://ipapi.co/json/', timeout: 3000 },
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
