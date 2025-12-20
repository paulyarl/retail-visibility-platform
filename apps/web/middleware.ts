import { NextRequest, NextResponse } from 'next/server';

// Environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.visibleshelf.com';
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
 * Check if user is platform admin by calling the API
 */
async function isPlatformAdmin(req: NextRequest): Promise<boolean> {
  try {
    // Check both auth_token (legacy) and access_token (current)
    const authToken = getCookie(req, 'auth_token') || getCookie(req, 'access_token');
    if (!authToken) return false;

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    const user = data.user || data;
    
    // Check if user is platform admin
    return user.role === 'PLATFORM_ADMIN' || 
           user.role === 'ADMIN' || 
           user.isPlatformAdmin === true;
  } catch (error) {
    console.error('[Middleware] Error checking platform admin:', error);
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, hostname, searchParams } = new URL(req.url);

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
            console.log(`[Middleware] Subdomain rewrite: ${hostname}${pathname} → ${destPath} (domain: ${domain})`);
            
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

          console.log(`[Middleware] Subdomain routing: ${hostname}${pathname} → ${destUrl.toString()} (domain: ${domain})`);

          const res = NextResponse.redirect(destUrl, { status: 302 });

          // Set tenant context cookie
          const tcx = JSON.stringify({ tenant_id: tenantId, aud: 'user' });
          setCookie(res, 'tcx', tcx);

          return res;
        }
      }
    } catch (error) {
      console.error('[Middleware] Error in subdomain routing:', error);
      // Continue with normal routing if subdomain lookup fails
    }
  }

  // Protect /admin/* routes - require platform admin
  if (pathname.startsWith('/admin')) {
    const isAdmin = await isPlatformAdmin(req);
    
    // Log all admin access attempts
    console.log('[Middleware] Admin access attempt:', {
      path: pathname,
      allowed: isAdmin,
      timestamp: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    });
    
    if (!isAdmin) {
      // Redirect to access denied page with context
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
