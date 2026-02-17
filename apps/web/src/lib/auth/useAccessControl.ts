/**
 * React Hook for Access Control
 * 
 * Provides easy-to-use hooks for checking user permissions in React components
 * 
 * OPTIMIZED: Uses AuthContext user data instead of fetching /auth/me independently
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { tenantInfoService } from '@/services/TenantInfoSingletonService';
import {
  UserData,
  TenantData,
  OrganizationData,
  AccessControlContext,
  AccessControlOptions,
  checkAccess,
  isPlatformAdmin,
  isPlatformSupport,
  isPlatformViewer,
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
  isPlatformSupport: boolean;
  isPlatformViewer: boolean;
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
  // Use AuthContext instead of fetching /auth/me independently
  const { user: authUser, isLoading: authLoading } = useAuth();
  
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert AuthContext user to UserData format
  const user = useMemo((): UserData | null => {
    if (!authUser) return null;
    return authUser as unknown as UserData;
  }, [authUser]);

  const fetchTenantData = useCallback(async () => {
    if (!tenantId || !user) return;
    
    try {
      setTenantLoading(true);
      setError(null);

      // Fetch tenant data if tenantId provided
      const tenant = await tenantInfoService.getTenantInfo(tenantId);
      if (tenant) {
        setTenantData(tenant);

        // Fetch organization data if needed
        if (fetchOrganization) {
          const organizationId = tenant.metadata?.organizationId;
          if (organizationId) {
            const org = await tenantInfoService.getOrganization(organizationId);
            setOrganizationData(org);
          } else {
            // Try to find organization by searching organizations that contain this tenant
            try {
              const organizations = await tenantInfoService.getOrganizations();
              
              // Ensure organizations is an array before calling find
              if (!Array.isArray(organizations)) {
                console.warn('[useAccessControl] Organizations is not an array:', organizations);
                throw new Error('Invalid organizations data format');
              }
              
              // Find the organization that contains this tenant
              const matchingOrg = organizations.find((org: any) =>
                org.tenants?.some((t: any) => t.id === tenantId)
              );

              if (matchingOrg) {
                // Now fetch the full organization data
                const org = await tenantInfoService.getOrganization(matchingOrg.id);
                setOrganizationData(org);
              } else {
                setOrganizationData(null);
              }
            } catch (orgError) {
              console.warn('Failed to fetch organizations:', orgError);
              setOrganizationData(null);
            }
          }
        }
      } else {
        setTenantData(null);
        setOrganizationData(null);
      }
    } catch (error) {
      console.error('Failed to fetch tenant data:', error);
      setError('Failed to load tenant data');
      setTenantData(null);
      setOrganizationData(null);
    } finally {
      setTenantLoading(false);
    }
  }, [tenantId, user, fetchOrganization]);

  useEffect(() => {
    if (user && tenantId) {
      fetchTenantData();
    }
  }, [user, tenantId, fetchTenantData]);

  // Combined loading state
  const loading = authLoading || tenantLoading;

  if (!user) {
    return {
      user: null,
      tenantData: null,
      organizationData: null,
      loading,
      error,
      hasAccess: false,
      isPlatformAdmin: false,
      isPlatformSupport: false,
      isPlatformViewer: false,
      isTenantAdmin: false,
      isOrgAdmin: false,
      isOrgMember: false,
      tenantRole: null,
      refetch: fetchTenantData,
    };
  }

  const context: AccessControlContext = {
    tenantId,
    tenantData,
    organizationData,
  };

  const accessCheck = checkAccess(user, context, options);
  const platformAdmin = isPlatformAdmin(user);
  const platformSupport = isPlatformSupport(user);
  const platformViewer = isPlatformViewer(user);
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
    isPlatformSupport: platformSupport,
    isPlatformViewer: platformViewer,
    isTenantAdmin: tenantAdmin,
    isOrgAdmin: orgAdmin,
    isOrgMember: orgMember,
    tenantRole: role,
    refetch: fetchTenantData,
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
