import { NextRequest, NextResponse } from 'next/server';

// Flags (read at edge)
const FF_TENANT_URLS = String(process.env.FF_TENANT_URLS || process.env.NEXT_PUBLIC_FF_TENANT_URLS || 'false').toLowerCase() === 'true';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

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
    const authToken = getCookie(req, 'auth_token');
    if (!authToken) return false;

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Cookie': `auth_token=${authToken}`,
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
  const { pathname, searchParams } = new URL(req.url);

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
      // Redirect to access denied page
      return NextResponse.redirect(new URL('/access-denied', req.url));
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
    '/admin/:path*',
    '/items/:path*',
    '/settings/:path*',
    '/tenants/:path*',
    '/t/:path*',
    '/',
  ],
};
