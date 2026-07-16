/**
 * Permission Middleware
 * 
 * Express middleware for permission checking at API endpoints.
 * Provides:
 * - Feature access checking
 * - Limit enforcement
 * - Role-based access control
 * - Public access validation
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Uses PermissionServiceFactory for zero-import access
 * - Integrates with existing Express middleware chain
 */

import { Request, Response, NextFunction } from 'express';
import { permissionServiceFactory } from './PermissionServiceFactory';
import { logger } from '../../logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      permissions?: {
        tenantId?: string;
        userId?: string;
        clientId?: string;
        context: 'tenant' | 'admin' | 'public';
      };
    }
  }
}

// Middleware options
export interface PermissionMiddlewareOptions {
  feature?: string;
  limit?: string;
  resource?: string;
  action?: string;
  requireAdmin?: boolean;
  requirePlatformAdmin?: boolean;
  skipCache?: boolean;
}

// Error response
interface PermissionErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Create permission denied response
 */
function permissionDenied(
  res: Response, 
  code: string, 
  message: string,
  details?: Record<string, any>
): void {
  const response: PermissionErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
  res.status(403).json(response);
}

/**
 * Extract context from request
 */
function extractContext(req: Request): {
  tenantId?: string;
  userId?: string;
  clientId?: string;
  context: 'tenant' | 'admin' | 'public';
} {
  // Check for authenticated user
  const user = (req as any).user;
  if (user) {
    // Check if admin
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT' || user.role === 'PLATFORM_VIEWER') {
      return {
        userId: user.id,
        context: 'admin'
      };
    }
    
    // Tenant context
    return {
      tenantId: user.tenantId || user.tenant_id,
      userId: user.id,
      context: 'tenant'
    };
  }

  // Public context
  const clientId = req.ip || req.headers['x-forwarded-for']?.toString() || 'anonymous';
  return {
    clientId,
    context: 'public'
  };
}

// ==========================================
// Permission Middleware Functions
// ==========================================

/**
 * Require feature access middleware
 */
export function requireFeature(feature: string, options?: { skipCache?: boolean }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;

      if (context.context === 'admin') {
        // Admin context - check admin feature
        const hasFeature = await permissionServiceFactory.hasAdminFeature(
          context.userId!,
          feature
        );
        if (!hasFeature) {
          return permissionDenied(res, 'FEATURE_DENIED', `Feature '${feature}' is not available for your account`);
        }
        return next();
      }

      if (context.context === 'tenant' && context.tenantId) {
        // Tenant context - check tenant feature
        const hasFeature = await permissionServiceFactory.hasFeature(
          context.tenantId,
          feature
        );
        if (!hasFeature) {
          return permissionDenied(res, 'FEATURE_DENIED', `Feature '${feature}' is not available for your subscription tier`);
        }
        return next();
      }

      // Public context - check public feature
      const hasFeature = await permissionServiceFactory.hasPublicFeature(
        context.clientId!,
        feature
      );
      if (!hasFeature) {
        return permissionDenied(res, 'FEATURE_DENIED', `Feature '${feature}' is not publicly accessible`);
      }
      next();
    } catch (error) {
      logger.error('[PermissionMiddleware] Error checking feature:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check feature permission'
        }
      });
    }
  };
}

/**
 * Require limit capacity middleware
 */
export function requireLimit(limitType: string, required: number = 1) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;

      if (context.context === 'public') {
        return permissionDenied(res, 'LIMIT_DENIED', 'Public access does not support limit operations');
      }

      const tenantId = context.tenantId || (req as any).params?.tenantId;
      if (!tenantId) {
        return permissionDenied(res, 'LIMIT_DENIED', 'Tenant ID required for limit check');
      }

      const wouldExceed = await permissionServiceFactory.wouldExceedLimit(
        tenantId,
        limitType,
        required
      );

      if (wouldExceed) {
        const status = await permissionServiceFactory.getLimitStatus(tenantId, limitType);
        return permissionDenied(
          res, 
          'LIMIT_EXCEEDED', 
          `Limit exceeded for '${limitType}'`,
          {
            limit: status.limit,
            current: status.current,
            remaining: status.remaining,
            required
          }
        );
      }

      next();
    } catch (error) {
      logger.error('[PermissionMiddleware] Error checking limit:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check limit'
        }
      });
    }
  };
}

/**
 * Require resource access middleware
 */
export function requireAccess(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;

      if (context.context === 'admin' && context.userId) {
        const canAccess = await permissionServiceFactory.canAdminAccess(
          context.userId,
          resource,
          action
        );
        if (!canAccess) {
          return permissionDenied(res, 'ACCESS_DENIED', `Access denied for '${resource}:${action}'`);
        }
        return next();
      }

      if (context.context === 'tenant' && context.tenantId) {
        const canAccess = await permissionServiceFactory.canAccess(
          context.tenantId,
          resource,
          action
        );
        if (!canAccess) {
          return permissionDenied(res, 'ACCESS_DENIED', `Access denied for '${resource}:${action}'`);
        }
        return next();
      }

      // Public context
      const canAccess = await permissionServiceFactory.canPublicAccess(
        context.clientId!,
        resource,
        action
      );
      if (!canAccess) {
        return permissionDenied(res, 'ACCESS_DENIED', `Public access denied for '${resource}:${action}'`);
      }
      next();
    } catch (error) {
      logger.error('[PermissionMiddleware] Error checking access:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check access permission'
        }
      });
    }
  };
}

