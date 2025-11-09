/**
 * Authentication & Authorization Middleware
 * 
 * This module provides centralized auth middleware for Express routes.
 * All middleware uses centralized helpers from utils/platform-admin.ts
 * for consistent role checking across the platform.
 * 
 * Middleware Hierarchy:
 * 1. authenticateToken - Validates JWT and adds user to request
 * 2. requirePlatformAdmin - Platform admins only (PLATFORM_ADMIN, ADMIN)
 * 3. requirePlatformUser - Any platform role (ADMIN, SUPPORT, VIEWER)
 * 4. checkTenantAccess - Platform users OR tenant members
 * 5. requireTenantOwner - Platform admins OR tenant owners/admins
 * 
 * Platform Roles (User.role):
 * - PLATFORM_ADMIN: Full platform access
 * - PLATFORM_SUPPORT: View all + support actions
 * - PLATFORM_VIEWER: Read-only all tenants
 * - ADMIN: Legacy platform admin
 * 
 * Tenant Roles (UserTenant.role):
 * - OWNER: Full tenant control
 * - ADMIN: Tenant admin
 * - MEMBER: Basic tenant access
 * - VIEWER: Read-only tenant access
 */
import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';
import { isPlatformUser, isPlatformAdmin } from '../utils/platform-admin';

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
    console.log('[Auth Middleware] Authorization header:', authHeader ? 'PRESENT' : 'MISSING');
    
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    console.log('[Auth Middleware] Token extracted:', token ? 'PRESENT' : 'MISSING');

    if (!token) {
      console.log('[Auth Middleware] No token found, returning 401');
      return res.status(401).json({ error: 'authentication_required', message: 'No token provided' });
    }

    console.log('[Auth Middleware] Verifying token...');
    const payload = authService.verifyAccessToken(token);
    console.log('[Auth Middleware] Token verified, payload:', payload);
    
    req.user = payload;
    console.log('[Auth Middleware] User attached to request:', req.user);
    next();
  } catch (error) {
    console.log('[Auth Middleware] Token verification failed:', error);
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
 * Uses centralized helper for consistent role checking
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  if (!isPlatformAdmin(req.user)) {
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
 * Platform user middleware (admin, support, or viewer)
 * Use for view-only operations that should be accessible to all platform roles
 */
export function requirePlatformUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  if (!isPlatformUser(req.user)) {
    return res.status(403).json({ 
      error: 'platform_access_required', 
      message: 'Platform-level access required' 
    });
  }

  next();
}

/**
 * Middleware to check if user has access to a specific tenant
 * Uses centralized helper for consistent platform role checking
 */
export function checkTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  // Platform users (admin, support, viewer) have access to all tenants
  if (isPlatformUser(req.user)) {
    return next();
  }

  // Get and validate tenant ID using helper
  const tenantId = requireTenantId(req, res);
  if (!tenantId) {
    return; // Error response already sent by requireTenantId
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
 * Extract tenant ID from request (params, query, or body)
 * Checks multiple locations in order of priority
 */
export function getTenantId(req: Request): string | null {
  return (
    req.params.tenantId ||
    req.params.id ||
    (req.query.tenantId as string) ||
    req.body.tenantId ||
    (req.user?.tenantIds && req.user.tenantIds[0]) ||
    null
  );
}

/**
 * Extract and validate tenant ID from request
 * Returns error response if tenant ID is missing
 */
export function requireTenantId(req: Request, res: Response): string | null {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    res.status(400).json({ 
      error: 'tenant_id_required', 
      message: 'Tenant ID is required' 
    });
    return null;
  }
  
  return tenantId;
}

/**
 * Middleware to check if user is a tenant owner/admin or platform admin
 * Used for sensitive tenant operations like managing feature flags
 * Allows: Platform ADMIN (global), or users with OWNER/ADMIN role within the specific tenant
 * Uses centralized helpers for consistent permission checking
 */
export async function requireTenantOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  // Platform admins can manage any tenant
  if (isPlatformAdmin(req.user)) {
    return next();
  }

  // Get and validate tenant ID using helper
  const tenantId = requireTenantId(req, res);
  if (!tenantId) {
    return; // Error response already sent by requireTenantId
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

/**
 * Middleware for read-only platform staff access (Platform Admin + Platform Support)
 * Use for GET/HEAD requests that should be accessible to support staff
 * Write operations (POST/PUT/PATCH/DELETE) require Platform Admin
 * 
 * Usage:
 *   router.get('/api/admin/resource', requirePlatformStaffOrAdmin, handler)
 *   router.post('/api/admin/resource', requirePlatformStaffOrAdmin, handler) // Auto-checks for admin on write
 */
export function requirePlatformStaffOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  const method = req.method.toUpperCase();
  
  // Read operations: Allow Platform Staff (Admin + Support + Viewer)
  if (method === 'GET' || method === 'HEAD') {
    if (isPlatformUser(req.user)) {
      return next();
    }
    return res.status(403).json({ 
      error: 'platform_staff_required', 
      message: 'Platform staff access required to view this resource' 
    });
  }
  
  // Write operations: Platform Admin only
  if (!isPlatformAdmin(req.user)) {
    return res.status(403).json({ 
      error: 'platform_admin_required', 
      message: 'Platform administrator access required for write operations' 
    });
  }
  
  next();
}
