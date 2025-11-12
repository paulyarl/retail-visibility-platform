/**
 * Centralized Access Control System
 * 
 * This module provides utilities for checking user permissions and roles
 * across the platform. Use these functions instead of implementing
 * custom access control logic in individual pages.
 * 
 * Permission Hierarchy:
 * 1. Platform Admin - Full access to everything (can override all checks)
 * 2. Organization Owner - Full access within their organization
 * 3. Organization Admin - Admin access within their organization
 * 4. Tenant Owner - Full access to their specific tenant
 * 5. Tenant Admin - Admin access to their specific tenant
 * 6. Tenant Member - Basic access to their specific tenant
 * 7. Regular User - No tenant access
 */

export type UserRole = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER';
export type PlatformRole = 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'ADMIN' | 'OWNER' | 'USER';

export interface UserData {
  id: string;
  email: string;
  role?: PlatformRole;
  isPlatformAdmin?: boolean; // Deprecated - use role === 'PLATFORM_ADMIN'
  tenants?: Array<{
    tenantId?: string; // New format
    id?: string; // Legacy format from AuthContext
    role: UserRole;
  }>;
}

export interface TenantData {
  id: string;
  name: string;
  organizationId?: string | null;
  metadata?: {
    isHeroLocation?: boolean;
    [key: string]: any;
  };
}

export interface OrganizationData {
  id: string;
  name: string;
  tenants: TenantData[];
}

export interface AccessControlContext {
  /** The tenant being accessed */
  tenantId?: string | null;
  /** Tenant data (optional, will be fetched if not provided) */
  tenantData?: TenantData | null;
  /** Organization data (optional, will be fetched if not provided) */
  organizationData?: OrganizationData | null;
}

export interface AccessControlOptions {
  /** Require platform admin access (strict - no override) */
  requirePlatformAdmin?: boolean;
  
  /** Require specific tenant role for the scoped tenant */
  requireTenantRole?: UserRole[];
  
  /** Require user to be owner/admin of ANY tenant in the organization */
  requireOrganizationMember?: boolean;
  
  /** Require user to be owner/admin of the HERO tenant in the organization */
  requireOrganizationAdmin?: boolean;
  
  /** Require the scoped tenant to be part of an organization */
  requireOrganization?: boolean;
  
  /** Require the scoped tenant to be a hero location */
  requireHeroLocation?: boolean;
  
  /** Allow platform admin to bypass all checks (default: true) */
  allowPlatformAdminOverride?: boolean;
  
  /** Custom validation function for complex scenarios */
  customCheck?: (user: UserData, context: AccessControlContext) => boolean;
}

/**
 * Check if user is a platform admin
 */
export function isPlatformAdmin(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || 
         user.role === 'ADMIN' || // Legacy
         user.isPlatformAdmin === true; // Legacy
}

/**
 * Permission Helpers
 * These functions check if a user has permission to perform specific actions.
 * Use these instead of checking roles directly for better maintainability.
 */

/**
 * Check if user can manage platform users (create, edit, delete)
 */
export function canManageUsers(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN';
}

/**
 * Check if user can view platform users (read-only)
 */
export function canViewUsers(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || 
         user.role === 'PLATFORM_SUPPORT' || 
         user.role === 'ADMIN';
}

/**
 * Check if user can manage feature flags
 */
export function canManageFeatureFlags(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN';
}

/**
 * Check if user can view feature flags (read-only)
 */
export function canViewFeatureFlags(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || 
         user.role === 'PLATFORM_SUPPORT' || 
         user.role === 'ADMIN';
}

/**
 * Check if user can manage organizations
 */
export function canManageOrganizations(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN';
}

/**
 * Check if user can view organizations (read-only)
 */
export function canViewOrganizations(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || 
         user.role === 'PLATFORM_SUPPORT' || 
         user.role === 'ADMIN';
}

export function isPlatformUser(user: UserData): boolean {
  // Check if user has any platform-level access (admin, support, or viewer)
  return user.role === 'PLATFORM_ADMIN' ||
         user.role === 'PLATFORM_SUPPORT' ||
         user.role === 'PLATFORM_VIEWER' ||
         user.role === 'ADMIN'; // Legacy
}

export function canViewAllTenants(user: UserData): boolean {
  // Any platform user can view all tenants
  return isPlatformUser(user);
}

