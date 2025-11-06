/**
 * Centralized Access Control System
 * 
 * This module provides utilities for checking user permissions and roles
 * across the platform. Use these functions instead of implementing
 * custom access control logic in individual pages.
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

export interface AccessControlOptions {
  requirePlatformAdmin?: boolean;
  requireTenantRole?: UserRole[];
  requireOrganization?: boolean;
  requireHeroLocation?: boolean;
  allowPlatformAdminOverride?: boolean;
}

export function isPlatformAdmin(user: UserData): boolean {
  return user.isPlatformAdmin === true || user.role === 'ADMIN';
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

export function checkAccess(user: UserData, tenantId: string | null, options: AccessControlOptions = {}): {
  hasAccess: boolean;
  reason?: string;
} {
  const {
    requirePlatformAdmin = false,
    requireTenantRole = [],
    allowPlatformAdminOverride = true,
  } = options;

  if (allowPlatformAdminOverride && isPlatformAdmin(user)) {
    return { hasAccess: true };
  }

  if (requirePlatformAdmin && !isPlatformAdmin(user)) {
    return { 
      hasAccess: false, 
      reason: 'Platform administrator access required' 
    };
  }

  if (requireTenantRole.length > 0 && tenantId) {
    if (!hasTenantRole(user, tenantId, requireTenantRole)) {
      return { 
        hasAccess: false, 
        reason: `Tenant ${requireTenantRole.join(' or ')} role required` 
      };
    }
  }

  return { hasAccess: true };
}

export const AccessPresets = {
  PLATFORM_ADMIN_ONLY: {
    requirePlatformAdmin: true,
    allowPlatformAdminOverride: false,
  } as AccessControlOptions,

  TENANT_ADMIN: {
    requireTenantRole: ['OWNER', 'ADMIN'],
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  TENANT_OWNER_ONLY: {
    requireTenantRole: ['OWNER'],
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

  ORGANIZATION_ADMIN: {
    requireTenantRole: ['OWNER', 'ADMIN'],
    requireOrganization: true,
    allowPlatformAdminOverride: true,
  } as AccessControlOptions,

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
