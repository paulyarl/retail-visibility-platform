/**
 * User Role Hook
 * 
 * Focused hook for fetching and managing user role information.
 * Handles both platform roles and tenant-specific roles.
 * 
 * OPTIMIZED: Uses AuthContext user data instead of fetching /auth/me independently
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { canBypassTierRestrictions, canBypassRoleRestrictions } from '@/lib/auth/platform-admin';
import type { UserRoleResult, UserTenantRole, PlatformUser } from './types';

/**
 * Hook for fetching user role data
 * 
 * @param tenantId - The tenant ID to check user role for
 * @returns User role data with platform and tenant context
 */
export function useUserRole(tenantId: string | null): UserRoleResult {
  // Use AuthContext instead of fetching /auth/me independently
  const { user, isLoading: authLoading } = useAuth();
  
  // Derive all values from AuthContext user
  const result = useMemo(() => {
    if (!user) {
      return {
        tenantRole: null as UserTenantRole | null,
        platformRole: null as string | null,
        platformUser: null as PlatformUser | null,
        canBypassTier: false,
        canBypassRole: false,
      };
    }

    // Set platform role and bypass capabilities
    const userPlatformRole = user.role || null;
    const tierBypass = canBypassTierRestrictions(user);
    const roleBypass = canBypassRoleRestrictions(user);

    // Create platform user object
    const platformUserData: PlatformUser = {
      id: user.id,
      userId: user.id,
      role: userPlatformRole,
      email: user.email,
      canBypassTier: tierBypass,
      canBypassRole: roleBypass
    };

    // Determine tenant role from user's tenants array
    let tenantRole: UserTenantRole | null = null;
    if (roleBypass) {
      // Platform admins/support bypass tenant roles
      tenantRole = 'OWNER';
    } else if (tenantId && user.tenants) {
      const userTenant = user.tenants.find((t: any) => t.id === tenantId);
      if (userTenant) {
        tenantRole = userTenant.role as UserTenantRole;
      } else if (user.role === 'PLATFORM_VIEWER') {
        tenantRole = 'VIEWER';
      }
    } else if (user.role === 'PLATFORM_VIEWER') {
      tenantRole = 'VIEWER';
    }

    return {
      tenantRole,
      platformRole: userPlatformRole,
      platformUser: platformUserData,
      canBypassTier: tierBypass,
      canBypassRole: roleBypass,
    };
  }, [user, tenantId]);

  return {
    ...result,
    loading: authLoading,
    error: null
  };
}
