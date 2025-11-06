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

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type PlatformRole = 'ADMIN' | 'USER';

export interface UserData {
  id: string;
  email: string;
  role?: PlatformRole;
  isPlatformAdmin?: boolean;
  tenants?: Array<{
    tenantId: string;
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

export function isPlatformAdmin(user: UserData): boolean {
  // Platform admin is determined by role === 'ADMIN'
  // isPlatformAdmin field doesn't exist in schema, kept in interface for backwards compatibility
  return user.role === 'ADMIN' || user.isPlatformAdmin === true;
}

export function getTenantRole(user: UserData, tenantId: string): UserRole | null {
  const tenantRole = user.tenants?.find(t => t.tenantId === tenantId);
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
  /** Platform administrators only (strict - no override) */
  PLATFORM_ADMIN_ONLY: {
    requirePlatformAdmin: true,
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

  /** Organization admin (owner/admin of hero location), or platform admin */
  ORGANIZATION_ADMIN: {
    requireOrganization: true,
    requireOrganizationAdmin: true,
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Organization member (owner/admin of any location), or platform admin */
  ORGANIZATION_MEMBER: {
    requireOrganization: true,
    requireOrganizationMember: true,
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Hero location admin (must be hero + owner/admin), or platform admin */
  HERO_LOCATION_ADMIN: {
    requireHeroLocation: true,
    requireTenantRole: ['OWNER', 'ADMIN'],
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  /** Chain propagation access (org admin for scoped tenant's org), or platform admin */
  CHAIN_PROPAGATION: {
    requireOrganization: true,
    requireOrganizationAdmin: true,
    allowPlatformAdminOverride: true,
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
