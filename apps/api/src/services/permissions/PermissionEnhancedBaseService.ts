/**
 * Permission-Enhanced Base Service
 * 
 * Provides common permission methods that all services can inherit.
 * This follows the zero-import pattern using PermissionServiceFactory.
 * 
 * Usage:
 * ```typescript
 * class MyService extends PermissionEnhancedBaseService {
 *   async myMethod(tenantId: string) {
 *     await this.requireFeature(tenantId, 'myFeature');
 *     await this.requireLimit(tenantId, 'myLimit', 1);
 *     // ... business logic
 *   }
 * }
 * ```
 */

import { permissionServiceFactory } from './PermissionServiceFactory';
import { PermissionError } from './PermissionDecorators';

// Permission check options
export interface PermissionCheckOptions {
  skipCache?: boolean;
  throwOnError?: boolean;
}

// Permission result
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  details?: Record<string, any>;
}

/**
 * Permission-Enhanced Base Service
 * 
 * Abstract base class providing permission methods for all services.
 * Services can extend this to inherit permission checking capabilities.
 */
export abstract class PermissionEnhancedBaseService {
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  // ==========================================
  // Feature Checking
  // ==========================================

  /**
   * Require a feature to be available
   * Throws PermissionError if feature is not available
   */
  protected async requireFeature(
    tenantId: string,
    feature: string,
    options?: PermissionCheckOptions
  ): Promise<void> {
    const hasFeature = await permissionServiceFactory.hasFeature(tenantId, feature);
    
    if (!hasFeature) {
      throw new PermissionError(
        `Feature '${feature}' is not available for tenant`,
        'FEATURE_DENIED',
        { feature, tenantId, serviceName: this.serviceName }
      );
    }
  }

  /**
   * Check if feature is available (non-throwing)
   */
  protected async checkFeature(
    tenantId: string,
    feature: string,
    options?: PermissionCheckOptions
  ): Promise<PermissionCheckResult> {
    const hasFeature = await permissionServiceFactory.hasFeature(tenantId, feature);
    
    return {
      allowed: hasFeature,
      reason: hasFeature ? undefined : `Feature '${feature}' is not available`,
      details: { feature, tenantId }
    };
  }

  /**
   * Check multiple features at once
   */
  protected async checkFeatures(
    tenantId: string,
    features: string[],
    options?: { requireAll?: boolean }
  ): Promise<PermissionCheckResult> {
    const results = await Promise.all(
      features.map(f => permissionServiceFactory.hasFeature(tenantId, f))
    );

    const requireAll = options?.requireAll ?? true;
    const hasAll = results.every(r => r);
    const hasAny = results.some(r => r);

    const allowed = requireAll ? hasAll : hasAny;
    const missingFeatures = features.filter((_, i) => !results[i]);

    return {
      allowed,
      reason: allowed ? undefined : `Missing features: ${missingFeatures.join(', ')}`,
      details: { features, results, missingFeatures }
    };
  }

  // ==========================================
  // Limit Checking
  // ==========================================

  /**
   * Require limit capacity
   * Throws PermissionError if limit would be exceeded
   */
  protected async requireLimit(
    tenantId: string,
    limitType: string,
    required: number = 1,
    options?: PermissionCheckOptions
  ): Promise<void> {
    const wouldExceed = await permissionServiceFactory.wouldExceedLimit(
      tenantId,
      limitType,
      required
    );

    if (wouldExceed) {
      const status = await permissionServiceFactory.getLimitStatus(tenantId, limitType);
      throw new PermissionError(
        `Limit exceeded for '${limitType}'`,
        'LIMIT_EXCEEDED',
        {
          limitType,
          limit: status.limit,
          current: status.current,
          remaining: status.remaining,
          required,
          serviceName: this.serviceName
        }
      );
    }
  }

  /**
   * Check limit capacity (non-throwing)
   */
  protected async checkLimit(
    tenantId: string,
    limitType: string,
    required: number = 1
  ): Promise<PermissionCheckResult> {
    const wouldExceed = await permissionServiceFactory.wouldExceedLimit(
      tenantId,
      limitType,
      required
    );

    const status = await permissionServiceFactory.getLimitStatus(tenantId, limitType);

    return {
      allowed: !wouldExceed,
      reason: wouldExceed
        ? `Limit exceeded for '${limitType}'. Current: ${status.current}, Limit: ${status.limit}`
        : undefined,
      details: {
        limitType,
        limit: status.limit,
        current: status.current,
        remaining: status.remaining,
        required,
        unlimited: status.unlimited
      }
    };
  }

