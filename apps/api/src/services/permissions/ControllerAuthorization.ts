/**
 * Controller Authorization Helpers
 * 
 * Provides HTTP-level permission checking for Express controllers.
 * Works alongside the existing PermissionMiddleware for route-level protection.
 * 
 * Usage:
 * ```typescript
 * class ProductController {
 *   async create(req: Request, res: Response) {
 *     const auth = new ControllerAuthorization(req, res);
 *     await auth.requireFeature('apiAccess');
 *     await auth.requireLimit('products', 1);
 *     // ... controller logic
 *   }
 * }
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { permissionServiceFactory } from './PermissionServiceFactory';
import { PermissionError } from './PermissionDecorators';

// Authorization context from request
export interface AuthorizationContext {
  tenantId?: string;
  userId?: string;
  organizationId?: string;
  userRole?: string;
  isAuthenticated: boolean;
}

// Authorization options
export interface AuthorizationOptions {
  requireTenant?: boolean;
  requireUser?: boolean;
  skipCache?: boolean;
}

// Authorization result
export interface AuthorizationResult {
  authorized: boolean;
  context: AuthorizationContext;
  error?: PermissionError;
}

/**
 * Controller Authorization Helper
 * 
 * Provides convenient methods for controller-level permission checking.
 */
export class ControllerAuthorization {
  private context: AuthorizationContext;
  private request: Request;
  private response: Response;

  constructor(request: Request, response: Response) {
    this.request = request;
    this.response = response;
    this.context = this.extractContext();
  }

  // ==========================================
  // Context Extraction
  // ==========================================

  /**
   * Extract authorization context from request
   */
  private extractContext(): AuthorizationContext {
    const user = (this.request as any).user;
    const tenant = (this.request as any).tenant;
    const organization = (this.request as any).organization;

    return {
      tenantId: tenant?.id || this.request.params.tenantId || this.request.body?.tenantId,
      userId: user?.id || (this.request as any).userId,
      organizationId: organization?.id || this.request.params.organizationId,
      userRole: user?.role,
      isAuthenticated: !!user || !!(this.request as any).userId
    };
  }

  /**
   * Get current authorization context
   */
  getContext(): AuthorizationContext {
    return this.context;
  }

  /**
   * Get tenant ID from context
   */
  getTenantId(): string | undefined {
    return this.context.tenantId;
  }

  /**
   * Get user ID from context
   */
  getUserId(): string | undefined {
    return this.context.userId;
  }

  // ==========================================
  // Feature Authorization
  // ==========================================

  /**
   * Require feature to be available
   * Sends 403 response if not available
   */
  async requireFeature(feature: string): Promise<boolean> {
    if (!this.context.tenantId) {
      this.sendUnauthorized('Tenant ID required');
      return false;
    }

    const hasFeature = await permissionServiceFactory.hasFeature(
      this.context.tenantId,
      feature
    );

    if (!hasFeature) {
      this.sendForbidden(`Feature '${feature}' is not available`);
      return false;
    }

    return true;
  }

  /**
   * Check feature availability (non-throwing)
   */
  async checkFeature(feature: string): Promise<AuthorizationResult> {
    if (!this.context.tenantId) {
      return {
        authorized: false,
        context: this.context,
        error: new PermissionError('Tenant ID required', 'MISSING_TENANT')
      };
    }

    const hasFeature = await permissionServiceFactory.hasFeature(
      this.context.tenantId,
      feature
    );

    return {
      authorized: hasFeature,
      context: this.context,
      error: hasFeature ? undefined : new PermissionError(
        `Feature '${feature}' is not available`,
        'FEATURE_DENIED',
        { feature, tenantId: this.context.tenantId }
      )
    };
  }

  // ==========================================
  // Limit Authorization
  // ==========================================

