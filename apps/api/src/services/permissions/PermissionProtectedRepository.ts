/**
 * Permission-Protected Repository Base
 * 
 * Provides repository-level permission enforcement for data access.
 * This adds an additional security layer before database operations.
 * 
 * Usage:
 * ```typescript
 * class ProductRepository extends PermissionProtectedRepository {
 *   async create(tenantId: string, data: any) {
 *     await this.enforceLimit(tenantId, 'products', 1);
 *     // ... database operation
 *   }
 * }
 * ```
 */

import { permissionServiceFactory } from './PermissionServiceFactory';
import { PermissionError } from './PermissionDecorators';
import { logger } from '../../logger';

// Repository operation types
export type RepositoryOperation = 'create' | 'read' | 'update' | 'delete' | 'list';

// Repository context
export interface RepositoryContext {
  tenantId: string;
  userId?: string;
  operation: RepositoryOperation;
  resource: string;
}

// Permission enforcement options
export interface EnforcementOptions {
  skipCache?: boolean;
  softEnforcement?: boolean; // Log but don't throw
}

/**
 * Permission-Protected Repository Base
 * 
 * Abstract base class for repositories with built-in permission enforcement.
 */
export abstract class PermissionProtectedRepository {
  protected resourceName: string;
  protected prisma: any;

  constructor(resourceName: string, prisma?: any) {
    this.resourceName = resourceName;
    this.prisma = prisma;
  }

  // ==========================================
  // Core Permission Enforcement
  // ==========================================

