import { NextRequest, NextResponse } from 'next/server';

// Import shared platform settings (this will be available at runtime)
// Note: This import might not work in middleware due to Next.js constraints
// In production, we'd use a database/cache approach
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

// Cache for rate limit configurations (updated periodically)
let rateLimitConfigs: Array<{
  route_type: string;
  max_requests: number;
  window_minutes: number;
  enabled: boolean;
}> = [];
let configsLastUpdated = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get platform settings (reads from database, falls back to environment)
async function getPlatformSettings(): Promise<{ rateLimitingEnabled: boolean }> {
  try {
    // Try to get from database first (same endpoint as configurations)
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/admin/platform-settings`);
    if (response.ok) {
      const data = await response.json();
      return {
        rateLimitingEnabled: data.rateLimitingEnabled ?? true
      };
    }
  } catch (error) {
    console.log('Failed to fetch platform settings from database, using environment fallback');
  }
  
  // Fallback to environment variable for backward compatibility
  return {
    rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED !== 'false',
  };
}

// Fetch rate limit configurations from database
async function getRateLimitConfigurations() {
  const now = Date.now();
  if (rateLimitConfigs.length === 0 || now - configsLastUpdated > CONFIG_CACHE_TTL) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/admin/platform-settings`);
      if (response.ok) {
        const data = await response.json();
        if (data.rateLimitConfigurations) {
          rateLimitConfigs = data.rateLimitConfigurations.map((config: any) => ({
            route_type: config.route_type,
            max_requests: config.max_requests,
            window_minutes: config.window_minutes,
            enabled: config.enabled
          }));
          configsLastUpdated = now;
        }
      }
    } catch (error) {
      console.error('Failed to fetch rate limit configurations:', error);
      // Fall back to default configurations
      rateLimitConfigs = [
        { route_type: 'auth', max_requests: 20, window_minutes: 1, enabled: true },
        { route_type: 'admin', max_requests: 20, window_minutes: 1, enabled: true },
        { route_type: 'strict', max_requests: 20, window_minutes: 1, enabled: true },
        { route_type: 'standard', max_requests: 100, window_minutes: 1, enabled: true },
        { route_type: 'exempt', max_requests: 1000, window_minutes: 1, enabled: false }
      ];
    }
  }
  return rateLimitConfigs;
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
    // Rate limit exceeded - store warning data for trend analysis
    try {
      // Store warning in database (fire and forget - don't block the response)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Make server-to-server call without authentication headers
      // Rate limiting warnings are internal system data, don't require user auth
      fetch(`${apiUrl}/api/rate-limit-warnings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: No Authorization header - this is an internal system call
          'X-Internal-Request': 'rate-limit-middleware', // Identify source
        },
        body: JSON.stringify({
          clientId,
          pathname,
          requestCount: clientData.count,
          maxRequests,
          windowMs: windowMs / 1000, // Convert back to seconds for storage
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
          blocked: false // Will be set to true for blocked requests
        })
      }).catch(err => console.error('Failed to store rate limit warning:', err));
    } catch (error) {
      console.error('Error preparing rate limit warning data:', error);
    }

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

    // For other routes that hit limits, block and log
    try {
      // Store blocked warning in database
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Make server-to-server call without authentication headers
      // Rate limiting warnings are internal system data, don't require user auth
      fetch(`${apiUrl}/api/rate-limit-warnings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: No Authorization header - this is an internal system call
          'X-Internal-Request': 'rate-limit-middleware', // Identify source
        },
        body: JSON.stringify({
          clientId,
          pathname,
          requestCount: clientData.count,
          maxRequests,
          windowMs: windowMs / 1000,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
          blocked: true
        })
      }).catch(err => console.error('Failed to store blocked rate limit warning:', err));
    } catch (error) {
      console.error('Error preparing blocked rate limit warning data:', error);
    }

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