  /**
   * Require limit capacity
   * Sends 403 response if limit exceeded
   */
  async requireLimit(limitType: string, required: number = 1): Promise<boolean> {
    if (!this.context.tenantId) {
      this.sendUnauthorized('Tenant ID required');
      return false;
    }

    const wouldExceed = await permissionServiceFactory.wouldExceedLimit(
      this.context.tenantId,
      limitType,
      required
    );

    if (wouldExceed) {
      const status = await permissionServiceFactory.getLimitStatus(
        this.context.tenantId,
        limitType
      );
      this.sendForbidden(
        `Limit exceeded for '${limitType}'`,
        { limit: status.limit, current: status.current, remaining: status.remaining }
      );
      return false;
    }

    return true;
  }

  /**
   * Check limit capacity (non-throwing)
   */
  async checkLimit(limitType: string, required: number = 1): Promise<AuthorizationResult> {
    if (!this.context.tenantId) {
      return {
        authorized: false,
        context: this.context,
        error: new PermissionError('Tenant ID required', 'MISSING_TENANT')
      };
    }

    const wouldExceed = await permissionServiceFactory.wouldExceedLimit(
      this.context.tenantId,
      limitType,
      required
    );

    const status = await permissionServiceFactory.getLimitStatus(
      this.context.tenantId,
      limitType
    );

    return {
      authorized: !wouldExceed,
      context: this.context,
      error: wouldExceed ? new PermissionError(
        `Limit exceeded for '${limitType}'`,
        'LIMIT_EXCEEDED',
        { limitType, limit: status.limit, current: status.current }
      ) : undefined
    };
  }

  // ==========================================
  // Access Authorization
  // ==========================================

  /**
   * Require resource access
   */
  async requireAccess(resource: string, action: string): Promise<boolean> {
    if (!this.context.tenantId) {
      this.sendUnauthorized('Tenant ID required');
      return false;
    }

    const canAccess = await permissionServiceFactory.canAccess(
      this.context.tenantId,
      resource,
      action
    );

    if (!canAccess) {
      this.sendForbidden(`Access denied for '${resource}:${action}'`);
      return false;
    }

    return true;
  }

  /**
   * Check resource access (non-throwing)
   */
  async checkAccess(resource: string, action: string): Promise<AuthorizationResult> {
    if (!this.context.tenantId) {
      return {
        authorized: false,
        context: this.context,
        error: new PermissionError('Tenant ID required', 'MISSING_TENANT')
      };
    }

    const canAccess = await permissionServiceFactory.canAccess(
      this.context.tenantId,
      resource,
      action
    );

    return {
      authorized: canAccess,
      context: this.context,
      error: canAccess ? undefined : new PermissionError(
        `Access denied for '${resource}:${action}'`,
        'ACCESS_DENIED',
        { resource, action, tenantId: this.context.tenantId }
      )
    };
  }

  // ==========================================
  // Admin Authorization
  // ==========================================

  /**
   * Require admin feature
   */
  async requireAdminFeature(feature: string): Promise<boolean> {
    if (!this.context.userId) {
      this.sendUnauthorized('Authentication required');
      return false;
    }

    const hasFeature = await permissionServiceFactory.hasAdminFeature(
      this.context.userId,
      feature
    );

    if (!hasFeature) {
      this.sendForbidden(`Admin feature '${feature}' is not available`);
      return false;
    }

    return true;
  }

  /**
   * Require platform admin role
   */
  async requirePlatformAdmin(): Promise<boolean> {
    if (!this.context.userId) {
      this.sendUnauthorized('Authentication required');
      return false;
    }

    const isPlatformAdmin = await permissionServiceFactory.isPlatformAdmin(
      this.context.userId
    );

    if (!isPlatformAdmin) {
      this.sendForbidden('Platform admin access required');
      return false;
    }

    return true;
  }

  /**
   * Require tenant management permission
   */
  async requireTenantManagement(): Promise<boolean> {
    if (!this.context.userId || !this.context.tenantId) {
      this.sendUnauthorized('Authentication and tenant required');
      return false;
    }

    const canManage = await permissionServiceFactory.canManageTenant(
      this.context.userId,
      this.context.tenantId
    );

    if (!canManage) {
      this.sendForbidden('Tenant management permission required');
      return false;
    }

    return true;
  }