export function canModifyTenants(user: UserData): boolean {
  // Only platform admins can modify tenants
  return isPlatformAdmin(user);
}

/**
 * Tenant Permission Helpers
 * These functions centralize all tenant-level permission logic
 * Use these instead of checking roles directly in components
 */

/**
 * Check if user can view a specific tenant
 * Platform users (admin, support, viewer) can view all tenants
 * Regular users can only view tenants they're members of
 */
export function canViewTenant(user: UserData, tenantId: string): boolean {
  // Platform users can view all tenants
  if (isPlatformUser(user)) return true;
  
  // Check if user is a member of this tenant (any role)
  const memberRole = getTenantRole(user, tenantId);
  return memberRole !== null;
}

/**
 * Check if user can edit a specific tenant
 * Platform admins can edit any tenant
 * Tenant owners and admins can edit their tenant
 */
export function canEditTenant(user: UserData, tenantId: string): boolean {
  // Platform admins can edit any tenant
  if (isPlatformAdmin(user)) return true;
  
  // Tenant owners and admins can edit their tenant
  const memberRole = getTenantRole(user, tenantId);
  return memberRole === 'OWNER' || memberRole === 'ADMIN';
}

/**
 * Check if user can delete a specific tenant
 * Platform admins can delete any tenant
 * Only tenant owners can delete their tenant
 */
export function canDeleteTenant(user: UserData, tenantId: string): boolean {
  // Platform admins can delete any tenant
  if (isPlatformAdmin(user)) return true;
  
  // Only tenant owners can delete
  const memberRole = getTenantRole(user, tenantId);
  return memberRole === 'OWNER';
}

/**
 * Check if user can rename a specific tenant
 * Same as canEditTenant - owners and admins can rename
 */
export function canRenameTenant(user: UserData, tenantId: string): boolean {
  return canEditTenant(user, tenantId);
}

/**
 * Check if user can manage tenant settings (branding, hours, etc.)
 * Platform admins can manage any tenant
 * Tenant owners and admins can manage their tenant
 */
export function canManageTenantSettings(user: UserData, tenantId: string): boolean {
  return canEditTenant(user, tenantId);
}

/**
 * Check if user can manage tenant inventory
 * Platform admins can manage any tenant's inventory
 * Tenant owners, admins, and members can manage their tenant's inventory
 */
export function canManageTenantInventory(user: UserData, tenantId: string): boolean {
  // Platform admins can manage any tenant
  if (isPlatformAdmin(user)) return true;
  
  // Tenant owners, admins, and members can manage inventory
  const memberRole = getTenantRole(user, tenantId);
  return memberRole === 'OWNER' || memberRole === 'ADMIN' || memberRole === 'MEMBER';
}

/**
 * Check if user can view tenant analytics
 * Platform users can view all tenant analytics
 * Tenant members (any role) can view their tenant's analytics
 */
export function canViewTenantAnalytics(user: UserData, tenantId: string): boolean {
  // Platform users can view all analytics
  if (isPlatformUser(user)) return true;
  
  // Any tenant member can view analytics
  const memberRole = getTenantRole(user, tenantId);
  return memberRole !== null;
}

/**
 * Check if user can create new tenants
 * Platform admins can always create tenants
 * Regular users can create tenants (subject to subscription limits)
 */
export function canCreateTenant(user: UserData): boolean {
  // Platform admins can always create tenants
  if (isPlatformAdmin(user)) return true;
  
  // Regular authenticated users can create tenants
  // (actual creation is subject to subscription limits checked elsewhere)
  return true;
}

/**
 * Check if user can switch to a specific tenant
 * Platform users can switch to any tenant
 * Regular users can only switch to tenants they're members of
 */
export function canSwitchToTenant(user: UserData, tenantId: string): boolean {
  // Platform users can switch to any tenant
  if (isPlatformUser(user)) return true;
  
  // Check if user is a member of this tenant
  const memberRole = getTenantRole(user, tenantId);
  return memberRole !== null;
}

export function getTenantRole(user: UserData, tenantId: string): UserRole | null {
  // Support both tenantId (new format) and id (legacy format from AuthContext)
  const tenantRole = user.tenants?.find(t => t.tenantId === tenantId || t.id === tenantId);
  return tenantRole?.role || null;
}

export function hasTenantRole(user: UserData, tenantId: string, roles: UserRole[]): boolean {
  const userRole = getTenantRole(user, tenantId);
  return userRole ? roles.includes(userRole) : false;
}

