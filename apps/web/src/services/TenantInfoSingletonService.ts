/**
 * Tenant Info Singleton Service
 *
 * Extends UniversalSingleton to provide architecture for automatic authentication and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { tenantPublicService } from '@/services/TenantPublicService';
import { platformHomeService } from './PlatformHomeSingletonService';
import { platformDashboardService } from './PlatformDashboardSingletonService';

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

class TenantInfoSingletonService extends TenantApiSingleton {
  private static _instance: TenantInfoSingletonService;

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      encrypt: false,
      ...cacheOptions
    });
  }

  public static getInstance(): TenantInfoSingletonService {
    if (!TenantInfoSingletonService._instance) {
      TenantInfoSingletonService._instance = new TenantInfoSingletonService('tenant-info-service');
    }
    return TenantInfoSingletonService._instance;
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
      //console.log(`[TenantInfoSingleton] Making API call to /api/public/tenant/${tenantId}`);
      const startTime = Date.now();
      
      // Use public service for public endpoint
      const tenant = await tenantPublicService.getPublicTenantInfo(tenantId);
      
      const endTime = Date.now();
      //console.log(`[TenantInfoSingleton] Tenant API call completed in ${endTime - startTime}ms, result:`, tenant);

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
      //console.log(`[TenantInfoSingleton] Making API call to /api/public/tenant/${tenantId}/profile`);
      const startTime = Date.now();
      
      // Use public service for public endpoint
      const profile = await tenantPublicService.getPublicTenantProfile(tenantId);
      
      const endTime = Date.now();
      //console.log(`[TenantInfoSingleton] Profile API call completed in ${endTime - startTime}ms, result:`, profile);

      return profile || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get business profile:', error);
      return null;
    }
  }

  /**
   * Get tenant tier information with caching
   * Uses the /api/tenants/:tenantId/tier/public endpoint
   */
  async getTenantTier(tenantId: string): Promise<TenantTier | null> {
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getTenantTier: tenantId is required');
      return null;
    }

    try {
      // Use public service for public endpoint
      const result = await tenantPublicService.getPublicTenantTier(tenantId);

      return result || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get tenant tier:', error);
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
      console.error('[TenantInfoSingleton] getBusinessHours: tenantId is required');
      return null;
    }

    try {
      // Use default request type (TENANT) for primary operation
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
        `tenant-business-hours-${tenantId}`,
        this.cacheTTL,
        {
          requireTenantContext: true,
          validateTenantAccess: true,
          tenantId: tenantId
        }
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get business hours:', result.error);
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
      // Use default request type (TENANT) for primary operation
      const response = await this.makeDefaultRequest<{
        success: boolean;
        gateways: PaymentGateway[];
      }>(
        `/public/tenant/${tenantId}/payment-gateways`,
        {},
        `payment-gateways-${tenantId}`,
        this.cacheTTL
      );
      if (!response.success){
        console.error('[TenantInfoSingleton] Failed to get payment gateways:', response.error);
        return [];
      }

      if (response?.success && response.data?.gateways) {
        console.log(`[TenantInfoSingleton] getPaymentGateways SUCCESS for tenant: ${tenantId}`, new Date().toISOString());
        return response.data.gateways;
      }

      console.log(`[TenantInfoSingleton] getPaymentGateways NO DATA for tenant: ${tenantId}`, new Date().toISOString());
      return [];
    } catch (error) {
      console.error(`[TenantInfoSingleton] getPaymentGateways ERROR for tenant: ${tenantId}`, error);
      return [];
    }
  }

  /**
   * Get tenant fulfillment settings with caching
   * Uses the /public/tenant/:tenantId/fulfillment-settings endpoint
   */
  async getFulfillmentSettings(tenantId: string): Promise<any> {
    console.log(`[TenantInfoSingleton] getFulfillmentSettings START for tenant: ${tenantId}`, new Date().toISOString());
    
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getFulfillmentSettings: tenantId is required');
      return null;
    }

    try {
      // Use default request type (TENANT) for primary operation
      const response = await this.makeDefaultRequest<{
        success: boolean;
        settings: any;
      }>(
        `/api/public/tenant/${tenantId}/fulfillment-settings`,
        {},
        `fulfillment-settings-${tenantId}`,
        this.cacheTTL
      );
      if (!response.success){
        console.error('[TenantInfoSingleton] Failed to get fulfillment settings:', response.error);
        return null;
      }

      if (response?.success && response.data?.settings) {
        console.log(`[TenantInfoSingleton] getFulfillmentSettings SUCCESS for tenant: ${tenantId}`, new Date().toISOString());
        return response.data.settings;
      }

      console.log(`[TenantInfoSingleton] getFulfillmentSettings NO DATA for tenant: ${tenantId}`, new Date().toISOString());
      return null;
    } catch (error) {
      console.error(`[TenantInfoSingleton] getFulfillmentSettings ERROR for tenant: ${tenantId}`, error);
      return null;
    }
  }

  /**
   * Get tenant payment gateway status
   * Uses the /api/tenants/:tenantId/payment-gateway endpoint
   */
  async getPaymentGatewayStatus(tenantId: string): Promise<any> {
    console.log(`[TenantInfoSingleton] getPaymentGatewayStatus START for tenant: ${tenantId}`, new Date().toISOString());
    
    if (!tenantId) {
      console.error('[TenantInfoSingleton] getPaymentGatewayStatus: tenantId is required');
      return null;
    }

    try {
      // Use default request type (TENANT) for primary operation
      const response = await this.makeDefaultRequest<{
        hasActiveGateway: boolean;
        defaultGatewayType?: string;
      }>(
        `/tenants/${tenantId}/payment-gateway`,
        {},
        `payment-gateway-status-${tenantId}`,
        this.cacheTTL
      );
      if (!response.success){
        console.error('[TenantInfoSingleton] Failed to get payment gateway status');
        return null;
      }

      console.log(`[TenantInfoSingleton] getPaymentGatewayStatus SUCCESS for tenant: ${tenantId}`, new Date().toISOString());
      return response.data;
    } catch (error) {
      console.error(`[TenantInfoSingleton] getPaymentGatewayStatus ERROR for tenant: ${tenantId}`, error);
      return null;
    }
  }
  /**
   * Get OAuth status for payment gateways
   * Uses the /api/oauth/:provider/status endpoint
   */
  async getOAuthStatus(tenantId: string, provider: 'paypal' | 'square'): Promise<any> {
    try {
      if (!tenantId || !provider) {
        console.error('[TenantInfoSingleton] getOAuthStatus: tenantId and provider are required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/oauth/${provider}/status?tenantId=${tenantId}`,
        {},
        `tenant-oauth-${provider}-status-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get OAuth status:', result.error);
        return null;
      }
      

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get OAuth status:', error);
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
        console.error('[TenantInfoSingleton] updatePaymentGatewayStatus: tenantId and gatewayId are required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways/${gatewayId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ is_active: isActive })
        },
        `tenant-gateway-update-${tenantId}-${gatewayId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to update payment gateway status:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to update payment gateway status:', error);
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
        console.error('[TenantInfoSingleton] setDefaultPaymentGateway: tenantId and gatewayId are required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways/${gatewayId}/set-default`,
        {
          method: 'POST',
          body: JSON.stringify({})
        },
        `tenant-gateway-set-default-${tenantId}-${gatewayId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to set default payment gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to set default payment gateway:', error);
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
        console.error('[TenantInfoSingleton] deletePaymentGateway: tenantId and gatewayId are required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways/${gatewayId}`,
        {
          method: 'DELETE'
        },
        `tenant-gateway-delete-${tenantId}-${gatewayId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to delete payment gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to delete payment gateway:', error);
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
        console.error('[TenantInfoSingleton] savePayPalGateway: tenantId is required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways`,
        {
          method: 'POST',
          body: JSON.stringify(gatewayData)
        },
        `tenant-gateway-save-paypal-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to save PayPal gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to save PayPal gateway:', error);
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
        console.error('[TenantInfoSingleton] saveSquareGateway: tenantId is required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/payment-gateways`,
        {
          method: 'POST',
          body: JSON.stringify(gatewayData)
        },
        `tenant-gateway-save-square-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to save Square gateway:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to save Square gateway:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/users`,
        {},
        `tenant-users-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get users:', result.error);
        return [];
      }

      console.log('[TenantInfoSingleton] API Response:', result);
      console.log('[TenantInfoSingleton] result.data:', result.data);

      // Extract users from the nested response structure
      // API returns: { success: true, users: [...], data: [...], items: [...], results: [...] }
      const users = result.data?.users || result.data?.data || result.data?.items || result.data?.results || [];
      console.log('[TenantInfoSingleton] Extracted users:', users);
      console.log('[TenantInfoSingleton] Is users array?', Array.isArray(users));

      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get users:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/users/invite`,
        {
          method: 'POST',
          body: JSON.stringify(inviteData)
        },
        `tenant-invite-user-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to invite user:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to invite user:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/users/${userId}`,
        {
          method: 'DELETE'
        },
        `tenant-delete-user-${tenantId}-${userId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to delete user:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to delete user:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/oauth/${gatewayType}/authorize?tenantId=${tenantId}`,
        {},
        `oauth-authorize-${gatewayType}-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get OAuth authorization URL:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get OAuth authorization URL:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
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
        console.error('[TenantInfoSingleton] Failed to disconnect OAuth:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to disconnect OAuth:', error);
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
      const result = await this.makeAuthenticatedRequest<{
        success: boolean;
        data: Array<{ tenant_logo_url: string }>;
      }>(
        `/api/public/tenant/${tenantId}/logo`,
        {},
        `tenant-logo-${tenantId}`
      );
      
      if (result && result.data && result.data.success && result.data.data && result.data.data.length > 0) {
        const logoUrl = result.data.data[0].tenant_logo_url;
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
   * Get tenant subdomain
   */
  async getTenantSubdomain(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}`,
        {},
        `tenant-subdomain-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get tenant subdomain:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/my-subdomains?tenantId=${tenantId}`,
        {},
        `tenant-user-subdomains-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get user subdomains:', result.error);
        throw new Error(result.error?.message || 'Failed to get user subdomains');
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get user subdomains:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/check-subdomain/${subdomain}`,
        {},
        `tenant-check-subdomain-${subdomain}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to check subdomain availability:', result.error);
        throw new Error(result.error?.message || 'Failed to check subdomain availability');
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to check subdomain availability:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { 
          method: 'PUT',
          body: JSON.stringify({ subdomain })
        },
        `tenant-update-subdomain-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to update tenant subdomain:', result.error);
        throw new Error(result.error?.message || 'Failed to update tenant subdomain', { cause: result.error });
      }

      // Invalidate tenant complete cache for this tenant
      await platformHomeService.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
      // Invalidate platform dashboard cache since tenant subdomain affects stats
      await platformDashboardService.invalidateStatsCache();
      
      return result.data!;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to update tenant subdomain:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { method: 'DELETE' },
        `tenant-delete-subdomain-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to delete tenant subdomain:', result.error);
        throw new Error(result.error?.message || 'Failed to delete tenant subdomain', { cause: result.error });
      }

      // Invalidate tenant complete cache for this tenant
      await platformHomeService.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
      // Invalidate platform dashboard cache since tenant subdomain affects stats
      await platformDashboardService.invalidateStatsCache();
      
      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to delete tenant subdomain:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { method: 'DELETE' },
        `tenant-delete-subdomain-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to delete subdomain:', result.error);
        throw new Error(result.error?.message || 'Failed to delete subdomain', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to delete subdomain:', error);
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
      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}?_t=${timestamp}`,
        {},
        `tenant-data-cache-busting-${tenantId}-${timestamp}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get tenant data with cache busting:', result.error);
        throw new Error(result.error?.message || 'Failed to get tenant data with cache busting');
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get tenant data with cache busting:', error);
      throw error;
    }
  }

  /**
   * Get tenant status change preview
   */
  async getTenantStatusPreview(tenantId: string, status: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/status/preview`,
        { 
          method: 'POST',
          body: JSON.stringify({ status })
        },
        `tenant-status-preview-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get tenant status preview:', result.error);
        throw new Error(result.error?.message || 'Failed to get tenant status preview', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get tenant status preview:', error);
      throw error;
    }
  }

  /**
   * Update tenant status
   */
  async updateTenantStatus(tenantId: string, status: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/status`,
        { 
          method: 'PATCH',
          body: JSON.stringify({
            status: status
          })
        },
        `tenant-update-status-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to update tenant status:', result.error);
        throw new Error(result.error?.message || 'Failed to update tenant status', { cause: result.error });
      }

      // Invalidate tenant complete cache for this tenant
      await platformHomeService.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
      // Invalidate platform dashboard cache since tenant status affects stats
      await platformDashboardService.invalidateStatsCache();
      
      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to update tenant status:', error);
      throw error;
    }
  }

  /**
   * Get GBP connection status
   */
  async getGBPConnectionStatus(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/google/business/status?tenantId=${tenantId}`,
        {},
        `tenant-gbp-status-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get GBP connection status:', result.error);
        throw new Error(result.error?.message || 'Failed to get GBP connection status', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get GBP connection status:', error);
      throw error;
    }
  }

  /**
   * Get GBP linked location
   */
  async getGBPLinkedLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/google/business/linked-location?tenantId=${tenantId}`,
        {},
        `tenant-gbp-linked-location-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get GBP linked location:', result.error);
        throw new Error(result.error?.message || 'Failed to get GBP linked location', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get GBP linked location:', error);
      throw error;
    }
  }

  /**
   * Get GBP locations
   */
  async getGBPLocations(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/google/business/locations?tenantId=${tenantId}`,
        {},
        `tenant-gbp-locations-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get GBP locations:', result.error);
        throw new Error(result.error?.message || 'Failed to get GBP locations', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get GBP locations:', error);
      throw error;
    }
  }

  /**
   * Link GBP location
   */
  async linkGBPLocation(tenantId: string, locationId: string, locationName: string, address: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/google/business/link-location`,
        { 
          method: 'POST',
          body: JSON.stringify({
            tenantId,
            locationId,
            locationName,
            address
          })
        },
        `tenant-gbp-link-location-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to link GBP location:', result.error);
        throw new Error(result.error?.message || 'Failed to link GBP location', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to link GBP location:', error);
      throw error;
    }
  }

  /**
   * Unlink GBP location
   */
  async unlinkGBPLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/google/business/unlink-location`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `tenant-gbp-unlink-location-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to unlink GBP location:', result.error);
        throw new Error(result.error?.message || 'Failed to unlink GBP location', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to unlink GBP location:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<any> {
    try {
      const result = await this.makeAuthenticatedRequest<any>(
        '/user/preferences',
        {},
        'user-preferences',
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get user preferences:', result.error);
        throw new Error(result.error?.message || 'Failed to get user preferences', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get user preferences:', error);
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<any> {
    try {
      const result = await this.makeAuthenticatedRequest<any>(
        '/auth/me',
        {},
        'auth-current-user',
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get current user:', result.error);
        throw new Error(result.error?.message || 'Failed to get current user', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get current user:', error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId: string): Promise<any> {
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/organizations/${organizationId}`,
        {},
        `tenant-organization-${organizationId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get organization:', result.error);
        throw new Error(result.error?.message || 'Failed to get organization', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get organization:', error);
      throw error;
    }
  }

  /**
   * Get all organizations
   */
  async getOrganizations(): Promise<any> {
    try {
      const result = await this.makeAuthenticatedRequest<any>(
        '/api/organizations',
        {},
        'tenant-organizations',
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoSingleton] Failed to get organizations:', result.error);
        throw new Error(result.error?.message || 'Failed to get organizations', { cause: result.error });
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoSingleton] Failed to get organizations:', error);
      throw error;
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
