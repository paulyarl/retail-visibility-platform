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
import { prisma } from '../prisma';
import * as jwt from 'jsonwebtoken';
import { user_tenant_role, user_role } from '@prisma/client';
import { isPlatformUser, isPlatformAdmin } from '../utils/platform-admin';
import { authService } from '../auth/auth.service';

// JWT Payload interface
// Note: Universal transform middleware makes both userId and userId available
export interface JWTPayload {
  id: string | undefined;
  userId?: string; // Added by universal transform middleware
  user_id?: string; // JWT token contains this
  email: string;
  role: user_role;
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
 * Convert camelCase to snake_case
 */
const toSnake = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * Convert snake_case to camelCase
 */
const toCamel = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Transform object to have BOTH naming conventions
 */
const makeBothConventionsAvailable = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(makeBothConventionsAvailable);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const enhanced: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnake(key);
      const camelKey = toCamel(key);
      
      // Add the original key
      enhanced[key] = makeBothConventionsAvailable(value);
      
      // Add snake_case version if different
      if (snakeKey !== key) {
        enhanced[snakeKey] = makeBothConventionsAvailable(value);
      }
      
      // Add camelCase version if different
      if (camelKey !== key) {
        enhanced[camelKey] = makeBothConventionsAvailable(value);
      }
    }
    
    return enhanced;
  }
  
  return obj;
};

/**
 * Middleware to authenticate JWT token
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('[AUTH] authenticateToken called for:', req.method, req.path, 'Token present:', !!token);

    if (!token) {
      console.log('[AUTH] No token provided');
      return res.status(401).json({ error: 'authentication_required', message: 'No token provided' });
    }

    //console.log('[AUTH] JWT verification attempted for token:', token.substring(0, 20) + '...');
    const payload = authService.verifyAccessToken(token);
    //console.log('[AUTH] Token verified successfully, payload:', { userId: payload.userId, user_id: payload.user_id, email: payload.email, role: payload.role });
    
    // Check if the session has been revoked in the database
    const userId = payload.userId || payload.user_id;
    if (userId) {
      try {
        const session = await prisma.$queryRaw<any[]>`
          SELECT id FROM user_sessions
          WHERE user_id = ${userId}
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1
        `;

        if (!session || session.length === 0) {
          console.log('[AUTH] Session revoked or expired for user:', userId);
          return res.status(401).json({ error: 'session_revoked', message: 'Your session has been revoked' });
        }
      } catch (error) {
        console.error('[AUTH] Error checking session status:', error);
        // If database check fails, allow request to proceed (fail open for availability)
      }
    }
    
    // Apply universal transform to JWT payload to ensure both naming conventions
    const transformedPayload = makeBothConventionsAvailable(payload);
    //console.log('[AUTH] Payload transformed, setting req.user');
    
    req.user = transformedPayload;
    //console.log('[AUTH] req.user set successfully, calling next()');
    //console.log('[AUTH] About to call next() for route:', req.method, req.path);
    next();
    //console.log('[AUTH] next() called successfully - should proceed to next middleware');
  } catch (error) {
    console.error('[AUTH] Exception in authenticateToken:', error);
    if (error instanceof Error) {
      console.error('[AUTH] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });
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
export function authorize(...roles: user_role[]) {
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
export async function checkTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication_required', message: 'Not authenticated' });
  }

  // Ensure userId is present (should be added by universal transform middleware)
  if (!req.user.userId && !req.user.user_id) {
    return res.status(401).json({ error: 'authentication_required', message: 'Invalid authentication data' });
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

  // First, check JWT tenantIds array
  if (req.user.tenantIds.includes(tenantId as string)) {
    return next();
  }

  // Fallback: if tenantIds array is empty or does not include this tenant,
  // verify membership via userTenant table so owners/members are not blocked
  try {
    const { prisma } = await import('../prisma');
    const userId = req.user.userId || req.user.user_id;
    const userTenant = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: userId!, // Now guaranteed to be string
          tenant_id: tenantId as string,
        },
      },
      select: { id: true },
    });

    if (userTenant) {
      return next();
    }
  } catch (error) {
    console.error('[checkTenantAccess] Error checking tenant membership:', error);
  }

  return res.status(403).json({ 
    error: 'tenant_access_denied', 
    message: 'You do not have access to this tenant' 
  });
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
    req.params?.tenantId ||
    req.params?.id ||
    (req.query?.tenantId as string) ||
    (req.query?.tenant_id as string) ||
    req.body?.tenantId ||
    req.body?.tenant_id ||
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
      error: 'tenantId_required', 
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

  // Ensure userId is present (should be added by universal transform middleware)
  if (!req.user.userId && !req.user.user_id) {
    return res.status(401).json({ error: 'authentication_required', message: 'Invalid authentication data' });
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
    const userId = req.user.userId || req.user.user_id;
    const userTenant = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: userId!, // Now guaranteed to be string
          tenant_id: tenantId as string,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!userTenant) {
      return res.status(403).json({ 
        error: 'tenant_access_denied', 
        message: 'You do not have access to this tenant' 
      });
    }

    // Must be OWNER or ADMIN role within the tenant to manage settings
    if (userTenant.role !== user_tenant_role.OWNER && userTenant.role !== user_tenant_role.ADMIN) {
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

/**
 * Middleware to check if user is tenant admin/owner
 * Used for tenant-level operations like propagation
 * Platform admins bypass this check
 */
export async function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'authentication_required',
      message: 'Not authenticated' 
    });
  }

  // Ensure userId is present (should be added by universal transform middleware)
  if (!req.user.userId && !req.user.user_id) {
    return res.status(401).json({ error: 'authentication_required', message: 'Invalid authentication data' });
  }

  // Platform admins can always access
  if (isPlatformAdmin(req.user)) {
    return next();
  }

  // Get tenant ID from params
  const tenantId = req.params.tenantId || req.params.id;
  if (!tenantId) {
    return res.status(400).json({
      error: 'tenantId_required',
      message: 'Tenant ID is required'
    });
  }

  // Import prisma here to avoid circular dependencies
  const { prisma } = await import('../prisma');
  
  // Check if user is OWNER or ADMIN of this tenant
  const userId = req.user.userId || req.user.user_id;
  const userTenant = await prisma.user_tenants.findUnique({
    where: {
      user_id_tenant_id: {
        user_id: userId!, // Now guaranteed to be string
        tenant_id: tenantId
      }
    },
    select: {
      role: true
    }
  });

  if (!userTenant || (userTenant.role !== user_tenant_role.OWNER && userTenant.role !== user_tenant_role.ADMIN)) {
    return res.status(403).json({
      error: 'tenant_admin_required',
      message: 'Tenant owner or administrator access required for this operation',
      requiredRole: 'OWNER or ADMIN',
      userRole: userTenant?.role || 'none'
    });
  }

  next();
}
