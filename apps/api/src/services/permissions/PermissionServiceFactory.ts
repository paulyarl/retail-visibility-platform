/**
 * Permission Service Factory
 * 
 * Layer 4: Service Factory Layer
 * 
 * Provides unified access to permission services with:
 * - Singleton pattern for each service type
 * - Context-aware service selection
 * - Zero-import convenience methods
 * - Backward compatibility
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Follows singleton pattern consistent with platform
 * - Provides factory methods for service access
 * - Integrates with existing service architecture
 */

import { 
  tenantPermissionContext,
  TenantPermissions
} from './TenantPermissionContext';

import {
  adminPermissionContext,
  AdminPermissions
} from './AdminPermissionContext';

import {
  publicPermissionContext,
  PublicPermissions
} from './PublicPermissionContext';

import {
  tenantFeatureService,
  FeatureDefinition,
  FeatureToggle
} from './TenantFeatureService';

import {
  tenantLimitsService,
  LimitDefinition,
  LimitStatus
} from './TenantLimitsService';
import { overrideService } from './OverrideService';

// Permission context types
export type PermissionContext = 'tenant' | 'admin' | 'public';

// Service interfaces for type safety
export interface PermissionServices {
  tenant: typeof tenantPermissionContext;
  admin: typeof adminPermissionContext;
  public: typeof publicPermissionContext;
  features: typeof tenantFeatureService;
  limits: typeof tenantLimitsService;
  override: typeof overrideService;
}

/**
 * Permission Service Factory
 * 
 * Provides unified access to all permission services
 */
class PermissionServiceFactory {
  private static instance: PermissionServiceFactory;
  
  // Service instances
  private services: PermissionServices = {
    tenant: tenantPermissionContext,
    admin: adminPermissionContext,
    public: publicPermissionContext,
    features: tenantFeatureService,
    limits: tenantLimitsService,
    override: overrideService
  };

