/**
 * Propagation Service - Enhanced with OrganizationApiSingleton
 * Handles item propagation between organization locations with next-level security
 */

import { OrganizationApiSingleton, AuthorizationGroup, type OrganizationRequestOptions, type PropagationRequest, type PropagationResult, type OrganizationTenant } from '../providers/base/OrganizationApiSingleton';

// Re-export types for component usage
export type { PropagationRequest, PropagationResult, OrganizationTenant };

export class PropagationService extends OrganizationApiSingleton {
  private static instance: PropagationService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'propagation-service*',
      'item-propagation*',
      'propagation-status*',
      'org-tenant*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(organizationId?: string): Promise<void> {
    await this.invalidateCachePattern('propagation-service*');
    await this.invalidateCachePattern('item-propagation*');
    await this.invalidateCachePattern('propagation-status*');
    await this.invalidateCachePattern('org-tenant*');
  }

  private constructor() {
    super('propagation-service', {
      defaultOrganizationValidation: {
        // Propagation requires admin-level access
        requireAuthorizationGroups: [AuthorizationGroup.CAN_PROPAGATE_ITEMS],
        
        // Multi-location requirement
        requireMultiLocation: true,
        minTenantCount: 2,
        excludeCurrentTenant: true,
        
        // Platform authority
        platformUsersBypassMembership: true,
        platformUsersBypassTenantCount: false,
        allowSupportOverride: true
      },
      autoValidateOrganization: true,
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      defaultRetryAttempts: 2,
      retryDelay: 1000
    });
  }

  static getInstance(): PropagationService {
    if (!PropagationService.instance) {
      PropagationService.instance = new PropagationService();
    }
    return PropagationService.instance;
  }

  /**
   * Propagate item to multiple locations with enhanced security
   */
  async propagateItem(
    organizationId: string,
    request: PropagationRequest
  ): Promise<PropagationResult> {
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      if (!request.sourceItemId) {
        throw new Error('Source item ID is required');
      }

      if (!request.targetTenantIds || request.targetTenantIds.length === 0) {
        throw new Error('At least one target tenant is required');
      }

      const options: OrganizationRequestOptions = {
        method: 'POST',
        body: JSON.stringify(request),
        organizationValidation: {
          // Use authorization groups for security
          requireAuthorizationGroups: [AuthorizationGroup.CAN_PROPAGATE_ITEMS],
          
          // Multi-location requirements
          requireMultiLocation: true,
          excludeCurrentTenant: true,
          minTenantCount: 2,
          currentTenantId: request.sourceTenantId,
          
          // Platform authority
          platformUsersBypassMembership: true,
          allowSupportOverride: true
        },
        organizationId,
        
        // No caching for write operations
        bypassCache: true,
        
        // Audit context for security
        auditContext: {
          operation: 'item_propagation',
          reason: `Propagating ${request.sourceItemId} to ${request.targetTenantIds.length} locations`
        }
      };

      const result = await this.makeDefaultRequest<PropagationResult>(
        `/api/organizations/${organizationId}/items/propagate`,
        options
      );

      return result.data || {
        success: false,
        summary: { total: 0, created: 0, updated: 0, failed: 0, skipped: 0 },
        details: []
      };
    } catch (error) {
      this.logError('Failed to propagate item', error);
      throw error;
    }
  }

  /**
   * Get organization tenants for propagation
   */
  async getOrganizationTenants(organizationId: string): Promise<OrganizationTenant[]> {
    console.log('[PropagationService] getOrganizationTenants called for:', organizationId);
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const options: OrganizationRequestOptions = {
        organizationValidation: {
          requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
          platformUsersBypassMembership: true,
          allowSupportOverride: true
        },
        organizationId
      };

      console.log('[PropagationService] Calling makeDefaultRequest');
      const result = await this.makeDefaultRequest<any>(
        `/api/organizations/${organizationId}`,
        options,
        `org-tenants-${organizationId}`,
        5 * 60 * 1000 // 5 minutes cache
      );

      console.log('[PropagationService] makeDefaultRequest returned:', result);
      // Extract tenants from the organization response
      const organization = result.data;
      const tenants = organization?.tenants || [];
      
      console.log('[PropagationService] Found tenants:', tenants.length);
      // Transform to match expected OrganizationTenant interface
      return tenants.map((tenant: any) => ({
        id: tenant.id,
        name: tenant.name,
        metadata: {
          businessName: tenant.business_name || undefined
        }
      }));
    } catch (error) {
      console.error('[PropagationService] getOrganizationTenants error:', error);
      this.logError('Failed to get organization tenants', error);
      throw error;
    }
  }

  /**
   * Check if propagation is available for organization
   */
  async checkPropagationAvailability(organizationId: string): Promise<{
    available: boolean;
    reason?: string;
    tenantCount: number;
    canPropagate?: boolean;
    userGroups?: string[];
  }> {
    try {
      const tenants = await this.getOrganizationTenants(organizationId);
      const currentUser = this.getCurrentUser();
      const userGroups = this.getUserAuthorizationGroups(currentUser);
      const canPropagate = userGroups.includes(AuthorizationGroup.CAN_PROPAGATE_ITEMS);
      
      return {
        available: tenants.length > 1 && canPropagate,
        reason: tenants.length <= 1 
          ? 'Organization needs multiple locations for propagation'
          : !canPropagate
          ? 'Insufficient permissions for propagation'
          : undefined,
        tenantCount: tenants.length,
        canPropagate,
        userGroups
      };
    } catch (error) {
      return {
        available: false,
        reason: 'Unable to check propagation availability',
        tenantCount: 0
      };
    }
  }

  /**
   * Support-assisted propagation (for platform support users)
   */
  async supportAssistedPropagation(
    organizationId: string,
    request: PropagationRequest,
    supportReason: string
  ): Promise<PropagationResult> {
    try {
      const options: OrganizationRequestOptions = {
        method: 'POST',
        body: JSON.stringify(request),
        organizationValidation: {
          // Support users have special access
          requireAuthorizationGroups: [AuthorizationGroup.CAN_SUPPORT_TENANTS],
          platformUsersBypassMembership: true,
          allowSupportOverride: true
        },
        organizationId,
        bypassCache: true,
        auditContext: {
          operation: 'support_assisted_propagation',
          reason: supportReason || `Support assisting with propagation of ${request.sourceItemId}`
        }
      };

      const result = await this.makeDefaultRequest<PropagationResult>(
        `/api/organizations/${organizationId}/items/propagate`,
        options
      );

      return result.data || {
        success: false,
        summary: { total: 0, created: 0, updated: 0, failed: 0, skipped: 0 },
        details: []
      };
    } catch (error) {
      this.logError('Failed to perform support-assisted propagation', error);
      throw error;
    }
  }
}

export const propagationService = PropagationService.getInstance();
