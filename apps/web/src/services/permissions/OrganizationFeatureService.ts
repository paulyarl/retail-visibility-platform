/**
 * Concrete Organization Feature Service
 * 
 * Simple delegation to abstract context service
 * Provides clean API for organization feature checks
 */

import { OrganizationPermissionService } from './OrganizationPermissionService';

export class OrganizationFeatureService extends OrganizationPermissionService {
  
  /**
   * Check if organization has specific feature
   * Simple delegation to base implementation
   */
  async hasFeature(organizationId: string, feature: string): Promise<boolean> {
    return super.hasFeature(organizationId, feature);
  }
  
  /**
   * Check if organization can add more tenants
   */
  async canAddTenant(organizationId: string): Promise<boolean> {
    return this.hasFeature(organizationId, 'multi_tenant');
  }
  
  /**
   * Check if organization can use advanced analytics
   */
  async canUseAdvancedAnalytics(organizationId: string): Promise<boolean> {
    return this.hasFeature(organizationId, 'advanced_analytics');
  }
  
  /**
   * Check if organization can use custom branding
   */
  async canUseCustomBranding(organizationId: string): Promise<boolean> {
    return this.hasFeature(organizationId, 'custom_branding');
  }
  
  /**
   * Check if organization has API access
   */
  async hasApiAccess(organizationId: string): Promise<boolean> {
    return this.hasFeature(organizationId, 'api_access');
  }
  
  /**
   * Get all available features for organization
   */
  async getAvailableFeatures(organizationId: string): Promise<string[]> {
    // This would get base features from organization + override features
    const organization = await this.getOrganization(organizationId);
    if (!organization) return [];
    
    // For now, return basic features based on organization status
    const baseFeatures = organization.isActive ? [
      'multi_tenant',
      'advanced_analytics', 
      'api_access'
    ] : [];
    
    if (organization.domain) {
      baseFeatures.push('custom_branding');
    }
    
    // TODO: Add override features
    
    return baseFeatures;
  }
}
