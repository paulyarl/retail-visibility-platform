/**
 * Permission Decorators
 * 
 * TypeScript decorators for permission checking at method level.
 * Provides:
 * - @RequireFeature - Feature access control
 * - @RequireLimit - Limit enforcement
 * - @RequireRole - Role-based access
 * - @CheckOverride - Override-aware operations
 * 
 * Usage:
 * ```typescript
 * class ProductService {
 *   @RequireFeature('advancedAnalytics')
 *   async getAdvancedAnalytics(tenantId: string) { ... }
 *   
 *   @RequireLimit('products')
 *   async createProduct(tenantId: string, data: any) { ... }
 * }
 * ```
 */

import { permissionServiceFactory } from './PermissionServiceFactory';

// Permission error class
export class PermissionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

// Decorator context types
interface PermissionContext {
  tenantId?: string;
  userId?: string;
  organizationId?: string;
}

// Extract tenant ID from method arguments
function extractTenantId(args: any[], tenantIdIndex?: number): string | null {
  if (tenantIdIndex !== undefined && args[tenantIdIndex]) {
    return args[tenantIdIndex];
  }
  
  // Try common patterns
  // First argument is often tenantId
  if (typeof args[0] === 'string' && args[0].startsWith('tenant-')) {
    return args[0];
  }
  
  // Check for tenantId in object argument
  if (typeof args[0] === 'object' && args[0]?.tenantId) {
    return args[0].tenantId;
  }
  
  // Check for context object
  if (typeof args[0] === 'object' && args[0]?.context?.tenantId) {
    return args[0].context.tenantId;
  }
  
  return null;
}

// Extract user ID from method arguments
function extractUserId(args: any[]): string | null {
  // Check for userId in object argument
  if (typeof args[0] === 'object' && args[0]?.userId) {
    return args[0].userId;
  }
  
  // Check for context object
  if (typeof args[0] === 'object' && args[0]?.context?.userId) {
    return args[0].context.userId;
  }
  
  return null;
}

// ==========================================
// Feature Decorator
// ==========================================

interface RequireFeatureOptions {
  feature: string;
  tenantIdIndex?: number;
  skipCache?: boolean;
  context?: 'tenant' | 'admin' | 'public';
}

/**
 * Decorator to require a specific feature for method execution
 * 
 * @example
 * class AnalyticsService {
 *   @RequireFeature({ feature: 'advancedAnalytics' })
 *   async getAdvancedReport(tenantId: string) { ... }
 * }
 */
