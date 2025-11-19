/**
 * User Role Hook
 * 
 * Focused hook for fetching and managing user role information.
 * Handles both platform roles and tenant-specific roles.
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { canBypassTierRestrictions, canBypassRoleRestrictions } from '@/lib/auth/platform-admin';
import type { UserRoleResult, UserTenantRole, PlatformUser } from './types';

/**
 * Hook for fetching user role data
 * 
 * @param tenantId - The tenant ID to check user role for
 * @returns User role data with platform and tenant context
 */
export function useUserRole(tenantId: string | null): UserRoleResult {
  const [tenantRole, setTenantRole] = useState<UserTenantRole | null>(null);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [canBypassTier, setCanBypassTier] = useState(false);
  const [canBypassRole, setCanBypassRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRole = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user profile and platform role
      const userResponse = await api.get('auth/me');
      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user data: ${userResponse.status}`);
      }

      const userData = await userResponse.json();
      const user = userData.user;

      if (!user) {
        throw new Error('No user data found');
      }

      // Set platform role and bypass capabilities
      const userPlatformRole = user.role || null;
      const tierBypass = canBypassTierRestrictions(user);
      const roleBypass = canBypassRoleRestrictions(user);

      setPlatformRole(userPlatformRole);
      setCanBypassTier(tierBypass);
      setCanBypassRole(roleBypass);

      // Create platform user object
      const platformUserData: PlatformUser = {
        id: user.id,
        userId: user.userId || user.id,
        role: userPlatformRole,
        email: user.email,
        canBypassTier: tierBypass,
        canBypassRole: roleBypass
      };
      setPlatformUser(platformUserData);

      // Fetch tenant-specific role if needed and not bypassing
      if (tenantId && !roleBypass) {
        try {
          const userTenantResponse = await api.get(`api/users/${user.id}/tenants/${tenantId}`);
          if (userTenantResponse.ok) {
            const userTenantData = await userTenantResponse.json();
            setTenantRole(userTenantData.role as UserTenantRole);
          } else if (user.role === 'PLATFORM_VIEWER') {
            // Platform viewers act as VIEWER role on any tenant
            setTenantRole('VIEWER');
          } else {
            // No role on this tenant
            setTenantRole(null);
          }
        } catch (err) {
          console.warn('[useUserRole] Failed to fetch user tenant role:', err);
          if (user.role === 'PLATFORM_VIEWER') {
            // Fallback: Platform viewers act as VIEWER role
            setTenantRole('VIEWER');
          }
        }
      } else if (roleBypass) {
        // Platform admins/support bypass tenant roles
        setTenantRole('OWNER'); // Effective owner-level access
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user role data';
      setError(errorMessage);
      console.error('[useUserRole] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when tenantId changes
  useEffect(() => {
    fetchUserRole();
  }, [tenantId]);

  return {
    tenantRole,
    platformRole,
    platformUser,
    canBypassTier,
    canBypassRole,
    loading,
    error
  };
}
