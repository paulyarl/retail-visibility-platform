import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

// Import the enhanced createSecurityAlert function
import { createSecurityAlert } from '../routes/admin-security';
import { collectEnhancedSecurityContext, createSecuritySummary } from '../utils/security-context';

// Extend Express Request interface to include rateLimit property
declare global {
  namespace Express {
    interface Request {
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime?: Date;
      };
    }
  }
}

/**
 * Analyze request rate patterns for trend analysis
 */
async function analyzeRequestRate(req: Request): Promise<{
  currentRate: number;
  ratePerMinute: number;
  ratePerHour: number;
  historicalAverage: number;
  rateTrend: 'increasing' | 'decreasing' | 'stable';
  peakRate: number;
  timeWindow: string;
}> {
  const ipAddress = req.ip || 'unknown';
  const now = new Date();
  
  try {
    // Get recent request patterns from rate_limit_warnings table
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const [
      requestsLastMinute,
      requestsLastHour,
      requestsLast24Hours,
      historicalData
    ] = await Promise.all([
      // Requests in last minute
      prisma.rate_limit_warnings.count({
        where: {
          ip_address: ipAddress,
          occurred_at: { gte: oneMinuteAgo }
        }
      }),
      // Requests in last hour  
      prisma.rate_limit_warnings.count({
        where: {
          ip_address: ipAddress,
          occurred_at: { gte: oneHourAgo }
        }
      }),
      // Requests in last 24 hours
      prisma.rate_limit_warnings.count({
        where: {
          ip_address: ipAddress,
          occurred_at: { gte: twentyFourHoursAgo }
        }
      }),
      // Historical pattern (last 7 days same time)
      prisma.rate_limit_warnings.count({
        where: {
          ip_address: ipAddress,
          occurred_at: {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            lt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);
    
    const currentRate = requestsLastMinute;
    const ratePerMinute = requestsLastMinute;
    const ratePerHour = requestsLastHour;
    const historicalAverage = historicalData / (7 * 60); // Average per minute over 7 days
    const peakRate = Math.max(requestsLastMinute, requestsLastHour / 60, historicalAverage);
    
    // Determine trend
    let rateTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (currentRate > historicalAverage * 1.5) {
      rateTrend = 'increasing';
    } else if (currentRate < historicalAverage * 0.5) {
      rateTrend = 'decreasing';
    }
    
    return {
      currentRate,
      ratePerMinute,
      ratePerHour,
      historicalAverage,
      rateTrend,
      peakRate,
      timeWindow: '1 minute'
    };
    
  } catch (error) {
    console.error('[Rate Analysis] Failed to analyze request rate:', error);
    // Return fallback data
    return {
      currentRate: 1,
      ratePerMinute: 1,
      ratePerHour: 1,
      historicalAverage: 0.1,
      rateTrend: 'increasing',
      peakRate: 1,
      timeWindow: '1 minute'
    };
  }
}
async function storeRateLimitWarning(req: Request, blocked: boolean = false) {
  try {
    const rateLimit = req.rateLimit;
    if (!rateLimit) return;

    await prisma.rate_limit_warnings.create({
      data: {
        client_id: `${req.ip}:${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`,
        pathname: req.path,
        request_count: rateLimit.current,
        max_requests: rateLimit.limit,
        window_ms: 15 * 60, // 15 minutes in seconds
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        blocked
      }
    });
  } catch (error) {
    console.error('[Rate Limit] Failed to store warning:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Collect comprehensive incident context for security analytics
 */
async function collectIncidentContext(req: Request) {
  const user = (req as any).user;
  const context: any = {
    // Request context
    endpoint: req.path,
    method: req.method,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString(),
    rateLimit: req.rateLimit,

    // Geographic context (from headers or IP geolocation)
    geoData: {
      country: req.get('CF-IPCountry') || req.get('X-Country-Code'),
      region: req.get('CF-RAY') ? 'Cloudflare' : undefined,
      timezone: req.get('X-Timezone'),
    },

    // Request patterns
    requestPatterns: {
      isApiRequest: req.path.startsWith('/api/'),
      isAdminRequest: req.path.includes('/admin'),
      isAuthRequest: req.path.includes('/auth') || req.path.includes('/login'),
      isPublicRequest: req.path.startsWith('/public/'),
      hasTenantContext: !!req.headers['x-tenant-id'],
    },

    // Risk indicators
    riskIndicators: {
      suspiciousUserAgent: false, // Could implement bot detection
      rapidRequests: req.rateLimit?.remaining === 0,
      unusualTiming: false, // Could detect off-hours activity
      knownBadIP: false, // Could integrate with threat intelligence
    },
  };

  // User context (if authenticated)
  if (user) {
    context.userContext = {
      id: user.userId || user.id,
      email: user.email,
      role: user.role,
      isAuthenticated: true,
      hasMfa: !!user.mfa_enabled,
      lastLogin: user.last_login,
      accountAge: user.created_at ? Date.now() - new Date(user.created_at).getTime() : null,
    };

    // Tenant context
    if (user.tenants || user.user_tenants) {
      const tenants = user.tenants || user.user_tenants;
      context.tenantContext = {
        count: tenants.length,
        primaryTenant: tenants.find((t: any) => t.role === 'OWNER')?.id,
        hasMultipleLocations: tenants.length > 1,
        subscriptionTiers: [...new Set(tenants.map((t: any) => t.subscription_tier).filter(Boolean))],
      };
    }

    // Behavior patterns
    context.behaviorPatterns = {
      isNewUser: user.created_at && (Date.now() - new Date(user.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000), // < 7 days
      isPowerUser: user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT',
      hasRecentActivity: user.last_login && (Date.now() - new Date(user.last_login).getTime()) < (24 * 60 * 60 * 1000), // < 24h
    };
  } else {
    context.userContext = {
      isAuthenticated: false,
      isAnonymous: true,
    };

    // Anonymous user patterns
    context.behaviorPatterns = {
      isAnonymousAccess: true,
      potentialBruteForce: req.path.includes('/login') || req.path.includes('/auth'),
    };
  }

  // Session context
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  if (sessionId) {
    context.sessionContext = {
      hasSessionId: true,
      // Could add session analytics here
    };
  }

  return context;
}

// General API rate limiter - applies to most endpoints
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit in dev for hot reload
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;

    // Skip rate limiting for authenticated platform admin users
    const user = (req as any).user;
    return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  },
  handler: async (req: Request, res: Response) => {
    // Store rate limit warning for trend analysis
    await storeRateLimitWarning(req, true); // blocked = true for rate limit exceeded

    // Collect enhanced security context with device fingerprinting and location data
    const securityContext = collectEnhancedSecurityContext(req);
    const securitySummary = createSecuritySummary(securityContext);
    
    // Analyze request rate patterns for trend analysis
    const rateAnalysis = await analyzeRequestRate(req);

    // Create telemetry metadata for tracking
    const telemetryMetadata = {
      ...securityContext,
      summary: securitySummary,
      riskFactors: securitySummary.riskFactors,
      isSuspicious: securitySummary.isSuspicious,
      // Enhanced rate analysis
      rateAnalysis: {
        ...rateAnalysis,
        limitInfo: {
          limit: req.rateLimit?.limit,
          current: req.rateLimit?.current,
          remaining: req.rateLimit?.remaining,
          resetTime: req.rateLimit?.resetTime?.toISOString(),
          windowMs: 15 * 60 * 1000 // 15 minutes
        },
        triggerReason: (req.rateLimit?.limit && rateAnalysis.currentRate >= req.rateLimit.limit) ? 'limit_exceeded' : 'rate_too_high'
      }
    };

    // Log security alert for rate limit violation with enhanced context
    const userId = (req as any).user?.userId || (req as any).user?.user_id;
    if (userId) {
      createSecurityAlert({
        userId,
        type: 'rate_limit_exceeded',
        severity: securitySummary.threatLevel === 'critical' ? 'critical' : 
                  securitySummary.threatLevel === 'high' ? 'warning' : 'info',
        title: 'Rate Limit Exceeded',
        message: `Request limit exceeded for ${securityContext.application.isAuthenticated ? 'authenticated user' : 'IP'} ${securityContext.network.ip} on endpoint ${securityContext.endpoint} from ${securitySummary.location} using ${securitySummary.device}`,
        metadata: telemetryMetadata,
      });
    } else {
      // Create alert for unauthenticated user (system-level alert)
      createSecurityAlert({
        userId: 'system', // Use system ID for unauthenticated threats
        type: 'rate_limit_exceeded',
        severity: securitySummary.threatLevel === 'critical' ? 'critical' : 
                  securitySummary.threatLevel === 'high' ? 'warning' : 'info',
        title: 'Rate Limit Exceeded - Unauthenticated',
        message: `Request limit exceeded for unauthenticated IP ${securityContext.network.ip} on endpoint ${securityContext.endpoint} from ${securitySummary.location} using ${securitySummary.device}`,
        metadata: {
          ...telemetryMetadata,
          unauthenticated: true,
        },
      });
    }

    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP, please try again after 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 15 * 60 * 1000) / 1000)
    });
  }
});

// Stricter rate limiter for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    error: 'auth_rate_limit_exceeded',
    message: 'Too many authentication attempts, please try again after 15 minutes.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    
    // Skip rate limiting for authenticated admin users
    const user = (req as any).user;
    return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  },
  handler: async (req: Request, res: Response) => {
    // Store rate limit warning for trend analysis
    await storeRateLimitWarning(req, true); // blocked = true for auth rate limit exceeded

    // Collect comprehensive incident context for critical security analytics
    const incidentContext = await collectIncidentContext(req);

    // Enhance risk indicators for auth attempts
    incidentContext.riskIndicators.potentialBruteForce = true;
    incidentContext.riskIndicators.authAttempt = true;

    // Log security alert for auth rate limit violation (highest severity)
    const userId = (req as any).user?.userId || (req as any).user?.user_id;
    if (userId) {
      createSecurityAlert({
        userId,
        type: 'auth_rate_limit_exceeded',
        severity: 'critical',
        title: 'Authentication Rate Limit Exceeded',
        message: `Multiple failed authentication attempts from ${incidentContext.ipAddress}${incidentContext.userContext.isAuthenticated ? ` (user: ${incidentContext.userContext.email})` : ''} - potential brute force attack`,
        metadata: incidentContext,
      });
    }

    res.status(429).json({
      error: 'auth_rate_limit_exceeded',
      message: 'Too many authentication attempts, please try again after 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 15 * 60 * 1000) / 1000)
    });
  }
});

