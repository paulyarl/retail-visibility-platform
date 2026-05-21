/**
 * Abstract Tenant Permission Service
 * 
 * Provides tenant context awareness
 * Extended by concrete tenant services
 */

import { BasePermissionService } from './BasePermissionService';
import { tenantTierService, Tenant, DbTier } from '../TenantTierService';

export abstract class TenantPermissionService extends BasePermissionService {
  
  /**
   * Implementation of abstract base method
   */
  protected getContextType(): 'tenant' | 'organization' | 'user' {
    return 'tenant';
  }
  
  /**
   * Implementation of abstract base method - tenant-specific permission logic
   */
  protected async checkBasePermission(tenantId: string, target: string): Promise<boolean> {
    // Check tier-based permissions
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return false;
    
    const tier = await this.getTier(tenant.subscription_tier || '');
    if (!tier) return false;
    
    // Convert features to strings for comparison
    const featureStrings = tier.features.map((feature: any) => 
      typeof feature === 'object' ? feature.featureKey : feature
    );
    
    return featureStrings.includes(target);
  }
  
  /**
   * Implementation of abstract base method - tenant-specific limit logic
   */
  protected async getBaseLimit(tenantId: string, target: string): Promise<number | null> {
    switch (target) {
      case 'locations':
        return this.getTierLocationLimit(tenantId);
      case 'skus':
        return this.getTierSkuLimit(tenantId);
      default:
        // Handle featured product types
        return this.getTierFeaturedLimit(tenantId, target);
    }
  }
  
  /**
   * Helper methods for tier-based data
   */
  protected async getTenant(tenantId: string): Promise<Tenant | null> {
    // Get all tenants and find the specific one
    const tenants = await tenantTierService.getAdminTierTenants();
    if (!tenants) return null;
    
    return tenants.find(tenant => tenant.id === tenantId) || null;
  }
  
  protected async getTier(tierName: string): Promise<DbTier | null> {
    // Get all tiers and find the specific one
    const tiers = await tenantTierService.getAdminTiers();
    if (!tiers) return null;
    
    return tiers.find(tier => tier.name === tierName) || null;
  }
  
  private async getTierLocationLimit(tenantId: string): Promise<number> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return 0;
    
    const tier = await this.getTier(tenant.subscription_tier || '');
    return tier?.maxLocations || 0;
  }
  
  private async getTierSkuLimit(tenantId: string): Promise<number> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return 0;
    
    const tier = await this.getTier(tenant.subscription_tier || '');
    return tier?.maxSkus || 0;
  }
  
  private async getTierFeaturedLimit(tenantId: string, featuredType: string): Promise<number> {
    // For now, return a default featured product limit
    // This would be implemented based on the actual tier data structure
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return 0;
    
    // Default limits based on tier type
    const tier = await this.getTier(tenant.subscription_tier || '');
    if (!tier) return 0;
    
    // Return default featured product limits (would be enhanced based on actual data)
    switch (tier.type) {
      case 'basic':
        return 3;
      case 'business':
        return 10;
      case 'enterprise':
        return 25;
      default:
        return 5;
    }
  }
}