export function isTenantOwnerOrAdmin(user: UserData, tenantId: string): boolean {
  return hasTenantRole(user, tenantId, ['OWNER', 'ADMIN']);
}

export function isTenantOwner(user: UserData, tenantId: string): boolean {
  return hasTenantRole(user, tenantId, ['OWNER']);
}

/**
 * Check if user is owner/admin of the hero tenant in an organization
 */
export function isOrganizationAdmin(user: UserData, organizationData: OrganizationData): boolean {
  const heroTenant = organizationData.tenants.find(t => t.metadata?.isHeroLocation === true);
  if (!heroTenant) return false;
  return isTenantOwnerOrAdmin(user, heroTenant.id);
}

/**
 * Check if user is owner/admin of ANY tenant in an organization
 */
export function isOrganizationMember(user: UserData, organizationData: OrganizationData): boolean {
  return organizationData.tenants.some(t => isTenantOwnerOrAdmin(user, t.id));
}

/**
 * Comprehensive access control check with organization context support
 */
export function checkAccess(
  user: UserData, 
  context: AccessControlContext = {}, 
  options: AccessControlOptions = {}
): {
  hasAccess: boolean;
  reason?: string;
} {
  const {
    requirePlatformAdmin = false,
    requireTenantRole = [],
    requireOrganizationMember = false,
    requireOrganizationAdmin = false,
    requireOrganization = false,
    requireHeroLocation = false,
    allowPlatformAdminOverride = true,
    customCheck,
  } = options;

  const { tenantId, tenantData, organizationData } = context;

  // 1. Platform admin override (if enabled)
  const userIsPlatformAdmin = isPlatformAdmin(user);
  console.log('[Access Control] Platform admin check:', { 
    allowPlatformAdminOverride, 
    userIsPlatformAdmin,
    userRole: user.role,
    isPlatformAdminFlag: user.isPlatformAdmin 
  });
  
  if (allowPlatformAdminOverride && userIsPlatformAdmin) {
    console.log('[Access Control] ✅ Platform admin override - granting access');
    return { hasAccess: true };
  }

  // 2. Strict platform admin requirement (no override)
  if (requirePlatformAdmin && !isPlatformAdmin(user)) {
    return { 
      hasAccess: false, 
      reason: 'Platform administrator access required' 
    };
  }

  // 3. Organization requirements
  if (requireOrganization && !tenantData?.organizationId) {
    return {
      hasAccess: false,
      reason: 'This feature requires the tenant to be part of an organization'
    };
  }

  // 4. Hero location requirement
  if (requireHeroLocation && !tenantData?.metadata?.isHeroLocation) {
    return {
      hasAccess: false,
      reason: 'This feature requires the tenant to be a hero location'
    };
  }

  // 5. Organization admin requirement (must be admin of hero tenant)
  if (requireOrganizationAdmin && organizationData) {
    if (!isOrganizationAdmin(user, organizationData)) {
      return {
        hasAccess: false,
        reason: 'Organization owner or admin access required (must be owner/admin of hero location)'
      };
    }
  }

  // 6. Organization member requirement (must be admin of any tenant in org)
  if (requireOrganizationMember && organizationData) {
    if (!isOrganizationMember(user, organizationData)) {
      return {
        hasAccess: false,
        reason: 'Organization membership required (must be owner/admin of at least one location)'
      };
    }
  }

  // 7. Tenant role requirement (for the scoped tenant)
  if (requireTenantRole.length > 0 && tenantId) {
    if (!hasTenantRole(user, tenantId, requireTenantRole)) {
      return { 
        hasAccess: false, 
        reason: `Tenant ${requireTenantRole.join(' or ')} role required` 
      };
    }
  }

  // 8. Custom check (for complex scenarios)
  if (customCheck && !customCheck(user, context)) {
    return {
      hasAccess: false,
      reason: 'Custom access requirements not met'
    };
  }

  return { hasAccess: true };
}

/**
 * Pre-configured access control presets for common scenarios
 */
