import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limiting';

export async function middleware(request: NextRequest) {
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitResponse = await rateLimitMiddleware(request);
    if (rateLimitResponse.status === 429) {
      return rateLimitResponse;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};
