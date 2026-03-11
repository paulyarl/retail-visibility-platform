import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

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
 * Tenant Public Service
 * Handles public tenant data operations with proper caching
 * Used for public pages and public tenant information display
 */
class TenantPublicService extends PublicApiSingleton {

    protected defaultContext: AppContext = AppContext.STORE;
    protected defaultIsolation: CacheIsolation = CacheIsolation.STORE;
  private static instance: TenantPublicService;

  // TTL for public tenant data (longer since it changes less frequently)
  private readonly PROFILE_TTL = 15 * 60 * 1000; // 15 minutes for public profiles
  private readonly HOURS_TTL = 10 * 60 * 1000; // 10 minutes for business hours

  protected constructor() {
    super('tenant-public-singleton');
  }

  public static getInstance(): TenantPublicService {
    if (!TenantPublicService.instance) {
      TenantPublicService.instance = new TenantPublicService();
    }
    return TenantPublicService.instance;
  }

  /**
   * Get public tenant info (basic)
   * Uses the /api/public/tenant/:tenantId endpoint
   */
  async getPublicTenantInfo(tenantId: string): Promise<any | null> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/tenant/${tenantId}`,
        {},
        `public-tenant-info-${tenantId}`,
        this.PROFILE_TTL
      );

      if (!response.success){
        console.error('[TenantPublicService] Failed to get public tenant info:', response.error);
        return null;
      }
      
      // console.log('[TenantPublicService] getPublicTenantInfo result:', {
      //   success: response.success,
      //   hasData: !!response.data,
      //   dataKeys: response.data ? Object.keys(response.data) : 'null',
      //   nestedKeys: response.data?.data ? Object.keys(response.data.data) : 'null',
      //   metadata: response.data?.metadata ? Object.keys(response.data.metadata) : 'null',
      //   fullData: JSON.stringify(response.data, null, 2)
      // });

      return response.data;
    } catch (error) {
      console.error('[TenantPublicService] Failed to get public tenant info:', error);
      return null;
    }
  }

  /**
   * Get tenant logo (public)
   * Uses the /api/public/tenant/:tenantId/logo endpoint
   */
  async getTenantLogo(tenantId: string): Promise<any | null> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/tenant/${encodeURIComponent(tenantId)}/logo`,
        {},
        `public-tenant-logo-${tenantId}`,
        this.PROFILE_TTL
      );

      if (!response.success){
        console.error('[TenantPublicService] Failed to get tenant logo:', response.error);
        return null;
      }

    //  console.log(`${this.constructor.name} - Logo Response:`, response.data);

      return response.data;
    } catch (error) {
      console.error('[TenantPublicService] Failed to get tenant logo:', error);
      return null;
    }
  }

  /**
   * Get tenant tier information (public)
   * Uses the /api/tenants/:tenantId/tier/public endpoint
   */
  async getPublicTenantTier(tenantId: string): Promise<any | null> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/tier/public`,
        {},
        `public-tenant-tier-${tenantId}`,
        this.PROFILE_TTL
      );

      if (!response.success){
        console.error('[TenantPublicService] Failed to get public tenant tier:', response.error);
        return null;
      }
   //   console.log(`${this.constructor.name} - Tier Response:`, response.data);

      return response.data;
    } catch (error) {
      console.error('[TenantPublicService] Failed to get public tenant tier:', error);
      return null;
    }
  }

  /**
   * Get public tenant profile
   * Uses the /api/public/tenant/:tenant_id/profile endpoint for public profile data
   */
  async getPublicTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    try {
      const response = await this.makeDefaultRequest<TenantProfile>(
        `/api/public/tenant/${tenantId}/profile`,
        {},
        `public-tenant-profile-${tenantId}`,
        this.PROFILE_TTL
      );
      if (!response.success){
        console.error('[TenantPublicService] Failed to get public tenant profile:', response.error);
        return null;
      }
   //   console.log(`${this.constructor.name} - Profile Response:`, response.data);

      return response.data||null;
    } catch (error) {
      console.error('[TenantPublicService] Failed to get public tenant profile:', error);
      return null;
    }
  }

  /**
   * Get tenant business hours (public)
   * Uses the /api/public/tenant/:tenantId/business-hours/status endpoint
   */
  async getTenantBusinessHours(tenantId: string): Promise<any | null> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/tenant/${tenantId}/business-hours/status`,
        {},
        `tenant-hours-${tenantId}`,
        this.HOURS_TTL
      );

      if (!response.success){
        console.error('[TenantPublicService] Failed to get tenant business hours:', response.error);
        return null;
      }
    //  console.log(`${this.constructor.name} - Hours Response:`, response.data);

      return response.data;
    } catch (error) {
      console.error('[TenantPublicService] Failed to get tenant business hours:', error);
      return null;
    }
  }

  /**
   * Get tenant business hours from the business-hours API (public)
   * Uses the /api/business-hours/:tenantId endpoint (same as shops page)
   */
  async getBusinessHours(tenantId: string): Promise<any | null> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/business-hours/${tenantId}`,
        {},
        `business-hours-${tenantId}`,
        this.HOURS_TTL
      );

      if (!response.success){
        console.error('[TenantPublicService] Failed to get business hours:', response.error);
        return null;
      }

      return response.data || null;
    } catch (error) {
      console.error('[TenantPublicService] Failed to get business hours:', error);
      return null;
    }
  }

  /**
   * Get tenant basic info for directory listing
   * Uses cached public profile data
   */
  async getTenantDirectoryInfo(tenantId: string): Promise<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo?: string;
    address?: any;
    contact?: any;
  } | null> {
    try {
      const profile = await this.getPublicTenantProfile(tenantId);
      if (!profile) return null;

//      console.log(`${this.constructor.name} - Directory Info Response:`, profile);

      return {
        id: profile.id,
        name: profile.business_name || profile.name || '',
        slug: profile.slug || '',
        description: profile.business_description || profile.description,
        logo: profile.logo_url || profile.logo,
        address: profile.address,
        contact: profile.contact
      };
    } catch (error) {
      console.error('[TenantPublicService] Failed to get tenant directory info:', error);
      return null;
    }
  }

  /**
   * Invalidate public tenant cache
   */
  public async invalidatePublicTenantCache(tenantId: string): Promise<void> {
    const patterns = [
      `public-tenant-profile-${tenantId}`,
      `tenant-hours-${tenantId}`
    ];

    for (const pattern of patterns) {
      await this.invalidateCache(pattern);
    }
  }
}

// Export singleton instance
export const tenantPublicService = TenantPublicService.getInstance();

// Export cache invalidation helpers for external use
export const invalidatePublicTenantCache = async (tenantId: string): Promise<void> => {
  await tenantPublicService.invalidatePublicTenantCache(tenantId);
};