  // ==========================================
  // Organization Authorization
  // ==========================================

  /**
   * Require organization role
   */
  async requireOrgRole(role: string | string[]): Promise<boolean> {
    if (!this.context.userId || !this.context.organizationId) {
      this.sendUnauthorized('Authentication and organization required');
      return false;
    }

    const { organizationPermissionContext } = require('./OrganizationPermissionContext');
    const userRole = await organizationPermissionContext.getUserRole(
      this.context.userId,
      this.context.organizationId
    );

    const requiredRoles = Array.isArray(role) ? role : [role];
    const hasRole = userRole && requiredRoles.includes(userRole);

    if (!hasRole) {
      this.sendForbidden(`Organization role required: ${requiredRoles.join(' or ')}`);
      return false;
    }

    return true;
  }

  // ==========================================
  // Combined Authorization
  // ==========================================

  /**
   * Require multiple permissions
   */
  async requirePermissions(options: {
    feature?: string;
    limit?: { type: string; required: number };
    access?: { resource: string; action: string };
    adminFeature?: string;
    platformAdmin?: boolean;
  }): Promise<boolean> {
    // Check feature
    if (options.feature) {
      if (!await this.requireFeature(options.feature)) return false;
    }

    // Check limit
    if (options.limit) {
      if (!await this.requireLimit(options.limit.type, options.limit.required)) return false;
    }

    // Check access
    if (options.access) {
      if (!await this.requireAccess(options.access.resource, options.access.action)) return false;
    }

    // Check admin feature
    if (options.adminFeature) {
      if (!await this.requireAdminFeature(options.adminFeature)) return false;
    }

    // Check platform admin
    if (options.platformAdmin) {
      if (!await this.requirePlatformAdmin()) return false;
    }

    return true;
  }

  // ==========================================
  // Response Helpers
  // ==========================================

  /**
   * Send 401 Unauthorized response
   */
  sendUnauthorized(message: string): void {
    this.response.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message
      }
    });
  }

  /**
   * Send 403 Forbidden response
   */
  sendForbidden(message: string, details?: Record<string, any>): void {
    this.response.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
        details
      }
    });
  }

  /**
   * Send 404 Not Found response
   */
  sendNotFound(message: string = 'Resource not found'): void {
    this.response.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message
      }
    });
  }

  /**
   * Send 422 Unprocessable Entity response
   */
  sendUnprocessable(message: string, details?: Record<string, any>): void {
    this.response.status(422).json({
      success: false,
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message,
        details
      }
    });
  }

  /**
   * Send 429 Too Many Requests response
   */
  sendRateLimited(retryAfter: number = 60): void {
    this.response.status(429).set('Retry-After', String(retryAfter)).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        retryAfter
      }
    });
  }
}

// ==========================================
// Decorator-like Helper Functions
// ==========================================

/**
 * Create authorization helper for controller method
 */
export function authorize(request: Request, response: Response): ControllerAuthorization {
  return new ControllerAuthorization(request, response);
}

/**
 * Quick feature check for controller
 */
export async function requireFeature(
  request: Request,
  response: Response,
  feature: string
): Promise<boolean> {
  const auth = new ControllerAuthorization(request, response);
  return auth.requireFeature(feature);
}

/**
 * Quick limit check for controller
 */
export async function requireLimit(
  request: Request,
  response: Response,
  limitType: string,
  required: number = 1
): Promise<boolean> {
  const auth = new ControllerAuthorization(request, response);
  return auth.requireLimit(limitType, required);
}

/**
 * Quick access check for controller
 */
export async function requireAccess(
  request: Request,
  response: Response,
  resource: string,
  action: string
): Promise<boolean> {
  const auth = new ControllerAuthorization(request, response);
  return auth.requireAccess(resource, action);
}

export default ControllerAuthorization;
