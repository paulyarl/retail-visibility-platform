import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from './lib/auth0';
import AuthSyncService from './services/AuthSyncService';
import { fetchTenantDirectorySlug } from './lib/directory-helpers';

// Environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || process.env.API_URL || 'https://api.visibleshelf.com';
const FF_TENANT_URLS = process.env.NEXT_PUBLIC_FF_TENANT_URLS === 'true';

// Platform domains that support subdomains
const PLATFORM_DOMAINS = ['visibleshelf.com', 'visibleshelf.store'];

// Check if hostname is a platform subdomain
function isPlatformSubdomain(hostname: string): { isSubdomain: boolean; subdomain: string; domain: string } | null {
  // Check production domains
  for (const domain of PLATFORM_DOMAINS) {
    if (hostname.endsWith(`.${domain}`) && hostname !== domain) {
      const subdomain = hostname.replace(`.${domain}`, '');
      return { isSubdomain: true, subdomain, domain };
    }
  }

  // Check localhost for development
  if (hostname.endsWith('.localhost') && hostname !== 'localhost') {
    const subdomain = hostname.replace('.localhost', '');
    return { isSubdomain: true, subdomain, domain: 'localhost' };
  }

  return null;
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
    console.error('[Proxy] Error checking platform admin:', error);
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

    try {
      // Look up tenant by subdomain using resolve endpoint
      const tenantResponse = await fetch(`${API_BASE_URL}/api/tenants/resolve-subdomain/${subdomain}`);

      if (tenantResponse.ok) {
        const subdomainData = await tenantResponse.json();
        if (subdomainData.success && subdomainData.tenantId) {
          // Subdomain exists, route to storefront
          const tenantId = subdomainData.tenantId;

          // For localhost development, use rewrite instead of redirect
          if (domain === 'localhost') {
            // Rewrite to tenant storefront path (keeps subdomain in URL)
            const destPath = `/t/${tenantId}${pathname}`;
            console.log(`[Proxy] Subdomain rewrite: ${hostname}${pathname} → ${destPath} (domain: ${domain})`);
            
            const url = req.nextUrl.clone();
            url.pathname = destPath;
            
            const res = NextResponse.rewrite(url);
            
            // Set tenant context cookie
            const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
            setCookie(res, 'tcx', tcx);
            
            return res;
          }

          // For production domains, redirect to tenant storefront
          const destUrl = new URL(`/t/${tenantId}${pathname}`, req.url);
          // Preserve query params
          const sourceUrl = new URL(req.url);
          sourceUrl.searchParams.forEach((value, key) => {
            destUrl.searchParams.set(key, value);
          });

         // console.log(`[Proxy] Subdomain routing: ${hostname}${pathname} → ${destUrl.toString()} (domain: ${domain})`);

          const res = NextResponse.redirect(destUrl, { status: 302 });

          // Set tenant context cookie
          const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
          setCookie(res, 'tcx', tcx);

          return res;
        }
      }
    } catch (error) {
      console.error('[Proxy] Error in subdomain routing:', error);
      // Continue with normal routing if subdomain lookup fails
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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.visibleshelf.com';
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
      console.error('[Proxy] Error resolving shops tenant redirect:', error);
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
