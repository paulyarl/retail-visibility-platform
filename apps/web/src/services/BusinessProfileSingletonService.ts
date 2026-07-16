/**
 * Business Profile Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached business profile operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { safeTransformToCamel } from '@/utils/case-transform';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { clientLogger } from '@/lib/client-logger';

interface ApiBusinessProfile {
  business_name?: string;
  address_line1?: string;
  address_line2?: string;
  phone_number?: string;
  website_url?: string;
  created_at?: string;
  updated_at?: string;
  map_privacy_mode?: string;
}

interface UseBusinessProfileOptions {
  transform?: boolean;
  tenantId?: string;
}

class BusinessProfileSingletonService extends TenantApiSingleton {
  public getServiceCachePatterns(): string[] {
    return ['business-profile-*'];
  }
  public invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      return this.invalidateCache(`business-profile-${tenantId}`);
    }
    return Promise.resolve();
  }
  private static instance: BusinessProfileSingletonService;

  private constructor() {
    super('business-profile-singleton');
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes for business profile data (changes infrequently)
  }

  public static getInstance(): BusinessProfileSingletonService {
    if (!BusinessProfileSingletonService.instance) {
      BusinessProfileSingletonService.instance = new BusinessProfileSingletonService();
    }
    return BusinessProfileSingletonService.instance;
  }

  /**
   * Get business profile for a specific tenant
   */
  async getBusinessProfile(tenantId: string, transform: boolean = false): Promise<BusinessProfile | ApiBusinessProfile | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<ApiBusinessProfile>(
      `/api/tenants/${tenantId}/profile`,
      {},
      `business-profile-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[BusinessProfileSingleton] Failed to get business profile:', { detail: result.error });
      return null;
    }

    if (!result.data) {
      return null;
    }

    // Apply transformation if requested
    const processedData = transform 
      ? safeTransformToCamel<BusinessProfile>(result.data)
      : result.data;
    
    return processedData;
  }

  /**
   * Update business profile
   */
  async updateBusinessProfile(tenantId: string, profileData: Partial<ApiBusinessProfile>): Promise<BusinessProfile | ApiBusinessProfile | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<ApiBusinessProfile>(
      `/api/tenants/${tenantId}/profile`,
      { 
        method: 'PUT',
        body: JSON.stringify(profileData)
      },
      `business-profile-update-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[BusinessProfileSingleton] Failed to update business profile:', { detail: result.error });
      throw result.error;
    }

    // Invalidate business profile cache
    await this.invalidateCache(`business-profile-${tenantId}*`);

    return result.data || null;
  }

  /**
   * Invalidate business profile cache for a specific tenant
   */
  public async invalidateBusinessProfileCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`business-profile-${tenantId}*`);
  }

  /**
   * Invalidate all business profile cache
   */
  public async invalidateAllBusinessProfileCache(): Promise<void> {
    await this.invalidateCache('business-profile-*');
  }
}

// Export singleton instance
export const businessProfileService = BusinessProfileSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateBusinessProfileCache = async (tenantId: string): Promise<void> => {
  const service = BusinessProfileSingletonService.getInstance();
  await service.invalidateBusinessProfileCache(tenantId);
};

export const invalidateAllBusinessProfileCache = async (): Promise<void> => {
  const service = BusinessProfileSingletonService.getInstance();
  await service.invalidateAllBusinessProfileCache();
};
