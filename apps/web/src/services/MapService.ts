/**
 * Map Service - Specialized service for map-related operations
 * 
 * Extends PublicApiSingleton with map-specific functionality:
 * - Automatic caching for location data
 * - Cache invalidation on profile updates
 * - Map-specific metrics tracking
 * - Privacy mode handling
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface MapLocation {
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  displayMap: boolean;
  privacyMode: 'precise' | 'neighborhood';
}

export interface TenantProfile {
  business_name: string;
  latitude: number;
  longitude: number;
  map_privacy_mode: 'precise' | 'neighborhood';
  display_map: boolean;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
}

/**
 * Map Service - Specialized singleton for map operations
 */
class MapService extends PublicApiSingleton {

  protected defaultContext: AppContext = AppContext.DIRECTORY;
  protected defaultIsolation: CacheIsolation = CacheIsolation.DIRECTORY;
  private static instance: MapService;
  
  private constructor() {
    super('map-service');
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes for location data
  }

  static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }

  /**
   * Get tenant map location with automatic caching
   */
  async getTenantMapLocation(tenantId: string): Promise<MapLocation | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // SAFER: Use super.makeDefaultRequest to ensure we call FlexibleApiSingleton implementation
      const response = await super.makeDefaultRequest<TenantProfile>(
        `/public/tenant/${tenantId}/profile`,
        {},
        `tenant-profile-${tenantId}`
      );

      if (!response.success || !response.data) {
        console.warn('[MapService] Failed to get tenant profile:', response.error);
        return null;
      }

      const profile = response.data;

      // Return null if map is disabled
      if (!profile.display_map) {
        return null;
      }

      // Return null if coordinates are missing
      if (!profile.latitude || !profile.longitude) {
        return null;
      }

      // Transform API response to MapLocation format
      return {
        businessName: profile.business_name || '',
        addressLine1: profile.address_line_1 || '',
        addressLine2: profile.address_line_2 || '',
        city: profile.city || '',
        state: profile.state || '',
        postalCode: profile.postal_code || '',
        countryCode: profile.country_code || '',
        latitude: profile.latitude,
        longitude: profile.longitude,
        displayMap: profile.display_map,
        privacyMode: (profile.map_privacy_mode as 'precise' | 'neighborhood') || 'precise',
      };
    } catch (error) {
      console.error('[MapService] Failed to get tenant map location:', error);
      return null;
    }
  }

  /**
   * Get multiple tenant map locations (for directory pages)
   */
  async getMultipleTenantMapLocations(tenantIds: string[]): Promise<Map<string, MapLocation>> {
    const locations = new Map<string, MapLocation>();
    
    // Use Promise.all for parallel requests
    const promises = tenantIds.map(async (tenantId) => {
      const location = await this.getTenantMapLocation(tenantId);
      return { tenantId, location };
    });

    const results = await Promise.all(promises);
    
    results.forEach(({ tenantId, location }) => {
      if (location) {
        locations.set(tenantId, location);
      }
    });

    return locations;
  }

  /**
   * Invalidate map cache for a tenant (call when profile is updated)
   */
  async invalidateTenantMapCache(tenantId: string): Promise<void> {
    try {
      await this.clearCache(`tenant-profile-${tenantId}`);
      console.log(`[MapService] Invalidated map cache for tenant: ${tenantId}`);
    } catch (error) {
      console.warn(`[MapService] Failed to invalidate map cache for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Apply privacy mode to coordinates
   */
  applyPrivacyMode(location: MapLocation): MapLocation {
    if (location.privacyMode === 'neighborhood' && location.latitude && location.longitude) {
      // Add random offset for neighborhood privacy (approximately 1-2km radius)
      const latOffset = (Math.random() - 0.5) * 0.02; // ~1km latitude
      const lngOffset = (Math.random() - 0.5) * 0.02; // ~1km longitude
      
      return {
        ...location,
        latitude: location.latitude + latOffset,
        longitude: location.longitude + lngOffset,
      };
    }
    
    return location;
  }

  /**
   * Get map-specific metrics
   */
  getMapMetrics() {
    const baseMetrics = this.getMetrics();
    return {
      ...baseMetrics,
      serviceType: 'map-service',
      cacheTTL: this.cacheTTL,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const mapService = MapService.getInstance();

export default MapService;