// Rate limiter for file uploads
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    error: 'upload_rate_limit_exceeded',
    message: 'Too many file uploads, please try again after 1 hour.',
    retryAfter: 60 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for authenticated platform admin users
    const user = (req as any).user;
    return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  },
  handler: async (req: Request, res: Response) => {
    // Store rate limit warning for trend analysis
    await storeRateLimitWarning(req, true); // blocked = true for upload rate limit exceeded

    // Collect comprehensive incident context for upload analytics
    const incidentContext = await collectIncidentContext(req);

    // Enhance context for upload-specific patterns
    incidentContext.uploadContext = {
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      hasFileData: req.method === 'POST' && req.headers['content-type']?.includes('multipart'),
    };

    // Log security alert for upload rate limit violation
    const userId = (req as any).user?.userId || (req as any).user?.user_id;
    if (userId) {
      createSecurityAlert({
        userId,
        type: 'upload_rate_limit_exceeded',
        severity: 'warning',
        title: 'File Upload Rate Limit Exceeded',
        message: `Upload limit exceeded for ${incidentContext.userContext.isAuthenticated ? 'user' : 'IP'} ${incidentContext.ipAddress} - potential abuse or spam`,
        metadata: incidentContext,
      });
    }

    res.status(429).json({
      error: 'upload_rate_limit_exceeded',
      message: 'Too many file uploads, please try again after 1 hour.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 60 * 60 * 1000) / 1000)
    });
  }
});

