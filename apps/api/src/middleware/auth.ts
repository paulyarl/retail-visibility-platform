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
// import { prisma } from '../prisma'; // Commented out to avoid circular dependencies
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

// Customer payload interface
export interface CustomerPayload {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

// Extend Express Request type to include user and customer
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      customer?: CustomerPayload;
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
export const makeBothConventionsAvailable = (obj: any): any => {
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
 * Middleware to authenticate via Auth0 session
 * Migrated from legacy JWT Bearer tokens to Auth0 cookie-based authentication
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for Auth0 session headers (set by web app from cookies)
    const auth0Id = req.headers['x-auth0-id'] as string;
    const auth0Email = req.headers['x-auth0-email'] as string || req.cookies?.auth0_email as string;

    if (!auth0Id && !auth0Email) {
      return res.status(401).json({ error: 'authentication_required', message: 'No Auth0 session provided' });
    }

    const { prisma } = await import('../prisma');
    
    let user = null;
    
    // Try by auth0_id first (most reliable)
    if (auth0Id) {
      user = await prisma.users.findUnique({
        where: { auth0_id: auth0Id },
        select: {
          id: true,
          email: true,
          role: true,
          auth0_id: true,
          user_tenants: {
            select: { tenant_id: true }
          }
        }
      });
    }
    
    // Fallback to email lookup
    if (!user && auth0Email) {
      user = await prisma.users.findUnique({
        where: { email: auth0Email.toLowerCase() },
        select: {
          id: true,
          email: true,
          role: true,
          auth0_id: true,
          user_tenants: {
            select: { tenant_id: true }
          }
        }
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'user_not_found', message: 'User not found in platform' });
    }

    // Build JWT-like payload from user data
    const payload: JWTPayload = {
      id: user.id,
      userId: user.id,
      user_id: user.id,
      email: user.email,
      role: user.role as user_role,
      tenantIds: user.user_tenants?.map((ut: any) => ut.tenant_id) || []
    };
    
    req.user = makeBothConventionsAvailable(payload);
    return next();
  } catch (error) {
    console.error('[AUTH] Auth0 authentication failed:', error);
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
 * Supports both JWT tokens and Auth0 session headers
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = authService.verifyAccessToken(token);
      req.user = payload;
      return next();
    }

    // Also check for Auth0 session headers (set by web app from cookies)
    const auth0Id = req.headers['x-auth0-id'] as string;
    const auth0Email = req.headers['x-auth0-email'] as string || req.cookies?.auth0_email as string;

    if (auth0Id || auth0Email) {
      const { prisma } = await import('../prisma');
      
      let user = null;
      
      // Try by auth0_id first (most reliable)
      if (auth0Id) {
        user = await prisma.users.findUnique({
          where: { auth0_id: auth0Id },
          select: {
            id: true,
            email: true,
            role: true,
            auth0_id: true,
            user_tenants: {
              select: { tenant_id: true }
            }
          }
        });
      }
      
      // Fallback to email lookup
      if (!user && auth0Email) {
        user = await prisma.users.findUnique({
          where: { email: auth0Email.toLowerCase() },
          select: {
            id: true,
            email: true,
            role: true,
            auth0_id: true,
            user_tenants: {
              select: { tenant_id: true }
            }
          }
        });
      }

      if (user) {
        const payload: JWTPayload = {
          id: user.id,
          userId: user.id,
          user_id: user.id,
          email: user.email,
          role: user.role as user_role,
          tenantIds: user.user_tenants?.map((ut: any) => ut.tenant_id) || []
        };
        
        req.user = makeBothConventionsAvailable(payload);
        
        // Track session for Auth0 authenticated users
        const { trackSession } = await import('./session-tracker');
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                          req.socket.remoteAddress ||
                          'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const auth0SessionId = req.cookies?.auth0_session || req.cookies?.appSession;
        
        trackSession({
          userId: user.id,
          auth0SessionId,
          ipAddress,
          userAgent,
          userRole: user.role,
          req,
        }).catch(err => {
          console.error('[optionalAuth] Error tracking session:', err);
        });
      }
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
    (req.headers['x-tenant-id'] as string) ||
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
/**
 * Customer authentication middleware
 * Validates JWT Bearer token from customer sessions via CustomerTokenService
 * Resolves to customers table (NOT users table)
 * Sets req.customer for downstream use
 */
export async function authenticateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { CustomerTokenService } = await import('../services/CustomerTokenService');
    const tokenService = CustomerTokenService.getInstance();

    // Try Bearer token first
    const token = CustomerTokenService.extractBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: 'customer_auth_required', message: 'Customer authentication required' });
    }

    const payload = tokenService.verifyAccessToken(token);

    if (!payload || !payload.customerId) {
      return res.status(401).json({ error: 'customer_auth_failed', message: 'Invalid or expired customer token' });
    }

    // Resolve to customers table
    const { prisma } = await import('../prisma');
    const customer = await prisma.customers.findUnique({
      where: { id: payload.customerId },
      select: { id: true, email: true, first_name: true, last_name: true, phone: true }
    });

    if (!customer) {
      return res.status(401).json({ error: 'customer_not_found', message: 'Customer not found' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    console.error('[AUTH] Customer authentication failed:', error);
    return res.status(401).json({ error: 'customer_auth_failed', message: 'Customer authentication failed' });
  }
}

/**
 * Optional customer authentication middleware
 * Attempts to authenticate via customer JWT token but doesn't fail if no token is present
 * Sets req.customer if valid token found, otherwise continues as anonymous
 */
export async function optionalCustomerAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { CustomerTokenService } = await import('../services/CustomerTokenService');
    const tokenService = CustomerTokenService.getInstance();

    // Try Bearer token
    const token = CustomerTokenService.extractBearerToken(req);

    if (!token) {
      return next(); // No token - continue as anonymous
    }

    const payload = tokenService.verifyAccessToken(token);

    if (!payload || !payload.customerId) {
      return next(); // Invalid token - continue as anonymous
    }

    // Resolve to customers table
    const { prisma } = await import('../prisma');
    const customer = await prisma.customers.findUnique({
      where: { id: payload.customerId },
      select: { id: true, email: true, first_name: true, last_name: true, phone: true }
    });

    if (customer) {
      req.customer = customer;
    }
  } catch (error) {
    // Silently fail - authentication is optional
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

  // Get tenant ID from params or header
  const tenantId = req.params.tenantId || req.params.id || (req.headers['x-tenant-id'] as string);
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
