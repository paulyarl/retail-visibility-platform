import { NextRequest, NextResponse } from 'next/server';

// Import shared platform settings (this will be available at runtime)
// Note: This import might not work in middleware due to Next.js constraints
// In production, we'd use a database/cache approach
const getPlatformSettings = () => ({
  rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED !== 'false'
});

// Simple in-memory rate limiting store
// In production, use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 100; // Allow 100 requests per minute for normal browsing

// Paths that should have stricter limits (auth, admin, etc.)
const STRICT_PATHS = [
  '/api/auth',
  '/api/admin',
  '/api/tenants',
];

// Paths that should be exempt from rate limiting (public storefront browsing)
const EXEMPT_PATHS = [
  '/api/directory',
  '/api/items',
  '/api/storefront',
  '/api/products',
];

export async function rateLimitMiddleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // Skip rate limiting for exempt paths (public browsing)
  if (EXEMPT_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check platform settings to see if rate limiting is enabled
  const settings = getPlatformSettings();
  if (!settings.rateLimitingEnabled) {
    return NextResponse.next();
  }

  // Get client identifier (IP address)
  const clientIP = request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown';

  const now = Date.now();
  const windowKey = `${clientIP}:${Math.floor(now / WINDOW_MS)}`;

  // Get or create rate limit entry
  let rateLimitEntry = rateLimitStore.get(windowKey);
  if (!rateLimitEntry || rateLimitEntry.resetTime < now) {
    rateLimitEntry = { count: 0, resetTime: now + WINDOW_MS };
    rateLimitStore.set(windowKey, rateLimitEntry);
  }

  // Check if limit exceeded
  const isStrictPath = STRICT_PATHS.some(path => pathname.startsWith(path));
  const limit = isStrictPath ? MAX_REQUESTS_PER_WINDOW / 4 : MAX_REQUESTS_PER_WINDOW; // Stricter for sensitive paths

  if (rateLimitEntry.count >= limit) {
    // Rate limit exceeded - return 429 instead of 404
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Please slow down and try again later.',
        retryAfter: Math.ceil((rateLimitEntry.resetTime - now) / 1000)
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimitEntry.resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitEntry.resetTime.toString(),
        },
      }
    );
  }

  // Increment counter
  rateLimitEntry.count++;

  // Add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', (limit - rateLimitEntry.count).toString());
  response.headers.set('X-RateLimit-Reset', rateLimitEntry.resetTime.toString());

  return response;
}

// Cleanup old entries periodically (simple implementation)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, WINDOW_MS);
