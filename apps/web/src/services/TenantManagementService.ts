import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';
import { StoreStatus } from '@/hooks/useStoreStatus';

export interface TenantUsage {
  items: number;
  orders: number;
  storage: number;
  bandwidth: number;
  limits: {
    items: number;
    storage: number;
    bandwidth: number;
  };
}

export interface TenantLimits {
  items: number;
  storage: number;
  bandwidth: number;
  features: string[];
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
}

export interface TenantProfile {
  id: string;
  business_name: string;
  address_line1: string;
  city: string;
  postal_code: string;
  country_code: string;
  phone_number: string;
  email: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  business_description?: string;
  hours?: any;
  logo_url?: string;
  social_links?: any;
  seo_tags?: any;
  organizationId?: string;
  metadata?: any;
  // Additional fields for compatibility
  name?: string;
  slug?: string;
  domain?: string;
  logo?: string;
  banner?: string;
  description?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  contact?: {
    email: string;
    phone: string;
    website?: string;
  };
  settings?: {
    theme: string;
    currency: string;
    timezone: string;
  };
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  updatedAt: string;
}

/**
 * Tenant Management Service
 * Handles authenticated tenant operations with proper caching
 * Used for tenant management, settings, and administrative operations
 */
class TenantManagementService extends TenantApiSingleton {
  protected defaultContext: AppContext = AppContext.TENANT;
  protected defaultIsolation: CacheIsolation = CacheIsolation.TENANT;
  