  /**
   * Track limit usage
   */
  protected async trackLimitUsage(
    tenantId: string,
    limitType: string,
    amount: number = 1
  ): Promise<void> {
    const limitsService = permissionServiceFactory.getLimitsService();
    await limitsService.trackUsage(tenantId, limitType, amount);
  }

  // ==========================================
  // Access Checking
  // ==========================================

  /**
   * Require resource access
   * Throws PermissionError if access is denied
   */
  protected async requireAccess(
    tenantId: string,
    resource: string,
    action: string,
    options?: PermissionCheckOptions
  ): Promise<void> {
    const canAccess = await permissionServiceFactory.canAccess(tenantId, resource, action);

    if (!canAccess) {
      throw new PermissionError(
        `Access denied for '${resource}:${action}'`,
        'ACCESS_DENIED',
        { resource, action, tenantId, serviceName: this.serviceName }
      );
    }
  }

  /**
   * Check resource access (non-throwing)
   */
  protected async checkAccess(
    tenantId: string,
    resource: string,
    action: string
  ): Promise<PermissionCheckResult> {
    const canAccess = await permissionServiceFactory.canAccess(tenantId, resource, action);

    return {
      allowed: canAccess,
      reason: canAccess ? undefined : `Access denied for '${resource}:${action}'`,
      details: { resource, action, tenantId }
    };
  }

  // ==========================================
  // Admin Permission Checking
  // ==========================================

  /**
   * Require admin feature
   */
  protected async requireAdminFeature(
    userId: string,
    feature: string
  ): Promise<void> {
    const hasFeature = await permissionServiceFactory.hasAdminFeature(userId, feature);

    if (!hasFeature) {
      throw new PermissionError(
        `Admin feature '${feature}' is not available`,
        'ADMIN_FEATURE_DENIED',
        { feature, userId, serviceName: this.serviceName }
      );
    }
  }

  /**
   * Require platform admin role
   */
  protected async requirePlatformAdmin(userId: string): Promise<void> {
    const isPlatformAdmin = await permissionServiceFactory.isPlatformAdmin(userId);

    if (!isPlatformAdmin) {
      throw new PermissionError(
        'Platform admin access required',
        'PLATFORM_ADMIN_REQUIRED',
        { userId, serviceName: this.serviceName }
      );
    }
  }

  /**
   * Require tenant management permission
   */
  protected async requireTenantManagement(userId: string, tenantId: string): Promise<void> {
    const canManage = await permissionServiceFactory.canManageTenant(userId, tenantId);

    if (!canManage) {
      throw new PermissionError(
        `Cannot manage tenant '${tenantId}'`,
        'TENANT_MANAGEMENT_DENIED',
        { userId, tenantId, serviceName: this.serviceName }
      );
    }
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  /**
   * Check if can add products
   */
  protected async canAddProducts(tenantId: string, count: number = 1): Promise<boolean> {
    return !(await permissionServiceFactory.wouldExceedLimit(tenantId, 'products', count));
  }

  /**
   * Check if can add locations
   */
  protected async canAddLocations(tenantId: string, count: number = 1): Promise<boolean> {
    return !(await permissionServiceFactory.wouldExceedLimit(tenantId, 'locations', count));
  }

  /**
   * Check if can add users
   */
  protected async canAddUsers(tenantId: string, count: number = 1): Promise<boolean> {
    return !(await permissionServiceFactory.wouldExceedLimit(tenantId, 'users', count));
  }

  /**
   * Get all limit statuses for a tenant
   */
  protected async getLimitStatuses(tenantId: string): Promise<Record<string, any>> {
    const limitsService = permissionServiceFactory.getLimitsService();
    return await limitsService.getAllLimitsStatus(tenantId);
  }

  /**
   * Get all features for a tenant
   */
  protected async getFeatures(tenantId: string): Promise<Record<string, boolean>> {
    const featureService = permissionServiceFactory.getFeatureService();
    return await featureService.getAllFeatures(tenantId);
  }

  /**
   * Invalidate permission cache for tenant
   */
  protected async invalidatePermissionCache(tenantId: string): Promise<void> {
    await permissionServiceFactory.invalidateTenantCache(tenantId);
  }

  // ==========================================
  // Logging Helpers
  // ==========================================

  /**
   * Log permission check
   */
  protected logPermissionCheck(
    context: string,
    permission: string,
    result: boolean,
    duration: number
  ): void {
    console.log(
      `[${this.serviceName}] Permission check: ${context}:${permission} = ${result} (${duration}ms)`
    );
  }

  /**
   * Log permission error
   */
  protected logPermissionError(error: PermissionError): void {
    console.error(
      `[${this.serviceName}] Permission error: ${error.code} - ${error.message}`,
      error.details
    );
  }
}

export default PermissionEnhancedBaseService;