export function RequireFeature(options: RequireFeatureOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tenantId = extractTenantId(args, options.tenantIdIndex);
      const userId = extractUserId(args);
      
      if (!tenantId && !userId) {
        throw new PermissionError(
          'Tenant ID or User ID required for permission check',
          'MISSING_CONTEXT'
        );
      }

      let hasFeature: boolean;
      
      if (options.context === 'admin' && userId) {
        hasFeature = await permissionServiceFactory.hasAdminFeature(userId, options.feature);
      } else if (tenantId) {
        hasFeature = await permissionServiceFactory.hasFeature(tenantId, options.feature);
      } else {
        throw new PermissionError(
          `Cannot check feature '${options.feature}' without context`,
          'MISSING_CONTEXT'
        );
      }

      if (!hasFeature) {
        throw new PermissionError(
          `Feature '${options.feature}' is not available`,
          'FEATURE_DENIED',
          { feature: options.feature, tenantId, userId }
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ==========================================
// Limit Decorator
// ==========================================

interface RequireLimitOptions {
  limitType: string;
  required?: number;
  tenantIdIndex?: number;
  consume?: boolean;
}

/**
 * Decorator to require limit capacity for method execution
 * 
 * @example
 * class ProductService {
 *   @RequireLimit({ limitType: 'products', required: 1, consume: true })
 *   async createProduct(tenantId: string, data: any) { ... }
 * }
 */
export function RequireLimit(options: RequireLimitOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tenantId = extractTenantId(args, options.tenantIdIndex);
      
      if (!tenantId) {
        throw new PermissionError(
          'Tenant ID required for limit check',
          'MISSING_CONTEXT'
        );
      }

      const required = options.required ?? 1;
      const wouldExceed = await permissionServiceFactory.wouldExceedLimit(
        tenantId,
        options.limitType,
        required
      );

      if (wouldExceed) {
        const status = await permissionServiceFactory.getLimitStatus(tenantId, options.limitType);
        throw new PermissionError(
          `Limit exceeded for '${options.limitType}'`,
          'LIMIT_EXCEEDED',
          {
            limitType: options.limitType,
            limit: status.limit,
            current: status.current,
            remaining: status.remaining,
            required
          }
        );
      }

      const result = await originalMethod.apply(this, args);

      // Optionally consume the limit after successful operation
      if (options.consume) {
        const limitsService = permissionServiceFactory.getLimitsService();
        await limitsService.trackUsage(tenantId, options.limitType, required);
      }

      return result;
    };

    return descriptor;
  };
}

// ==========================================
// Role Decorator
// ==========================================

interface RequireRoleOptions {
  role: string | string[];
  userIdIndex?: number;
  organizationIdIndex?: number;
}

/**
 * Decorator to require specific role for method execution
 * 
 * @example
 * class AdminService {
 *   @RequireRole({ role: 'PLATFORM_ADMIN' })
 *   async manageSystem(userId: string) { ... }
 * }
 */
export function RequireRole(options: RequireRoleOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const userId = extractUserId(args);
      
      if (!userId) {
        throw new PermissionError(
          'User ID required for role check',
          'MISSING_CONTEXT'
        );
      }

      const requiredRoles = Array.isArray(options.role) ? options.role : [options.role];
      const adminService = permissionServiceFactory.getAdminService();
      
      // Get user roles
      const permissions = await adminService.getAdminPermissions(userId);
      const hasRole = requiredRoles.some(role => permissions.roles.includes(role as any));

      if (!hasRole) {
        throw new PermissionError(
          `Required role not found. Required: ${requiredRoles.join(' or ')}`,
          'ROLE_DENIED',
          { requiredRoles, userRoles: permissions.roles }
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ==========================================
// Access Decorator
// ==========================================

interface RequireAccessOptions {
  resource: string;
  action: string;
  tenantIdIndex?: number;
  userIdIndex?: number;
}

/**
 * Decorator to require resource access for method execution
 * 
 * @example
 * class TenantService {
 *   @RequireAccess({ resource: 'tenants', action: 'update' })
 *   async updateTenant(userId: string, tenantId: string, data: any) { ... }
 * }
 */
export function RequireAccess(options: RequireAccessOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tenantId = extractTenantId(args, options.tenantIdIndex);
      const userId = extractUserId(args);

      let canAccess: boolean;

      if (userId) {
        canAccess = await permissionServiceFactory.canAdminAccess(
          userId,
          options.resource,
          options.action
        );
      } else if (tenantId) {
        canAccess = await permissionServiceFactory.canAccess(
          tenantId,
          options.resource,
          options.action
        );
      } else {
        throw new PermissionError(
          'User ID or Tenant ID required for access check',
          'MISSING_CONTEXT'
        );
      }

      if (!canAccess) {
        throw new PermissionError(
          `Access denied for '${options.resource}:${options.action}'`,
          'ACCESS_DENIED',
          { resource: options.resource, action: options.action, tenantId, userId }
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ==========================================
// Organization Role Decorator
// ==========================================

interface RequireOrgRoleOptions {
  role: string | string[];
  userIdIndex?: number;
  organizationIdIndex?: number;
}

/**
 * Decorator to require organization role for method execution
 * 
 * @example
 * class OrganizationService {
 *   @RequireOrgRole({ role: 'ORG_ADMIN' })
 *   async manageOrganization(userId: string, organizationId: string) { ... }
 * }
 */
export function RequireOrgRole(options: RequireOrgRoleOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const userId = args[options.userIdIndex ?? 0];
      const organizationId = args[options.organizationIdIndex ?? 1];

      if (!userId || !organizationId) {
        throw new PermissionError(
          'User ID and Organization ID required for organization role check',
          'MISSING_CONTEXT'
        );
      }

      const requiredRoles = Array.isArray(options.role) ? options.role : [options.role];
      const { organizationPermissionContext } = require('./OrganizationPermissionContext');
      
      const userRole = await organizationPermissionContext.getUserRole(userId, organizationId);
      
      if (!userRole || !requiredRoles.includes(userRole)) {
        throw new PermissionError(
          `Organization role required: ${requiredRoles.join(' or ')}`,
          'ORG_ROLE_DENIED',
          { requiredRoles, userRole }
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ==========================================
// Combined Permission Decorator
// ==========================================

interface RequirePermissionsOptions {
  feature?: string;
  limit?: string;
  resource?: string;
  action?: string;
  role?: string | string[];
  tenantIdIndex?: number;
  userIdIndex?: number;
}

/**
 * Decorator combining multiple permission checks
 * 
 * @example
 * class ProductService {
 *   @RequirePermissions({
 *     feature: 'bulkOperations',
 *     limit: 'products',
 *     resource: 'products',
 *     action: 'create'
 *   })
 *   async bulkCreateProducts(tenantId: string, products: any[]) { ... }
 * }
 */
export function RequirePermissions(options: RequirePermissionsOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tenantId = extractTenantId(args, options.tenantIdIndex);
      const userId = extractUserId(args);

      // Check feature
      if (options.feature) {
        const hasFeature = tenantId
          ? await permissionServiceFactory.hasFeature(tenantId, options.feature)
          : userId
          ? await permissionServiceFactory.hasAdminFeature(userId, options.feature)
          : false;

        if (!hasFeature) {
          throw new PermissionError(
            `Feature '${options.feature}' is not available`,
            'FEATURE_DENIED',
            { feature: options.feature }
          );
        }
      }

      // Check limit
      if (options.limit && tenantId) {
        const wouldExceed = await permissionServiceFactory.wouldExceedLimit(tenantId, options.limit);
        if (wouldExceed) {
          throw new PermissionError(
            `Limit exceeded for '${options.limit}'`,
            'LIMIT_EXCEEDED',
            { limitType: options.limit }
          );
        }
      }

      // Check access
      if (options.resource && options.action) {
        const canAccess = userId
          ? await permissionServiceFactory.canAdminAccess(userId, options.resource, options.action)
          : tenantId
          ? await permissionServiceFactory.canAccess(tenantId, options.resource, options.action)
          : false;

        if (!canAccess) {
          throw new PermissionError(
            `Access denied for '${options.resource}:${options.action}'`,
            'ACCESS_DENIED',
            { resource: options.resource, action: options.action }
          );
        }
      }

      // Check role
      if (options.role && userId) {
        const requiredRoles = Array.isArray(options.role) ? options.role : [options.role];
        const adminService = permissionServiceFactory.getAdminService();
        const permissions = await adminService.getAdminPermissions(userId);
        const hasRole = requiredRoles.some(role => permissions.roles.includes(role as any));

        if (!hasRole) {
          throw new PermissionError(
            `Required role not found`,
            'ROLE_DENIED',
            { requiredRoles }
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ==========================================
// Cached Permission Decorator
// ==========================================

/**
 * Decorator to cache permission check results
 * 
 * @example
 * class FeatureService {
 *   @CachedPermission({ ttl: 600 })
 *   async checkFeature(tenantId: string, feature: string) { ... }
 * }
 */
export function CachedPermission(options: { ttl?: number }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { value: any; expires: number }>();

    descriptor.value = async function (...args: any[]) {
      const cacheKey = JSON.stringify(args);
      const cached = cache.get(cacheKey);
      
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }

      const result = await originalMethod.apply(this, args);
      
      cache.set(cacheKey, {
        value: result,
        expires: Date.now() + (options.ttl ?? 300) * 1000
      });

      return result;
    };

    return descriptor;
  };
}

// Export all decorators
export default {
  RequireFeature,
  RequireLimit,
  RequireRole,
  RequireAccess,
  RequireOrgRole,
  RequirePermissions,
  CachedPermission,
  PermissionError
};
