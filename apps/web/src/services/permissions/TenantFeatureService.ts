/**
 * Concrete Tenant Feature Service
 * 
 * Simple delegation to abstract context service
 * Provides clean API for tenant feature checks
 */

import { TenantPermissionService } from './TenantPermissionService';

export class TenantFeatureService extends TenantPermissionService {
  
  /**
   * Check if tenant has specific feature
   * Simple delegation to base implementation
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    return super.hasFeature(tenantId, feature);
  }
  
  /**
   * Check if tenant can use advanced analytics
   */
  async canUseAdvancedAnalytics(tenantId: string): Promise<boolean> {
    return this.hasFeature(tenantId, 'advanced_analytics');
  }
  
  /**
   * Check if tenant can create featured products
   */
  async canCreateFeaturedProducts(tenantId: string): Promise<boolean> {
    return this.hasFeature(tenantId, 'featured_products');
  }
  
  /**
   * Check if tenant has API access
   */
  async hasApiAccess(tenantId: string): Promise<boolean> {
    return this.hasFeature(tenantId, 'api_access');
  }
  
  /**
   * Check if tenant can use custom branding
   */
  async canUseCustomBranding(tenantId: string): Promise<boolean> {
    return this.hasFeature(tenantId, 'custom_branding');
  }
  
  /**
   * Get all available features for tenant
   */
  async getAvailableFeatures(tenantId: string): Promise<string[]> {
    // This would get base features from tier + override features
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return [];
    
    const tier = await this.getTier(tenant.subscription_tier || '');
    const baseFeatures = tier?.features || [];
    
    // Convert feature objects to strings for compatibility
    const featureStrings = baseFeatures.map((feature: any) => 
      typeof feature === 'object' ? feature.featureKey : feature
    );
    
    // TODO: Add override features
    
    return featureStrings;
  }
}
