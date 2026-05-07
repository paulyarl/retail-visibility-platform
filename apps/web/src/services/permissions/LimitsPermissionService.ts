/**
 * Limits Permission Service
 * 
 * Concrete service for limit-specific permission checks
 * Uses context services for actual limit evaluation
 */

import { TenantLimitsService } from './TenantLimitsService';
import { OrganizationFeatureService } from './OrganizationFeatureService';

export class LimitsPermissionService {
  private tenantService = new TenantLimitsService('limits-permission-service');
  private organizationService = new OrganizationFeatureService('limits-permission-service');
  
  /**
   * Check if tenant can create more locations
   */
  async tenantCanCreateLocation(tenantId: string): Promise<boolean> {
    return this.tenantService.canCreateLocation(tenantId);
  }
  
  /**
   * Get tenant's max locations
   */
  async getTenantMaxLocations(tenantId: string): Promise<number> {
    return this.tenantService.getMaxLocations(tenantId);
  }
  
  /**
   * Get tenant's SKU limit
   */
  async getTenantSkuLimit(tenantId: string): Promise<number> {
    return this.tenantService.getSkuLimit(tenantId);
  }
  
  /**
   * Check if organization can add more tenants
   */
  async organizationCanAddTenant(organizationId: string): Promise<boolean> {
    return this.organizationService.canAddTenant(organizationId);
  }
  
  /**
   * Get organization's max tenants
   */
  async getOrganizationMaxTenants(organizationId: string): Promise<number> {
    // For now, return a default limit
    // This would be implemented based on organization data
    const hasMultiTenant = await this.organizationService.hasFeature(organizationId, 'multi_tenant');
    return hasMultiTenant ? 10 : 1;
  }
  
  /**
   * Check if tenant is within SKU limit
   */
  async tenantWithinSkuLimit(tenantId: string): Promise<boolean> {
    const currentCount = await this.getCurrentSkuCount(tenantId);
    const maxLimit = await this.getTenantSkuLimit(tenantId);
    return currentCount < maxLimit;
  }
  
  /**
   * Get all limits for tenant (batch operation)
   */
  async getTenantLimits(tenantId: string): Promise<{
    locations: number;
    skus: number;
    featuredProducts: Record<string, number>;
  }> {
    const [locations, skus] = await Promise.all([
      this.getTenantMaxLocations(tenantId),
      this.getTenantSkuLimit(tenantId)
    ]);
    
    // Get featured product limits
    const featuredProducts = await this.getTenantFeaturedLimits(tenantId);
    
    return {
      locations,
      skus,
      featuredProducts
    };
  }
  
  /**
   * Get all limits for organization (batch operation)
   */
  async getOrganizationLimits(organizationId: string): Promise<{
    tenants: number;
    users: number;
  }> {
    const [tenants, users] = await Promise.all([
      this.getOrganizationMaxTenants(organizationId),
      this.getOrganizationMaxUsers(organizationId)
    ]);
    
    return {
      tenants,
      users
    };
  }
  
  /**
   * Helper methods
   */
  private async getCurrentSkuCount(tenantId: string): Promise<number> {
    // This would integrate with product service
    return 0;
  }
  
  private async getTenantFeaturedLimits(tenantId: string): Promise<Record<string, number>> {
    // This would get all featured product limits for the tenant
    return {};
  }
  
  private async getOrganizationMaxUsers(organizationId: string): Promise<number> {
    // This would get organization user limit
    return 0;
  }
}
