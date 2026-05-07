/**
 * Tenant Public Service V2 - Migrated to FlexibleApiSingletonV2
 * 
 * Handles public tenant data operations with proper caching
 * Uses the new delegation pattern for consistent execution
 */

import { FlexibleApiSingletonV2, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingletonV2';

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
 * Tenant Public Service V2
 * 
 * Migrated to use FlexibleApiSingletonV2 with delegation pattern
 * Maintains all existing functionality while using clean architecture
 */
class TenantPublicServiceV2 extends FlexibleApiSingletonV2 {
  private static instance: TenantPublicServiceV2;

  // Define defaults for this service
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  // TTL for public tenant data (longer since it changes less frequently)
  private readonly PROFILE_TTL = 15 * 60 * 1000; // 15 minutes for public profiles
  private readonly HOURS_TTL = 10 * 60 * 1000; // 10 minutes for business hours

  protected constructor() {
    super('tenant-public-singleton-v2');
  }

  public static getInstance(): TenantPublicServiceV2 {
    if (!TenantPublicServiceV2.instance) {
      TenantPublicServiceV2.instance = new TenantPublicServiceV2();
    }
    return TenantPublicServiceV2.instance;
  }

  /**
   * Get public tenant info (basic)
   * Uses delegation pattern: setup → execution
   */
  async getPublicTenantInfo(tenantId: string): Promise<any | null> {
    try {
      // Using makeDefaultRequest with delegation pattern
      const response = await this.makeDefaultRequest<any>(
        `/api/public/tenant/${tenantId}`,
        {},
        `public-tenant-info-${tenantId}`,
        this.PROFILE_TTL,
        {
          requestType: RequestType.PUBLIC,
          requestTarget: RequestTarget.API
        }
      );

      if (!response.success){
        console.error('[TenantPublicServiceV2] Failed to get public tenant info:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[TenantPublicServiceV2] Failed to get public tenant info:', error);
      return null;
    }
  }

  /**
   * Get tenant logo (public)
   * Uses delegation pattern for consistent execution
   */
  async getPublicTenantLogo(tenantId: string): Promise<string | null> {
    try {
      // Using makeDefaultRequest with delegation pattern
      const response = await this.makeDefaultRequest<any>(
        `/api/public/tenant/${tenantId}/logo`,
        {
          method: 'GET',
          headers: {
            'Accept': 'image/*'
          }
        },
        `public-tenant-logo-${tenantId}`,
        this.PROFILE_TTL,
        { requestTarget: RequestTarget.API }
      );

      if (!response.success){
        console.error('[TenantPublicServiceV2] Failed to get public tenant logo:', response.error);
        return null;
      }

      return response.data?.logo_url || null;
    } catch (error) {
      console.error('[TenantPublicServiceV2] Failed to get public tenant logo:', error);
      return null;
    }
  }

  /**
   * Get public tenant profile (detailed)
   * Uses delegation pattern with custom caching
   */
  async getPublicTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    try {
      // Using makeDefaultRequest with delegation pattern
      const response = await this.makeDefaultRequest<TenantProfile>(
        `/api/public/tenant/${tenantId}/profile`,
        {},
        `public-tenant-profile-${tenantId}`,
        this.PROFILE_TTL,
        {
          requestType: RequestType.PUBLIC,
          requestTarget: RequestTarget.API
        }
      );

      if (!response.success){
        console.error('[TenantPublicServiceV2] Failed to get public tenant profile:', response.error);
        return null;
      }

      return response.data || null;
    } catch (error) {
      console.error('[TenantPublicServiceV2] Failed to get public tenant profile:', error);
      return null;
    }
  }

  /**
   * Get tenant business hours (public)
   * Uses delegation pattern with shorter TTL for hours
   */
  async getTenantBusinessHours(tenantId: string): Promise<any | null> {
    try {
      // Using makeDefaultRequest with delegation pattern
      const response = await this.makeDefaultRequest<any>(
        `/api/public/tenant/${tenantId}/hours`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        },
        `public-tenant-hours-${tenantId}`,
        this.HOURS_TTL,
        { requestTarget: RequestTarget.API }
      );

      if (!response.success){
        console.error('[TenantPublicServiceV2] Failed to get tenant business hours:', response.error);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('[TenantPublicServiceV2] Failed to get tenant business hours:', error);
      return null;
    }
  }

  /**
   * Test hook customization for public requests
   * Demonstrates how to customize request behavior in V2
   */
  protected async onPublicRequest<T>(
    url: string,
    options: any,
    cacheKey?: string,
    ttl?: number
  ): Promise<any> {
    console.log(`[TenantPublicServiceV2] Customizing public request for: ${url}`);
    
    // Add custom headers for tenant public requests
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Tenant-Public-Version': 'v2',
        'X-Request-Timestamp': Date.now().toString(),
        'X-Service': 'TenantPublicServiceV2'
      }
    };
  }
}

// Export the singleton instance
export const tenantPublicServiceV2 = TenantPublicServiceV2.getInstance();

// Also export the class for testing
export { TenantPublicServiceV2 };
