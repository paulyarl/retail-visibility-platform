/**
 * Platform Access Control Utility
 * 
 * Centralized helpers for checking platform-level user permissions.
 * This ensures consistent checking across the entire backend.
 * 
 * Role Hierarchy:
 * - PLATFORM_ADMIN: Full control (create, update, delete)
 * - PLATFORM_SUPPORT: View all + limited actions (password resets, unlock accounts)
 * - PLATFORM_VIEWER: Read-only access (analytics, sales, legal, compliance)
 * 
 * NOTE: Now uses centralized USER_ROLES and ROLE_GROUPS from config/role-groups.ts
 */

import { user_role } from '@prisma/client';
import { USER_ROLES, isRoleInGroup, hasPermission, isValidRole, type UserRole } from '../config/role-groups';

/**
 * Check if a user has full platform admin privileges
 * 
 * @param user - User object with role property (Prisma user_role enum or string)
 * @returns true if user is PLATFORM_ADMIN or legacy ADMIN
 */
export function isPlatformAdmin(user: { role?: user_role | string } | null | undefined): boolean {
  const role = user?.role;
  if (!role) return false;

  // Normalize role to string for comparison
  const roleStr = typeof role === 'string' ? role : String(role);

  // Check for valid role and platform admin group membership
  if (isValidRole(roleStr)) {
    return isRoleInGroup(roleStr, 'IS_PLATFORM_ADMIN');
  }

  // Fallback for Prisma enum values
  return role === 'PLATFORM_ADMIN' || 
         role === 'ADMIN' ||
         role === user_role.PLATFORM_ADMIN ||
         role === user_role.ADMIN;
}

/**
 * Check if a user has any platform-level access (admin, support, or viewer)
 * 
 * @param user - User object with role property (Prisma user_role enum or string)
 * @returns true if user has any platform role
 */
export function isPlatformUser(user: { role?: user_role | string } | null | undefined): boolean {
  const role = user?.role;
  if (!role) return false;

  // Normalize role to string for comparison
  const roleStr = typeof role === 'string' ? role : String(role);

  // Check for valid role and platform support group membership
  if (isValidRole(roleStr)) {
    return isRoleInGroup(roleStr, 'IS_PLATFORM_ADMIN') || isRoleInGroup(roleStr, 'IS_PLATFORM_SUPPORT');
  }

  // Fallback for Prisma enum values
  return role === 'PLATFORM_ADMIN' ||
         role === 'PLATFORM_SUPPORT' ||
         role === 'PLATFORM_VIEWER' ||
         role === 'ADMIN' ||
         role === user_role.PLATFORM_ADMIN ||
         role === user_role.PLATFORM_SUPPORT ||
         role === user_role.PLATFORM_VIEWER ||
         role === user_role.ADMIN;
}

/**
 * Check if a user can view all tenants (any platform role)
 * 
 * @param user - User object with role property
 * @returns true if user can view all tenants
 */
export function canViewAllTenants(user: { role?: user_role | string } | null | undefined): boolean {
  return isPlatformUser(user);
}

/**
 * Check if a user can modify tenants (only platform admin)
 * 
 * @param user - User object with role property
 * @returns true if user can modify tenants
 */
export function canModifyTenants(user: { role?: user_role | string } | null | undefined): boolean {
  return isPlatformAdmin(user);
}

/**
 * Check if a user can perform support actions (admin or support)
 * 
 * @param user - User object with role property
 * @returns true if user can perform support actions
 */
export function canPerformSupportActions(user: { role?: user_role | string } | null | undefined): boolean {
  const role = user?.role;
  if (!role) return false;

  // Normalize role to string for comparison
  const roleStr = typeof role === 'string' ? role : String(role);

  // Check for valid role and platform support group membership
  if (isValidRole(roleStr)) {
    return isRoleInGroup(roleStr, 'IS_PLATFORM_ADMIN') || isRoleInGroup(roleStr, 'IS_PLATFORM_SUPPORT');
  }

  // Fallback for Prisma enum values
  return role === 'PLATFORM_ADMIN' ||
         role === 'PLATFORM_SUPPORT' ||
         role === 'TENANT_OWNER' ||
         role === 'OWNER' ||
         role === 'TENANT_ADMIN' ||
         role === 'ADMIN' ||
         role === user_role.PLATFORM_ADMIN ||
         role === user_role.PLATFORM_SUPPORT ||
         role === user_role.TENANT_OWNER ||
         role === user_role.OWNER ||
         role === user_role.TENANT_ADMIN ||
         role === user_role.ADMIN;
}

/**
 * Check if a user has read-only platform access
 * 
 * @param user - User object with role property
 * @returns true if user is platform viewer
 */
export function isPlatformViewer(user: { role?: user_role | string } | null | undefined): boolean {
  const role = user?.role;
  if (!role) return false;
  
  const roleStr = typeof role === 'string' ? role : String(role);
  return roleStr === USER_ROLES.PLATFORM_VIEWER || 
         role === user_role.PLATFORM_VIEWER;
}

/**
 * Type guard for platform admin check
 */
export function assertPlatformAdmin(user: any): asserts user is { role: user_role | string } {
  if (!isPlatformAdmin(user)) {
    throw new Error('Platform administrator access required');
  }
}

/**
 * Type guard for any platform user check
 */
export function assertPlatformUser(user: any): asserts user is { role: user_role | string } {
  if (!isPlatformUser(user)) {
    throw new Error('Platform-level access required');
  }
}
