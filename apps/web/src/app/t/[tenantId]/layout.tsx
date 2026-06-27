import { redirect, notFound } from 'next/navigation';
import SetTenantId from "@/components/client/SetTenantId";
import DynamicTenantSidebar from "@/components/navigation/DynamicTenantSidebar";
import CrmAlertToastWatcher from '@/components/crm/CrmAlertToastWatcher';
import TenantContextProvider from '@/components/tenant/TenantContextProvider';
import ServerResolvedContextProvider from '@/components/tenant/ServerResolvedContextProvider';
import { getTenantContext } from '@/lib/tenantContext';
import RememberTenantRoute from '@/components/client/RememberTenantRoute';
import { SocialPixels } from '@/components/tracking/SocialPixels';
import { tenantInfoService } from '@/services/TenantInfoService';
import { auth0 } from '@/lib/auth0';
import type { ServerResolvedAuth, ServerResolvedTenant } from '@/components/tenant/ServerResolvedContextProvider';

export default async function TenantPageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenantId: string }> }) {
  // Get Auth0 session for authentication (wrapped in try/catch for robustness)
  let session = null;
  try {
    session = await auth0.getSession();
  } catch {
    // Session read failed (expired/malformed cookies) — treat as unauthenticated
    session = null;
  }
  const isAuthenticated = !!session?.user;

  const resolvedParams = await params;

  const tenantId = resolvedParams?.tenantId;

  // Redirect to login if not authenticated.
  // Use 'returnTo' (not 'next') because Auth0 SDK callback reads ctx.returnTo.
  // After successful login the user is returned to the tenant dashboard.
  if (!isAuthenticated) {
    const returnPath = `/t/${tenantId}/dashboard`;
    // Redirect to login
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnPath)}`);
  }

  if (!tenantId) {
    notFound();
  }

  // Resolve tenant context and tenant info in parallel to minimize server render time
  const auth0Email = session?.user?.email;
  const auth0Id = session?.user?.sub;

  const [tenantCtx, tenantInfo] = await Promise.all([
    getTenantContext(),
    tenantInfoService.getTenantInfo(tenantId, { auth0Email, auth0Id }),
  ]);

  const tenantSlug = tenantInfo?.slug;
  const hasPublishedDirectory = tenantInfo?.hasPublishedDirectory ?? tenantInfo?.has_published_directory;

  // Build server-resolved auth state for client consumption (single source of truth)
  const serverAuth: ServerResolvedAuth = {
    isAuthenticated: true,
    user: session?.user ? {
      id: session.user.sub,
      email: session.user.email || '',
      emailVerified: session.user.email_verified,
      name: session.user.name,
      picture: session.user.picture,
      auth0Id: session.user.sub,
      firstName: session.user.given_name,
      lastName: session.user.family_name,
    } : null,
  };

  // Build server-resolved tenant state
  const serverTenant: ServerResolvedTenant = {
    tenantId: tenantId ?? tenantCtx.tenantId ?? '',
    tenantSlug: tenantSlug ?? tenantCtx.tenantSlug ?? null,
    hasPublishedDirectory: !!hasPublishedDirectory,
    aud: tenantCtx.aud ?? null,
    tenantInfo: tenantInfo ?? null,
  };

  return (
    <>
      {/* Persist last visited tenant route for restore-after-login UX */}
      <RememberTenantRoute tenantId={tenantId} />
      <ServerResolvedContextProvider auth={serverAuth} tenant={serverTenant}>
        <TenantContextProvider value={{ tenantId: tenantId ?? tenantCtx.tenantId, tenantSlug: tenantSlug ?? tenantCtx.tenantSlug, aud: tenantCtx.aud, hasPublishedDirectory: hasPublishedDirectory }}>
          <CrmAlertToastWatcher tenantId={tenantId} />
          <SocialPixels tenantId={tenantId} />
          <DynamicTenantSidebar tenantId={tenantId} slug={tenantSlug} hasPublishedDirectory={hasPublishedDirectory}>
            {children}
          </DynamicTenantSidebar>
        </TenantContextProvider>
      </ServerResolvedContextProvider>
    </>
  );
}
