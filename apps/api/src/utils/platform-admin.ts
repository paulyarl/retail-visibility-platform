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
 */

import { UserRole } from '@prisma/client';

/**
 * Check if a user has full platform admin privileges
 * 
 * @param user - User object with role property
 * @returns true if user is PLATFORM_ADMIN or legacy ADMIN
 */
export function isPlatformAdmin(user: { role?: UserRole } | null | undefined): boolean {
  if (!user || !user.role) return false;
  
  // Check for explicit PLATFORM_ADMIN role or legacy ADMIN role
  return user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN;
}

/**
 * Check if a user has any platform-level access (admin, support, or viewer)
 * 
 * @param user - User object with role property
 * @returns true if user has any platform role
 */
export function isPlatformUser(user: { role?: UserRole } | null | undefined): boolean {
  if (!user || !user.role) return false;
  
  return user.role === UserRole.PLATFORM_ADMIN ||
         user.role === UserRole.PLATFORM_SUPPORT ||
         user.role === UserRole.PLATFORM_VIEWER ||
         user.role === UserRole.ADMIN; // Legacy
}

/**
 * Check if a user can view all tenants (any platform role)
 * 
 * @param user - User object with role property
 * @returns true if user can view all tenants
 */
export function canViewAllTenants(user: { role?: UserRole } | null | undefined): boolean {
  return isPlatformUser(user);
}

/**
 * Check if a user can modify tenants (only platform admin)
 * 
 * @param user - User object with role property
 * @returns true if user can modify tenants
 */
export function canModifyTenants(user: { role?: UserRole } | null | undefined): boolean {
  return isPlatformAdmin(user);
}

/**
 * Check if a user can perform support actions (admin or support)
 * 
 * @param user - User object with role property
 * @returns true if user can perform support actions
 */
export function canPerformSupportActions(user: { role?: UserRole } | null | undefined): boolean {
  if (!user || !user.role) return false;
  
  return user.role === UserRole.PLATFORM_ADMIN ||
         user.role === UserRole.PLATFORM_SUPPORT ||
         user.role === UserRole.ADMIN; // Legacy
}

/**
 * Check if a user has read-only platform access
 * 
 * @param user - User object with role property
 * @returns true if user is platform viewer
 */
export function isPlatformViewer(user: { role?: UserRole } | null | undefined): boolean {
  if (!user || !user.role) return false;
  return user.role === UserRole.PLATFORM_VIEWER;
}

/**
 * Type guard for platform admin check
 */
export function assertPlatformAdmin(user: any): asserts user is { role: UserRole } {
  if (!isPlatformAdmin(user)) {
    throw new Error('Platform administrator access required');
  }
}

/**
 * Type guard for any platform user check
 */
export function assertPlatformUser(user: any): asserts user is { role: UserRole } {
  if (!isPlatformUser(user)) {
    throw new Error('Platform-level access required');
  }
}
