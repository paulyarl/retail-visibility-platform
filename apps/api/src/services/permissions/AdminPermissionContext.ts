/**
 * Admin Permission Context
 * 
 * Layer 4: Context Permission Layer
 * 
 * Provides admin-specific permission checking with:
 * - Role-based permission evaluation
 * - Admin privilege validation
 * - Security constraints
 * - Audit logging
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Extends BasePermissionService (which extends UniversalSingleton)
 * - Follows singleton pattern with getInstance()
 * - Integrates with existing user and role services
 */

import { BasePermissionService, PermissionResult, FeaturePermission, LimitPermission, AccessPermission, PermissionCheckOptions, PermissionCacheEntry } from './BasePermissionService';
import { SingletonCacheOptions } from '../../lib/UniversalSingleton';

// Admin roles
export type AdminRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER';

// Admin features by role
export interface AdminFeatures {
  manageAllTenants: boolean;
  manageTenantUsers: boolean;
  manageBilling: boolean;
  viewAnalytics: boolean;
  manageOverrides: boolean;
  manageApprovals: boolean;
  manageTickets: boolean;
  auditAccess: boolean;
  systemConfig: boolean;
}

// Admin permissions result
export interface AdminPermissions {
  roles: AdminRole[];
  features: Record<string, boolean>;
  tenants?: string[]; // Tenants this admin can manage
}

// Cache options for admin permission context
const ADMIN_PERMISSION_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 2000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'admin'
};

/**
 * Admin Permission Context Service
 * 
 * Singleton service for admin-specific permission checking
 */
class AdminPermissionContext extends BasePermissionService {
  private static instance: AdminPermissionContext;

  // Admin feature definitions by role
  private roleFeatures: Record<AdminRole, AdminFeatures> = {
    'PLATFORM_ADMIN': {
      manageAllTenants: true,
      manageTenantUsers: true,
      manageBilling: true,
      viewAnalytics: true,
      manageOverrides: true,
      manageApprovals: true,
      manageTickets: true,
      auditAccess: true,
      systemConfig: true
    },
    'TENANT_ADMIN': {
      manageAllTenants: false,
      manageTenantUsers: true,
      manageBilling: true,
      viewAnalytics: true,
      manageOverrides: true,
      manageApprovals: true,
      manageTickets: false,
      auditAccess: false,
      systemConfig: false
    },
    'PLATFORM_SUPPORT': {
      manageAllTenants: false,
      manageTenantUsers: false,
      manageBilling: false,
      viewAnalytics: true,
      manageOverrides: false,
      manageApprovals: false,
      manageTickets: true,
      auditAccess: true,
      systemConfig: false
    },
    'PLATFORM_VIEWER': {
      manageAllTenants: false,
      manageTenantUsers: false,
      manageBilling: false,
      viewAnalytics: true,
      manageOverrides: false,
      manageApprovals: false,
      manageTickets: false,
      auditAccess: false,
      systemConfig: false
    }
  };

  constructor() {
    super('AdminPermissionContext', ADMIN_PERMISSION_CACHE_OPTIONS);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdminPermissionContext {
    if (!AdminPermissionContext.instance) {
      AdminPermissionContext.instance = new AdminPermissionContext();
    }
    return AdminPermissionContext.instance;
  }

  // ==========================================
  // Abstract Method Implementations
  // ==========================================

  /**
   * Check if a user has access to a specific admin feature
   * Note: For admin context, we use userId instead of tenantId
   */
  async hasFeature(userId: string, feature: string, options?: PermissionCheckOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Check cache first (unless skipCache is true)
      if (!options?.skipCache) {
        const cached = await this.getCachedPermission(userId, 'admin_feature', feature);
        if (cached) {
          this.logPermissionCheck(userId, 'admin_feature', feature, cached.granted, cached.source, Date.now() - startTime);
          return cached.granted;
        }
      }

      // Get user roles and check feature access
      const roles = await this.getUserRoles(userId);
      const hasAccess = this.checkRoleFeature(roles, feature);

      // Cache the result
      const cacheEntry: PermissionCacheEntry = {
        granted: hasAccess,
        source: 'tier', // Admin permissions are role-based (tier equivalent)
        timestamp: Date.now(),
        ttl: this.defaultTTL
      };
      await this.setCachedPermission(userId, 'admin_feature', feature, cacheEntry);

      this.logPermissionCheck(userId, 'admin_feature', feature, hasAccess, 'role', Date.now() - startTime);
      return hasAccess;
    } catch (error) {
      this.handlePermissionError(userId, 'admin_feature', feature, error);
    }
  }

  /**
   * Get limit value (not typically used for admin context, returns high values)
   */
  async getLimit(userId: string, limitType: string, options?: PermissionCheckOptions): Promise<number> {
    // Admin users typically have high or unlimited limits
    const roles = await this.getUserRoles(userId);
    
    if (roles.includes('PLATFORM_ADMIN')) {
      return -1; // Unlimited for platform admins
    }
    
    // Default high limits for other admin roles
    return 10000;
  }

