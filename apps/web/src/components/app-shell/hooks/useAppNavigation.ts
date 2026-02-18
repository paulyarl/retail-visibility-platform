import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '@/lib/featureFlags';

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
  isAuthenticated?: boolean;
}

/**
 * Hook to compute navigation links based on feature flags and tenant context
 * Handles tenant-scoped URLs when FF_TENANT_URLS is enabled
 * Accepts auth state as prop to avoid context dependency
 */
export function useAppNavigation({ tenantId, isAuthenticated = false }: UseAppNavigationProps): UseAppNavigationResult {
  const [links, setLinks] = useState<AppLinks>({
    dashboard: `/`,
    tenants: `/tenants`, 
    shops: `/shops`, 
    directory: `/shops/directory`, 
    analytics: `/`,
    settings: `/settings`,
  });
  const [tenantScopedLinksOn, setTenantScopedLinksOn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Compute tenant-scoped links when FF_TENANT_URLS is enabled
    const tenantUrlsOverride = localStorage.getItem('ff_tenant_urls') === 'on';
    const tenantUrlsOn = tenantUrlsOverride || isFeatureEnabled('FF_TENANT_URLS', tenantId || undefined);
    
    if (tenantUrlsOn && tenantId && isAuthenticated) {
      setLinks({
        dashboard: `/t/${tenantId}/dashboard`,
        tenants: `/tenants`,  
        shops: `/shops/${tenantId}`,  
        directory: `/shops/directory`,  
        analytics: `/`,
        settings: `/t/${tenantId}/settings`,
      });
      setTenantScopedLinksOn(true);
    } else {
      setLinks({
        dashboard: `/`,
        tenants: `/`,
        shops: `/shops`, 
        directory: `/shops/directory`, 
        analytics: `/`,
        settings: `/settings`,
      });
      setTenantScopedLinksOn(false);
    }

    setHydrated(true);
  }, [tenantId, isAuthenticated]);

  return { links, tenantScopedLinksOn, hydrated };
}
