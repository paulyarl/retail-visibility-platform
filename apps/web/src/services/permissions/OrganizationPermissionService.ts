/**
 * Abstract Organization Permission Service
 * 
 * Provides organization context awareness
 * Extended by concrete organization services
 */

import { BasePermissionService } from './BasePermissionService';
import { organizationService, Organization } from '../OrganizationService';

export abstract class OrganizationPermissionService extends BasePermissionService {
  
  /**
   * Implementation of abstract base method
   */
  protected getContextType(): 'tenant' | 'organization' | 'user' {
    return 'organization';
  }
  
  /**
   * Implementation of abstract base method - organization-specific permission logic
   */
  protected async checkBasePermission(organizationId: string, target: string): Promise<boolean> {
    // Check organization-level permissions
    const organization = await this.getOrganization(organizationId);
    if (!organization) return false;
    
    // For now, return basic organization permissions
    // This would be enhanced based on actual organization data structure
    switch (target) {
      case 'multi_tenant':
        return organization.isActive; // Active organizations can have multiple tenants
      case 'advanced_analytics':
        return organization.isActive; // Active organizations get analytics
      case 'custom_branding':
        return organization.domain ? true : false; // Organizations with domain can brand
      case 'api_access':
        return organization.isActive; // Active organizations get API access
      default:
        // Default to active status for other features
        return organization.isActive;
    }
  }
  
  /**
   * Implementation of abstract base method - organization-specific limit logic
   */
  protected async getBaseLimit(organizationId: string, target: string): Promise<number | null> {
    switch (target) {
      case 'tenants':
        return this.getOrganizationTenantLimit(organizationId);
      case 'users':
        return this.getOrganizationUserLimit(organizationId);
      default:
        return null;
    }
  }
  
  /**
   * Helper methods for organization data
   */
  protected async getOrganization(organizationId: string): Promise<Organization | null> {
    // Get all organizations and find the specific one
    const organizations = await organizationService.getOrganizations();
    if (!organizations) return null;
    
    return organizations.find((org: Organization) => org.id === organizationId) || null;
  }
  
  /**
   * Helper methods for organization limits
   */
  private async getCurrentTenantCount(organizationId: string): Promise<number> {
    const tenants = await organizationService.getOrganizations();
    return tenants?.length || 0;
  }
  
  private async getOrganizationTenantLimit(organizationId: string): Promise<number> {
    const organization = await organizationService.getOrganization(organizationId);
    if (!organization) return 0;
    
    // Plan-based tenant limits
    switch (organization.plan) {
      case 'basic':
        return 1;
      case 'business':
        return 5;
      case 'enterprise':
        return 50;
      default:
        return 1;
    }
  }
  
  private async getOrganizationUserLimit(organizationId: string): Promise<number> {
    const organization = await organizationService.getOrganization(organizationId);
    if (!organization) return 0;
    
    // Plan-based user limits
    switch (organization.plan) {
      case 'basic':
        return 5;
      case 'business':
        return 25;
      case 'enterprise':
        return 500;
      default:
        return 5;
    }
  }
}
