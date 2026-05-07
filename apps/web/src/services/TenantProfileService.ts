/**
 * Tenant Profile Service
 * 
 * Handles tenant profile operations including geocoding
 * Uses TenantApiSingleton for authenticated operations
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface GeocodeRequest {
  address: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export interface TenantProfile {
  id: string;
  business_name?: string;
  business_description?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone_number?: string;
  website?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
}

class TenantProfileService extends TenantApiSingleton {
  private static instance: TenantProfileService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-profile-service*',
      'tenant-geocoding*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-profile-service*');
    await this.invalidateCachePattern('tenant-geocoding*');
  }

  private constructor() {
    super('tenant-profile-service', {
      ttl: 5 * 60 * 1000 // 5 minutes for profile data
    });
  }

  public static getInstance(): TenantProfileService {
    if (!TenantProfileService.instance) {
      TenantProfileService.instance = new TenantProfileService();
    }
    return TenantProfileService.instance;
  }

  /**
   * Geocode an address to get coordinates
   * Uses the /api/tenant/profile/geocode endpoint
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (!address) {
      console.error('[TenantProfileService] geocodeAddress: address is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<GeocodeResult>(
        '/api/tenant/profile/geocode',
        {
          method: 'POST',
          body: JSON.stringify({ address })
        },
        `geocode-${address.slice(0, 50)}` // Use partial address for cache key
      );

      if (!result.success) {
        console.error('[TenantProfileService] Failed to geocode address:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantProfileService] Failed to geocode address:', error);
      return null;
    }
  }

  /**
   * Get tenant profile
   * Uses the /api/tenant/profile endpoint
   */
  async getTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    if (!tenantId) {
      console.error('[TenantProfileService] getTenantProfile: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<TenantProfile>(
        `/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`,
        {},
        `tenant-profile-${tenantId}`
      );

      if (!result.success) {
        console.error('[TenantProfileService] Failed to get tenant profile:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantProfileService] Failed to get tenant profile:', error);
      return null;
    }
  }

  /**
   * Update tenant profile
   * Uses the /api/tenant/profile endpoint
   */
  async updateTenantProfile(tenantId: string, profileData: Partial<TenantProfile>): Promise<TenantProfile | null> {
    if (!tenantId) {
      console.error('[TenantProfileService] updateTenantProfile: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<TenantProfile>(
        '/api/tenant/profile',
        {
          method: 'PATCH',
          body: JSON.stringify(profileData)
        },
        `tenant-profile-${tenantId}`
      );

      if (!result.success) {
        console.error('[TenantProfileService] Failed to update tenant profile:', result.error);
        return null;
      }

      // Invalidate cache after update
      this.invalidateCache(`tenant-profile-${tenantId}`);

      return result.data || null;
    } catch (error) {
      console.error('[TenantProfileService] Failed to update tenant profile:', error);
      return null;
    }
  }
}

// Export singleton instance
export const tenantProfileService = TenantProfileService.getInstance();
