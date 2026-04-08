/**
 * Public Tenant Info Service
 * 
 * Handles public-facing tenant operations for storefront display
 * Extends PublicApiSingleton for public requests without authentication
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { tenantPublicService, LocationStatusInfo } from '@/services/TenantPublicService';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface TenantInfo {
  id: string;
  name: string;
  slug?: string | null;
  subscriptionStatus?: string;
  subscriptionTier?: string | null;
  trialEndsAt?: string | null;
  locationStatus?: string | null;
  statusInfo?: LocationStatusInfo;
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

export interface TenantTier {
  id: string;
  name: string;
  effective?: {
    id: string;
    name: string;
  };
  features?: string[];
  limits?: Record<string, any>;
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
  gatewayType?: string;  // camelCase version from API
  gateway_type: string;
  is_active: boolean;
  isActive?: boolean;  // camelCase version from API
  is_default: boolean;
  isDefault?: boolean;  // camelCase version from API
  config: any;
  last_verified_at?: string;
  verification_status?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

class PublicTenantInfoService extends PublicApiSingleton {

  protected defaultContext: AppContext = AppContext.STORE;
  protected defaultIsolation: CacheIsolation = CacheIsolation.STORE;
  private static _instance: PublicTenantInfoService;

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      encrypt: false,
      ...cacheOptions
    });
  }

  public static getInstance(): PublicTenantInfoService {
    if (!PublicTenantInfoService._instance) {
      PublicTenantInfoService._instance = new PublicTenantInfoService('public-tenant-info-service');
    }
    return PublicTenantInfoService._instance;
  }

  /**
   * Get tenant basic information with caching
   * Uses the /public/tenant/:tenantId endpoint
   */
  async getTenantInfo(tenantId: string): Promise<TenantInfo | null> { 
    
    if (!tenantId) {
      console.error('[PublicTenantInfoService] getTenantInfo: tenantId is required');
      return null;
    }

    try {
      // Use public service for public endpoint
      const tenant = await tenantPublicService.getPublicTenantInfo(tenantId); 

      return tenant || null;
    } catch (error) {
      console.error('[PublicTenantInfoService] Failed to get tenant info:', error);
      return null;
    }
  }

  /**
   * Get tenant business profile with caching
   * Uses the /public/tenant/:tenantId/profile endpoint
   */
  async getBusinessProfile(tenantId: string): Promise<BusinessProfile | null> { 
    
    if (!tenantId) {
      console.error('[PublicTenantInfoService] getBusinessProfile: tenantId is required');
      return null;
    }

    try {
      // Use public service for public endpoint
      const profile = await tenantPublicService.getPublicTenantProfile(tenantId); 

      return profile || null;
    } catch (error) {
      console.error('[PublicTenantInfoService] Failed to get business profile:', error);
      return null;
    }
  }

  /**
   * Get tenant tier information with caching
   * Uses the /api/tenants/:tenantId/tier/public endpoint
   */
  async getTenantTier(tenantId: string): Promise<TenantTier | null> {
    if (!tenantId) {
      console.error('[PublicTenantInfoService] getTenantTier: tenantId is required');
      return null;
    }

    try {
      // Use public service for public endpoint
      const result = await tenantPublicService.getPublicTenantTier(tenantId);

      return result || null;
    } catch (error) {
      console.error('[PublicTenantInfoService] Failed to get tenant tier:', error);
      return null;
    }
  }

  /**
   * Get tenant profile information (alias for getBusinessProfile)
   * Uses the /public/tenant/:tenantId/profile endpoint
   */
  async getTenantProfile(tenantId: string): Promise<BusinessProfile | null> {
    return this.getBusinessProfile(tenantId);
  }

  /**
   * Get tenant business hours with caching
   * Uses the /api/tenant/:tenantId/business-hours endpoint
   */
  async getBusinessHours(tenantId: string): Promise<BusinessHours | null> {
    if (!tenantId) {
      console.error('[PublicTenantInfoService] getBusinessHours: tenantId is required');
      return null;
    }

    try {
      // Use public request for public display of business hours
      const result = await this.makeDefaultRequest<{
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
        `/api/tenants/${tenantId}/business-hours`,
        {},
        `public-business-hours-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[PublicTenantInfoService] Failed to get business hours:', result.error);
        return null;
      }

      if (result && result.data && result.data.success && result.data.data) {
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
      console.error('[PublicTenantInfoService] Failed to get business hours:', error);
      return null;
    }
  }

  /**
   * Get tenant payment gateway status (active/inactive)
   * Uses the /public/tenant/:tenantId/payment-gateways endpoint
   * Also checks OAuth completion for OAuth-based gateways
   */
  async getPaymentGatewayStatus(tenantId: string): Promise<{hasActiveGateway: boolean; defaultGatewayType?: string} | null> { 
    if (!tenantId) {
      console.error('[PublicTenantInfoService] getPaymentGatewayStatus: tenantId is required');
      return null;
    }

    try {
      // API returns { success: true, hasActivePaymentGateway: boolean, defaultGatewayType: string, gateways: [...] }
      const response = await this.makeDefaultRequest<{
        success: boolean;
        hasActivePaymentGateway: boolean;
        defaultGatewayType?: string;
        gateways: Array<{gatewayType: string; isActive: boolean; isDefault?: boolean}>;
      }>(
        `/public/tenant/${tenantId}/payment-gateways`,
        {},
        `public-tenant-gateway-status-${tenantId}`
      ) as any;

      console.log(`[PublicTenantInfoService] getPaymentGatewayStatus response:`, response);
      
      if (response?.success && response.data) {
        const { gateways } = response.data;
        
        // If no gateways, return false immediately
        if (!gateways || gateways.length === 0) {
          return {
            hasActiveGateway: false,
            defaultGatewayType: undefined
          };
        }

        // Find the default/active gateway
        const activeGateway = gateways.find((g: any) => g.isActive && (g.isDefault || g.is_default));
        if (!activeGateway) {
          return {
            hasActiveGateway: false,
            defaultGatewayType: undefined
          };
        }

        // For OAuth-based gateways, verify OAuth completion
        if (activeGateway.gatewayType === 'square') {
          try {
            const oauthResponse = await this.makeDefaultRequest<{
              connected: boolean;
              isExpired?: boolean;
            }>(
              `/public/tenant/${tenantId}/oauth-status/square`,
              {},
              `oauth-status-${tenantId}-square`,
              300 // 5 minute cache for OAuth status
            );

            if (!oauthResponse?.success || !oauthResponse.data?.connected || oauthResponse.data?.isExpired) {
              console.log(`[PublicTenantInfoService] Square OAuth not completed or expired for tenant: ${tenantId}`);
              return {
                hasActiveGateway: false,
                defaultGatewayType: undefined
              };
            }
          } catch (oauthError) {
            console.warn(`[PublicTenantInfoService] Failed to check Square OAuth status for tenant: ${tenantId}`, oauthError);
            return {
              hasActiveGateway: false,
              defaultGatewayType: undefined
            };
          }
        } else if (activeGateway.gatewayType === 'paypal') {
          try {
            const oauthResponse = await this.makeDefaultRequest<{
              connected: boolean;
              isExpired?: boolean;
            }>(
              `/public/tenant/${tenantId}/oauth-status/paypal`,
              {},
              `oauth-status-${tenantId}-paypal`,
              300 // 5 minute cache for OAuth status
            );

            // For PayPal: trust is_active flag from database
            // PayPal tokens can be auto-refreshed, so expired tokens are okay
            // Only fail if there's no OAuth record at all (never connected)
            if (!oauthResponse?.success || oauthResponse.data?.connected === undefined) {
              return {
                hasActiveGateway: false,
                defaultGatewayType: undefined
              };
            }
            // If we have any OAuth record (even expired), trust the is_active flag
            // The checkout process will handle token refresh if needed
          } catch (oauthError) {
            // Don't fail on OAuth check error - trust the is_active flag
          }
        }

        // For other gateways (Stripe with direct API keys, PayPal), trust the is_active flag
        return {
          hasActiveGateway: true,
          defaultGatewayType: activeGateway.gatewayType
        };
      }

      console.log(`[PublicTenantInfoService] getPaymentGatewayStatus NO DATA for tenant: ${tenantId}`, new Date().toISOString());
      return null;
    } catch (error) {
      console.error(`[PublicTenantInfoService] getPaymentGatewayStatus ERROR for tenant: ${tenantId}`, error);
      return null;
    }
  }

  /**
   * Get tenant payment gateways with caching
   * Uses the /public/tenant/:tenantId/payment-gateways endpoint
   */
  async getPaymentGateways(tenantId: string): Promise<PaymentGateway[]> { 
    
    if (!tenantId) {
      console.error('[PublicTenantInfoService] getPaymentGateways: tenantId is required');
      return [];
    }

    try {
      // Use PUBLIC request type for public endpoint
      const response = await this.makeDefaultRequest<{
        success: boolean;
        gateways: PaymentGateway[];
      }>(
        `/public/tenant/${tenantId}/payment-gateways`,
        {},
        `public-payment-gateways-${tenantId}`,
        this.cacheTTL
      );
      if (!response.success){
        console.error('[PublicTenantInfoService] Failed to get payment gateways:', response.error);
        return [];
      }

      if (response?.success && response.data?.gateways) { 
        return response.data.gateways;
      }

      console.log(`[PublicTenantInfoService] getPaymentGateways NO DATA for tenant: ${tenantId}`, new Date().toISOString());
      return [];
    } catch (error) {
      console.error(`[PublicTenantInfoService] getPaymentGateways ERROR for tenant: ${tenantId}`, error);
      return [];
    }
  }

  /**
   * Get tenant fulfillment settings with caching
   * Uses the /public/tenant/:tenantId/fulfillment-settings endpoint
   */
  async getFulfillmentSettings(tenantId: string): Promise<any> {
    
    if (!tenantId) {
      console.error('[PublicTenantInfoService] getFulfillmentSettings: tenantId is required');
      return null;
    }

    try {
      // Use PUBLIC request type for public endpoint
      const response = await this.makeDefaultRequest<{
        success: boolean;
        settings: any;
      }>(
        `/api/public/tenant/${tenantId}/fulfillment-settings`,
        {},
        `public-fulfillment-settings-${tenantId}`,
        this.cacheTTL
      );
      if (!response.success){
        console.error('[PublicTenantInfoService] Failed to get fulfillment settings:', response.error);
        return null;
      }

      if (response?.success && response.data?.settings) { 
        return response.data.settings;
      }

      console.log(`[PublicTenantInfoService] getFulfillmentSettings NO DATA for tenant: ${tenantId}`, new Date().toISOString());
      return null;
    } catch (error) {
      console.error(`[PublicTenantInfoService] getFulfillmentSettings ERROR for tenant: ${tenantId}`, error);
      return null;
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
      console.error('[PublicTenantInfoService] Failed to get complete tenant info:', error);
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
    
    if (!tenantId) {
      return null;
    }

    try {
      // Use the public API to query the materialized view
      const result = await this.makeDefaultRequest<{
        success: boolean;
        data: Array<{ tenant_logo_url: string }>;
      }>(
        `/api/public/tenant/${tenantId}/logo`,
        {},
        `public-tenant-logo-${tenantId}`,
        this.cacheTTL
      );
      
      if (result && result.data && result.data.success && result.data.data && result.data.data.length > 0) {
        const logoUrl = result.data.data[0].tenant_logo_url; 
        return logoUrl;
      }

      return null;
    } catch (error) {
      console.error('[PublicTenantInfoService] Failed to get tenant logo from discovery:', error);
      return null;
    }
  }
}

export const publicTenantInfoService = PublicTenantInfoService.getInstance();
export default PublicTenantInfoService;
