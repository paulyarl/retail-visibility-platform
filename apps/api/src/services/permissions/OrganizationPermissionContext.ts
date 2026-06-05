/**
 * Organization Permission Context
 * 
 * Layer 5: Extended Context Layer
 * 
 * Provides organization-level permission checking with:
 * - Multi-tenant organization support
 * - Organization role-based permissions
 * - Cross-tenant management capabilities
 * - Organization feature bundles
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Extends UniversalSingleton for consistent caching and metrics
 * - Follows singleton pattern with getInstance()
 * - Integrates with existing OrganizationService
 */

import { UniversalSingleton, SingletonCacheOptions } from '../../lib/UniversalSingleton';
import { PrismaClient } from '@prisma/client';
import { tenantPermissionContext } from './TenantPermissionContext';

// Organization roles
export type OrganizationRole = 'ORG_OWNER' | 'ORG_ADMIN' | 'ORG_MEMBER' | 'ORG_VIEWER';

// Organization features
export interface OrganizationFeatures {
  manageAllTenants: boolean;
  createTenants: boolean;
  billingManagement: boolean;
  userManagement: boolean;
  analyticsAccess: boolean;
  apiManagement: boolean;
  customBranding: boolean;
  ssoIntegration: boolean;
}

// Organization permissions result
export interface OrganizationPermissions {
  organizationId: string;
  role: OrganizationRole;
  features: Record<string, boolean>;
  managedTenants: string[];
}

// Organization member
export interface OrganizationMember {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  joinedAt: Date;
}

// Cache options for organization permission context
const ORG_PERMISSION_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 3000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'authenticated'
};

/**
 * Organization Permission Context Service
 * 
 * Singleton service for organization-level permission checking
 */
class OrganizationPermissionContext extends UniversalSingleton {
  private prisma: PrismaClient;
  private static instance: OrganizationPermissionContext;

  // Organization feature definitions by role
  private roleFeatures: Record<OrganizationRole, OrganizationFeatures> = {
    'ORG_OWNER': {
      manageAllTenants: true,
      createTenants: true,
      billingManagement: true,
      userManagement: true,
      analyticsAccess: true,
      apiManagement: true,
      customBranding: true,
      ssoIntegration: true
    },
    'ORG_ADMIN': {
      manageAllTenants: true,
      createTenants: true,
      billingManagement: true,
      userManagement: true,
      analyticsAccess: true,
      apiManagement: true,
      customBranding: true,
      ssoIntegration: false
    },
    'ORG_MEMBER': {
      manageAllTenants: false,
      createTenants: false,
      billingManagement: false,
      userManagement: false,
      analyticsAccess: true,
      apiManagement: false,
      customBranding: false,
      ssoIntegration: false
    },
    'ORG_VIEWER': {
      manageAllTenants: false,
      createTenants: false,
      billingManagement: false,
      userManagement: false,
      analyticsAccess: true,
      apiManagement: false,
      customBranding: false,
      ssoIntegration: false
    }
  };

