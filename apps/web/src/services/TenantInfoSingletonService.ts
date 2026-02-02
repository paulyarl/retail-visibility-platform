/**
 * Tenant Info Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached tenant information operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

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

class TenantInfoSingletonService {
  private static instance: TenantInfoSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 5 * 60 * 1000, // 5 minutes for tenant info
      enableLogging: true,
      enableMetrics: true
    });
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
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getTenantInfo: tenantId is required');
      return null;
    }

    try {
      const result = await this.client.makeRequest<TenantInfo>(
        `/public/tenant/${tenantId}`
      );
      
      return (result as any) || null;
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
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getBusinessProfile: tenantId is required');
      return null;
    }

    try {
      const result = await this.client.makeRequest<BusinessProfile>(
        `/public/tenant/${tenantId}/profile`
      );
      
      return (result as any) || null;
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
      const result = await this.client.makeRequest<{
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
        `/api/tenant/${tenantId}/business-hours`
      );
      
      if (result.data && result.data.success && result.data.data) {
        const { periods, timezone } = result.data.data;
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
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getPaymentGateways: tenantId is required');
      return [];
    }

    try {
      const result = await this.client.makeRequest<{
        success: boolean;
        gateways: PaymentGateway[];
      }>(
        `/public/tenant/${tenantId}/payment-gateways`
      );
      
      if (result.data && result.data.success && result.data.gateways) {
        return result.data.gateways.filter((g: any) => g.is_active);
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
   * Get performance metrics
   */
  public getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
  }
}

// Export singleton instance
export const tenantInfoService = TenantInfoSingletonService.getInstance();