// Rate limiter for search endpoints
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 30 : 200, // Higher limit in dev for hot reload
  message: {
    error: 'search_rate_limit_exceeded',
    message: 'Too many search requests, please slow down.',
    retryAfter: 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for authenticated platform admin users
    const user = (req as any).user;
    return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  },
  handler: async (req: Request, res: Response) => {
    // Store rate limit warning for trend analysis
    await storeRateLimitWarning(req, true); // blocked = true for search rate limit exceeded

    // Collect comprehensive incident context for search analytics
    const incidentContext = await collectIncidentContext(req);

    // Enhance context for search-specific patterns
    incidentContext.searchContext = {
      queryParams: req.query,
      hasSearchTerm: !!req.query.q || !!req.query.query,
      isDirectorySearch: req.path.includes('/directory'),
      isProductSearch: req.path.includes('/items') || req.path.includes('/products'),
    };

    // Log security alert for search rate limit violation
    const userId = (req as any).user?.userId || (req as any).user?.user_id;
    if (userId) {
      createSecurityAlert({
        userId,
        type: 'search_rate_limit_exceeded',
        severity: 'warning',
        title: 'Search Rate Limit Exceeded',
        message: `Search limit exceeded for ${incidentContext.userContext.isAuthenticated ? 'user' : 'IP'} ${incidentContext.ipAddress} - potential scraping or abuse`,
        metadata: incidentContext,
      });
    }

    res.status(429).json({
      error: 'search_rate_limit_exceeded',
      message: 'Too many search requests, please slow down.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 60 * 1000) / 1000)
    });
  }
});

// Rate limiter for admin endpoints (stricter limits)
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 admin requests per windowMs
  message: {
    error: 'admin_rate_limit_exceeded',
    message: 'Too many admin requests, please try again after 15 minutes.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request, res: Response) => {
    // Only skip for authenticated admin users
    const user = (req as any).user;
    return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'admin_rate_limit_exceeded',
      message: 'Too many admin requests, please try again after 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 15 * 60 * 1000) / 1000)
    });
  }
});