  /**
   * Check if a user can access a specific admin resource with an action
   */
  async canAccess(userId: string, resource: string, action: string, options?: PermissionCheckOptions): Promise<boolean> {
    const startTime = Date.now();
    const permissionKey = `${resource}:${action}`;
    
    try {
      // Check cache first (unless skipCache is true)
      if (!options?.skipCache) {
        const cached = await this.getCachedPermission(userId, 'admin_access', permissionKey);
        if (cached) {
          this.logPermissionCheck(userId, 'admin_access', permissionKey, cached.granted, cached.source, Date.now() - startTime);
          return cached.granted;
        }
      }

      // Get user roles and check access
      const roles = await this.getUserRoles(userId);
      const hasAccess = this.checkRoleAccess(roles, resource, action);

      // Cache the result
      const cacheEntry: PermissionCacheEntry = {
        granted: hasAccess,
        source: 'tier',
        timestamp: Date.now(),
        ttl: this.defaultTTL
      };
      await this.setCachedPermission(userId, 'admin_access', permissionKey, cacheEntry);

      this.logPermissionCheck(userId, 'admin_access', permissionKey, hasAccess, 'role', Date.now() - startTime);
      return hasAccess;
    } catch (error) {
      this.handlePermissionError(userId, 'admin_access', permissionKey, error);
    }
  }

  /**
   * Get detailed permission result for an admin feature
   */
  async getFeaturePermission(userId: string, feature: string, options?: PermissionCheckOptions): Promise<FeaturePermission> {
    const roles = await this.getUserRoles(userId);
    const hasAccess = this.checkRoleFeature(roles, feature);

    return {
      feature,
      granted: hasAccess,
      source: 'tier',
      expiresAt: null,
      metadata: options?.includeMetadata ? { roles } : undefined
    };
  }

  /**
   * Get detailed permission result for an admin limit
   */
  async getLimitPermission(userId: string, limitType: string, options?: PermissionCheckOptions): Promise<LimitPermission> {
    const limit = await this.getLimit(userId, limitType);

    return {
      limitType,
      limit,
      granted: limit !== 0,
      source: 'tier',
      expiresAt: null,
      metadata: options?.includeMetadata ? { type: 'admin_limit' } : undefined
    };
  }

  // ==========================================
  // Role-Based Permission Methods
  // ==========================================

  /**
   * Get user roles from database
   */
  private async getUserRoles(userId: string): Promise<AdminRole[]> {
    try {
      // Check if user exists and has admin roles
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { 
          id: true,
          role: true
        }
      });

      // Also get tenant memberships
      const tenantMemberships = await this.prisma.user_tenants.findMany({
        where: { user_id: userId },
        select: {
          role: true,
          tenant_id: true
        }
      });

      if (!user) {
        this.logWarning(`User not found: ${userId}`);
        return [];
      }

      // Determine admin roles based on user role
      const roles: AdminRole[] = [];

      // Check for platform admin role
      if (user.role === 'PLATFORM_ADMIN') {
        roles.push('PLATFORM_ADMIN');
      } else if (user.role === 'PLATFORM_SUPPORT') {
        roles.push('PLATFORM_SUPPORT');
      } else if (user.role === 'PLATFORM_VIEWER') {
        roles.push('PLATFORM_VIEWER');
      }

      // Check for tenant admin roles
      const tenantAdminRoles: AdminRole[] = tenantMemberships
        .filter((tu: { role: string; tenant_id: string }) => tu.role === 'ADMIN' || tu.role === 'OWNER')
        .map((): AdminRole => 'TENANT_ADMIN');

      roles.push(...tenantAdminRoles);

