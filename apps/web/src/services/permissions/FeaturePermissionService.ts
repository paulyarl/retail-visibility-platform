/**
 * Feature Permission Service
 * 
 * Concrete service for feature-specific permission checks
 * Uses context services for actual permission evaluation
 */

import { TenantFeatureService } from './TenantFeatureService';
import { OrganizationFeatureService } from './OrganizationFeatureService';

export class FeaturePermissionService {
  private tenantService = new TenantFeatureService('feature-permission-service');
  private organizationService = new OrganizationFeatureService('feature-permission-service');
  
  /**
   * Check if tenant has feature
   */
  async tenantHasFeature(tenantId: string, feature: string): Promise<boolean> {
    return this.tenantService.hasFeature(tenantId, feature);
  }
  
  /**
   * Check if organization has feature
   */
  async organizationHasFeature(organizationId: string, feature: string): Promise<boolean> {
    return this.organizationService.hasFeature(organizationId, feature);
  }
  
  /**
   * Check if user has feature (delegates to tenant/organization)
   */
  async userHasFeature(userId: string, feature: string): Promise<boolean> {
    // Get user's tenant and organization
    const { tenantId, organizationId } = await this.getUserContext(userId);
    
    // Check both tenant and organization permissions
    const [tenantPermission, orgPermission] = await Promise.all([
      tenantId ? this.tenantService.hasFeature(tenantId, feature) : false,
      organizationId ? this.organizationService.hasFeature(organizationId, feature) : false
    ]);
    
    // User has feature if either tenant or organization allows it
    return tenantPermission || orgPermission;
  }
  
  /**
   * Check multiple features at once (batch operation)
   */
  async tenantHasFeatures(tenantId: string, features: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      features.map(async (feature) => {
        results[feature] = await this.tenantService.hasFeature(tenantId, feature);
      })
    );
    
    return results;
  }
  
  /**
   * Get all available features for tenant
   */
  async getTenantAvailableFeatures(tenantId: string): Promise<string[]> {
    // This would integrate with the tier service to get base features
    // Then add any override-granted features
    const baseFeatures = await this.getTenantBaseFeatures(tenantId);
    const overrideFeatures = await this.getTenantOverrideFeatures(tenantId);
    
    return [...new Set([...baseFeatures, ...overrideFeatures])];
  }
  
  /**
   * Helper methods
   */
  private async getUserContext(userId: string): Promise<{ tenantId?: string; organizationId?: string }> {
    // This would integrate with user service to get context
    // For now, return mock data
    return { tenantId: undefined, organizationId: undefined };
  }
  
  private async getTenantBaseFeatures(tenantId: string): Promise<string[]> {
    // This would integrate with tenant tier service
    return [];
  }
  
  private async getTenantOverrideFeatures(tenantId: string): Promise<string[]> {
    // This would query feature overrides for this tenant
    return [];
  }
}