// Rate limiter for API endpoints that cost money (external APIs)
export const costlyApiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 costly API calls per hour
  message: {
    error: 'costly_api_rate_limit_exceeded',
    message: 'Too many API calls that incur costs, please try again after 1 hour.',
    retryAfter: 60 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for authenticated platform admin users
    const user = (req as any).user;
    return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  },
  handler: async (req: Request, res: Response) => {
    // Store rate limit warning for trend analysis
    await storeRateLimitWarning(req, true); // blocked = true for costly API rate limit exceeded

    // Collect comprehensive incident context for costly API analytics
    const incidentContext = await collectIncidentContext(req);

    // Enhance context for costly API patterns
    incidentContext.apiCostContext = {
      isGeocoding: req.path.includes('/geocode'),
      isGoogleService: req.path.includes('/google'),
      isExternalService: req.path.includes('/external'),
      estimatedCost: req.path.includes('/geocode') ? '$0.005' : 'variable',
    };

    // Log security alert for costly API rate limit violation
    const userId = (req as any).user?.userId || (req as any).user?.user_id;
    if (userId) {
      createSecurityAlert({
        userId,
        type: 'costly_api_rate_limit_exceeded',
        severity: 'warning',
        title: 'Costly API Rate Limit Exceeded',
        message: `External API limit exceeded for ${incidentContext.userContext.isAuthenticated ? 'user' : 'IP'} ${incidentContext.ipAddress} - high-cost operations restricted`,
        metadata: incidentContext,
      });
    }

    res.status(429).json({
      error: 'costly_api_rate_limit_exceeded',
      message: 'Too many API calls that incur costs, please try again after 1 hour.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 60 * 60 * 1000) / 1000)
    });
  }
});

// Rate limiter for store status endpoints (more permissive since cached)
export const storeStatusRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 2000, // Higher limit for cached endpoint
  message: {
    error: 'store_status_rate_limit_exceeded',
    message: 'Too many store status requests, please try again after 15 minutes.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for authenticated platform admin users
    const user = (req as any).user;
    return user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  },
  handler: async (req: Request, res: Response) => {
    // Store rate limit warning for trend analysis
    await storeRateLimitWarning(req, true); // blocked = true for store status rate limit exceeded

    // Collect comprehensive incident context for store status analytics
    const incidentContext = await collectIncidentContext(req);

    // Enhance context for store status patterns (cached, essential for UI)
    incidentContext.storeStatusContext = {
      isCachedEndpoint: true,
      tenantId: req.params.tenantId,
      isPublicAccess: req.path.startsWith('/public/'),
      uiEssential: true, // Store status is critical for user experience
    };

    // Log security alert for store status rate limit violation (lower severity since cached)
    const userId = (req as any).user?.userId || (req as any).user?.user_id;
    if (userId) {
      createSecurityAlert({
        userId,
        type: 'store_status_rate_limit_exceeded',
        severity: 'info', // Lower severity since this is cached and UI-essential
        title: 'Store Status Rate Limit Exceeded',
        message: `Store status limit exceeded for ${incidentContext.userContext.isAuthenticated ? 'user' : 'IP'} ${incidentContext.ipAddress} on tenant ${req.params.tenantId} - cached endpoint abuse`,
        metadata: incidentContext,
      });
    }

    res.status(429).json({
      error: 'store_status_rate_limit_exceeded',
      message: 'Too many store status requests, please try again after 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 15 * 60 * 1000) / 1000)
    });
  }
});

/**
 * Apply appropriate rate limiting based on route path
 */
export function applyRateLimit(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  // Skip rate limiting for telemetry endpoints (test and production)
  if (path.startsWith('/api/security/telemetry/')) {
    return next();
  }

  // Authentication endpoints
  if (path.startsWith('/auth/') || path.includes('/login') || path.includes('/register')) {
    authRateLimit(req, res, next);
    return;
  }

  // File upload endpoints
  if (path.includes('/upload') || req.method === 'POST' && req.headers['content-type']?.includes('multipart')) {
    /* uploadRateLimit(req, res, next);
    return; */
     return next();
  }

  // Search endpoints
  if (path.includes('/search') || path.includes('/directory')) {
    searchRateLimit(req, res, next);
    return;
  }

  // Admin endpoints
  if (path.startsWith('/api/admin/') || path.includes('/admin')) {
    /* adminRateLimit(req, res, next);
    return; */
     return next();
  }

  // Store status endpoints (cached, essential for UI - NO RATE LIMIT)
  if (path.includes('/business-hours/status')) {
    // Skip rate limiting entirely for store status endpoints
    return next();
  }

  // Costly API endpoints (geocoding, external services)
  if (path.includes('/geocode') || path.includes('/google') || path.includes('/external')) {
    costlyApiRateLimit(req, res, next);
    return;
  }

  // Default general rate limit
  generalRateLimit(req, res, next);
}