  // Private constructor for singleton
  private constructor() {
    // Services are already initialized above
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PermissionServiceFactory {
    if (!PermissionServiceFactory.instance) {
      PermissionServiceFactory.instance = new PermissionServiceFactory();
    }
    return PermissionServiceFactory.instance;
  }

  // ==========================================
  // Service Accessors
  // ==========================================

  /**
   * Get tenant permission service
   */
  getTenantService(): typeof tenantPermissionContext {
    return this.services.tenant;
  }

  /**
   * Get admin permission service
   */
  getAdminService(): typeof adminPermissionContext {
    return this.services.admin;
  }

  /**
   * Get public permission service
   */
  getPublicService(): typeof publicPermissionContext {
    return this.services.public;
  }

  /**
   * Get feature service
   */
  getFeatureService(): typeof tenantFeatureService {
    return this.services.features;
  }

  /**
   * Get limits service
   */
  getLimitsService(): typeof tenantLimitsService {
    return this.services.limits;
  }

  /**
   * Get all services
   */
  getAllServices(): PermissionServices {
    return this.services;
  }

  // ==========================================
  // Context-Aware Service Selection
  // ==========================================

  /**
   * Get appropriate service based on context
   */
  getServiceForContext(context: PermissionContext): 
    typeof tenantPermissionContext | typeof adminPermissionContext | typeof publicPermissionContext {
    switch (context) {
      case 'tenant':
        return this.services.tenant;
      case 'admin':
        return this.services.admin;
      case 'public':
        return this.services.public;
      default:
        return this.services.tenant;
    }
  }

  // ==========================================
  // Zero-Import Convenience Methods
  // ==========================================

  // --- Feature Checks ---

  /**
   * Check if tenant has feature
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    return await this.services.tenant.hasFeature(tenantId, feature);
  }

  /**
   * Check if admin has feature
   */
  async hasAdminFeature(userId: string, feature: string): Promise<boolean> {
    return await this.services.admin.hasFeature(userId, feature);
  }

  /**
   * Check if public feature is accessible
   */
  async hasPublicFeature(clientId: string, feature: string): Promise<boolean> {
    return await this.services.public.hasFeature(clientId, feature);
  }

  // --- Limit Checks ---

  /**
   * Get tenant limit
   */
  async getLimit(tenantId: string, limitType: string): Promise<number> {
    return await this.services.limits.getLimit(tenantId, limitType);
  }

  /**
   * Check if limit would be exceeded
   */
  async wouldExceedLimit(
    tenantId: string,
    limitType: string,
    additional?: number
  ): Promise<boolean> {
    return await this.services.limits.wouldExceedLimit(tenantId, limitType, additional);
  }

  /**
   * Get limit status
   */
  async getLimitStatus(tenantId: string, limitType: string): Promise<LimitStatus> {
    return await this.services.limits.getLimitStatus(tenantId, limitType);
  }

  // --- Access Checks ---

  /**
   * Check if tenant can access resource
   */
  async canAccess(
    tenantId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    return await this.services.tenant.canAccess(tenantId, resource, action);
  }

  /**
   * Check if admin can access resource
   */
  async canAdminAccess(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    return await this.services.admin.canAccess(userId, resource, action);
  }

  /**
   * Check if public can access resource
   */
  async canPublicAccess(
    clientId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    return await this.services.public.canAccess(clientId, resource, action);
  }

  // --- Permission Bundles ---

  /**
   * Get all tenant permissions
   */
  async getTenantPermissions(tenantId: string): Promise<TenantPermissions> {
    return await this.services.tenant.getTenantPermissions(tenantId);
  }

  /**
   * Get all admin permissions
   */
  async getAdminPermissions(userId: string): Promise<AdminPermissions> {
    return await this.services.admin.getAdminPermissions(userId);
  }

  /**
   * Get all public permissions
   */
  async getPublicPermissions(clientId: string): Promise<PublicPermissions> {
    return await this.services.public.getPublicPermissions(clientId);
  }

  // --- Convenience Methods ---

  /**
   * Check if can add product
   */
  async canAddProduct(tenantId: string): Promise<boolean> {
    return await this.services.limits.canAddProduct(tenantId);
  }

  /**
   * Check if can add location
   */
  async canAddLocation(tenantId: string): Promise<boolean> {
    return await this.services.limits.canAddLocation(tenantId);
  }

  // --- Override Management ---

  /**
   * Get override service
   */
  getOverrideService() {
    return this.services.override;
  }

  /**
   * Grant an override
   */
  async grantOverride(input: import('./OverrideService').GrantOverrideInput) {
    return await this.services.override.grantOverride(input);
  }

  /**
   * Revoke an override
   */
  async revokeOverride(tenantId: string, feature: string, revokedBy: string, reason?: string) {
    return await this.services.override.revokeOverride(tenantId, feature, revokedBy, reason);
  }

  /**
   * Check if tenant has active override
   */
  async hasActiveOverride(tenantId: string, feature: string): Promise<boolean> {
    return await this.services.override.hasActiveOverride(tenantId, feature);
  }

  /**
   * Get tenant overrides
   */
  async getTenantOverrides(tenantId: string) {
    return await this.services.override.getTenantOverrides(tenantId);
  }

  /**
   * Get active overrides
   */
  async getActiveOverrides(tenantId: string) {
    return await this.services.override.getActiveOverrides(tenantId);
  }

  /**
   * Extend override expiration
   */
  async extendOverride(tenantId: string, feature: string, newExpiresAt: Date) {
    return await this.services.override.extendOverride(tenantId, feature, newExpiresAt);
  }

  /**
   * Check if can add user
   */
  async canAddUser(tenantId: string): Promise<boolean> {
    return await this.services.limits.canAddUser(tenantId);
  }

  /**
   * Check if can feature product
   */
  async canFeatureProduct(tenantId: string): Promise<boolean> {
    return await this.services.limits.canFeatureProduct(tenantId);
  }

  /**
   * Check if is platform admin
   */
  async isPlatformAdmin(userId: string): Promise<boolean> {
    return await this.services.admin.isPlatformAdmin(userId);
  }

  /**
   * Check if can manage tenant
   */
  async canManageTenant(userId: string, tenantId: string): Promise<boolean> {
    return await this.services.admin.canManageTenant(userId, tenantId);
  }

  // --- Cache Management ---

  /**
   * Invalidate tenant cache
   */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    await this.services.tenant.invalidateTenantCache(tenantId);
  }

  /**
   * Clear all permission caches
   */
  async clearAllCaches(): Promise<void> {
    await this.services.tenant.clearAllPermissionCache();
    await this.services.admin.clearAllPermissionCache();
    await this.services.public.clearAllPermissionCache();
  }

  // --- Metrics ---

  /**
   * Get metrics from all services
   */
  getMetrics(): Record<string, any> {
    return {
      tenant: this.services.tenant.getMetrics(),
      admin: this.services.admin.getMetrics(),
      public: this.services.public.getMetrics(),
      features: this.services.features.getMetrics(),
      limits: this.services.limits.getMetrics()
    };
  }
}

// Export singleton instance
export const permissionServiceFactory = PermissionServiceFactory.getInstance();
export default PermissionServiceFactory;

// Also export individual services for direct access
export {
  tenantPermissionContext,
  adminPermissionContext,
  publicPermissionContext,
  tenantFeatureService,
  tenantLimitsService
};
