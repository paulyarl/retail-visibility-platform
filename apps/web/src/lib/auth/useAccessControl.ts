/**
 * React Hook for Access Control
 * 
 * Provides easy-to-use hooks for checking user permissions in React components
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  UserData,
  TenantData,
  OrganizationData,
  AccessControlContext,
  AccessControlOptions,
  checkAccess,
  isPlatformAdmin,
  isTenantOwnerOrAdmin,
  getTenantRole,
  isOrganizationAdmin,
  isOrganizationMember,
  AccessPresets,
} from './access-control';

// Re-export for convenience
export { AccessPresets } from './access-control';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface UseAccessControlResult {
  user: UserData | null;
  tenantData: TenantData | null;
  organizationData: OrganizationData | null;
  loading: boolean;
  error: string | null;
  hasAccess: boolean;
  accessReason?: string;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  isOrgAdmin: boolean;
  isOrgMember: boolean;
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
  options: AccessControlOptions = {},
  fetchOrganization: boolean = false
): UseAccessControlResult {
  const [user, setUser] = useState<UserData | null>(null);
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user data
      const userRes = await api.get(`${API_BASE_URL}/user/me`);
      if (!userRes.ok) throw new Error('Failed to fetch user data');
      const userData = await userRes.json();
      setUser(userData);

      // Fetch tenant data if tenantId provided
      if (tenantId) {
        const tenantRes = await api.get(`${API_BASE_URL}/tenants/${tenantId}`);
        if (tenantRes.ok) {
          const tenant = await tenantRes.json();
          setTenantData(tenant);

          // Fetch organization data if needed
          if (fetchOrganization && tenant.organizationId) {
            const orgRes = await api.get(`${API_BASE_URL}/organizations/${tenant.organizationId}`);
            if (orgRes.ok) {
              const org = await orgRes.json();
              setOrganizationData(org);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setUser(null);
      setTenantData(null);
      setOrganizationData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, fetchOrganization]);

  if (!user) {
    return {
      user: null,
      tenantData: null,
      organizationData: null,
      loading,
      error,
      hasAccess: false,
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isOrgAdmin: false,
      isOrgMember: false,
      tenantRole: null,
      refetch: fetchData,
    };
  }

  const context: AccessControlContext = {
    tenantId,
    tenantData,
    organizationData,
  };

  const accessCheck = checkAccess(user, context, options);
  const platformAdmin = isPlatformAdmin(user);
  const tenantAdmin = tenantId ? isTenantOwnerOrAdmin(user, tenantId) : false;
  const orgAdmin = organizationData ? isOrganizationAdmin(user, organizationData) : false;
  const orgMember = organizationData ? isOrganizationMember(user, organizationData) : false;
  const role = tenantId ? getTenantRole(user, tenantId) : null;

  return {
    user,
    tenantData,
    organizationData,
    loading,
    error,
    hasAccess: accessCheck.hasAccess,
    accessReason: accessCheck.reason,
    isPlatformAdmin: platformAdmin,
    isTenantAdmin: tenantAdmin,
    isOrgAdmin: orgAdmin,
    isOrgMember: orgMember,
    tenantRole: role,
    refetch: fetchData,
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
