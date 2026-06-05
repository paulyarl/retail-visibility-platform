import { NextRequest, NextResponse } from 'next/server';
import rateLimitSingletonService from '@/services/RateLimitSingletonService';

// Rate limiting configuration
const WINDOW_MS = 60 * 1000; // 1 minute

// Exempt paths that should not be rate limited (public browsing)
const EXEMPT_PATHS = [
  '/api/directory',
  '/api/items',
  '/api/storefront',
  '/api/products'
];

// Stricter limits for sensitive paths
const STRICT_PATHS = [
  '/api/tenants'
];

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Get platform settings (cached via singleton service)
async function getPlatformSettings(): Promise<{ rateLimitingEnabled: boolean }> {
  const enabled = await rateLimitSingletonService.isRateLimitingEnabled();
  return { rateLimitingEnabled: enabled };
}

// Fetch rate limit configurations (cached via singleton service)
async function getRateLimitConfigurations() {
  return await rateLimitSingletonService.getRateLimitConfigurations();
}

// Clean up expired entries
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Get client identifier (IP + User-Agent for better identification)
function getClientIdentifier(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  return `${ip}:${userAgent}`;
}

// Check if path should be exempt from rate limiting
function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.some(path => pathname.startsWith(path));
}

// Check if path should have stricter rate limiting
function isStrictPath(pathname: string): boolean {
  return STRICT_PATHS.some(path => pathname.startsWith(path));
}

// Get route type for a given path
function getRouteTypeForPath(pathname: string): string {
  if (pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api/admin')) return 'admin';
  if (isStrictPath(pathname)) return 'strict';
  if (isExemptPath(pathname)) return 'exempt';
  return 'standard';
}

// Get rate limit for path using dynamic configurations
async function getRateLimitForPath(pathname: string): Promise<{ maxRequests: number; windowMs: number; enabled: boolean }> {
  const configs = await getRateLimitConfigurations();
  const routeType = getRouteTypeForPath(pathname);
  const config = configs.find(c => c.route_type === routeType);

  if (config) {
    return {
      maxRequests: config.max_requests,
      windowMs: config.window_minutes * 60 * 1000, // Convert minutes to milliseconds
      enabled: config.enabled
    };
  }

  // Fallback to defaults if config not found
  const defaults = {
    auth: { maxRequests: 20, windowMs: 60 * 1000, enabled: true },
    admin: { maxRequests: 20, windowMs: 60 * 1000, enabled: true },
    strict: { maxRequests: 20, windowMs: 60 * 1000, enabled: true },
    standard: { maxRequests: 100, windowMs: 60 * 1000, enabled: true },
    exempt: { maxRequests: 1000, windowMs: 60 * 1000, enabled: false }
  };

  return defaults[routeType as keyof typeof defaults] || defaults.standard;
}

// Apply rate limiting to a request
export async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const settings = await getPlatformSettings();

  // If rate limiting is disabled globally, skip
  if (!settings.rateLimitingEnabled) {
    return null;
  }

  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for exempt paths (public browsing)
  if (isExemptPath(pathname)) {
    return null;
  }

  // Get dynamic rate limit configuration for this path
  const { maxRequests, windowMs, enabled } = await getRateLimitForPath(pathname);

  // If rate limiting is disabled for this route type, skip
  if (!enabled) {
    return null;
  }

  const clientId = getClientIdentifier(request);
  const now = Date.now();

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupExpiredEntries();
  }

  const clientData = rateLimitStore.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    // First request or window expired
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + windowMs
    });
    return null;
  }

  if (clientData.count >= maxRequests) {
    // Rate limit exceeded - store warning data for trend analysis (fire and forget)
    rateLimitSingletonService.logRateLimitWarning({
      clientId,
      pathname,
      requestCount: clientData.count,
      maxRequests,
      windowMs: windowMs / 1000, // Convert back to seconds for storage
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
      blocked: false // Will be set to true for blocked requests
    });

    console.warn('🔥 RATE LIMIT WARNING:', {
      clientId,
      pathname,
      requestCount: clientData.count,
      maxRequests,
      windowMs,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      action: 'LOGGED_WARNING_ONLY' // No blocking for data collection
    });

    // Special handling for auth routes - don't block for data collection
    const routeType = getRouteTypeForPath(pathname);
    if (routeType === 'auth') {
      // Increment counter but don't block
      clientData.count++;
      rateLimitStore.set(clientId, clientData);
      return null;
    }

    // For other routes that hit limits, block and log (fire and forget)
    rateLimitSingletonService.logRateLimitWarning({
      clientId,
      pathname,
      requestCount: clientData.count,
      maxRequests,
      windowMs: windowMs / 1000,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
      blocked: true
    });

    // Return 429 response
    const resetTime = new Date(clientData.resetTime);
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((clientData.resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toISOString()
        }
      }
    );
  }

  // Increment counter
  clientData.count++;
  rateLimitStore.set(clientId, clientData);

  return null;
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
