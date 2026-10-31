import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from './lib/auth0';
import AuthSyncService from './services/AuthSyncService';
import { fetchTenantDirectorySlug } from './lib/directory-helpers';
import { clientLogger } from '@/lib/client-logger';
import { isPlatformSubdomain, isPortalSubdomainHost, isStorefrontPath, isCandidateCustomHost, managePathSuffix, platformOrigin, surfaceClassForPath, STOREFRONT_PREFIX_ROOTS, tenantHostCanonicalPath, canonicalSurfaceUrl, type StorefrontCanonical } from '@/lib/storefront-routing';

// Environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || process.env.API_URL || 'http://localhost:4000';
const FF_TENANT_URLS = process.env.NEXT_PUBLIC_FF_TENANT_URLS === 'true';
// Custom domains (level 3, D10): off → the custom-host branch is skipped
// entirely and behavior is identical to pre-sprint.
const FF_CUSTOM_DOMAINS = process.env.NEXT_PUBLIC_FF_CUSTOM_DOMAINS === 'true';
// D13: the /manage redirect target must come from config — never the request
// host (tenant-controlled DNS), never a literal baked into the redirect line.
const PLATFORM_APP_ORIGIN = platformOrigin();

// Resolve-cache (1.4): positive AND definitive-miss entries cached briefly so
// the resolve endpoint isn't hit per request; transient 429/5xx is never
// cached — the next request retries live. Per-isolate, ephemeral — fine.
const customHostCache = new Map<string, { value: { tenantId: string; domain: string; active: boolean; status: string } | null; expires: number }>();
const CUSTOM_HOST_CACHE_TTL_MS = 60_000;

interface CustomHostResolution {
  tenantId: string;
  domain: string;
  active: boolean;
  status: string;
}