export const AccessPresets = {
  /** Platform admin only (no tenant override) */
  PLATFORM_ADMIN_ONLY: {
    requirePlatformAdmin: true,
    allowPlatformAdminOverride: false,
  } as AccessControlOptions,

  /** Platform staff (admin + support) for read-only admin access */
  PLATFORM_STAFF: {
    requirePlatformAdmin: true,
    allowPlatformAdminOverride: false,
  } as AccessControlOptions,

  /** Platform admin or support (can help customers, but not viewers) */
  PLATFORM_SUPPORT: {
    customCheck: (user) => {
      return user.role === 'PLATFORM_ADMIN' || 
             user.role === 'PLATFORM_SUPPORT' ||
             user.role === 'ADMIN'; // Legacy
    },
    allowPlatformAdminOverride: false,
  } as AccessControlOptions,

  /** Tenant owner/admin for the scoped tenant, or platform admin */
  TENANT_ADMIN: {
    requireTenantRole: ['OWNER', 'ADMIN'],
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Tenant owner only for the scoped tenant, or platform admin */
  TENANT_OWNER_ONLY: {
    requireTenantRole: ['OWNER'],
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Tenant owner/admin/member (for viewing/basic operations), or platform admin */
  TENANT_MEMBER: {
    requireTenantRole: ['OWNER', 'ADMIN', 'MEMBER'],
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Platform support OR tenant owner/admin (for inventory/propagation operations) */
  SUPPORT_OR_TENANT_ADMIN: {
    customCheck: (user, context) => {
      // Platform support can help any tenant
      if (user.role === 'PLATFORM_ADMIN' || 
          user.role === 'PLATFORM_SUPPORT' ||
          user.role === 'ADMIN') {
        return true;
      }
      // Tenant owner/admin can manage their own tenant
      if (context?.tenantId) {
        const tenantRole = user.tenants?.find(t => 
          t.tenantId === context.tenantId || t.id === context.tenantId
        )?.role;
        return tenantRole === 'OWNER' || tenantRole === 'ADMIN';
      }
      return false;
    },
    allowPlatformAdminOverride: false,
  } as AccessControlOptions,

  /** Organization admin (owner/admin of hero location), or platform admin */
  ORGANIZATION_ADMIN: {
    requireOrganization: true,
    requireOrganizationAdmin: true,
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Organization member (owner/admin of any location), or platform support */
  ORGANIZATION_MEMBER: {
    requireOrganization: true,
    customCheck: (user, context) => {
      // Platform support/admin can view organization data
      if (user.role === 'PLATFORM_ADMIN' || 
          user.role === 'PLATFORM_SUPPORT' ||
          user.role === 'ADMIN') {
        return true;
      }
      // Check if user is a member of the organization
      if (context?.organizationData) {
        return user.tenants?.some(t => 
          context.organizationData!.tenants.some(orgTenant => 
            (t.tenantId === orgTenant.id || t.id === orgTenant.id) &&
            (t.role === 'OWNER' || t.role === 'ADMIN')
          )
        ) || false;
      }
      return false;
    },
    allowPlatformAdminOverride: false,
  } as AccessControlOptions,

  /** Hero location admin (must be hero + owner/admin), or platform admin */
  HERO_LOCATION_ADMIN: {
    requireHeroLocation: true,
    requireTenantRole: ['OWNER', 'ADMIN'],
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Chain propagation access (org admin for scoped tenant's org), or platform support */
  CHAIN_PROPAGATION: {
    requireOrganization: true,
    customCheck: (user, context) => {
      // Platform support can help with propagation
      if (user.role === 'PLATFORM_ADMIN' || 
          user.role === 'PLATFORM_SUPPORT' ||
          user.role === 'ADMIN') {
        return true;
      }
      // Organization admin can propagate
      if (context?.organizationData) {
        const heroTenant = context.organizationData.tenants.find(
          t => t.metadata?.isHeroLocation === true
        );
        if (heroTenant) {
          const tenantRole = user.tenants?.find(t => 
            t.tenantId === heroTenant.id || t.id === heroTenant.id
          )?.role;
          return tenantRole === 'OWNER' || tenantRole === 'ADMIN';
        }
      }
      return false;
    },
    allowPlatformAdminOverride: false,
  } as AccessControlOptions,

  /** Any authenticated user */
  AUTHENTICATED: {
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,
};

export function getAccessDeniedMessage(reason?: string, userRole?: string | null): {
  title: string;
  message: string;
  userRoleText?: string;
} {
  return {
    title: 'Access Restricted',
    message: reason || 'You do not have permission to access this resource.',
    userRoleText: userRole ? `Your current role: ${userRole}` : undefined,
  };
}
