/**
 * Concrete Tenant Limits Service
 * 
 * Simple delegation to abstract context service
 * Provides clean API for tenant limit checks
 */

import { TenantPermissionService } from './TenantPermissionService';

export class TenantLimitsService extends TenantPermissionService {
  
  /**
   * Get tenant's max locations
   * Simple delegation to base implementation
   */
  async getMaxLocations(tenantId: string): Promise<number> {
    const limit = await this.getTenantLimit(tenantId);
    return limit || 0;
  }
  
  /**
   * Get tenant's SKU limit
   * Simple delegation to base implementation
   */
  async getSkuLimit(tenantId: string): Promise<number> {
    const limit = await this.getLimit(tenantId, 'skus');
    return limit || 0;
  }
  
  /**
   * Get tenant's featured product limit for specific type
   * Simple delegation to base implementation
   */
  async getFeaturedProductLimit(tenantId: string, featuredType: string): Promise<number> {
    const limit = await super.getFeaturedProductLimit(tenantId, featuredType);
    return limit || 0;
  }
  
  /**
   * Check if tenant can create more locations
   */
  async canCreateLocation(tenantId: string): Promise<boolean> {
    const currentCount = await this.getCurrentLocationCount(tenantId);
    const maxLimit = await this.getMaxLocations(tenantId);
    return currentCount < maxLimit;
  }
  
  /**
   * Check if tenant can add more SKUs
   */
  async canAddSku(tenantId: string): Promise<boolean> {
    const currentCount = await this.getCurrentSkuCount(tenantId);
    const maxLimit = await this.getSkuLimit(tenantId);
    return currentCount < maxLimit;
  }
  
  /**
   * Check if tenant can add more featured products of specific type
   */
  async canAddFeaturedProduct(tenantId: string, featuredType: string): Promise<boolean> {
    const currentCount = await this.getCurrentFeaturedCount(tenantId, featuredType);
    const maxLimit = await this.getFeaturedProductLimit(tenantId, featuredType);
    return currentCount < maxLimit;
  }
  
  /**
   * Get all limits for tenant
   */
  async getAllLimits(tenantId: string): Promise<{
    locations: number;
    skus: number;
    featuredProducts: Record<string, number>;
  }> {
    const [locations, skus] = await Promise.all([
      this.getMaxLocations(tenantId),
      this.getSkuLimit(tenantId)
    ]);
    
    // Get featured product limits for common types
    const featuredTypes = ['store_selection', 'new_arrival', 'seasonal', 'clearance'];
    const featuredLimits: Record<string, number> = {};
    
    await Promise.all(
      featuredTypes.map(async (type) => {
        featuredLimits[type] = await this.getFeaturedProductLimit(tenantId, type);
      })
    );
    
    return {
      locations,
      skus,
      featuredProducts: featuredLimits
    };
  }
  
  /**
   * Helper methods (would integrate with actual services)
   */
  private async getCurrentLocationCount(tenantId: string): Promise<number> {
    // This would integrate with location service
    return 0;
  }
  
  private async getCurrentSkuCount(tenantId: string): Promise<number> {
    // This would integrate with product service
    return 0;
  }
  
  private async getCurrentFeaturedCount(tenantId: string, featuredType: string): Promise<number> {
    // This would integrate with featured products service
    return 0;
  }
}
