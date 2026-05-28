/**
 * Tenant Info Service
 * 
 * Handles tenant-specific operations, management, and authenticated requests
 * Extends TenantApiSingleton for tenant context and authentication
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage, RequestType } from '@/providers/base/FlexibleApiSingleton';
import { platformHomeService } from './PlatformHomeSingletonService';
import { platformDashboardService } from './PlatformDashboardSingletonService';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface PaymentGateway {
  id: string;
  name: string;
  type: string;
  gateway_type: string;
  is_active: boolean;
  is_default: boolean;
  config: any;
  last_verified_at?: string;
  verification_status?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
  } | string;
}

class TenantInfoService extends TenantApiSingleton {
  private static _instance: TenantInfoService;

  /**
   * PILOT: Get all cache patterns for this service
   * Documents all cache keys that this service manages
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-gateways-{tenantId}*',
      'tenant-subdomain-{tenantId}*',
      'tenant-update-subdomain-{tenantId}*',
      'tenant-delete-subdomain-{tenantId}*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   * Other services can call this to invalidate tenant info caches
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      // Invalidate specific tenant info caches
      await this.invalidateCachePattern(`tenant-gateways-${tenantId}*`);
      await this.invalidateCachePattern(`tenant-subdomain-${tenantId}*`);
    } else {
      // Invalidate all tenant info caches
      await this.invalidateCachePattern('tenant*');
    }
  }

  /**
   * PILOT: Declare cross-service cache dependencies
   * Tenant info service depends on platform service for complete tenant data
   */
  public getCrossServiceInvalidations(): Array<{service: () => any, method: string, params: any[]}> {
    return [
      // Note: This will be called with tenantId parameter when needed
    ];
  }

  protected constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      encrypt: false,
      ...cacheOptions
    });
  }

  public static getInstance(): TenantInfoService {
    if (!TenantInfoService._instance) {
      TenantInfoService._instance = new TenantInfoService('tenant-info-service');
    }
    return TenantInfoService._instance;
  }

  /**
   * Get payment gateways for tenant
   * Uses the /api/tenants/:tenantId/payment-gateways endpoint
   */
  async getPaymentGateways(tenantId: string): Promise<PaymentGateway[]> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getPaymentGateways: tenantId is required');
        return [];
      }

      const result = await this.makeDefaultRequest<PaymentGateway[]>(
        `/api/tenants/${tenantId}/payment-gateways`,
        {},
        `tenant-gateways-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get payment gateways:', result.error);
        return [];
      }

      return Array.isArray(result.data) ? result.data : [];
    } catch (error) {
      console.error('[TenantInfoService] Failed to get payment gateways:', error);
      return [];
    }
  }

  /**
   * Get payment gateways with Stripe Connect status
   * Uses the /api/tenants/:tenantId/payment-gateways endpoint
   */
  async getPaymentGatewaysWithStripeConnect(tenantId: string): Promise<{
    gateways: PaymentGateway[];
    stripeConnect: {
      connected: boolean;
      status: string | null;
      payoutsEnabled: boolean;
      paymentsEnabled: boolean;
      feePercent?: number;
    } | null;
  }> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getPaymentGatewaysWithStripeConnect: tenantId is required');
        return { gateways: [], stripeConnect: null };
      }

      const result = await this.makeDefaultRequest<{ gateways: PaymentGateway[]; stripeConnect: any }>(
        `/api/tenants/${tenantId}/payment-gateways`,
        {},
        `tenant-gateways-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get payment gateways:', result.error);
        return { gateways: [], stripeConnect: null };
      }

      return {
        gateways: Array.isArray(result.data?.gateways) ? result.data.gateways : [],
        stripeConnect: result.data?.stripeConnect || null,
      };
    } catch (error) {
      console.error('[TenantInfoService] Failed to get payment gateways:', error);
      return { gateways: [], stripeConnect: null };
    }
  }

  /**
   * Start Stripe Connect onboarding for tenant
   * Uses the /api/tenants/:tenantId/stripe-connect/onboard endpoint
   */
  async startStripeConnectOnboarding(tenantId: string): Promise<{
    success: boolean;
    onboardingUrl?: string;
    error?: string;
  }> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] startStripeConnectOnboarding: tenantId is required');
        return { success: false, error: 'tenantId is required' };
      }

      const result = await this.makeDefaultRequest<{ success: boolean; onboarding_url?: string; error?: string }>(
        `/api/tenants/${tenantId}/stripe-connect/onboard`,
        {
          method: 'POST',
        },
        undefined,
        0,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      console.log(`[TenantInfoService] Start Stripe Connect onboarding result for tenant ${tenantId}:`, result);
      if (!result.success) {
        console.error('[TenantInfoService] Failed to start Stripe Connect onboarding:', result.error);
        const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to start onboarding';
        return { success: false, error: errorMessage };
      }

      return {
        success: result.data?.success ?? true,
        onboardingUrl: result.data?.onboarding_url,
      };
    } catch (error) {
      console.error('[TenantInfoService] Failed to start Stripe Connect onboarding:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start onboarding';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Refresh Stripe Connect status from Stripe API
   * Uses the /api/tenants/:tenantId/stripe-connect/refresh endpoint
   */
  async refreshStripeConnectStatus(tenantId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] refreshStripeConnectStatus: tenantId is required');
        return { success: false, error: 'tenantId is required' };
      }

      const result = await this.makeDefaultRequest<{ success: boolean; error?: string }>(
        `/api/tenants/${tenantId}/stripe-connect/refresh`,
        {
          method: 'POST',
        },
        undefined,
        0,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );

      if (!result.success) {
        console.error('[TenantInfoService] Failed to refresh Stripe Connect status:', result.error);
        const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to refresh status';
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error) {
      console.error('[TenantInfoService] Failed to refresh Stripe Connect status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh status';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Unlink a GBP (Google Business Profile) location from tenant
   * Uses the /api/tenants/:tenantId/gbp/unlink endpoint
   */
  async unlinkGBPLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] unlinkGBPLocation: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/gbp/unlink`,
        {
          method: 'POST',
          body: JSON.stringify({})
        },
        `tenant-gbp-unlink-${tenantId}`
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to unlink GBP location:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to unlink GBP location:', error);
      return null;
    }
  }

  /**
   * Link a GBP (Google Business Profile) location to tenant
   * Uses the /api/tenants/:tenantId/gbp/link endpoint
   */
  async linkGBPLocation(tenantId: string, locationId: string, locationName: string, fullAddress: string): Promise<any> {
    try {
      if (!tenantId || !locationId) {
        console.error('[TenantInfoService] linkGBPLocation: tenantId and locationId are required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/gbp/link`,
        {
          method: 'POST',
          body: JSON.stringify({
            locationId,
            locationName,
            fullAddress
          })
        },
        `tenant-gbp-link-${tenantId}-${locationId}`
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to link GBP location:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to link GBP location:', error);
      return null;
    }
  }

  /**
   * Get GBP (Google Business Profile) available locations
   * Uses the /api/tenants/:tenantId/gbp/locations endpoint
   */
  async getGBPLocations(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getGBPLocations: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/gbp/locations`,
        {},
        `tenant-gbp-locations-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get GBP locations:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get GBP locations:', error);
      return null;
    }
  }

  /**
   * Get GBP (Google Business Profile) linked location
   * Uses the /google/business/linked-location endpoint
   */
  async getGBPLinkedLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getGBPLinkedLocation: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/linked-location?tenantId=${tenantId}`,
        {},
        `tenant-gbp-location-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get GBP linked location:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get GBP linked location:', error);
      return null;
    }
  }

  /**
   * Get GBP (Google Business Profile) connection status
   * Uses the /google/business/status endpoint
   */
  async getGBPConnectionStatus(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getGBPConnectionStatus: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/status?tenantId=${tenantId}`,
        {},
        `tenant-gbp-status-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get GBP connection status:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get GBP connection status:', error);
      return null;
    }
  }

  /**
   * Get tenant information
   * Uses the /api/tenants/:tenantId endpoint
   * @param tenantId - The tenant ID
   * @param ssrAuth - Optional SSR auth headers { auth0Email, auth0Id }
   */
  async getTenantInfo(tenantId: string, ssrAuth?: { auth0Email?: string; auth0Id?: string }): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getTenantInfo: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}`,
        {},
        `tenant-info-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED,
          ssrAuth
        }
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get tenant info:', {
          error: result.error,
          status: result.status,
          tenantId,
          hasAuth0Email: !!ssrAuth?.auth0Email,
          hasAuth0Id: !!ssrAuth?.auth0Id
        });
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get tenant info:', error);
      return null;
    }
  }

  /**
   * Get tenant business hours with caching
   * Uses the /api/tenants/:tenantId/business-hours endpoint (authenticated)
   * For tenant dashboard and management pages
   */
  async getBusinessHours(tenantId: string): Promise<BusinessHours | null> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getBusinessHours: tenantId is required');
        return null;
      }

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
        `/api/tenant/${tenantId}/business-hours`,
        {},
        `tenant-business-hours-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get business hours:', result.error);
        return null;
      }

      if (result && result.data && result.data.success && result.data.data) {
        const { periods, timezone } = result.data.data;
        const hours: BusinessHours = { timezone };

        // Convert periods to day-based format for BusinessHoursDisplay
        periods.forEach((period: any) => {
          // Convert API day format (MONDAY) to title case (Monday) for display
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
      console.error('[TenantInfoService] Failed to get business hours:', error);
      return null;
    }
  }

  /**
   * Get tenant tier information
   * Uses the /api/tenants/:tenantId/tier endpoint
   */
  async getTenantTier(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getTenantTier: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/tier`,
        {},
        `tenant-tier-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get tenant tier:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get tenant tier:', error);
      return null;
    }
  }

  /**
   * Get complete tenant information with all details
   * Combines multiple API calls into one comprehensive object
   */
  async getCompleteTenantInfo(tenantId: string): Promise<{
    tenant: any | null;
    businessProfile: any | null;
    businessHours: any | null;
    paymentGateways: any[];
  }> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getCompleteTenantInfo: tenantId is required');
        return {
          tenant: null,
          businessProfile: null,
          businessHours: null,
          paymentGateways: []
        };
      }

      // Get tenant data independently - this is the core requirement
      const tenant = await this.getTenantDataWithCacheBusting(tenantId);

      // Get optional data independently - failures don't affect core tenant data
      let businessProfile = null;
      let businessHours = null;
      let paymentGateways: any[] = [];

      try {
        const orgResult = await this.getOrganization(tenantId);
        businessProfile = orgResult?.success ? orgResult.data : null;
      } catch (error) {
        // Organization failure doesn't break the entire operation
        console.warn('[TenantInfoService] Organization data unavailable:', error);
      }

      try {
        businessHours = await this.getBusinessHours(tenantId);
      } catch (error) {
        // Business hours failure doesn't break the entire operation
        console.warn('[TenantInfoService] Business hours unavailable:', error);
      }

      try {
        paymentGateways = await this.getPaymentGateways(tenantId);
      } catch (error) {
        // Payment gateways failure doesn't break the entire operation
        console.warn('[TenantInfoService] Payment gateways unavailable:', error);
      }

      return {
        tenant: tenant,
        businessProfile: businessProfile,
        businessHours: businessHours,
        paymentGateways: paymentGateways
      };
    } catch (error) {
      console.error('[TenantInfoService] Failed to get complete tenant info:', error);
      return {
        tenant: null,
        businessProfile: null,
        businessHours: null,
        paymentGateways: []
      };
    }
  }

  /**
   * Get OAuth status for a payment provider
   * Uses the /api/tenants/:tenantId/oauth/:provider/status endpoint
   */
  async getOAuthStatus(tenantId: string, provider: string): Promise<any> {
    try {
      if (!tenantId || !provider) {
        console.error('[TenantInfoService] getOAuthStatus: tenantId and provider are required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/oauth/${provider}/status?tenantId=${tenantId}`,
        {},
        `tenant-oauth-${tenantId}-${provider}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get OAuth status:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get OAuth status:', error);
      return null;
    }
  }

  /**
   * Update payment gateway active status
   * Uses the /api/tenants/:tenantId/payment-gateways/:gatewayId endpoint
   */
  async updatePaymentGatewayStatus(tenantId: string, gatewayId: string, isActive: boolean): Promise<any> {
    try {
      if (!tenantId || !gatewayId) {
        console.error('[TenantInfoService] updatePaymentGatewayStatus: tenantId and gatewayId are required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways/${gatewayId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ is_active: isActive })
        },
        `tenant-gateway-update-${tenantId}-${gatewayId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to update payment gateway status:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to update payment gateway status:', error);
      return null;
    }
  }

  /**
   * Set default payment gateway
   * Uses the /api/tenants/:tenantId/payment-gateways/:gatewayId/set-default endpoint
   */
  async setDefaultPaymentGateway(tenantId: string, gatewayId: string): Promise<any> {
    try {
      if (!tenantId || !gatewayId) {
        console.error('[TenantInfoService] setDefaultPaymentGateway: tenantId and gatewayId are required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways/${gatewayId}/set-default`,
        {
          method: 'POST',
          body: JSON.stringify({})
        },
        `tenant-gateway-set-default-${tenantId}-${gatewayId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to set default payment gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to set default payment gateway:', error);
      return null;
    }
  }

  /**
   * Delete payment gateway
   * Uses the /api/tenants/:tenantId/payment-gateways/:gatewayId endpoint
   */
  async deletePaymentGateway(tenantId: string, gatewayId: string): Promise<any> {
    try {
      if (!tenantId || !gatewayId) {
        console.error('[TenantInfoService] deletePaymentGateway: tenantId and gatewayId are required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways/${gatewayId}`,
        {
          method: 'DELETE'
        },
        `tenant-gateway-delete-${tenantId}-${gatewayId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to delete payment gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to delete payment gateway:', error);
      return null;
    }
  }

  /**
   * Save or update PayPal gateway configuration
   * Uses the /api/tenants/:tenantId/payment-gateways endpoint
   */
  async savePayPalGateway(tenantId: string, gatewayData: {
    gateway_type: string;
    mode: string;
    client_id: string;
    client_secret: string;
    display_name: string;
    is_active: boolean;
    is_default: boolean;
  }): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] savePayPalGateway: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways`,
        {
          method: 'POST',
          body: JSON.stringify(gatewayData)
        },
        `tenant-gateway-save-paypal-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to save PayPal gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to save PayPal gateway:', error);
      return null;
    }
  }

  /**
   * Save or update Square gateway configuration
   * Uses the /api/tenants/:tenantId/payment-gateways endpoint
   */
  async saveSquareGateway(tenantId: string, gatewayData: {
    gateway_type: string;
    environment: string;
    application_id: string;
    access_token: string;
    location_id: string;
    display_name: string;
    is_active: boolean;
    is_default: boolean;
  }): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] saveSquareGateway: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways`,
        {
          method: 'POST',
          body: JSON.stringify(gatewayData)
        },
        `tenant-gateway-save-square-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to save Square gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to save Square gateway:', error);
      return null;
    }
  }

  /**
   * Get users for a tenant
   * Uses the /api/tenants/:tenantId/users endpoint
   */
  async getUsers(tenantId: string): Promise<any[]> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/users`,
        {},
        `tenant-users-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get users:', result.error);
        return [];
      }

     /*  console.log('[TenantInfoService] API Response:', result);
      console.log('[TenantInfoService] result.data:', result.data);
 */
      // Extract users from the nested response structure
      // API returns: { success: true, users: [...], data: [...], items: [...], results: [...] }
      const users = result.data?.users || result.data?.data || result.data?.items || result.data?.results || [];
      //console.log('[TenantInfoService] Extracted users:', users);
      //console.log('[TenantInfoService] Is users array?', Array.isArray(users));
 
      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error('[TenantInfoService] Failed to get users:', error);
      return [];
    }
  }

  /**
   * Invite user to tenant
   * Uses the /api/tenants/:tenantId/users/invite endpoint
   */
  async inviteUser(tenantId: string, inviteData: {
    email: string;
    role: string;
  }): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/users/invite`,
        {
          method: 'POST',
          body: JSON.stringify(inviteData)
        },
        `tenant-invite-user-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to invite user:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to invite user:', error);
      return null;
    }
  }

  /**
   * Delete user from tenant
   * Uses the /api/tenants/:tenantId/users/:userId endpoint
   */
  async deleteUser(tenantId: string, userId: string): Promise<any> {
    try {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/users/${userId}`,
        {
          method: 'DELETE'
        },
        `tenant-delete-user-${tenantId}-${userId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to delete user:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to delete user:', error);
      return null;
    }
  }

  /**
   * Get OAuth authorization URL for payment gateway
   * Uses the /api/oauth/:gatewayType/authorize endpoint
   */
  async getOAuthAuthorizationUrl(gatewayType: string, tenantId: string): Promise<any> {
    try {
      if (!gatewayType || !tenantId) {
        throw new Error('Gateway type and Tenant ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/oauth/${gatewayType}/authorize?tenantId=${tenantId}`,
        {},
        `oauth-authorize-${gatewayType}-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get OAuth authorization URL:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get OAuth authorization URL:', error);
      return null;
    }
  }

  /**
   * Disconnect OAuth for payment gateway
   * Uses the /api/oauth/:gatewayType/disconnect endpoint
   */
  async disconnectOAuth(gatewayType: string, tenantId: string): Promise<any> {
    try {
      if (!gatewayType || !tenantId) {
        throw new Error('Gateway type and Tenant ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/oauth/${gatewayType}/disconnect`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tenantId })
        },
        `oauth-disconnect-${gatewayType}-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to disconnect OAuth:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to disconnect OAuth:', error);
      return null;
    }
  }

  /**
   * Register Square test token (admin-only, for sandbox testing)
   * Uses the /api/oauth/square/register-test-token endpoint
   */
  async registerSquareTestToken(tenantId: string, data: {
    accessToken: string;
    merchantId?: string;
    applicationId: string;
    locationId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      if (!tenantId || !data.accessToken || !data.applicationId || !data.locationId) {
        throw new Error('tenantId, accessToken, applicationId, and locationId are required');
      }

      const result = await this.makeDefaultRequest<any>(
        '/api/oauth/square/register-test-token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId,
            accessToken: data.accessToken,
            merchantId: data.merchantId,
            applicationId: data.applicationId,
            locationId: data.locationId,
          })
        },
        `oauth-square-test-token-${tenantId}`
      );

      if (!result.success) {
        console.error('[TenantInfoService] Failed to register Square test token:', result.error);
        const errorMsg = typeof result.error === 'string' ? result.error : 
          (result.error as any)?.message || 'Failed to register test token';
        return { success: false, error: errorMsg };
      }

      return { success: true };
    } catch (error) {
      console.error('[TenantInfoService] Failed to register Square test token:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to register test token';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get tenant subdomain
   */
  async getTenantSubdomain(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}`,
        {},
        `tenant-subdomain-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get tenant subdomain:', error);
      throw error;
    }
  }

  /**
   * Get user subdomains
   */
  async getUserSubdomains(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/my-subdomains?tenantId=${tenantId}`,
        {},
        `tenant-user-subdomains-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get user subdomains:', result.error);
        throw new Error(getErrorMessage(result.error) || 'Failed to get user subdomains');
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get user subdomains:', error);
      throw error;
    }
  }

  /**
   * Check subdomain availability
   */
  async checkSubdomainAvailability(subdomain: string): Promise<any> {
    try {
      if (!subdomain) {
        throw new Error('Subdomain is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/check-subdomain/${subdomain}`,
        {},
        `tenant-check-subdomain-${subdomain}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to check subdomain availability:', result.error);
        throw new Error(getErrorMessage(result.error) || 'Failed to check subdomain availability');
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to check subdomain availability:', error);
      throw error;
    }
  }

  /**
   * Update tenant subdomain
   */
  async updateTenantSubdomain(tenantId: string, subdomain: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { 
          method: 'PUT',
          body: JSON.stringify({ subdomain })
        },
        `tenant-update-subdomain-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to update tenant subdomain:', result.error);
        const error = new Error(getErrorMessage(result.error) || 'Failed to update tenant subdomain');
        (error as any).cause = result.error;
        throw error;
      }

      // Invalidate tenant complete cache for this tenant - use service contract
      await this.invalidateServiceCaches(tenantId);
      
      // Also invalidate platform service caches via cross-service dependency
      await platformHomeService.invalidateTenantCaches(tenantId);
      
      // Invalidate platform dashboard cache since tenant subdomain affects stats
      await platformDashboardService.invalidateStatsCache();
      
      return result.data!;
    } catch (error) {
      console.error('[TenantInfoService] Failed to update tenant subdomain:', error);
      throw error;
    }
  }

  /**
   * Delete tenant subdomain
   */
  async deleteTenantSubdomain(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { method: 'DELETE' },
        `tenant-delete-subdomain-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to delete tenant subdomain:', result.error);
        const error = new Error(getErrorMessage(result.error) || 'Failed to delete tenant subdomain');
        (error as any).cause = result.error;
        throw error;
      }

      // Invalidate tenant complete cache for this tenant - use service contract
      await this.invalidateServiceCaches(tenantId);
      
      // Also invalidate platform service caches via cross-service dependency
      await platformHomeService.invalidateTenantCaches(tenantId);
      
      // Invalidate platform dashboard cache since tenant subdomain affects stats
      await platformDashboardService.invalidateStatsCache();
      
      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to delete tenant subdomain:', error);
      throw error;
    }
  }

  /**
   * Delete subdomain by tenant ID
   */
  async deleteSubdomainByTenantId(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { method: 'DELETE' },
        `tenant-delete-subdomain-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to delete subdomain:', result.error);
        const error = new Error(getErrorMessage(result.error) || 'Failed to delete subdomain');
        (error as any).cause = result.error;
        throw error;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to delete subdomain:', error);
      throw error;
    }
  }

  /**
   * Get tenant data with cache busting
   */
  async getTenantDataWithCacheBusting(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const timestamp = Date.now();
      const result = await this.makeDefaultRequest<any>(
        // `/api/tenants/${tenantId}?_t=${timestamp}`,
        // {},
        // `tenant-data-cache-busting-${tenantId}-${timestamp}`
        `/api/tenants/${tenantId}`,
        {},
        `tenant-data-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get tenant data with cache busting:', result.error);
        throw new Error(getErrorMessage(result.error) || 'Failed to get tenant data with cache busting');
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get tenant data with cache busting:', error);
      throw error;
    }
  }

  /**
   * Get tenant status preview
   */
  async getTenantStatusPreview(tenantId: string, status?: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/status/preview`,
        { 
          method: 'POST',
          body: JSON.stringify({ status })
        },
        `tenant-status-preview-${tenantId}-${status || 'default'}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get tenant status preview:', result.error);
        const error = new Error(getErrorMessage(result.error) || 'Failed to get tenant status preview');
        (error as any).cause = result.error;
        throw error;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get tenant status preview:', error);
      throw error;
    }
  }

  /**
   * Update tenant status with immediate frontend cache invalidation
   */
  async updateTenantStatus(tenantId: string, status: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/status`,
        { 
          method: 'PATCH',
          body: JSON.stringify({
            status: status
          })
        },
        `tenant-update-status-${tenantId}`,
        0, // No cache for updates
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to update tenant status:', result.error);
        const error = new Error(getErrorMessage(result.error) || 'Failed to update tenant status');
        (error as any).cause = result.error;
        throw error;
      }

      // 🔥 CRITICAL: Invalidate frontend singleton caches immediately
      await this.invalidateAllTenantCaches(tenantId);

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to update tenant status:', error);
      throw error;
    }
  }

  /**
   * Invalidate all frontend singleton caches for a tenant
   * This ensures immediate propagation across browser and server caches
   */
  async invalidateAllTenantCaches(tenantId: string): Promise<void> {
    try {
      console.log(`[Frontend Cache] Starting cache invalidation for tenant ${tenantId}`);
      
      // Get tenant info for additional cache keys (slug-based invalidation)
      const tenantInfo = await this.getTenantInfo(tenantId).catch(() => null);
      const slug = tenantInfo?.slug;

      const invalidations = [
        // Primary tenant info caches (affects /tenant/[id] page)
        this.invalidateCache(`public-tenant-info-${tenantId}`),
        this.invalidateCache(`public-tenant-profile-${tenantId}`),
        this.invalidateCache(`tenant-hours-${tenantId}`),
        
        // Shop caches (affects /shops/[slug] and /products/[id] pages)
        slug ? this.invalidateCache(`shop-data-${slug}`) : null,
        slug ? this.invalidateCache(`shop:slug:${slug}`) : null,
        this.invalidateCache(`shop:tenantId:${tenantId}`),
        
        // Directory caches (affects /directory/[slug] page)
        slug ? this.invalidateCache(`directory-listing-${slug}`) : null,
        this.invalidateCache(`directory:*${tenantId}*`),
        
        // Pattern-based invalidation for comprehensive cleanup
        this.invalidateCache(`*${tenantId}*`),
        slug ? this.invalidateCache(`*${slug}*`) : null,
        
        // Business hours cache
        this.invalidateCache(`business-hours-${tenantId}`),
        this.invalidateCache(`business-hours-v2-${tenantId}`),
      ].filter(Boolean);

      await Promise.all(invalidations);
      
      console.log(`[Frontend Cache] Invalidated ${invalidations.length} cache keys for tenant ${tenantId}`);
      console.log(`[Frontend Cache] Invalidated keys for slug: ${slug || 'no-slug'}`);
      
    } catch (error) {
      console.error(`[Frontend Cache] Error invalidating caches for tenant ${tenantId}:`, error);
      // Don't throw - cache invalidation failure shouldn't break the status update
    }
  }

  /**
   * Get Google Business Profile status
   */
  async getGoogleBusinessProfileStatus(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/status?tenantId=${tenantId}`,
        {},
        `tenant-gbp-status-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get Google Business Profile status:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get Google Business Profile status:', error);
      return null;
    }
  }

  /**
   * Get Google Business Profile linked location
   */
  async getGoogleBusinessProfileLinkedLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/linked-location?tenantId=${tenantId}`,
        {},
        `tenant-gbp-linked-location-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get Google Business Profile linked location:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get Google Business Profile linked location:', error);
      return null;
    }
  }

  /**
   * Get Google Business Profile locations
   */
  async getGoogleBusinessProfileLocations(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/locations?tenantId=${tenantId}`,
        {},
        `tenant-gbp-locations-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get Google Business Profile locations:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get Google Business Profile locations:', error);
      return null;
    }
  }

  /**
   * Link Google Business Profile location
   */
  async linkGoogleBusinessProfileLocation(tenantId: string, locationData: any): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/link-location`,
        { 
          method: 'POST',
          body: JSON.stringify(locationData)
        },
        `tenant-gbp-link-location-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to link Google Business Profile location:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to link Google Business Profile location:', error);
      return null;
    }
  }

  /**
   * Unlink Google Business Profile location
   */
  async unlinkGoogleBusinessProfileLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/unlink-location`,
        { 
          method: 'POST',
          body: JSON.stringify({})
        },
        `tenant-gbp-unlink-location-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to unlink Google Business Profile location:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to unlink Google Business Profile location:', error);
      return null;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/user/preferences',
        {},
        'user-preferences',
        this.cacheTTL,
        {
          context: AppContext.USER,
          isolation: CacheIsolation.USER,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get user preferences:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/auth/me',
        {},
        'auth-current-user',
        this.cacheTTL,
        {
          context: AppContext.USER,
          isolation: CacheIsolation.USER,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        // Don't log as error - unauthenticated requests are normal on public pages
        console.log('[TenantInfoService] User not authenticated');
        return null;
      }

      return result.data;
    } catch (error) {
      // Don't log as error - unauthenticated requests are normal on public pages
      console.log('[TenantInfoService] User not authenticated');
      return null;
    }
  }

  /**
   * Get organization
   */
  async getOrganization(organizationId: string): Promise<{
    success: boolean;
    data?: any;
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      if (!organizationId) {
        return this.createResponse(false, undefined, undefined, 'Organization ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/organizations/${organizationId}`,
        {},
        `tenant-organization-${organizationId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      
      if (!result.success) {
        this.logError('Failed to get organization', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      return this.createResponse(true, result.data);
    } catch (error) {
      this.logError('Failed to get organization', error);
      return this.createResponse(false, undefined, error, 'Failed to connect to organization service');
    }
  }

  /**
   * Get organizations
   */
  async getPaymentGatewaySettings(tenantId: string): Promise<{
    gateway_enabled: boolean;
    stripe_enabled: boolean;
    paypal_enabled: boolean;
    square_enabled: boolean;
    clover_enabled: boolean;
  } | null> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getPaymentGatewaySettings: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: {
          gateway_enabled: boolean;
          stripe_enabled: boolean;
          paypal_enabled: boolean;
          square_enabled: boolean;
          clover_enabled: boolean;
        };
      }>(
        `/api/tenants/${tenantId}/payment-gateway-settings`,
        {},
        `tenant-gateway-settings-${tenantId}`,
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get payment gateway settings:', result.error);
        return null;
      }

      return result.data?.settings ?? null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get payment gateway settings:', error);
      return null;
    }
  }

  async updatePaymentGatewaySettings(tenantId: string, settings: {
    gateway_enabled?: boolean;
    stripe_enabled?: boolean;
    paypal_enabled?: boolean;
    square_enabled?: boolean;
    clover_enabled?: boolean;
  }): Promise<{
    gateway_enabled: boolean;
    stripe_enabled: boolean;
    paypal_enabled: boolean;
    square_enabled: boolean;
    clover_enabled: boolean;
  } | null> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] updatePaymentGatewaySettings: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: {
          gateway_enabled: boolean;
          stripe_enabled: boolean;
          paypal_enabled: boolean;
          square_enabled: boolean;
          clover_enabled: boolean;
        };
      }>(
        `/api/tenants/${tenantId}/payment-gateway-settings`,
        {
          method: 'PUT',
          body: JSON.stringify(settings),
        },
        `tenant-gateway-settings-update-${tenantId}`
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to update payment gateway settings:', result.error);
        return null;
      }

      return result.data?.settings ?? null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to update payment gateway settings:', error);
      return null;
    }
  }

  async getProductOptionsSettings(tenantId: string): Promise<{
    product_physical_enabled: boolean;
    product_digital_enabled: boolean;
    product_hybrid_enabled: boolean;
    product_service_enabled: boolean;
    product_variant_enabled: boolean;
    product_gallery_enabled: boolean;
    product_video_enabled: boolean;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: {
          product_physical_enabled: boolean;
          product_digital_enabled: boolean;
          product_hybrid_enabled: boolean;
          product_service_enabled: boolean;
          product_variant_enabled: boolean;
          product_gallery_enabled: boolean;
          product_video_enabled: boolean;
        };
      }>(
        `/api/tenants/${tenantId}/product-options`,
        {},
        `tenant-product-options-settings-${tenantId}`,
        this.cacheTTL,
        { context: AppContext.TENANT, isolation: CacheIsolation.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      if (!result.success) return null;
      return result.data?.settings ?? null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get product options settings:', error);
      return null;
    }
  }

  async getFeaturedOptionsSettings(tenantId: string): Promise<{
    featured_enabled: boolean;
    featured_store_selection: boolean;
    featured_new_arrival: boolean;
    featured_seasonal: boolean;
    featured_sale: boolean;
    featured_staff_pick: boolean;
    featured_clearance: boolean;
    featured_featured: boolean;
    featured_bestseller: boolean;
    featured_trending: boolean;
    featured_recommended: boolean;
    featured_random_featured: boolean;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: Record<string, boolean>;
      }>(
        `/api/tenants/${tenantId}/featured-options`,
        {},
        `tenant-featured-options-settings-${tenantId}`,
        this.cacheTTL,
        { context: AppContext.TENANT, isolation: CacheIsolation.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      if (!result.success) return null;
      return result.data?.settings as any ?? null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get featured options settings:', error);
      return null;
    }
  }

  async getIntegrationOptionsSettings(tenantId: string): Promise<{
    integration_enabled: boolean;
    integration_clover: boolean;
    integration_square: boolean;
    integration_gbp: boolean;
    integration_google_shopping: boolean;
    integration_google_merchant_center: boolean;
    integration_gmc_sync: boolean;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: Record<string, boolean>;
      }>(
        `/api/tenants/${tenantId}/integration-options`,
        {},
        `tenant-integration-options-settings-${tenantId}`,
        this.cacheTTL,
        { context: AppContext.TENANT, isolation: CacheIsolation.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      if (!result.success) return null;
      return result.data?.settings as any ?? null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get integration options settings:', error);
      return null;
    }
  }

  async getQuickstartOptionsSettings(tenantId: string): Promise<{
    quickstart_enabled: boolean;
    quickstart_wizard: boolean;
    quickstart_wizard_ai: boolean;
    quickstart_category_generator: boolean;
    quickstart_ai_openai: boolean;
    quickstart_ai_gemini: boolean;
    quickstart_image_gen: boolean;
    quickstart_image_hd: boolean;
    default_text_model: string;
    default_image_model: string;
    default_image_quality: string;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: Record<string, any>;
      }>(
        `/api/tenants/${tenantId}/quickstart-options`,
        {},
        `tenant-quickstart-options-settings-${tenantId}`,
        this.cacheTTL,
        { context: AppContext.TENANT, isolation: CacheIsolation.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      if (!result.success) return null;
      return result.data?.settings as any ?? null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get quickstart options settings:', error);
      return null;
    }
  }

  async getStorefrontOptionsSettings(tenantId: string): Promise<{
    storefront_opt_enabled: boolean;
    hours_animated: boolean;
    hours_status: boolean;
    category_store: boolean;
    category_product: boolean;
    recommend_store: boolean;
    recommend_products: boolean;
    recently_viewed: boolean;
    storefront_social_media: boolean;
    storefront_contact: boolean;
    interactive_maps: boolean;
    qr_codes_512: boolean;
    qr_codes_1024: boolean;
    qr_codes_2048: boolean;
    qr_product: boolean;
    qr_store: boolean;
    qr_logo: boolean;
    qr_directory: boolean;
    image_gallery_5: boolean;
    image_gallery_10: boolean;
    image_gallery_15: boolean;
    enhanced_seo: boolean;
    storefront_actions: boolean;
    default_qr_resolution: string;
    default_gallery_limit: number;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: Record<string, any>;
      }>(
        `/api/tenants/${tenantId}/storefront-options`,
        {},
        `tenant-storefront-options-settings-${tenantId}`,
        this.cacheTTL,
        { context: AppContext.TENANT, isolation: CacheIsolation.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      if (!result.success) return null;
      return result.data?.settings as any ?? null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get storefront options settings:', error);
      return null;
    }
  }

  /**
   * Get all tiers that have a given capability type enabled.
   * Reusable for any capability — used for "upgrade to access" messaging.
   */
  async getTiersWithCapability(capabilityTypeKey: string): Promise<{
    tier_key: string;
    tier_name: string;
    tier_description: string;
    capability_enabled: boolean;
    features: { feature_key: string; feature_name: string; is_enabled: boolean }[];
  }[] | null> {
    try {
      const result = await this.makeDefaultRequest<any[]>(
        `/api/tenants/capabilities/tiers-by-capability?capabilityTypeKey=${encodeURIComponent(capabilityTypeKey)}`,
        {},
        `tenant-tiers-by-capability-${capabilityTypeKey}`,
        this.cacheTTL,
        { context: AppContext.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      return Array.isArray(result.data) ? result.data : null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get tiers with capability:', error);
      return null;
    }
  }

  async getCommerceSettings(tenantId: string): Promise<{
    deposit_enabled: boolean;
    full_payment_enabled: boolean;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: Record<string, any>;
      }>(
        `/api/tenants/${tenantId}/commerce-settings`,
        {},
        `tenant-commerce-settings-${tenantId}`,
        this.cacheTTL,
        { context: AppContext.TENANT, isolation: CacheIsolation.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      if (!result.success) return null;
      const s = result.data?.settings;
      return s ? { deposit_enabled: !!s.deposit_enabled, full_payment_enabled: !!s.full_payment_enabled } : null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get commerce settings:', error);
      return null;
    }
  }

  async getFulfillmentSettings(tenantId: string): Promise<{
    pickup_enabled: boolean;
    delivery_enabled: boolean;
    shipping_enabled: boolean;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.makeDefaultRequest<{
        success: boolean;
        settings: Record<string, any>;
      }>(
        `/api/tenants/${tenantId}/fulfillment-settings`,
        {},
        `tenant-fulfillment-settings-${tenantId}`,
        this.cacheTTL,
        { context: AppContext.TENANT, isolation: CacheIsolation.TENANT, requestType: RequestType.AUTHENTICATED }
      );
      if (!result.success) return null;
      const s = result.data?.settings;
      return s ? { pickup_enabled: !!s.pickup_enabled, delivery_enabled: !!s.delivery_enabled, shipping_enabled: !!s.shipping_enabled } : null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get fulfillment settings:', error);
      return null;
    }
  }

  async getOrganizations(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/organizations',
        {},
        'tenant-organizations',
        this.cacheTTL,
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get organizations:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get organizations:', error);
      return null;
    }
  }
}

export const tenantInfoService = TenantInfoService.getInstance();
export default TenantInfoService;
