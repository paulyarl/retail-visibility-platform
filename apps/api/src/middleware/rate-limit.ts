import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

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
 * Rate limiting middleware for API security
 * Implements different limits for different endpoints and user types
 */

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
    return req.path === '/health';
  },
  handler: (req: Request, res: Response) => {
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
  handler: (req: Request, res: Response) => {
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
  handler: (req: Request, res: Response) => {
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
  handler: (req: Request, res: Response) => {
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
  handler: (req: Request, res: Response) => {
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
  handler: (req: Request, res: Response) => {
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

  // Authentication endpoints
  if (path.startsWith('/auth/') || path.includes('/login') || path.includes('/register')) {
    authRateLimit(req, res, next);
    return;
  }

  // File upload endpoints
  if (path.includes('/upload') || req.method === 'POST' && req.headers['content-type']?.includes('multipart')) {
    uploadRateLimit(req, res, next);
    return;
  }

  // Search endpoints
  if (path.includes('/search') || path.includes('/directory')) {
    searchRateLimit(req, res, next);
    return;
  }

  // Admin endpoints
  if (path.startsWith('/api/admin/') || path.includes('/admin')) {
    adminRateLimit(req, res, next);
    return;
  }

  // Store status endpoints (cached, essential for UI)
  if (path.includes('/business-hours/status')) {
    storeStatusRateLimit(req, res, next);
    return;
  }

  // Costly API endpoints (geocoding, external services)
  if (path.includes('/geocode') || path.includes('/google') || path.includes('/external')) {
    costlyApiRateLimit(req, res, next);
    return;
  }

  // Default general rate limit
  generalRateLimit(req, res, next);
}