  constructor() {
    super('OrganizationPermissionContext', ORG_PERMISSION_CACHE_OPTIONS);
    this.prisma = new PrismaClient();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OrganizationPermissionContext {
    if (!OrganizationPermissionContext.instance) {
      OrganizationPermissionContext.instance = new OrganizationPermissionContext();
    }
    return OrganizationPermissionContext.instance;
  }

  // ==========================================
  // Organization Membership
  // ==========================================

  /**
   * Get user's role in an organization
   */
  async getUserRole(userId: string, organizationId: string): Promise<OrganizationRole | null> {
    try {
      // Check cache first
      const cacheKey = `org_role:${userId}:${organizationId}`;
      const cached = await this.getCache<OrganizationRole>(cacheKey);
      if (cached) return cached;

      // Query organization membership - organizations_list table doesn't have members yet
      // For now, check if user is the owner of the organization
      const organization = await this.prisma.organizations_list.findFirst({
        where: {
          id: organizationId,
          owner_id: userId
        },
        select: { id: true }
      });

      const isOwner = !!organization;
      
      // TODO: Implement proper organization_members table when needed
      // For now, only owners have admin access
      const membership = { role: isOwner ? 'ORG_ADMIN' : null };

      if (!membership || !membership.role) return null;

      // Map database role to OrganizationRole
      const role = this.mapToOrganizationRole(membership.role);
      
      // Cache the result
      await this.setCache(cacheKey, role, { ttl: ORG_PERMISSION_CACHE_OPTIONS.defaultTTL });
      
      return role;
    } catch (error) {
      this.logError('Error getting user organization role', error);
      return null;
    }
  }

  /**
   * Map database role to OrganizationRole type
   */
  private mapToOrganizationRole(dbRole: string): OrganizationRole {
    const roleMapping: Record<string, OrganizationRole> = {
      'OWNER': 'ORG_OWNER',
      'ADMIN': 'ORG_ADMIN',
      'MEMBER': 'ORG_MEMBER',
      'VIEWER': 'ORG_VIEWER',
      'ORG_OWNER': 'ORG_OWNER',
      'ORG_ADMIN': 'ORG_ADMIN',
      'ORG_MEMBER': 'ORG_MEMBER',
      'ORG_VIEWER': 'ORG_VIEWER'
    };
    return roleMapping[dbRole] || 'ORG_VIEWER';
  }

  /**
   * Check if user is member of organization
   */
  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, organizationId);
    return role !== null;
  }

  /**
   * Check if user is organization owner
   */
  async isOwner(userId: string, organizationId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, organizationId);
    return role === 'ORG_OWNER';
  }

  /**
   * Check if user is organization admin or higher
   */
  async isAdmin(userId: string, organizationId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, organizationId);
    return role === 'ORG_OWNER' || role === 'ORG_ADMIN';
  }

  // ==========================================
  // Organization Feature Checking
  // ==========================================

  /**
   * Check if user has organization feature
   */
  async hasFeature(userId: string, organizationId: string, feature: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Check cache
      const cacheKey = `org_feature:${userId}:${organizationId}:${feature}`;
      const cached = await this.getCache<boolean>(cacheKey);
      if (cached !== undefined) {
        this.logInfo(`[ORG_PERMISSION] Cache hit: ${organizationId}:${feature} = ${cached}`);
        return cached as boolean; // Explicit type assertion
      }

      // Get user role
      const role = await this.getUserRole(userId, organizationId);
      if (!role) {
        this.logInfo(`[ORG_PERMISSION] No role found: ${userId}:${organizationId}`);
        return false;
      }

      // Check if role has feature
      const roleFeatures = this.roleFeatures[role];
      const hasFeature = roleFeatures[feature as keyof OrganizationFeatures] || false;

      // Cache result
      await this.setCache(cacheKey, hasFeature, { ttl: ORG_PERMISSION_CACHE_OPTIONS.defaultTTL });

      this.logInfo(`[ORG_PERMISSION] Feature check: ${organizationId}:${feature} = ${hasFeature} (role)`);
      return hasFeature;
    } catch (error) {
      this.logError(`Error checking org feature: ${feature}`, error);
      return false;
    }
  }

  /**
   * Get all features for user in organization
   */
  async getAllFeatures(userId: string, organizationId: string): Promise<Record<string, boolean>> {
    const role = await this.getUserRole(userId, organizationId);
    if (!role) return {};

    const roleFeatures = this.roleFeatures[role];
    return { ...roleFeatures } as Record<string, boolean>;
  }

  // ==========================================
  // Tenant Management Permissions
  // ==========================================

  /**
   * Check if user can manage a specific tenant within organization
   */
  async canManageTenant(userId: string, organizationId: string, tenantId: string): Promise<boolean> {
    try {
      // Check if tenant belongs to organization
      const tenantInOrg = await this.isTenantInOrganization(organizationId, tenantId);
      if (!tenantInOrg) return false;

      // Check if user has manageAllTenants permission
      return await this.hasFeature(userId, organizationId, 'manageAllTenants');
    } catch (error) {
      this.logError('Error checking tenant management permission', error);
      return false;
    }
  }

  /**
   * Check if user can create tenants in organization
   */
  async canCreateTenant(userId: string, organizationId: string): Promise<boolean> {
    return await this.hasFeature(userId, organizationId, 'createTenants');
  }

  /**
   * Get all tenants user can manage in organization
   */
  async getManagedTenants(userId: string, organizationId: string): Promise<string[]> {
    try {
      const canManage = await this.hasFeature(userId, organizationId, 'manageAllTenants');
      if (!canManage) return [];

      // Get all tenants in organization
      return await this.getOrganizationTenants(organizationId);
    } catch (error) {
      this.logError('Error getting managed tenants', error);
      return [];
    }
  }

  // ==========================================
  // Organization Data Access
  // ==========================================

  /**
   * Check if tenant belongs to organization
   */
  private async isTenantInOrganization(organizationId: string, tenantId: string): Promise<boolean> {
    try {
      const tenant = await this.prisma.tenants.findFirst({
        where: {
          id: tenantId,
          organization_id: organizationId
        },
        select: { id: true }
      });
      return !!tenant;
    } catch (error) {
      this.logError('Error checking tenant in organization', error);
      return false;
    }
  }

  /**
   * Get all tenants in organization
   */
  async getOrganizationTenants(organizationId: string): Promise<string[]> {
    try {
      const cacheKey = `org_tenants:${organizationId}`;
      const cached = await this.getCache<string[]>(cacheKey);
      if (cached) return cached;

      const tenants = await this.prisma.tenants.findMany({
        where: { organization_id: organizationId },
        select: { id: true }
      });

      const tenantIds = tenants.map(t => t.id);
      await this.setCache(cacheKey, tenantIds, { ttl: ORG_PERMISSION_CACHE_OPTIONS.defaultTTL });
      
      return tenantIds;
    } catch (error) {
      this.logError('Error getting organization tenants', error);
      return [];
    }
  }

  /**
   * Get organization for a tenant
   */
  async getTenantOrganization(tenantId: string): Promise<string | null> {
    try {
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { organization_id: true }
      });
      return tenant?.organization_id || null;
    } catch (error) {
      this.logError('Error getting tenant organization', error);
      return null;
    }
  }

  // ==========================================
  // Cross-Tenant Permission Checking
  // ==========================================

  /**
   * Check if user has permission across all tenants in organization
   */
  async hasCrossTenantPermission(
    userId: string,
    organizationId: string,
    permission: string
  ): Promise<boolean> {
    // Must have manageAllTenants to have cross-tenant permissions
    const canManageAll = await this.hasFeature(userId, organizationId, 'manageAllTenants');
    if (!canManageAll) return false;

    // Check the specific permission
    return await this.hasFeature(userId, organizationId, permission);
  }

  /**
   * Check tenant-level permission with organization override
   */
  async checkTenantPermissionWithOrgOverride(
    userId: string,
    tenantId: string,
    permission: string
  ): Promise<boolean> {
    // First check if user has organization-level override
    const organizationId = await this.getTenantOrganization(tenantId);
    if (organizationId) {
      const orgPermission = await this.hasCrossTenantPermission(userId, organizationId, permission);
      if (orgPermission) return true;
    }

    // Fall back to tenant-level permission check
    // This would typically delegate to TenantPermissionContext
    return false;
  }

  // ==========================================
  // Organization Permissions Bundle
  // ==========================================

  /**
   * Get complete organization permissions for a user
   */
  async getOrganizationPermissions(userId: string, organizationId: string): Promise<OrganizationPermissions | null> {
    const role = await this.getUserRole(userId, organizationId);
    if (!role) return null;

    const features = await this.getAllFeatures(userId, organizationId);
    const managedTenants = await this.getManagedTenants(userId, organizationId);

    return {
      organizationId,
      role,
      features,
      managedTenants
    };
  }

  /**
   * Get all organizations a user belongs to
   */
  async getUserOrganizations(userId: string): Promise<Array<{ id: string; role: OrganizationRole }>> {
    try {
      // organization_members table doesn't exist yet, return empty array
      // TODO: Implement proper organization_members table when needed
      return [];
    } catch (error) {
      this.logError('Error getting user organizations', error);
      return [];
    }
  }