  private static instance: TenantManagementService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-management-service*',
      'tenant-settings*',
      'tenant-operations*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-management-service*');
    await this.invalidateCachePattern('tenant-settings*');
    await this.invalidateCachePattern('tenant-operations*');
  }

  // Different TTL for different management operations
  private readonly PROFILE_TTL = 5 * 60 * 1000; // 5 minutes for profile
  private readonly USAGE_TTL = 2 * 60 * 1000; // 2 minutes for usage
  private readonly LIMITS_TTL = 10 * 60 * 1000; // 10 minutes for limits
  private readonly MEDIA_TTL = 30 * 60 * 1000; // 30 minutes for media

  protected constructor() {
    super('tenant-management-singleton');
  }

  public static getInstance(): TenantManagementService {
    if (!TenantManagementService.instance) {
      TenantManagementService.instance = new TenantManagementService();
    }
    return TenantManagementService.instance;
  }

  /**
   * Get current user's tenant profile
   * Uses the /api/tenant endpoint (authenticated)
   */
  async getCurrentTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    try {
      const response = await this.makeDefaultRequest<TenantProfile>(
        `/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`,
        {},
        `current-tenant-${tenantId}`,
        this.PROFILE_TTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get current tenant profile:', error);
      return null;
    }
  }

  /**
   * Get current tenant ID (base class method)
   * Uses the base class implementation for compatibility
   */
  getCurrentTenant(): string | undefined {
    return super.getCurrentTenant();
  }

  /**
   * Get tenant profile for management
   * Uses the /api/tenant/profile endpoint (authenticated)
   */
  async getTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    try {
      const response = await this.makeDefaultRequest<TenantProfile>(
        `/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`,
        {},
        `tenant-profile-${tenantId}`,
        this.PROFILE_TTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant profile:', error);
      return null;
    }
  }

  /**
   * Update tenant profile
   * Uses the /api/tenant/profile endpoint (authenticated)
   */
  async updateTenantProfile(profileData: Partial<TenantProfile>): Promise<TenantProfile | null> {
    try {
      const response = await this.makeDefaultRequest<TenantProfile>(
        '/api/tenant/profile',
        {
          method: 'PATCH',
          body: JSON.stringify(profileData),
        },
        'tenant-profile'
      );

      // Invalidate cached profile data
      await this.invalidateCache('tenant-profile*');
      
      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to update tenant profile:', error);
      return null;
    }
  }

  /**
   * Get tenant usage statistics
   * Uses the /api/tenants/[id]/complete endpoint and extracts usage data
   */
  async getTenantUsage(tenantId?: string): Promise<TenantUsage | null> {
    try {
      const endpoint = tenantId ? `/api/tenants/${tenantId}/complete` : '/api/tenant-limits/status';
      const cacheKey = tenantId ? `tenant-complete-${tenantId}` : 'current-tenant-usage';

      const response = await this.makeDefaultRequest<any>(
        endpoint,
        {},
        cacheKey,
        this.USAGE_TTL
      );

      // Extract usage data from the complete response
      if (response.data?.usage) {
        return response.data.usage;
      }
      // console.log('[TenantManagementService] No usage data found in response:', response.data);

      return response.data || null;
    } catch (error) {
      this.logError('Failed to get tenant usage', error);
      return null;
    }
  }

  /**
   * Get tenant limits
   * Uses the /api/tenant-limits/status endpoint (authenticated)
   */
  async getTenantLimits(): Promise<TenantLimits | null> {
    try {
      const response = await this.makeDefaultRequest<TenantLimits>(
        '/api/tenant-limits/status',
        {},
        'tenant-limits',
        this.LIMITS_TTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant limits:', error);
      return null;
    }
  }

  /**
   * Get tenant banner
   * Uses the /api/tenants/[id]/banner endpoint (authenticated)
   */
  async getTenantBanner(tenantId: string): Promise<string | null> {
    try {
      const response = await this.makeDefaultRequest<{ banner: string }>(
        `/api/tenants/${tenantId}/banner`,
        {},
        `tenant-banner-${tenantId}`,
        this.MEDIA_TTL
      );

      return response?.data?.banner || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant banner:', error);
      return null;
    }
  }

  /**
   * Update tenant banner
   * Uses the /api/tenants/[id]/banner endpoint (authenticated)
   */
  async updateTenantBanner(tenantId: string, bannerUrl: string): Promise<boolean> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/tenants/${tenantId}/banner`,
        {
          method: 'PUT',
          body: JSON.stringify({ banner: bannerUrl }),
        },
        `tenant-banner-${tenantId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantManagementService] Failed to update tenant banner:', error);
      return false;
    }
  }

  /**
   * Get tenant logo
   * Uses the /api/tenants/[id]/logo endpoint (authenticated)
   */
  async getTenantLogo(tenantId: string): Promise<string | null> {
    try {
      const response = await this.makeDefaultRequest<{ logo: string }>(
        `/api/tenants/${tenantId}/logo`,
        {},
        `tenant-logo-${tenantId}`,
        this.MEDIA_TTL
      );

      return response?.data?.logo || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant logo:', error);
      return null;
    }
  }

  /**
   * Update tenant logo
   * Uses the /api/tenants/[id]/logo endpoint (authenticated)
   */
  async updateTenantLogo(tenantId: string, logoUrl: string): Promise<boolean> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/tenants/${tenantId}/logo`,
        {
          method: 'PUT',
          body: JSON.stringify({ logo: logoUrl }),
        },
        `tenant-logo-${tenantId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantManagementService] Failed to update tenant logo:', error);
      return false;
    }
  }

  /**
   * Invalidate all tenant management cache
   * Useful after tenant updates or when switching tenants
   */
  public async invalidateTenantManagementCache(tenantId?: string): Promise<void> {
    const patterns = [
      'tenant-profile*',
      'current-tenant*',
      'tenant-limits',
      'tenant-usage*',
    ];

    if (tenantId) {
      patterns.push(`tenant-banner-${tenantId}`);
      patterns.push(`tenant-logo-${tenantId}`);
      patterns.push(`tenant-profile-${tenantId}`);
    }

    for (const pattern of patterns) {
      await this.invalidateCache(pattern);
    }
  }

  /**
   * Get business hours for a tenant
   */
  async getBusinessHours(tenantId: string): Promise<any> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/tenant/${tenantId}/business-hours`,
        {},
        `business-hours-${tenantId}`,
        this.PROFILE_TTL
      );
      
      if (!response.success) {
        console.error('[TenantManagementService] Failed to get business hours:', response.error);
        return null;
      }
      
      // API returns { success: true, data: { timezone, periods } }
      const data = response.data as any;
      return data?.data || data || null;
    } catch (error) {
      console.error('[TenantManagementService] Error fetching business hours:', error);
      return null;
    }
  }

  /**
   * Get special business hours for a tenant
   */
  async getSpecialBusinessHours(tenantId: string): Promise<any> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/tenant/${tenantId}/business-hours/special`,
        {},
        `business-hours-special-${tenantId}`,
        this.PROFILE_TTL
      );
      
      if (!response.success) {
        console.error('[TenantManagementService] Failed to get special business hours:', response.error);
        return null;
      }
      
      // API returns { success: true, data: { overrides } }
      const data = response.data as any;
      return data?.data || data || null;
    } catch (error) {
      console.error('[TenantManagementService] Error fetching special business hours:', error);
      return null;
    }
  }

  /**
   * Update business hours for a tenant
   * Updates both the dedicated business-hours endpoint and the profile
   */
  async updateBusinessHours(tenantId: string, hours: { timezone?: string; periods: any[] }): Promise<any> {
    console.log('[TenantManagementService] updateBusinessHours', tenantId, hours);

    // 1. Update via dedicated endpoint
    const result = await this.makeDefaultRequest(
      `/api/tenant/${tenantId}/business-hours`,
      {
        method: 'PUT',
        body: JSON.stringify(hours)
      },
      `tenant-business-hours-${tenantId}`
    );

    // 2. Also update profile hours for backward compatibility
    await this.makeDefaultRequest(
      '/api/tenant/profile',
      {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          hours
        })
      },
      `tenant-profile-${tenantId}`
    );

    // Invalidate all related caches
    await this.invalidateBusinessHoursCaches(tenantId);

    return result.data;
  }

  /**
   * Update special business hours for a tenant
   * Updates both the dedicated special-hours endpoint and the profile
   */
  async updateSpecialBusinessHours(tenantId: string, overrides: any[]): Promise<any> {
    // console.log('[TenantManagementService] updateSpecialBusinessHours', tenantId, overrides);

    // 1. Update via dedicated endpoint
    const result = await this.makeDefaultRequest(
      `/api/tenant/${tenantId}/business-hours/special`,
      {
        method: 'PUT',
        body: JSON.stringify({ overrides })
      },
      `tenant-special-hours-${tenantId}`
    );

    // 2. Also update profile hours for backward compatibility
    const currentProfile = await this.getCurrentTenantProfile(tenantId);
    const currentHours = currentProfile?.hours || {};
    const updatedHours = { ...currentHours, overrides };

    await this.makeDefaultRequest(
      '/api/tenant/profile',
      {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          hours: updatedHours
        })
      },
      `tenant-profile-${tenantId}`
    );

    // Invalidate all related caches
    await this.invalidateBusinessHoursCaches(tenantId);

    return result.data;
  }

  /**
   * Helper to invalidate all business hours related caches
   */
  private async invalidateBusinessHoursCaches(tenantId: string): Promise<void> {
    await this.invalidateCache(`tenant-profile-${tenantId}`);

    const cacheKeys = [
      `/api/${AppContext.TENANT}/${tenantId}/business-hours`,
      `/api/${AppContext.TENANT}/${tenantId}/business-hours/status`,
      `/api/${AppContext.PUBLIC}/${AppContext.TENANT}/${tenantId}/business-hours`,
      `/api/${AppContext.PUBLIC}/${AppContext.TENANT}/${tenantId}/business-hours/status`
    ];

    for (const key of cacheKeys) {
      await this.invalidateCacheWithContext(`${key}`);
    }
  }

  /**
   * Get store status for tenant (private endpoint)
   * Uses inherited base cache for automatic deduplication
   * Aligned with public service for consistent messaging
   */
  async getStoreStatus(tenantId: string): Promise<StoreStatus | null> {
    if (!tenantId) {
      return null;
    }

    const result = await this.makeDefaultRequest<StoreStatus>(
      `/api/tenant/${tenantId}/business-hours/status`,
      {},
      `tenant-store-status-${tenantId}`,
      5 * 60 * 1000 // 5 minutes for status
    );

    if (!result.success || !result.data) {
      console.error('[TenantManagementService] Failed to get store status:', result.error);
      return null;
    }

    // The API returns { success, data: { isOpen, status, label } }
    // makeDefaultRequest wraps it as { success, data: { success, data: {...} } }
    // So result.data is the API response, and we need result.data.data for the actual status
    const statusData: StoreStatus = (result.data as any).data || result.data;
    
    return statusData;
  }

  /**
   * Get GBP hours sync status
   */
  async getGBPHoursStatus(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/tenant/${tenantId}/gbp/hours/status`,
      {},
      `tenant-gbp-hours-status-${tenantId}`,
      60 * 1000 // 1 minute TTL for sync status
    );
    return result.data;
  }

  /**
   * Trigger GBP hours mirroring
   */
  async triggerGBPHoursMirror(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/tenant/${tenantId}/gbp/hours/mirror`,
      {
        method: 'POST'
      },
      `tenant-gbp-hours-mirror-${tenantId}`
    );
    
    // Invalidate status cache to force refresh
    await this.invalidateCache(`tenant-gbp-hours-status-${tenantId}`);
    
    return result.data;
  }

  /**
   * Update tenant timezone
   */
  async updateTimezone(tenantId: string, timezone: string, existingHours?: any): Promise<any> {
    const result = await this.makeDefaultRequest(
      '/api/tenant/profile',
      {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          hours: { ...(existingHours || {}), timezone }
        })
      },
      `tenant-profile-${tenantId}`
    );
    
    // Invalidate related caches (base cache handles store status automatically)
    await this.invalidateCache(`tenant-profile-${tenantId}`);
    // Invalidate all related caches
    await this.invalidateBusinessHoursCaches(tenantId);
    
    return result.data;
  }

  /**
   * Propagate business hours to organization locations
   */
  async propagateBusinessHours(tenantId: string, includeSpecialHours: boolean = false): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/v1/tenants/${tenantId}/business-hours/propagate`,
      {
        method: 'POST',
        body: JSON.stringify({ includeSpecialHours })
      },
      `propagation-business-hours-${tenantId}`
    );
    
    // Invalidate all related caches
    await this.invalidateBusinessHoursCaches(tenantId);
    
    return result.data;
  }

  /**
   * Propagate feature flags to organization locations
   */
  async propagateFeatureFlags(tenantId: string, mode: string = 'all'): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/v1/tenants/${tenantId}/feature-flags/propagate`,
      {
        method: 'POST',
        body: JSON.stringify({ mode })
      },
      `propagation-feature-flags-${tenantId}`
    );
    
    return result.data;
  }

  /**
   * Propagate user roles to organization locations
   */
  async propagateUserRoles(tenantId: string, mode: string = 'all'): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/v1/tenants/${tenantId}/user-roles/propagate`,
      {
        method: 'POST',
        body: JSON.stringify({ mode })
      },
      `propagation-user-roles-${tenantId}`
    );
     // Invalidate all related caches
    await this.invalidateBusinessHoursCaches(tenantId);
    return result.data;
  }

  /**
   * Propagate brand assets to organization locations
   */
  async propagateBrandAssets(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/v1/tenants/${tenantId}/brand-assets/propagate`,
      {
        method: 'POST'
      },
      `propagation-brand-assets-${tenantId}`
    );
    
    return result.data;
  }

  /**
   * Propagate business profile to organization locations
   */
  async propagateBusinessProfile(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/v1/tenants/${tenantId}/business-profile/propagate`,
      {
        method: 'POST'
      },
      `propagation-business-profile-${tenantId}`
    );
    
    // Invalidate related caches
    await this.invalidateCache(`tenant-profile-*`);
    
    return result.data;
  }

  /**
   * Update organization hero location
   */
  async updateOrganizationHeroLocation(organizationId: string, tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/organizations/${organizationId}/hero-location`,
      {
        method: 'PUT',
        body: JSON.stringify({ tenantId })
      },
      `org-hero-location-${organizationId}`
    );
    
    // Invalidate organization and tenant caches
    await this.invalidateCache(`organization-${organizationId}`);
    await this.invalidateCache(`tenant-profile-${tenantId}`);
    await this.invalidateCache(`org-${organizationId}-tenants`);
    await this.invalidateCache(`access-control-${organizationId}`);
    await this.invalidateCache(`access-control-tenant-${tenantId}`);
    
    return result.data;
  }
}

// Export singleton instance
export const tenantManagementService = TenantManagementService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateTenantManagementCache = async (tenantId?: string): Promise<void> => {
  await tenantManagementService.invalidateTenantManagementCache(tenantId);
};
