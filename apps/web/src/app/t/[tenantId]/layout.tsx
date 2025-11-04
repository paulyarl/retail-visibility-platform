import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import RememberTenantRoute from '@/components/client/RememberTenantRoute';
import TenantShell from '@/components/tenant/TenantShell';
import { getTenantContext } from '@/lib/tenantContext';
import TenantContextProvider from '@/components/tenant/TenantContextProvider';
import { isFeatureEnabled } from '@/lib/featureFlags';

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenantId: string }> | { tenantId: string } }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const resolvedParams = (params && typeof params === 'object' && 'then' in (params as any)) 
    ? await (params as Promise<{ tenantId: string }>) 
    : (params as { tenantId: string });
  const tenantId = resolvedParams?.tenantId;
  if (!token) {
    redirect(`/login?next=/t/${tenantId}`);
  }
  if (!tenantId) {
    notFound();
  }

  // Resolve server tenant context (from tcx cookie or headers)
  const tenantCtx = await getTenantContext();

  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  let tenantList: Array<{ id: string; name: string }> = [];
  try {
    const res = await fetch(`${apiBaseUrl}/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      redirect('/tenants');
    }
    const list: Array<{ id: string; name: string }> = await res.json();
    tenantList = Array.isArray(list) ? list : [];
    const isMember = Array.isArray(tenantList) && tenantList.some(t => t.id === tenantId);
    if (!isMember) {
      // Membership guard
      redirect('/tenants');
    }
  } catch {
    redirect('/tenants');
  }

  // Resolve current tenant friendly name
  const current = tenantList.find(t => t.id === tenantId);
  const tenantName = current?.name || tenantId;

  // Feature flags (server-side) for gating nav items/variants
  const ffTenantUrls = isFeatureEnabled('FF_TENANT_URLS', tenantId);
  const ffAppShellNav = isFeatureEnabled('FF_APP_SHELL_NAV', tenantId);
  const ffCategoryMgmt = isFeatureEnabled('FF_CATEGORY_MANAGEMENT_PAGE' as any, tenantId as any);

  const nav = [
    { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
    { label: 'Items', href: `/t/${tenantId}/items` },
    { label: 'Scan Products', href: `/t/${tenantId}/scan` },
    ...(ffCategoryMgmt ? [{ label: 'Categories', href: `/t/${tenantId}/categories` }] as const : []),
    { label: 'Quick Start', href: `/t/${tenantId}/quick-start` },
    { label: 'Insights', href: `/t/${tenantId}/insights` },
    { label: 'Storefront', href: `/tenant/${tenantId}` },
    { label: 'Settings', href: `/t/${tenantId}/settings` },
    // Advanced/Diagnostic tools - consider moving to Settings submenu in future
    { label: 'Feed Validation', href: `/t/${tenantId}/feed-validation` },
    { label: 'Profile Completeness', href: `/t/${tenantId}/profile-completeness` },
    { label: 'Onboarding', href: `/t/${tenantId}/onboarding` },
  ];

  return (
    <>
      {/* Persist last visited tenant route for restore-after-login UX */}
      <RememberTenantRoute tenantId={tenantId} />
      <TenantContextProvider value={{ tenantId: tenantCtx.tenantId ?? tenantId, tenantSlug: tenantCtx.tenantSlug, aud: tenantCtx.aud }}>
        <TenantShell 
          tenantId={tenantId} 
          tenantName={tenantName} 
          nav={nav} 
          tenants={tenantList}
          // Pass a hint for shell variant; component may ignore if it doesn't support it yet
          // @ts-ignore optional prop for future variant gating
          appShellVariant={ffAppShellNav ? 'v2' : 'default'}
        >
          {children}
        </TenantShell>
      </TenantContextProvider>
    </>
  );
}
