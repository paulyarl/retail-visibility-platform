/**
 * Hero Location Service
 * 
 * Manages hero location operations for organizations:
 * - Identifies hero location for payment processing
 * - Routes payments through hero location gateways
 * - Handles organization-level operations via hero tenant
 */

import { prisma } from '../prisma';

export interface HeroLocationInfo {
  tenantId: string;
  tenantName: string;
  organizationId: string;
  paymentGatewayId?: string;
  paymentGatewayType?: string;
  businessProfile?: {
    business_name: string;
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
  };
}

export class HeroLocationService {
  private static instance: HeroLocationService;

  static getInstance(): HeroLocationService {
    if (!HeroLocationService.instance) {
      HeroLocationService.instance = new HeroLocationService();
    }
    return HeroLocationService.instance;
  }

  /**
   * Get hero location for an organization
   */
  async getHeroLocation(organizationId: string): Promise<HeroLocationInfo | null> {
    const organization = await prisma.organizations_list.findUnique({
      where: { id: organizationId },
      include: {
        tenants: {
          include: {
            tenant_business_profiles_list: true,
          },
        },
      },
    });

    if (!organization || !organization.tenants.length) {
      return null;
    }

    // Find tenant marked as hero location
    const heroTenant = organization.tenants.find(tenant => 
      (tenant.metadata as any)?.isHeroLocation === true
    );

    if (!heroTenant) {
      return null;
    }

    // Get payment gateway information for hero tenant
    const paymentGateway = await prisma.merchant_billing_gateways.findFirst({
      where: {
        tenant_id: heroTenant.id,
        is_active: true,
      },
      orderBy: {
        is_default: 'desc',
      },
    });

    return {
      tenantId: heroTenant.id,
      tenantName: heroTenant.name,
      organizationId: organization.id,
      paymentGatewayId: paymentGateway?.id,
      paymentGatewayType: paymentGateway?.gateway_type|| '',
      businessProfile: heroTenant.tenant_business_profiles_list ? {
        business_name: heroTenant.tenant_business_profiles_list.business_name,
        address_line1: heroTenant.tenant_business_profiles_list.address_line1,
        city: heroTenant.tenant_business_profiles_list.city,
        state: heroTenant.tenant_business_profiles_list.state || '',
        postal_code: heroTenant.tenant_business_profiles_list.postal_code,
      } : undefined,
    };
  }

  /**
   * Get hero location for a tenant (finds organization and hero location)
   */
  async getHeroLocationForTenant(tenantId: string): Promise<HeroLocationInfo | null> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { organization_id: true },
    });

    if (!tenant?.organization_id) {
      return null;
    }

    return this.getHeroLocation(tenant.organization_id);
  }

  /**
   * Check if a tenant is the hero location for its organization
   */
  async isHeroLocation(tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    return (tenant?.metadata as any)?.isHeroLocation === true;
  }

  /**
   * Get payment processing configuration for hero location
   */
  async getHeroPaymentConfig(organizationId: string): Promise<{
    paymentGatewayId?: string;
    paymentGatewayType?: string;
    tenantId: string;
  } | null> {
    const heroLocation = await this.getHeroLocation(organizationId);
    
    if (!heroLocation) {
      return null;
    }

    return {
      paymentGatewayId: heroLocation.paymentGatewayId,
      paymentGatewayType: heroLocation.paymentGatewayType,
      tenantId: heroLocation.tenantId,
    };
  }

  /**
   * Route order payment through hero location
   * Returns the tenant ID that should process the payment
   */
  async routeOrderPayment(pickupTenantId: string): Promise<string> {
    // Get the organization for the pickup tenant
    const pickupTenant = await prisma.tenants.findUnique({
      where: { id: pickupTenantId },
      select: { organization_id: true },
    });

    if (!pickupTenant?.organization_id) {
      // No organization, use the pickup tenant directly
      return pickupTenantId;
    }

    // Get hero location for the organization
    const heroLocation = await this.getHeroLocation(pickupTenant.organization_id);
    
    if (!heroLocation) {
      // No hero location set, use pickup tenant
      return pickupTenantId;
    }

    // Route payment through hero location
    return heroLocation.tenantId;
  }

  /**
   * Get all tenants in an organization with hero status
   */
  async getOrganizationTenantsWithHeroStatus(organizationId: string): Promise<Array<{
    id: string;
    name: string;
    isHero: boolean;
  }>> {
    const organization = await prisma.organizations_list.findUnique({
      where: { id: organizationId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            metadata: true,
          },
        },
      },
    });

    if (!organization) {
      return [];
    }

    return organization.tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      isHero: (tenant.metadata as any)?.isHeroLocation === true,
    }));
  }
}

export default HeroLocationService;
