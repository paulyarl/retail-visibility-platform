import { Request, Response, NextFunction } from 'express';
import { JWTPayload, makeBothConventionsAvailable } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platform-admin';
import { user_role } from '@prisma/client';
import { logger } from '../logger';

/**
 * Middleware to authenticate via Auth0 session
 * Migrated from legacy JWT Bearer tokens to Auth0 cookie-based authentication
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
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
    next();
  } catch (error) {
    logger.error('[authenticateToken] Auth0 authentication failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    return res.status(400).json({ error: 'tenantId_required', message: 'Tenant ID is required' });
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
 * Optional authentication - adds user to request if Auth0 session is valid, but doesn't require it
 * Migrated from legacy JWT Bearer tokens to Auth0 cookie-based authentication
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for Auth0 session headers (set by web app from cookies)
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
      }
    }
  } catch (error) {
    // Silently fail - authentication is optional
  }
  next();
};
