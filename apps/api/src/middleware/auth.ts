// Auth middleware for Express
import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';

// JWT Payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantIds: string[];
}

// Extend Express Request type to include user
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
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
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
}

/**
 * Alias for backward compatibility
 */
export const requireAuth = authenticateToken;

/**
 * Middleware to check if user has required role
 */
export function authorize(...roles: UserRole[]) {
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
}

/**
 * Platform admin-only middleware (explicit)
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  // Check for explicit PLATFORM_ADMIN role, or legacy ADMIN role
  if (req.user.role !== UserRole.PLATFORM_ADMIN && req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({ 
      error: 'platform_admin_required', 
      message: 'Platform administrator access required' 
    });
  }

  next();
}

/**
 * Admin-only middleware (legacy - use requirePlatformAdmin instead)
 * @deprecated Use requirePlatformAdmin for platform-wide admin access
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requirePlatformAdmin(req, res, next);
}

/**
 * Middleware to check if user has access to a specific tenant
 */
export function checkTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  // Platform users (admin, support, viewer) have access to all tenants
  if (req.user.role === UserRole.PLATFORM_ADMIN || 
      req.user.role === UserRole.PLATFORM_SUPPORT ||
      req.user.role === UserRole.PLATFORM_VIEWER ||
      req.user.role === UserRole.ADMIN) {
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
}

/**
 * Optional authentication - adds user to request if token is valid, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
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
}

/**
 * Extract tenant ID from query or user context
 */
export function getTenantId(req: Request): string | null {
  return (req.query.tenantId as string) || (req.user?.tenantIds && req.user.tenantIds[0]) || null;
}

/**
 * Middleware to check if user is a tenant owner/admin or platform admin
 * Used for sensitive tenant operations like managing feature flags
 * Allows: Platform ADMIN (global), or users with OWNER/ADMIN role within the specific tenant
 */
export async function requireTenantOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  // Platform admins can manage any tenant
  if (req.user.role === UserRole.PLATFORM_ADMIN || req.user.role === UserRole.ADMIN) {
    return next();
  }

  // Get tenant ID from request
  const tenantId = req.params.tenantId || req.params.id || req.query.tenantId || req.body.tenantId;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenant_id_required', message: 'Tenant ID is required' });
  }

  // Check if user has access to this tenant and their role within it
  try {
    const { prisma } = await import('../prisma');
    const userTenant = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: req.user.userId,
          tenantId: tenantId as string,
        },
      },
    });

    if (!userTenant) {
      return res.status(403).json({ 
        error: 'tenant_access_denied', 
        message: 'You do not have access to this tenant' 
      });
    }

    // Must be OWNER or ADMIN role within the tenant to manage settings
    if (userTenant.role !== 'OWNER' && userTenant.role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'owner_or_admin_required', 
        message: 'Only tenant owners/admins can manage feature flags' 
      });
    }

    next();
  } catch (error) {
    console.error('[requireTenantOwner] Error checking tenant access:', error);
    return res.status(500).json({ error: 'authorization_check_failed' });
  }
}
