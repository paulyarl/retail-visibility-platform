/**
 * Frontend Hero Location Service
 * 
 * Provides methods to interact with hero location API:
 * - Get hero location for organization
 * - Route payments through hero location
 * - Get payment configuration
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface HeroLocation {
  tenantId: string;
  tenantName: string;
  organizationId: string;
  hasPaymentGateway: boolean;
  paymentGatewayType?: string;
  businessProfile?: {
    business_name: string;
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
  };
}

export interface PaymentRouting {
  pickupTenantId: string;
  paymentTenantId: string;
  isHeroPayment: boolean;
  paymentConfig?: {
    paymentGatewayId?: string;
    paymentGatewayType?: string;
  };
}

export interface OrganizationTenant {
  id: string;
  name: string;
  isHero: boolean;
}

class HeroLocationService extends PublicApiSingleton {
  private static instance: HeroLocationService;

  static getInstance(): HeroLocationService {
    if (!HeroLocationService.instance) {
      HeroLocationService.instance = new HeroLocationService("hero-location");
    }
    return HeroLocationService.instance;
  }

 

  /**
   * Get hero location for an organization
   */
  async getHeroLocation(organizationId: string): Promise<{ heroLocation: HeroLocation | null }> {
    const response = await this.makeDefaultRequest<{ 
      success: boolean; 
      heroLocation: HeroLocation | null;
      message?: string;
    }>(`/hero-location/organization/${organizationId}`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get hero location';
      throw new Error(errorMessage);
    }

    return {
      heroLocation: response.data?.heroLocation
    };
  }

  /**
   * Get hero location for a tenant's organization
   */
  async getHeroLocationForTenant(tenantId: string): Promise<{ heroLocation: HeroLocation | null }> {
    const response = await this.makeDefaultRequest<{ 
      success: boolean; 
      heroLocation: HeroLocation | null;
      message?: string;
    }>(`/hero-location/tenant/${tenantId}`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get hero location';
      throw new Error(errorMessage);
    }

    return {
      heroLocation: response.data?.heroLocation
    };
  }

  /**
   * Route payment through hero location
   */
  async routePayment(pickupTenantId: string): Promise<PaymentRouting> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      paymentRouting: PaymentRouting;
    }>('/hero-location/route-payment', {
      method: 'POST',
      body: JSON.stringify({ pickupTenantId }),
    });

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to route payment';
      throw new Error(errorMessage);
    }

    return response.data?.paymentRouting;
  }

  /**
   * Get all tenants in organization with hero status
   */
  async getOrganizationTenants(organizationId: string): Promise<{
    tenants: OrganizationTenant[];
    heroCount: number;
  }> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      tenants: OrganizationTenant[];
      heroCount: number;
    }>(`/hero-location/organization/${organizationId}/tenants`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get organization tenants';
      throw new Error(errorMessage);
    }

    return {
      tenants: response.data?.tenants,
      heroCount: response.data?.heroCount,
    };
  }

  /**
   * Check if a tenant is the hero location
   */
  async isHeroLocation(tenantId: string): Promise<boolean> {
    try {
      const result = await this.getHeroLocationForTenant(tenantId);
      
      return result.heroLocation?.tenantId === tenantId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get payment configuration for checkout
   */
  async getPaymentConfig(pickupTenantId: string): Promise<{
    paymentTenantId: string;
    isHeroPayment: boolean;
    paymentConfig?: {
      paymentGatewayId?: string;
      paymentGatewayType?: string;
    };
  }> {
    const routing = await this.routePayment(pickupTenantId);
    
    return {
      paymentTenantId: routing.paymentTenantId,
      isHeroPayment: routing.isHeroPayment,
      paymentConfig: routing.paymentConfig,
    };
  }
}

export default HeroLocationService.getInstance();