      return roles;
    } catch (error) {
      this.logError('Error getting user roles', error);
      return [];
    }
  }

  /**
   * Check if any of the roles have access to a feature
   */
  private checkRoleFeature(roles: AdminRole[], feature: string): boolean {
    for (const role of roles) {
      const roleFeatures = this.roleFeatures[role];
      if (roleFeatures && roleFeatures[feature as keyof AdminFeatures]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if any of the roles have access to a resource:action
   */
  private checkRoleAccess(roles: AdminRole[], resource: string, action: string): boolean {
    // Map resource:action to features
    const accessFeatureMapping: Record<string, string> = {
      'tenants:read': 'viewAnalytics',
      'tenants:update': 'manageAllTenants',
      'tenants:delete': 'manageAllTenants',
      'users:read': 'viewAnalytics',
      'users:update': 'manageTenantUsers',
      'users:delete': 'manageTenantUsers',
      'billing:read': 'manageBilling',
      'billing:update': 'manageBilling',
      'analytics:read': 'viewAnalytics',
      'overrides:read': 'manageOverrides',
      'overrides:create': 'manageOverrides',
      'overrides:update': 'manageOverrides',
      'overrides:delete': 'manageOverrides',
      'approvals:read': 'manageApprovals',
      'approvals:approve': 'manageApprovals',
      'approvals:reject': 'manageApprovals',
      'tickets:read': 'manageTickets',
      'tickets:update': 'manageTickets',
      'audit:read': 'auditAccess',
      'config:read': 'systemConfig',
      'config:update': 'systemConfig'
    };

    const accessKey = `${resource}:${action}`;
    const feature = accessFeatureMapping[accessKey];

    if (feature) {
      return this.checkRoleFeature(roles, feature);
    }

    // Default: read access for any admin role
    if (action === 'read' && roles.length > 0) {
      return true;
    }

    return false;
  }

  // ==========================================
  // Admin-Specific Methods
  // ==========================================

  /**
   * Check if user is platform admin
   */
  async isPlatformAdmin(userId: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.includes('PLATFORM_ADMIN');
  }

  /**
   * Check if user can manage a specific tenant
   */
  async canManageTenant(userId: string, tenantId: string): Promise<boolean> {
    try {
      // Platform admins can manage all tenants
      if (await this.isPlatformAdmin(userId)) {
        return true;
      }

      // Check if user is admin of the specific tenant
      const tenantUser = await this.prisma.user_tenants.findFirst({
        where: {
          user_id: userId,
          tenant_id: tenantId,
          role: { in: ['ADMIN', 'OWNER'] }
        }
      });

      return !!tenantUser;
    } catch (error) {
      this.logError('Error checking tenant management permission', error);
      return false;
    }
  }

  /**
   * Check if user can manage overrides
   */
  async canManageOverrides(userId: string): Promise<boolean> {
    return await this.hasFeature(userId, 'manageOverrides');
  }

  /**
   * Check if user can approve requests
   */
  async canApproveRequests(userId: string): Promise<boolean> {
    return await this.hasFeature(userId, 'manageApprovals');
  }

  /**
   * Check if user can view audit logs
   */
  async canViewAuditLogs(userId: string): Promise<boolean> {
    return await this.hasFeature(userId, 'auditAccess');
  }

  /**
   * Get tenants that an admin can manage
   */
  async getManagedTenants(userId: string): Promise<string[]> {
    try {
      // Platform admins can manage all tenants
      if (await this.isPlatformAdmin(userId)) {
        const tenants = await this.prisma.tenants.findMany({
          select: { id: true }
        });
        return tenants.map(t => t.id);
      }

      // Get tenants where user is admin
      const tenantUsers = await this.prisma.user_tenants.findMany({
        where: {
          user_id: userId,
          role: { in: ['ADMIN', 'OWNER'] }
        },
        select: { tenant_id: true }
      });

      return tenantUsers.map((tu: { tenant_id: string }) => tu.tenant_id);
    } catch (error) {
      this.logError('Error getting managed tenants', error);
      return [];
    }
  }

  /**
   * Get all admin features for a user
   */
  async getAllAdminFeatures(userId: string): Promise<Record<string, boolean>> {
    const roles = await this.getUserRoles(userId);
    const features: Record<string, boolean> = {};

    // Initialize all features to false
    for (const feature of Object.keys(this.roleFeatures['PLATFORM_VIEWER'])) {
      features[feature] = false;
    }

    // Set features based on roles
    for (const role of roles) {
      const roleFeatures = this.roleFeatures[role];
      for (const [feature, enabled] of Object.entries(roleFeatures)) {
        if (enabled) {
          features[feature] = true;
        }
      }
    }

    return features;
  }

  /**
   * Get complete admin permissions for a user
   */
  async getAdminPermissions(userId: string): Promise<AdminPermissions> {
    const [roles, features, tenants] = await Promise.all([
      this.getUserRoles(userId),
      this.getAllAdminFeatures(userId),
      this.getManagedTenants(userId)
    ]);

    return { roles, features, tenants };
  }

  // ==========================================
  // Audit Logging
  // ==========================================

  /**
   * Log admin action for audit purposes
   */
  async logAdminAction(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.prisma.audit_log.create({
        data: {
          id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: 'platform',
          actor_id: userId,
          actor_type: 'user',
          action: action as any,
          entity_type: resource as any,
          entity_id: resourceId,
          diff: metadata || {},
          occurred_at: new Date()
        }
      });

      this.logInfo(`Admin action logged: ${action} on ${resource}:${resourceId}`, { userId });
    } catch (error) {
      this.logError('Error logging admin action', error);
    }
  }
}

// Export singleton instance
export const adminPermissionContext = AdminPermissionContext.getInstance();
export default AdminPermissionContext;
