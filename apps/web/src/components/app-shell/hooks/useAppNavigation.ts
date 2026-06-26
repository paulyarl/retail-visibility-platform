import { useState, useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { tenantInfoService } from '@/services/TenantInfoService';
import { ROLE_GROUPS } from '@/config/rbac';
interface AppLinks {
  dashboard: string;
  tenants: string;
  barcode: string;
  directory: string;
  analytics?: string;
  settings: string;
}

interface UseAppNavigationResult {
  links: AppLinks;
  tenantScopedLinksOn: boolean;
  hydrated: boolean;
}

interface UseAppNavigationProps {
  tenantId: string | null;
  // isAuthenticated?: boolean;
}

/**
 * Hook to compute navigation links based on feature flags and tenant context
 * Handles tenant-scoped URLs when FF_TENANT_URLS is enabled
 * Accepts auth state as prop to avoid context dependency
 */

export function useAppNavigation({ tenantId }: UseAppNavigationProps): UseAppNavigationResult {
  const [links, setLinks] = useState<AppLinks>({
    dashboard: `/dashboard`,
    tenants: `/tenants`, 
    barcode: '/settings/scan',
    directory: `/directory`,  
    // analytics: `/`,
    settings: `/settings`,
  });
  const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();
  const [tenantScopedLinksOn, setTenantScopedLinksOn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fetchNavigationData = async () => {
      // Compute tenant-scoped links when FF_TENANT_URLS is enabled
      const tenantUrlsOverride = localStorage.getItem('ff_tenant_urls') === 'on';
      const tenantUrlsOn = false;

      // Get auth info from cookies for API authentication headers
      // Note: Cookies might be URL-encoded, need to decode
      const auth0Email = document.cookie.match(/auth0_email=([^;]+)/)?.[1];
      const auth0Id = document.cookie.match(/auth0_id=([^;]+)/)?.[1];
      
      // Decode URL-encoded values
      const decodedEmail = auth0Email ? decodeURIComponent(auth0Email) : null;
      const decodedAuth0Id = auth0Id ? decodeURIComponent(auth0Id) : null;

      // Fetch tenant info using singleton service with auth headers
      let tenantInfo: any = null;
      let tenantSlug: string | null = null;
      let hasPublishedDirectory: boolean | null = null;
      
      // Only fetch tenant info if user is authenticated and we have auth cookies
      if (user && isAuthenticated && tenantId && (decodedEmail || decodedAuth0Id)) {
        // Platform users (admin, support, viewer) have access to all tenants
        const isPlatformUser = ROLE_GROUPS.IS_PLATFORM_ADMIN.includes(user.role as any) ||
                               ROLE_GROUPS.IS_PLATFORM_SUPPORT.includes(user.role as any) ||
                               user.role === 'PLATFORM_VIEWER';

        // Check if user has access to this tenant (or is a platform user)
        console.log(`User Role: ${user.role}`);
        const hasTenantAccess = isPlatformUser || user.tenants?.some(t => t.id === tenantId);
        console.log('Tenant access check:', {
          tenantId,
          userTenants: user.tenants?.map(t => ({ id: t.id, name: t.name })),
          hasAccess: hasTenantAccess,
          isPlatformUser
        });

        if (!hasTenantAccess) {
          console.warn('User does not have access to tenant:', tenantId);
        } else {
          try {
            tenantInfo = await tenantInfoService.getTenantInfo(tenantId, { auth0Email: decodedEmail || undefined, auth0Id: decodedAuth0Id || undefined });
            tenantSlug = tenantInfo?.slug;
            hasPublishedDirectory = tenantInfo?.hasPublishedDirectory ?? tenantInfo?.has_published_directory;
          } catch (error) {
            console.error('Failed to fetch tenant info:', error);
          }
        }
      }

      // user is authenticated and has a tenant ID
      if (user && isAuthenticated && tenantId) {
        setLinks({
          ...(hasPublishedDirectory ? {
            dashboard: `/t/${tenantId}/dashboard`,
            tenants: `/tenants`,
            barcode: `/settings/scan`,
            // analytics: `/`,
            directory: `/directory/${tenantSlug}`,
            settings: `/t/${tenantId}/settings`,
          } : {
            dashboard: `/t/${tenantId}/dashboard`,
            tenants: `/tenants`,
            barcode: `/settings/scan`,
            directory: `/directory`, 
            // analytics: `/`,
            settings: `/t/${tenantId}/settings`,
          })
        });
        setTenantScopedLinksOn(true);
        // user is not authenticated yet
      } else if (!isAuthenticated) {
        setLinks({
          dashboard: `/dashboard`,
          tenants: `/auth/login`,
          barcode: `/settings/scan`,
          directory: `/directory`,
          // analytics: `/`,
          settings: `/`,
        });
        setTenantScopedLinksOn(false);
        // user is authenticated but has no tenant ID
      } else {
        setLinks({
          dashboard: `/dashboard`,
          tenants: `/tenants`,
          barcode: `/settings/scan`,
          directory: `/directory`,
          // analytics: `/`,
          settings: `/settings`,
        });
        setTenantScopedLinksOn(false);
      }

      setHydrated(true);
    };

    fetchNavigationData();
  }, [tenantId, user, isAuthenticated]);

  return { links, tenantScopedLinksOn, hydrated };
}
