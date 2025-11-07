import { Request, Response, NextFunction } from 'express';
import { authService, JWTPayload } from './auth.service';
import { isPlatformAdmin } from '../utils/platform-admin';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'authentication_required', message: 'No token provided' });
    }

    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'token_expired', message: 'Token has expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'invalid_token', message: 'Invalid token' });
      }
    }
    return res.status(401).json({ error: 'authentication_failed', message: 'Authentication failed' });
  }
};

/**
 * Middleware to check if user has required role
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'insufficient_permissions', 
        message: 'You do not have permission to access this resource' 
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has access to a specific tenant
 */
export const checkTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  // Platform admin users have access to all tenants
  if (isPlatformAdmin(req.user)) {
    return next();
  }

  // Get tenant ID from request (params, query, or body)
  const tenantId = req.params.tenantId || req.params.id || req.query.tenantId || req.body.tenantId;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenant_id_required', message: 'Tenant ID is required' });
  }

  // Check if user has access to this tenant
  if (!req.user.tenantIds.includes(tenantId as string)) {
    return res.status(403).json({ 
      error: 'tenant_access_denied', 
      message: 'You do not have access to this tenant' 
    });
  }

  next();
};

/**
 * Optional authentication - adds user to request if token is valid, but doesn't require it
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = authService.verifyAccessToken(token);
      req.user = payload;
    }
  } catch (error) {
    // Silently fail - authentication is optional
  }
  next();
};
