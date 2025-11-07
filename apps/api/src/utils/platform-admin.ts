/**
 * Platform Admin Utility
 * 
 * Centralized helper to check if a user is a platform administrator.
 * This ensures consistent checking across the entire backend.
 */

import { UserRole } from '@prisma/client';

/**
 * Check if a user has platform admin privileges
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
 * Type guard for platform admin check
 */
export function assertPlatformAdmin(user: any): asserts user is { role: UserRole } {
  if (!isPlatformAdmin(user)) {
    throw new Error('Platform administrator access required');
  }
}
