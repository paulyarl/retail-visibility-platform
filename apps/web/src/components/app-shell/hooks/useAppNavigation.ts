import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '@/lib/featureFlags';

interface AppLinks {
  dashboard: string;
  inventory: string;
  tenants: string;
  settings: string;
}

interface UseAppNavigationResult {
  links: AppLinks;
  tenantScopedLinksOn: boolean;
  hydrated: boolean;
}

/**
 * Hook to compute navigation links based on feature flags and tenant context
 * Handles tenant-scoped URLs when FF_TENANT_URLS is enabled
 */
export function useAppNavigation(tenantId: string | null): UseAppNavigationResult {
  const [links, setLinks] = useState<AppLinks>({
    dashboard: '/',
    inventory: '/items',
    tenants: '/tenants',
    settings: '/settings',
  });
  const [tenantScopedLinksOn, setTenantScopedLinksOn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Compute tenant-scoped links when FF_TENANT_URLS is enabled
    const tenantUrlsOverride = localStorage.getItem('ff_tenant_urls') === 'on';
    const tenantUrlsOn = tenantUrlsOverride || isFeatureEnabled('FF_TENANT_URLS', tenantId || undefined);

    if (tenantUrlsOn && tenantId) {
      setLinks({
        dashboard: `/t/${tenantId}/dashboard`,
        inventory: `/t/${tenantId}/items`,
        tenants: '/tenants',
        settings: `/t/${tenantId}/settings`,
      });
      setTenantScopedLinksOn(true);
    } else {
      setLinks({
        dashboard: '/',
        inventory: '/items',
        tenants: '/tenants',
        settings: '/settings',
      });
      setTenantScopedLinksOn(false);
    }

    setHydrated(true);
  }, [tenantId]);

  return { links, tenantScopedLinksOn, hydrated };
}
