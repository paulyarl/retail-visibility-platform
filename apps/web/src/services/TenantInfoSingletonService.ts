/**
 * Tenant Info Singleton Service
 *
 * Extends UniversalSingleton to provide cached tenant information operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingleton } from '@/providers/base/UniversalSingleton';

export interface TenantInfo {
  id: string;
  name: string;
  metadata?: {
    businessName?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    logo_url?: string;
    [key: string]: any;
  };
  access?: {
    storefront?: boolean;
    [key: string]: any;
  };
}

export interface BusinessProfile {
  business_name: string;
  phone_number?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  logo_url?: string;
  business_description?: string;
  social_links?: Record<string, string>;
  metadata?: Record<string, any>;
  hours?: any;
}

export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
  } | string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  [key: string]: any;
}

class TenantInfoSingletonService extends UniversalSingleton {
  private static instance: TenantInfoSingletonService;

  private constructor() {
    super('tenant-info-service', { encrypt: false });
  }

  public static getInstance(): TenantInfoSingletonService {
    if (!TenantInfoSingletonService.instance) {
      TenantInfoSingletonService.instance = new TenantInfoSingletonService();
    }
    return TenantInfoSingletonService.instance;
  }

  /**
   * Get tenant basic information with caching
   * Uses the /public/tenant/:tenantId endpoint
   */
  async getTenantInfo(tenantId: string): Promise<TenantInfo | null> {
    console.log(`[TenantInfoSingleton] getTenantInfo START for tenant: ${tenantId}`, new Date().toISOString());
    
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getTenantInfo: tenantId is required');
      return null;
    }

    try {
      console.log(`[TenantInfoSingleton] Making API call to /api/public/tenant/${tenantId}`);
      const startTime = Date.now();
      
      const tenant = await this.makeApiRequest<TenantInfo>(
        `/api/public/tenant/${tenantId}`,
        {},
        `tenant-info-${tenantId}`
      );
      
      const endTime = Date.now();
      console.log(`[TenantInfoSingleton] API call completed in ${endTime - startTime}ms, result:`, tenant);

      return tenant || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get tenant info:', error);
      return null;
    }
  }

  /**
   * Get tenant business profile with caching
   * Uses the /public/tenant/:tenantId/profile endpoint
   */
  async getBusinessProfile(tenantId: string): Promise<BusinessProfile | null> {
    console.log(`[TenantInfoSingleton] getBusinessProfile START for tenant: ${tenantId}`, new Date().toISOString());
    
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getBusinessProfile: tenantId is required');
      return null;
    }

    try {
      console.log(`[TenantInfoSingleton] Making API call to /api/public/tenant/${tenantId}/profile`);
      const startTime = Date.now();
      
      const profile = await this.makeApiRequest<BusinessProfile>(
        `/api/public/tenant/${tenantId}/profile`,
        {},
        `tenant-profile-${tenantId}`
      );
      
      const endTime = Date.now();
      console.log(`[TenantInfoSingleton] Profile API call completed in ${endTime - startTime}ms, result:`, profile);

      return profile || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get business profile:', error);
      return null;
    }
  }

  /**
   * Get tenant business hours with caching
   * Uses the /api/tenant/:tenantId/business-hours endpoint
   */
  async getBusinessHours(tenantId: string): Promise<BusinessHours | null> {
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getBusinessHours: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeApiRequest<{
        success: boolean;
        data: {
          periods: Array<{
            day: string;
            open: string;
            close: string;
          }>;
          timezone: string;
        };
      }>(
        `/api/tenant/${tenantId}/business-hours`,
        {},
        `tenant-hours-${tenantId}`
      );

      if (result && result.success && result.data) {
        const { periods, timezone } = result.data;
        const hours: BusinessHours = { timezone };

        // Convert periods to day-based format for BusinessHoursDisplay
        periods.forEach((period: any) => {
          // Convert API day format (MONDAY) to title case (Monday) for storefront display
          const dayMap: Record<string, string> = {
            'MONDAY': 'Monday',
            'TUESDAY': 'Tuesday',
            'WEDNESDAY': 'Wednesday',
            'THURSDAY': 'Thursday',
            'FRIDAY': 'Friday',
            'SATURDAY': 'Saturday',
            'SUNDAY': 'Sunday'
          };
          const titleCaseDay = dayMap[period.day] || period.day;
          if (titleCaseDay && !hours[titleCaseDay]) {
            hours[titleCaseDay] = {
              open: period.open,
              close: period.close
            };
          }
        });

        return hours;
      }

      return null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get business hours:', error);
      return null;
    }
  }

  /**
   * Get tenant payment gateways with caching
   * Uses the /public/tenant/:tenantId/payment-gateways endpoint
   */
  async getPaymentGateways(tenantId: string): Promise<PaymentGateway[]> {
    console.log(`[TenantInfoSingleton] getPaymentGateways START for tenant: ${tenantId}`, new Date().toISOString());
    
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getPaymentGateways: tenantId is required');
      return [];
    }

    try {
      console.log(`[TenantInfoSingleton] Making API call to /api/public/tenant/${tenantId}/payment-gateways`);
      const startTime = Date.now();
      
      const result = await this.makeApiRequest<{
        success: boolean;
        gateways: PaymentGateway[];
      }>(
        `/api/public/tenant/${tenantId}/payment-gateways`,
        {},
        `tenant-gateways-${tenantId}`
      );
      
      const endTime = Date.now();
      console.log(`[TenantInfoSingleton] Payment gateways API call completed in ${endTime - startTime}ms, result:`, result);

      if (result && result.success && result.gateways) {
        return result.gateways.filter((g: any) => g.is_active);
      }

      return [];
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get payment gateways:', error);
      return [];
    }
  }

  /**
   * Get complete tenant information with all details
   * Combines multiple API calls into one comprehensive object
   */
  async getCompleteTenantInfo(tenantId: string): Promise<{
    tenant: TenantInfo | null;
    businessProfile: BusinessProfile | null;
    businessHours: BusinessHours | null;
    paymentGateways: PaymentGateway[];
  }> {
    if (!tenantId) {
      return {
        tenant: null,
        businessProfile: null,
        businessHours: null,
        paymentGateways: []
      };
    }

    try {
      // Fetch all data in parallel for better performance
      const [tenant, businessProfile, businessHours, paymentGateways] = await Promise.all([
        this.getTenantInfo(tenantId),
        this.getBusinessProfile(tenantId),
        this.getBusinessHours(tenantId),
        this.getPaymentGateways(tenantId)
      ]);

      return {
        tenant,
        businessProfile,
        businessHours,
        paymentGateways
      };
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get complete tenant info:', error);
      return {
        tenant: null,
        businessProfile: null,
        businessHours: null,
        paymentGateways: []
      };
    }
  }

  /**
   * Get tenant logo URL from mv_global_discovery materialized view
   * This is used as a fallback when the tenant API doesn't return logo_url
   */
  async getTenantLogoFromDiscovery(tenantId: string): Promise<string | null> {
    console.log(`[TenantInfoSingleton] getTenantLogoFromDiscovery START for tenant: ${tenantId}`, new Date().toISOString());
    
    if (!tenantId) {
      return null;
    }

    try {
      // Use the public API to query the materialized view
      const result = await this.makeApiRequest<{
        success: boolean;
        data: Array<{ tenant_logo_url: string }>;
      }>(
        `/api/public/tenant/${tenantId}/logo`,
        {},
        `tenant-logo-${tenantId}`
      );
      
      if (result && result.success && result.data && result.data.length > 0) {
        const logoUrl = result.data[0].tenant_logo_url;
        console.log(`[TenantInfoSingleton] Found logo URL from discovery: ${logoUrl}`);
        return logoUrl;
      }

      return null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get tenant logo from discovery:', error);
      return null;
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return super.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    // UniversalSingleton doesn't have resetMetrics, so we'll just log
    console.log('[TenantInfoSingleton] Metrics reset requested');
  }
}

// Export singleton instance
export const tenantInfoService = TenantInfoSingletonService.getInstance();
