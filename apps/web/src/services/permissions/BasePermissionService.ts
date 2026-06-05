/**
 * Base Permission Service
 * 
 * Provides full override system awareness
 * Extended by context-specific services
 */

import { AdminApiSingleton } from '../../providers/base/AdminApiSingleton';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';
import { featureOverridesService, OverrideType } from '../FeatureOverridesService';

export abstract class BasePermissionService extends AdminApiSingleton {
  
  /**
   * Core permission check with override support
   * All permission checks flow through this method
   */
  protected async checkPermissionWithOverride(
    entityId: string,
    overrideType: OverrideType,
    target: string
  ): Promise<boolean> {
    // 1. Check for active override first (highest priority)
    const override = await featureOverridesService.getActiveOverride(
      entityId,
      overrideType,
      target
    );
    
    if (override) {
      return override.status === 'active';
    }
    
    // 2. Delegate to context-specific implementation
    return this.checkBasePermission(entityId, target);
  }
  
  /**
   * Core limit check with override support
   */
  protected async getLimitWithOverride(
    entityId: string,
    overrideType: OverrideType,
    target: string
  ): Promise<number | null> {
    // Check for override first
    const override = await featureOverridesService.getActiveOverride(
      entityId,
      overrideType,
      target
    );
    
    if (override) {
      return this.extractLimitFromOverride(override, overrideType);
    }
    
    // Fall back to base limit
    return this.getBaseLimit(entityId, target);
  }
  
  /**
   * Extract limit value from override based on type
   */
  private extractLimitFromOverride(override: any, overrideType: OverrideType): number {
    switch (overrideType) {
      case 'limits':
      case 'featured_products':
      case 'tenant_limits':
        return override.customLimit;
      default:
        throw new Error(`Override type ${overrideType} does not support limits`);
    }
  }
  
  /**
   * Common cache invalidation for permission changes
   */
  protected async invalidatePermissionCache(entityId: string): Promise<void> {
    const cacheKeys = [
      `permission-${this.getContextType()}-${entityId}`,
      `overrides-${this.getContextType()}-${entityId}`,
      `limits-${this.getContextType()}-${entityId}`
    ];
    
    await Promise.all(
      cacheKeys.map(key => 
        this.invalidateCacheAcrossContexts(key, [AppContext.ADMIN], [CacheIsolation.ADMIN])
      )
    );
  }
  
  /**
   * Abstract methods - implemented by context services
   */
  protected abstract checkBasePermission(entityId: string, target: string): Promise<boolean>;
  protected abstract getBaseLimit(entityId: string, target: string): Promise<number | null>;
  protected abstract getContextType(): 'tenant' | 'organization' | 'user';
  
  /**
   * Public API methods that concrete services will use
   */
  async hasFeature(entityId: string, feature: string): Promise<boolean> {
    return this.checkPermissionWithOverride(entityId, 'feature', feature);
  }
  
  async getLimit(entityId: string, limitType: string): Promise<number | null> {
    return this.getLimitWithOverride(entityId, 'limits', limitType);
  }
  
  async getFeaturedProductLimit(entityId: string, featuredType: string): Promise<number | null> {
    return this.getLimitWithOverride(entityId, 'featured_products', featuredType);
  }
  
  async getTenantLimit(entityId: string): Promise<number | null> {
    return this.getLimitWithOverride(entityId, 'tenant_limits', 'locations');
  }
}