// ... (rest of the code remains the same)
  // ==========================================
  // Convenience Methods
  // ==========================================

  /**
   * Check if user can manage billing
   */
  async canManageBilling(userId: string, organizationId: string): Promise<boolean> {
    return await this.hasFeature(userId, organizationId, 'billingManagement');
  }

  /**
   * Check if user can manage users
   */
  async canManageUsers(userId: string, organizationId: string): Promise<boolean> {
    return await this.hasFeature(userId, organizationId, 'userManagement');
  }

  /**
   * Check if user can access analytics
   */
  async canAccessAnalytics(userId: string, organizationId: string): Promise<boolean> {
    return await this.hasFeature(userId, organizationId, 'analyticsAccess');
  }

  /**
   * Check if user can manage API
   */
  async canManageAPI(userId: string, organizationId: string): Promise<boolean> {
    return await this.hasFeature(userId, organizationId, 'apiManagement');
  }

  /**
   * Check if user can configure SSO
   */
  async canConfigureSSO(userId: string, organizationId: string): Promise<boolean> {
    return await this.hasFeature(userId, organizationId, 'ssoIntegration');
  }

  // ==========================================
  // Cache Management
  // ==========================================

  /**
   * Invalidate organization cache
   */
  async invalidateOrganizationCache(organizationId: string): Promise<void> {
    await this.clearCache(`org_tenants:${organizationId}`);
    this.logInfo(`Invalidated cache for organization: ${organizationId}`);
  }

  /**
   * Invalidate user organization cache
   */
  async invalidateUserOrgCache(userId: string, organizationId: string): Promise<void> {
    await this.clearCache(`org_role:${userId}:${organizationId}`);
    // Clear all feature caches for this user/org combination
    const features = Object.keys(this.roleFeatures['ORG_VIEWER']);
    for (const feature of features) {
      await this.clearCache(`org_feature:${userId}:${organizationId}:${feature}`);
    }
    this.logInfo(`Invalidated user organization cache: ${userId}/${organizationId}`);
  }

  // ==========================================
  // Cleanup
  // ==========================================

  /**
   * Cleanup service resources
   */
  async cleanupService(): Promise<void> {
    await this.cleanup();
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
export const organizationPermissionContext = OrganizationPermissionContext.getInstance();
export default OrganizationPermissionContext;
