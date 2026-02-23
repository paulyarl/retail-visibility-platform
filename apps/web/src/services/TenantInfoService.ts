/**
 * Tenant Info Service
 * 
 * Handles tenant-specific operations, management, and authenticated requests
 * Extends TenantApiSingleton for tenant context and authentication
 */

import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';
import { platformHomeService } from './PlatformHomeSingletonService';
import { platformDashboardService } from './PlatformDashboardSingletonService';

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
        this.cacheTTL
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
   * Uses the /api/tenants/:tenantId/gbp/location endpoint
   */
  async getGBPLinkedLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getGBPLinkedLocation: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/gbp/location`,
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
   * Uses the /api/tenants/:tenantId/gbp/status endpoint
   */
  async getGBPConnectionStatus(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getGBPConnectionStatus: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/gbp/status`,
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
   */
  async getTenantInfo(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        console.error('[TenantInfoService] getTenantInfo: tenantId is required');
        return null;
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}`,
        {},
        `tenant-info-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success) {
        console.error('[TenantInfoService] Failed to get tenant info:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get tenant info:', error);
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
        this.cacheTTL
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

      // Get data from multiple endpoints in parallel
      const [tenantData, organizationResult, businessHoursData, paymentGatewaysData] = await Promise.all([
        this.getTenantDataWithCacheBusting(tenantId),
        this.getOrganization(tenantId), // Using getOrganization as a fallback for business profile
        Promise.resolve(null), // Business hours not available in this service
        this.getPaymentGateways(tenantId)
      ]);

      return {
        tenant: tenantData,
        businessProfile: organizationResult?.success ? organizationResult.data : null,
        businessHours: businessHoursData,
        paymentGateways: paymentGatewaysData
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
        `/api/tenants/${tenantId}/oauth/${provider}/status`,
        {},
        `tenant-oauth-${tenantId}-${provider}`,
        this.cacheTTL
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
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get users:', result.error);
        return [];
      }

      console.log('[TenantInfoService] API Response:', result);
      console.log('[TenantInfoService] result.data:', result.data);

      // Extract users from the nested response structure
      // API returns: { success: true, users: [...], data: [...], items: [...], results: [...] }
      const users = result.data?.users || result.data?.data || result.data?.items || result.data?.results || [];
      console.log('[TenantInfoService] Extracted users:', users);
      console.log('[TenantInfoService] Is users array?', Array.isArray(users));

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
        this.cacheTTL
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
        throw new Error(result.error?.message || 'Failed to get user subdomains');
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
        throw new Error(result.error?.message || 'Failed to check subdomain availability');
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
        const error = new Error(result.error?.message || 'Failed to update tenant subdomain');
        (error as any).cause = result.error;
        throw error;
      }

      // Invalidate tenant complete cache for this tenant
      await platformHomeService.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
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
        const error = new Error(result.error?.message || 'Failed to delete tenant subdomain');
        (error as any).cause = result.error;
        throw error;
      }

      // Invalidate tenant complete cache for this tenant
      await platformHomeService.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
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
        const error = new Error(result.error?.message || 'Failed to delete subdomain');
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
        `/api/tenants/${tenantId}?_t=${timestamp}`,
        {},
        `tenant-data-cache-busting-${tenantId}-${timestamp}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get tenant data with cache busting:', result.error);
        throw new Error(result.error?.message || 'Failed to get tenant data with cache busting');
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
        const error = new Error(result.error?.message || 'Failed to get tenant status preview');
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
   * Update tenant status
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
        `tenant-update-status-${tenantId}`
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to update tenant status:', result.error);
        const error = new Error(result.error?.message || 'Failed to update tenant status');
        (error as any).cause = result.error;
        throw error;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to update tenant status:', error);
      throw error;
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
        this.cacheTTL
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
        this.cacheTTL
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
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantInfoService] Failed to get current user:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[TenantInfoService] Failed to get current user:', error);
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
        this.cacheTTL
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
  async getOrganizations(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/organizations',
        {},
        'tenant-organizations',
        this.cacheTTL
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