async function resolveCustomHost(req: NextRequest, hostname: string): Promise<CustomHostResolution | null> {
  const key = hostname.toLowerCase();
  const hit = customHostCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  // ?v=2 — extended contract: known-but-inactive rows resolve too so the
  // proxy can bounce them to the canonical surface instead of 404ing.
  const resp = await fetch(`${API_BASE_URL}/api/tenants/resolve-custom-domain/${encodeURIComponent(key)}?v=2`, {
    headers: { 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' },
  });
  if (resp.ok) {
    const data = await resp.json();
    const value: CustomHostResolution | null = data?.success && data.tenantId
      ? {
          tenantId: data.tenantId as string,
          domain: data.domain as string,
          active: data.active === true,
          status: String(data.status ?? ''),
        }
      : null;
    customHostCache.set(key, { value, expires: Date.now() + CUSTOM_HOST_CACHE_TTL_MS });
    return value;
  }
  if (resp.status === 404) {
    customHostCache.set(key, { value: null, expires: Date.now() + CUSTOM_HOST_CACHE_TTL_MS });
  }
  return null; // 429/5xx — definitive miss handling but NOT cached
}

// Canonical lookup for the inactive-host bounce — separate cache keyed by
// tenant, same TTL. A miss (404/5xx) is not cached: the redirect depends on
// it, so the next request retries live.
const tenantCanonicalCache = new Map<string, { value: StorefrontCanonical | null; expires: number }>();

async function resolveTenantCanonical(req: NextRequest, tenantId: string): Promise<StorefrontCanonical | null> {
  const hit = tenantCanonicalCache.get(tenantId);
  if (hit && hit.expires > Date.now()) return hit.value;

  const resp = await fetch(`${API_BASE_URL}/api/tenants/storefront-canonical/${encodeURIComponent(tenantId)}`, {
    headers: { 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data?.success || (data.kind !== 'custom' && data.kind !== 'subdomain' && data.kind !== 'path')) {
    return null;
  }
  const value: StorefrontCanonical = { kind: data.kind, host: data.host ?? null, tenantId: data.tenantId ?? tenantId };
  tenantCanonicalCache.set(tenantId, { value, expires: Date.now() + CUSTOM_HOST_CACHE_TTL_MS });
  return value;
}

function getCookie(req: NextRequest, name: string): string | undefined {
  try {
    return req.cookies.get(name)?.value;
  } catch {
    return undefined;
  }
}

function setCookie(res: NextResponse, name: string, value: string, maxAgeSec = 60 * 60 * 24 * 7) {
  res.cookies.set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: maxAgeSec,
  });
}

/**
 * Check if user is platform admin by checking database role
 */
async function isPlatformAdmin(req: NextRequest): Promise<boolean> {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();
    
    if (!session?.user?.email) {
      return false;
    }

    // Check database for user role via service
    const authSyncService = AuthSyncService.getInstance();
    const user = await authSyncService.getUserByIdentifier(session.user.email);

    if (!user || !user.is_active) {
      return false;
    }

    // Check if user has PLATFORM_ADMIN role
    const isAdmin = user.role === 'PLATFORM_ADMIN' || user.role === 'SUPER_ADMIN';
     
    console.log('[Proxy] User role check:', user.email, 'role:', user.role, 'isAdmin:', isAdmin);
    
    return isAdmin;
  } catch (error) {
    clientLogger.error('[Proxy] Error checking platform admin:', { detail: error });
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = new URL(req.url);
  
  // Log auth route attempts with cookies
  if (pathname.startsWith('/auth/')) {
    const hasSession = req.cookies.has('__session');
    console.log('[Proxy] Auth route detected:', pathname, 'Has session cookie:', hasSession);
  }

  // First, let Auth0 handle authentication routes. The SDK middleware always returns a
  // NextResponse: a redirect/response for /auth/* routes and NextResponse.next() for all
  // other routes. Only short-circuit for actual auth routes; otherwise continue with the
  // custom proxy logic below.
  const authResponse = await auth0.middleware(req);

  if (pathname.startsWith('/auth/')) {
    const location = authResponse.headers.get('location');
    console.log('[Proxy] Auth0 handled auth route:', pathname, 'Status:', authResponse.status, 'Location:', location);
    return authResponse;
  }

  // Continue with existing proxy logic for non-auth routes
  const { hostname, searchParams } = new URL(req.url);

  // Portal host (mystore.{apex}) — the shared merchant workspace surface
  // (NRS mystore.nrsplus.com parity). A platform host, not a tenant host:
  // workspace/auth paths render here, '/' is the workspace entry, and
  // everything else canonicalizes to the apex (marketing, directory, and
  // storefronts never render under the portal host). Runs before the
  // tenant-subdomain and custom-domain branches — portal names are carved
  // out of both candidate checks in storefront-routing.
  if (isPortalSubdomainHost(hostname)) {
    if (pathname === '/') {
      const dest = new URL('/tenants', req.url);
      console.log(`[Proxy] Portal home: ${hostname}/ → ${dest.toString()}`);
      return NextResponse.redirect(dest, { status: 302 });
    }
    if (pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')) {
      return NextResponse.next();
    }
    if (surfaceClassForPath(pathname) === 'tenant-scope') {
      return NextResponse.next();
    }
    const dest = new URL(`${pathname}${req.nextUrl.search}`, platformOrigin());
    console.log(`[Proxy] Portal canonicalize to apex: ${hostname}${pathname} → ${dest.toString()}`);
    return NextResponse.redirect(dest, { status: 301 });
  }

  // Handle subdomain storefront routing
  const subdomainInfo = isPlatformSubdomain(hostname);
  if (subdomainInfo) {
    const { subdomain, domain } = subdomainInfo;

    // Skip subdomain routing for API routes and assets
    if (pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')) {
      return NextResponse.next();
    }

    // D13 branded workspace entry: /manage[/rest] → platform /t/{id}[/rest].
    // Same rule as custom hosts — computed before the storefront-path gate
    // so the portal door isn't refused as a non-storefront path.
    const manageSuffix = managePathSuffix(pathname);

    // Non-storefront paths never serve on a tenant host — this branch returns
    // before the /admin and /settings auth gates, so anything off the
    // storefront allowlist is refused rather than rendered unauthenticated.
    if (!isStorefrontPath(pathname) && manageSuffix === null) {
      return NextResponse.rewrite(new URL('/404', req.url));
    }

    try {
      // Look up tenant by subdomain using resolve endpoint.
      // Forward the client IP — the API rate-limits resolves per client, and
      // without this every lookup shares the edge egress IP and self-throttles.
      const tenantResponse = await fetch(`${API_BASE_URL}/api/tenants/resolve-subdomain/${subdomain}`, {
        headers: { 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' },
      });

      if (tenantResponse.ok) {
        const subdomainData = await tenantResponse.json();
        if (subdomainData.success && subdomainData.tenantId) {
          // Subdomain exists, rewrite to the public storefront at /tenant/{id}.
          // Rewrite (never redirect) so the subdomain stays canonical in the URL.
          const tenantId = subdomainData.tenantId;

          // D13 branded workspace entry on subdomains: {slug}.{apex}/manage
          // is the merchant portal door — absolute platform origin so the
          // workspace never renders under the tenant host, and the redirect
          // can't become open. Mirrors the custom-host block below.
          if (manageSuffix !== null) {
            const dest = new URL(`${PLATFORM_APP_ORIGIN}/t/${tenantId}${manageSuffix}${req.nextUrl.search}`);
            console.log(`[Proxy] Subdomain /manage: ${hostname}${pathname} → ${dest.toString()}`);
            return NextResponse.redirect(dest, { status: 302 });
          }

          // Paths already under /tenant/ are canonicalized, not passed through:
          // on a tenant host "/" IS the storefront — /tenant/{id} is the
          // platform's internal path leaking into the tenant's URL space, and
          // /tenant/{otherId} would serve a DIFFERENT tenant's storefront
          // under this host. Self → 301 to the host-relative canonical;
          // foreign → 301 to the platform origin.
          let destPath: string;
          if (pathname === '/tenant' || pathname.startsWith('/tenant/')) {
            const canon = tenantHostCanonicalPath(pathname, tenantId);
            if (canon?.kind === 'foreign') {
              const dest = new URL(`${pathname}${req.nextUrl.search}`, PLATFORM_APP_ORIGIN);
              console.log(`[Proxy] Subdomain foreign-tenant bounce: ${hostname}${pathname} → ${dest.toString()}`);
              return NextResponse.redirect(dest, { status: 301 });
            }
            if (canon?.kind === 'self') {
              const dest = new URL(`${canon.path}${req.nextUrl.search}`, req.url);
              console.log(`[Proxy] Subdomain canonicalize: ${hostname}${pathname} → ${dest.toString()}`);
              return NextResponse.redirect(dest, { status: 301 });
            }
            destPath = pathname;
          } else if (pathname === '/' || STOREFRONT_PREFIX_ROOTS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
            destPath = `/tenant/${tenantId}${pathname === '/' ? '' : pathname}`;
          } else {
            destPath = pathname;
          }

          console.log(`[Proxy] Subdomain rewrite: ${hostname}${pathname} → ${destPath} (domain: ${domain})`);

          const url = req.nextUrl.clone();
          url.pathname = destPath;

          const res = NextResponse.rewrite(url);

          // Set tenant context cookie
          const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
          setCookie(res, 'tcx', tcx);

          return res;
        }
      }

      // Definitive non-tenant answer (404, 429, or no tenantId): fail closed —
      // never render the platform app on a tenant-named host. Only a fetch
      // exception falls through, preserving API-outage resilience.
      return NextResponse.rewrite(new URL('/404', req.url));
    } catch (error) {
      clientLogger.error('[Proxy] Error in subdomain routing:', { detail: error });
      // Continue with normal routing if subdomain lookup fails
    }
  }

  // Tenant-owned custom domains (level 3 — sprint plan 4.1–4.4). Any host
  // that isn't ours is a candidate: resolve it or fail closed. Order (F-M1):
  //   resolve → www→apex 301 → /manage redirect → allowlist → rewrite.
  if (FF_CUSTOM_DOMAINS && isCandidateCustomHost(hostname)) {
    if (pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')) {
      return NextResponse.next();
    }

    try {
      const resolved = await resolveCustomHost(req, hostname);

      // Known-but-inactive domain (pending/verified/error/disabled): the row
      // exists, so this IS a tenant host — just mid-lifecycle or suspended.
      // Don't 404 the storefront; bounce to the next-highest ACTIVE layer
      // (the resolved canonical is never this host — it isn't active). 302,
      // not 301: activation flips canonical back here and a permanent
      // redirect would have to be un-learned.
      if (resolved && !resolved.active) {
        const manageSuffix = managePathSuffix(pathname);
        if (manageSuffix !== null) {
          const dest = new URL(`${PLATFORM_APP_ORIGIN}/t/${resolved.tenantId}${manageSuffix}${req.nextUrl.search}`);
          console.log(`[Proxy] Custom-host inactive /manage: ${hostname}${pathname} → ${dest.toString()}`);
          return NextResponse.redirect(dest, { status: 302 });
        }
        if (!isStorefrontPath(pathname)) {
          return NextResponse.rewrite(new URL('/404', req.url));
        }
        const canon = await resolveTenantCanonical(req, resolved.tenantId);
        if (!canon) {
          // Canonical lookup failed (outage/404) — fail closed rather than
          // redirect blind or serve the platform app on a tenant-named host.
          return NextResponse.rewrite(new URL('/404', req.url));
        }
        const dest = canonicalSurfaceUrl(canon, resolved.tenantId, pathname, req.nextUrl.search);
        console.log(`[Proxy] Custom-host inactive bounce (${resolved.status}): ${hostname}${pathname} → ${dest}`);
        return NextResponse.redirect(dest, { status: 302 });
      }

      if (resolved) {
        // D9 host canonicalization first: the www companion 301s to the
        // stored (www-stripped) host. Path + query preserved — a /manage
        // request lands on the apex /manage and takes its own redirect.
        if (hostname.toLowerCase().startsWith('www.')) {
          const dest = new URL(`${pathname}${req.nextUrl.search}`, `https://${resolved.domain}`);
          console.log(`[Proxy] Custom-host www→apex: ${hostname}${pathname} → ${dest.toString()}`);
          return NextResponse.redirect(dest, { status: 301 });
        }

        // D13 branded workspace entry: /manage[/rest] → platform /t/{id}[/rest].
        // Absolute platform origin — the workspace is never served under the
        // tenant-controlled host, and the redirect can't become open.
        const manageSuffix = managePathSuffix(pathname);
        if (manageSuffix !== null) {
          const dest = new URL(`${PLATFORM_APP_ORIGIN}/t/${resolved.tenantId}${manageSuffix}${req.nextUrl.search}`);
          console.log(`[Proxy] Custom-host /manage: ${hostname}${pathname} → ${dest.toString()}`);
          return NextResponse.redirect(dest, { status: 302 });
        }

        // Same trust boundary as subdomains (B1): the custom-host branch
        // returns before the /admin and /settings auth gates, so anything
        // off the storefront allowlist is refused, never rendered.
        if (!isStorefrontPath(pathname)) {
          return NextResponse.rewrite(new URL('/404', req.url));
        }

        // Same canonicalization as the subdomain branch: /tenant/{resolvedId}
        // is a platform-internal path on the tenant's own domain — 301 to the
        // host-relative canonical. A foreign tenant's path 301s to the
        // platform origin instead of serving cross-tenant content here.
        let destPath: string;
        if (pathname === '/tenant' || pathname.startsWith('/tenant/')) {
          const canon = tenantHostCanonicalPath(pathname, resolved.tenantId);
          if (canon?.kind === 'foreign') {
            const dest = new URL(`${pathname}${req.nextUrl.search}`, PLATFORM_APP_ORIGIN);
            console.log(`[Proxy] Custom-host foreign-tenant bounce: ${hostname}${pathname} → ${dest.toString()}`);
            return NextResponse.redirect(dest, { status: 301 });
          }
          if (canon?.kind === 'self') {
            const dest = new URL(`${canon.path}${req.nextUrl.search}`, req.url);
            console.log(`[Proxy] Custom-host canonicalize: ${hostname}${pathname} → ${dest.toString()}`);
            return NextResponse.redirect(dest, { status: 301 });
          }
          destPath = pathname;
        } else if (pathname === '/' || STOREFRONT_PREFIX_ROOTS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
          destPath = `/tenant/${resolved.tenantId}${pathname === '/' ? '' : pathname}`;
        } else {
          destPath = pathname;
        }

        console.log(`[Proxy] Custom-host rewrite: ${hostname}${pathname} → ${destPath} (domain: ${resolved.domain})`);

        const url = req.nextUrl.clone();
        url.pathname = destPath;

        const res = NextResponse.rewrite(url);
        const tcx = JSON.stringify({ tenant_id: resolved.tenantId, aud: 'user' });
        setCookie(res, 'tcx', tcx);
        return res;
      }

      // Unknown custom host (no custom_domains row at all) → fail closed
      // (H8-style): never render the platform app on a host that might be a
      // tenant domain. Transient resolve failures land here too — a 404
      // beats serving the wrong app.
      return NextResponse.rewrite(new URL('/404', req.url));
    } catch (error) {
      clientLogger.error('[Proxy] Error in custom-domain routing:', { detail: error });
      // Fetch exception → fall through (API-outage resilience, matching the
      // subdomain branch's semantics).
    }
  }

  // Protect /admin/* and /settings/admin/* routes - require platform admin (Auth0 session + DB role check)
  if (pathname.startsWith('/admin') || pathname.startsWith('/settings/admin')) {
    const session = await auth0.getSession();

    if (!session?.user) {
      // No Auth0 session — send to login, preserving return path
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const isAdmin = await isPlatformAdmin(req);

    if (!isAdmin) {
      // Authenticated but lacks PLATFORM_ADMIN role
      const deniedUrl = new URL('/access-denied', req.url);
      deniedUrl.searchParams.set('path', pathname);
      deniedUrl.searchParams.set('timestamp', new Date().toISOString());
      return NextResponse.redirect(deniedUrl);
    }
  }

  if (!FF_TENANT_URLS) return NextResponse.next();

  // Best-effort tenant resolution from cookie or query
  const cookieTenant = getCookie(req, 'lastTenantId');
  const qpTenant = searchParams.get('tenantId') || searchParams.get('tenant_id') || undefined;
  const tenantId = (qpTenant || cookieTenant || '').trim();

  // Redirect legacy routes → canonical when we have a tenantId hint
  if (tenantId) {
    if (pathname === '/items' || pathname.startsWith('/items/')) {
      const dest = new URL(`/t/${tenantId}/items`, req.url);
      const res = NextResponse.redirect(dest, { status: 301 });
      // Issue tcx cookie (unsigned minimal payload)
      const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
      setCookie(res, 'tcx', tcx);
      return res;
    }
    if (pathname === '/settings/tenant') {
      const dest = new URL(`/t/${tenantId}/settings/tenant`, req.url);
      const res = NextResponse.redirect(dest, { status: 301 });
      const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
      setCookie(res, 'tcx', tcx);
      return res;
    }
    if (pathname === '/tenants/users') {
      const dest = new URL(`/t/${tenantId}/users`, req.url);
      const res = NextResponse.redirect(dest, { status: 301 });
      const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
      setCookie(res, 'tcx', tcx);
      return res;
    }
  }

  // Redirect /shops/t/[tenantId] to /shops/[slug] for SEO-friendly URLs
  const shopsTenantMatch = pathname.match(/^\/shops\/t\/([^\/]+)(.*)$/);
  if (shopsTenantMatch) {
    const tenantId = shopsTenantMatch[1];
    const remainingPath = shopsTenantMatch[2] || '';
    
    // Try to get the slug for this tenant
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || process.env.API_URL || 'http://localhost:4000';
      console.log(`[Proxy] Fetching slug for tenant: ${tenantId}`);
      const slugRes = await fetch(`${apiBaseUrl}/api/directory/resolve-slug/${tenantId}`);
      console.log(`[Proxy] Slug res:`, slugRes);
      
      if (slugRes.ok) {
        const slugData = await slugRes.json();
        console.log(`[Proxy] Slug data:`, slugData);
        if (slugData.success && slugData.tenantId && slugData.tenantId !== tenantId) {
          // If we got a different tenantId back, it means the input was a slug
          // This case shouldn't happen but we handle it gracefully
          const destUrl = new URL(`/shops/${tenantId}${remainingPath}`, req.url);
          const res = NextResponse.redirect(destUrl, { status: 301 });
          const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
          setCookie(res, 'tcx', tcx);
          return res;
        }
        
        // Try to get the actual slug from directory (uses canonical helper)
        const slug = await fetchTenantDirectorySlug(tenantId, apiBaseUrl);
        if (slug) {
          const destUrl = new URL(`/shops/${slug}${remainingPath}`, req.url);

          // Preserve query params
          const sourceUrl = new URL(req.url);
          sourceUrl.searchParams.forEach((value, key) => {
            destUrl.searchParams.set(key, value);
          });

          console.log(`[Proxy] Shops tenant redirect: ${pathname} → ${destUrl.toString()}`);

          const res = NextResponse.redirect(destUrl, { status: 301 });
          const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
          setCookie(res, 'tcx', tcx);
          return res;
        }
      }
    } catch (error) {
      clientLogger.error('[Proxy] Error resolving shops tenant redirect:', { detail: error });
    }
    
    // Fallback: redirect to /shops/[tenantId]
    const destUrl = new URL(`/shops/${tenantId}${remainingPath}`, req.url);
    const sourceUrl = new URL(req.url);
    sourceUrl.searchParams.forEach((value, key) => {
      destUrl.searchParams.set(key, value);
    });

    console.log(`[Proxy] Shops tenant fallback redirect: ${pathname} → ${destUrl.toString()}`);
    
    const res = NextResponse.redirect(destUrl, { status: 301 });
    const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
    setCookie(res, 'tcx', tcx);
    return res;
  }

  // When already under /t/{tenantId}/..., issue tcx cookie if missing
  const tMatch = pathname.match(/^\/t\/([^\/]+)\//);
  if (tMatch) {
    const tid = tMatch[1];
    const hasTcx = !!getCookie(req, 'tcx');
    if (!hasTcx && tid) {
      const res = NextResponse.next();
      const tcx = JSON.stringify({ tenant_id: tid, aud: 'user' });
      setCookie(res, 'tcx', tcx);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};