  /**
   * Enforce feature availability
   */
  protected async enforceFeature(
    tenantId: string,
    feature: string,
    options?: EnforcementOptions
  ): Promise<void> {
    try {
      const hasFeature = await permissionServiceFactory.hasFeature(tenantId, feature);
      
      if (!hasFeature) {
        const error = new PermissionError(
          `Feature '${feature}' required for ${this.resourceName} operation`,
          'FEATURE_REQUIRED',
          { feature, resource: this.resourceName, tenantId }
        );

        if (options?.softEnforcement) {
          console.warn(`[PermissionProtectedRepository] Soft enforcement: ${error.message}`);
          return;
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof PermissionError) throw error;
      logger.error(`[PermissionProtectedRepository] Error enforcing feature:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw new PermissionError(
        'Permission check failed',
        'PERMISSION_CHECK_FAILED',
        { feature, resource: this.resourceName }
      );
    }
  }

  /**
   * Enforce limit capacity
   */
  protected async enforceLimit(
    tenantId: string,
    limitType: string,
    required: number = 1,
    options?: EnforcementOptions
  ): Promise<void> {
    try {
      const wouldExceed = await permissionServiceFactory.wouldExceedLimit(
        tenantId,
        limitType,
        required
      );

      if (wouldExceed) {
        const status = await permissionServiceFactory.getLimitStatus(tenantId, limitType);
        const error = new PermissionError(
          `Limit exceeded for '${limitType}' in ${this.resourceName}`,
          'LIMIT_EXCEEDED',
          {
            limitType,
            resource: this.resourceName,
            limit: status.limit,
            current: status.current,
            remaining: status.remaining,
            required
          }
        );

        if (options?.softEnforcement) {
          console.warn(`[PermissionProtectedRepository] Soft enforcement: ${error.message}`);
          return;
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof PermissionError) throw error;
      logger.error(`[PermissionProtectedRepository] Error enforcing limit:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw new PermissionError(
        'Permission check failed',
        'PERMISSION_CHECK_FAILED',
        { limitType, resource: this.resourceName }
      );
    }
  }

  /**
   * Enforce resource access
   */
  protected async enforceAccess(
    tenantId: string,
    action: RepositoryOperation,
    options?: EnforcementOptions
  ): Promise<void> {
    try {
      const canAccess = await permissionServiceFactory.canAccess(
        tenantId,
        this.resourceName,
        action
      );

      if (!canAccess) {
        const error = new PermissionError(
          `Access denied for ${this.resourceName}:${action}`,
          'ACCESS_DENIED',
          { resource: this.resourceName, action, tenantId }
        );

        if (options?.softEnforcement) {
          console.warn(`[PermissionProtectedRepository] Soft enforcement: ${error.message}`);
          return;
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof PermissionError) throw error;
      logger.error(`[PermissionProtectedRepository] Error enforcing access:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw new PermissionError(
        'Permission check failed',
        'PERMISSION_CHECK_FAILED',
        { resource: this.resourceName, action }
      );
    }
  }

  // ==========================================
  // Convenience Enforcement Methods
  // ==========================================

  /**
   * Enforce create permission (limit + access)
   */
  protected async enforceCreate(
    tenantId: string,
    limitType?: string,
    count: number = 1
  ): Promise<void> {
    await this.enforceAccess(tenantId, 'create');
    if (limitType) {
      await this.enforceLimit(tenantId, limitType, count);
    }
  }

  /**
   * Enforce read permission
   */
  protected async enforceRead(tenantId: string): Promise<void> {
    await this.enforceAccess(tenantId, 'read');
  }

  /**
   * Enforce update permission
   */
  protected async enforceUpdate(tenantId: string): Promise<void> {
    await this.enforceAccess(tenantId, 'update');
  }

  /**
   * Enforce delete permission
   */
  protected async enforceDelete(
    tenantId: string,
    limitType?: string
  ): Promise<void> {
    await this.enforceAccess(tenantId, 'delete');
    // Note: Deleting should free up limit capacity
  }

  /**
   * Enforce list permission
   */
  protected async enforceList(tenantId: string): Promise<void> {
    await this.enforceAccess(tenantId, 'list');
  }

  // ==========================================
  // Usage Tracking
  // ==========================================

  /**
   * Track usage after successful operation
   */
  protected async trackUsage(
    tenantId: string,
    limitType: string,
    amount: number = 1
  ): Promise<void> {
    const limitsService = permissionServiceFactory.getLimitsService();
    await limitsService.trackUsage(tenantId, limitType, amount);
  }

  /**
   * Release usage after delete operation
   */
  protected async releaseUsage(
    tenantId: string,
    limitType: string,
    amount: number = 1
  ): Promise<void> {
    const limitsService = permissionServiceFactory.getLimitsService();
    await limitsService.trackUsage(tenantId, limitType, -amount);
  }

  // ==========================================
  // Query Helpers
  // ==========================================

  /**
   * Create tenant-scoped query
   */
  protected createTenantQuery(tenantId: string): { tenant_id: string } {
    return { tenant_id: tenantId };
  }

  /**
   * Create tenant-scoped select with permission check
   */
  protected async createPermissionAwareSelect<T>(
    tenantId: string,
    selectFields: T,
    options?: { requireRead?: boolean }
  ): Promise<T & { tenant_id: boolean }> {
    if (options?.requireRead !== false) {
      await this.enforceRead(tenantId);
    }

    return {
      ...selectFields,
      tenant_id: true
    } as T & { tenant_id: boolean };
  }

  // ==========================================
  // Logging
  // ==========================================

  /**
   * Log repository operation
   */
  protected logOperation(
    operation: RepositoryOperation,
    tenantId: string,
    details?: Record<string, any>
  ): void {
    console.log(
      `[${this.resourceName}Repository] ${operation} operation for tenant: ${tenantId}`,
      details || ''
    );
  }

  /**
   * Log permission enforcement
   */
  protected logEnforcement(
    type: 'feature' | 'limit' | 'access',
    result: boolean,
    details: Record<string, any>
  ): void {
    console.log(
      `[${this.resourceName}Repository] Enforcement: ${type} = ${result}`,
      details
    );
  }
}

export default PermissionProtectedRepository;
