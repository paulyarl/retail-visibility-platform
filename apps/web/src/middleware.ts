/**
 * Middleware to handle source map requests and prevent them from being treated as routes
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block source map requests from being treated as page routes
  if (pathname.endsWith('.map')) {
    return new NextResponse(null, { status: 404 });
  }

  // Allow other requests to proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except API routes, static files, and Next.js internals
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
