/**
 * React Hook for Access Control
 * 
 * Provides easy-to-use hooks for checking user permissions in React components
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  UserData,
  AccessControlOptions,
  checkAccess,
  isPlatformAdmin,
  isTenantOwnerOrAdmin,
  getTenantRole,
} from './access-control';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface UseAccessControlResult {
  user: UserData | null;
  loading: boolean;
  error: string | null;
  hasAccess: boolean;
  accessReason?: string;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  tenantRole: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check user access based on options
 * 
 * @example
 * const { hasAccess, loading, isPlatformAdmin } = useAccessControl(tenantId, AccessPresets.TENANT_ADMIN);
 */
export function useAccessControl(
  tenantId: string | null,
  options: AccessControlOptions = {}
): UseAccessControlResult {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(`${API_BASE_URL}/user/me`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData = await res.json();
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [tenantId]);

  if (!user) {
    return {
      user: null,
      loading,
      error,
      hasAccess: false,
      isPlatformAdmin: false,
      isTenantAdmin: false,
      tenantRole: null,
      refetch: fetchUser,
    };
  }

  const accessCheck = checkAccess(user, tenantId, options);
  const platformAdmin = isPlatformAdmin(user);
  const tenantAdmin = tenantId ? isTenantOwnerOrAdmin(user, tenantId) : false;
  const role = tenantId ? getTenantRole(user, tenantId) : null;

  return {
    user,
    loading,
    error,
    hasAccess: accessCheck.hasAccess,
    accessReason: accessCheck.reason,
    isPlatformAdmin: platformAdmin,
    isTenantAdmin: tenantAdmin,
    tenantRole: role,
    refetch: fetchUser,
  };
}

/**
 * Simple hook to check if user is platform admin
 */
export function useIsPlatformAdmin(): {
  isPlatformAdmin: boolean;
  loading: boolean;
  error: string | null;
} {
  const { isPlatformAdmin: isAdmin, loading, error } = useAccessControl(null, {});
  
  return {
    isPlatformAdmin: isAdmin,
    loading,
    error,
  };
}

/**
 * Simple hook to check if user is tenant admin
 */
export function useIsTenantAdmin(tenantId: string): {
  isTenantAdmin: boolean;
  tenantRole: string | null;
  loading: boolean;
  error: string | null;
} {
  const { isTenantAdmin, tenantRole, loading, error } = useAccessControl(tenantId, {});
  
  return {
    isTenantAdmin,
    tenantRole,
    loading,
    error,
  };
}
