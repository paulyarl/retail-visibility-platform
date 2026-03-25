import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { useAuth } from "@/contexts/AuthContext";

interface AppLinks {
  dashboard: string;
  tenants: string;
  shops: string;
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
    shops: `/shops`, 
    directory: `/directory`, 
    // analytics: `/`,
    settings: `/settings`,
  });
  const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();
  const [tenantScopedLinksOn, setTenantScopedLinksOn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Compute tenant-scoped links when FF_TENANT_URLS is enabled
    const tenantUrlsOverride = localStorage.getItem('ff_tenant_urls') === 'on';
    // const tenantUrlsOn = tenantUrlsOverride || isFeatureEnabled('FF_TENANT_URLS', tenantId || undefined);
    const tenantUrlsOn = true;

    // console.log(`${useAppNavigation.name} user: ${JSON.stringify(user)}`);
    // console.log(`${useAppNavigation.name} isAuthenticated: ${isAuthenticated}`);
    // console.log(`${useAppNavigation.name} tenantId: ${tenantId}`);


    // if (tenantUrlsOn && tenantId && isAuthenticated) {
    if (user || isAuthenticated || tenantId) {
      setLinks({
        dashboard: `/t/${tenantId}/dashboard`,
        tenants: `/tenants`,  
        shops: `/shops/${tenantId}`,  
        directory: `/directory/${tenantId}`,  
        // analytics: `/`,
        settings: `/t/${tenantId}/settings`,
      });
      setTenantScopedLinksOn(true);
    } else if (!isAuthenticated) {
      setLinks({
        dashboard: `/dashboard`,
        tenants: `/auth/login`,
        shops: `/shops`, 
        directory: `/directory`, 
        // analytics: `/`,
        settings: `/`,
      });
      setTenantScopedLinksOn(false);
    } else {
      setLinks({
        dashboard: `/dashboard`,
        tenants: `/tenants`, 
        shops: `/shops`, 
        directory: `/directory`, 
        // analytics: `/`,
        settings: `/settings`,
      });
      setTenantScopedLinksOn(false);
    }

    setHydrated(true);
  }, [tenantId, isAuthenticated]);

  return { links, tenantScopedLinksOn, hydrated };
}