/**
 * Require admin role middleware
 */
export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;

      if (context.context !== 'admin') {
        return permissionDenied(res, 'ADMIN_REQUIRED', 'Admin access required');
      }

      next();
    } catch (error) {
      logger.error('[PermissionMiddleware] Error checking admin:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check admin permission'
        }
      });
    }
  };
}

/**
 * Require platform admin role middleware
 */
export function requirePlatformAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;

      if (context.context !== 'admin' || !context.userId) {
        return permissionDenied(res, 'PLATFORM_ADMIN_REQUIRED', 'Platform admin access required');
      }

      const isPlatformAdmin = await permissionServiceFactory.isPlatformAdmin(context.userId);
      if (!isPlatformAdmin) {
        return permissionDenied(res, 'PLATFORM_ADMIN_REQUIRED', 'Platform admin access required');
      }

      next();
    } catch (error) {
      logger.error('[PermissionMiddleware] Error checking platform admin:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check platform admin permission'
        }
      });
    }
  };
}

/**
 * Require tenant management middleware
 */
export function requireTenantManagement(tenantIdParam: string = 'tenantId') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;

      const targetTenantId = (req as any).params?.[tenantIdParam] || (req as any).body?.tenantId;
      if (!targetTenantId) {
        return permissionDenied(res, 'TENANT_ID_REQUIRED', 'Tenant ID is required');
      }

      if (context.context === 'admin' && context.userId) {
        const canManage = await permissionServiceFactory.canManageTenant(
          context.userId,
          targetTenantId
        );
        if (!canManage) {
          return permissionDenied(res, 'TENANT_MANAGEMENT_DENIED', 'You do not have permission to manage this tenant');
        }
        return next();
      }

      if (context.context === 'tenant' && context.tenantId === targetTenantId) {
        // User is accessing their own tenant
        return next();
      }

      return permissionDenied(res, 'TENANT_MANAGEMENT_DENIED', 'You do not have permission to manage this tenant');
    } catch (error) {
      logger.error('[PermissionMiddleware] Error checking tenant management:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check tenant management permission'
        }
      });
    }
  };
}

/**
 * Combined permission middleware
 */
export function requirePermissions(options: PermissionMiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;

      // Check feature if specified
      if (options.feature) {
        if (context.context === 'admin' && context.userId) {
          const hasFeature = await permissionServiceFactory.hasAdminFeature(context.userId, options.feature);
          if (!hasFeature) {
            return permissionDenied(res, 'FEATURE_DENIED', `Feature '${options.feature}' is not available`);
          }
        } else if (context.context === 'tenant' && context.tenantId) {
          const hasFeature = await permissionServiceFactory.hasFeature(context.tenantId, options.feature);
          if (!hasFeature) {
            return permissionDenied(res, 'FEATURE_DENIED', `Feature '${options.feature}' is not available`);
          }
        }
      }

      // Check limit if specified
      if (options.limit && context.tenantId) {
        const wouldExceed = await permissionServiceFactory.wouldExceedLimit(context.tenantId, options.limit);
        if (wouldExceed) {
          return permissionDenied(res, 'LIMIT_EXCEEDED', `Limit exceeded for '${options.limit}'`);
        }
      }

      // Check access if specified
      if (options.resource && options.action) {
        if (context.context === 'admin' && context.userId) {
          const canAccess = await permissionServiceFactory.canAdminAccess(context.userId, options.resource, options.action);
          if (!canAccess) {
            return permissionDenied(res, 'ACCESS_DENIED', `Access denied for '${options.resource}:${options.action}'`);
          }
        } else if (context.context === 'tenant' && context.tenantId) {
          const canAccess = await permissionServiceFactory.canAccess(context.tenantId, options.resource, options.action);
          if (!canAccess) {
            return permissionDenied(res, 'ACCESS_DENIED', `Access denied for '${options.resource}:${options.action}'`);
          }
        }
      }

      // Check admin requirements
      if (options.requirePlatformAdmin) {
        if (context.context !== 'admin' || !context.userId) {
          return permissionDenied(res, 'PLATFORM_ADMIN_REQUIRED', 'Platform admin access required');
        }
        const isPlatformAdmin = await permissionServiceFactory.isPlatformAdmin(context.userId);
        if (!isPlatformAdmin) {
          return permissionDenied(res, 'PLATFORM_ADMIN_REQUIRED', 'Platform admin access required');
        }
      } else if (options.requireAdmin) {
        if (context.context !== 'admin') {
          return permissionDenied(res, 'ADMIN_REQUIRED', 'Admin access required');
        }
      }

      next();
    } catch (error) {
      logger.error('[PermissionMiddleware] Error checking permissions:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check permissions'
        }
      });
    }
  };
}

/**
 * Optional permission check - adds permission info but doesn't block
 */
export function withPermissions() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = extractContext(req);
      req.permissions = context;
      next();
    } catch (error) {
      logger.error('[PermissionMiddleware] Error extracting permissions:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      next();
    }
  };
}

// Export all middleware functions
export default {
  requireFeature,
  requireLimit,
  requireAccess,
  requireAdmin,
  requirePlatformAdmin,
  requireTenantManagement,
  requirePermissions,
  withPermissions
};
