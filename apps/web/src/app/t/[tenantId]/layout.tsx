import { redirect, notFound } from 'next/navigation';
import SetTenantId from "@/components/client/SetTenantId";
import DynamicTenantSidebar from "@/components/navigation/DynamicTenantSidebar";
import TenantContextProvider from '@/components/tenant/TenantContextProvider';
import { getTenantContext } from '@/lib/tenantContext';
import RememberTenantRoute from '@/components/client/RememberTenantRoute';
import { tenantInfoService } from '@/services/TenantInfoService';
import { auth0 } from '@/lib/auth0';

export default async function TenantPageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenantId: string }> | { tenantId: string } }) {
  // Get Auth0 session for authentication (wrapped in try/catch for robustness)
  let session = null;
  try {
    session = await auth0.getSession();
  } catch {
    // Session read failed (expired/malformed cookies) — treat as unauthenticated
    session = null;
  }
  const isAuthenticated = !!session?.user;

  const resolvedParams = (params && typeof params === 'object' && 'then' in (params as any))
    ? await (params as Promise<{ tenantId: string }>)
    : (params as { tenantId: string });

  const tenantId = resolvedParams?.tenantId;

  // Redirect to login if not authenticated.
  // Use 'returnTo' (not 'next') because Auth0 SDK callback reads ctx.returnTo.
  // After successful login the user is returned to the tenant dashboard.
  if (!isAuthenticated) {
    const returnPath = `/t/${tenantId}/dashboard`;
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnPath)}`);
  }

  if (!tenantId) {
    notFound();
  }

  // Resolve server tenant context (from tcx cookie or headers)
  const tenantCtx = await getTenantContext();
  // console.log(`[TenantPageLayout] tenantCtx:`, tenantCtx);

  // Get Auth0 user info for SSR authentication headers
  const auth0Email = session?.user?.email;
  const auth0Id = session?.user?.sub;
  // console.log(`[TenantPageLayout] auth0Email:`, auth0Email);
  // console.log(`[TenantPageLayout] auth0Id:`, auth0Id);

  // Fetch tenant info using singleton service with SSR auth headers
  const tenantInfo = await tenantInfoService.getTenantInfo(tenantId, { auth0Email, auth0Id });
  // console.log(`[TenantPageLayout] tenantInfo:`, tenantInfo);
  const tenantSlug = tenantInfo?.slug;
  // console.log(`[TenantPageLayout] tenantSlug:`, tenantSlug);
  const hasPublishedDirectory = tenantInfo?.hasPublishedDirectory ?? tenantInfo?.has_published_directory;
  // console.log(`[TenantPageLayout] hasPublishedDirectory:`, hasPublishedDirectory);

  // console.log(`[TenantPageLayout] Tenant info:`, {
  //   tenantId,
  //   tenantSlug,
  //   hasPublishedDirectory,
  //   isAuthenticated
  // });

  return (
    <>
      {/* Persist last visited tenant route for restore-after-login UX */}
      <RememberTenantRoute tenantId={tenantId} />
      <TenantContextProvider value={{ tenantId: tenantId ?? tenantCtx.tenantId, tenantSlug: tenantSlug ?? tenantCtx.tenantSlug, aud: tenantCtx.aud, hasPublishedDirectory: hasPublishedDirectory }}>
        <DynamicTenantSidebar tenantId={tenantId} slug={tenantSlug} hasPublishedDirectory={hasPublishedDirectory}>
          {children}
        </DynamicTenantSidebar>
      </TenantContextProvider>
    </>
  );
}
