/**
 * Tenant Permission Context
 * 
 * Layer 4: Context Permission Layer
 * 
 * Provides tenant-specific permission checking with:
 * - Tier-based permission evaluation
 * - Override-first logic integration
 * - Tenant data integration
 * - Context-specific optimizations
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Extends BasePermissionService (which extends UniversalSingleton)
 * - Follows singleton pattern with getInstance()
 * - Integrates with TenantSingletonService and TierSingletonService
 */

import { BasePermissionService, PermissionResult, FeaturePermission, LimitPermission, AccessPermission, PermissionCheckOptions, PermissionCacheEntry } from './BasePermissionService';
import { SingletonCacheOptions } from '../../lib/UniversalSingleton';

// Tier features configuration
export interface TierFeatures {
  basicAnalytics: boolean;
  advancedAnalytics: boolean;
  customBranding: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  bulkOperations: boolean;
  customIntegrations: boolean;
  whiteLabel: boolean;
}

// Tier limits configuration
export interface TierLimits {
  products: number;
  locations: number;
  users: number;
  storage: number; // MB
  apiCallsPerMonth: number;
  featuredProducts: number;
}

// Tenant permissions result
export interface TenantPermissions {
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

// Cache options for tenant permission context
const TENANT_PERMISSION_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 5000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'authenticated'
};

/**
 * Tenant Permission Context Service
 * 
 * Singleton service for tenant-specific permission checking
 */
class TenantPermissionContext extends BasePermissionService {
  private static instance: TenantPermissionContext;

  // Tier feature definitions by subscription tier
  private tierFeatures: Record<string, TierFeatures> = {
    'starter': {
      basicAnalytics: true,
      advancedAnalytics: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: false,
      bulkOperations: false,
      customIntegrations: false,
      whiteLabel: false
    },
    'professional': {
      basicAnalytics: true,
      advancedAnalytics: true,
      customBranding: true,
      prioritySupport: false,
      apiAccess: true,
      bulkOperations: true,
      customIntegrations: false,
      whiteLabel: false
    },
    'enterprise': {
      basicAnalytics: true,
      advancedAnalytics: true,
      customBranding: true,
      prioritySupport: true,
      apiAccess: true,
      bulkOperations: true,
      customIntegrations: true,
      whiteLabel: true
    }
  };

  // Tier limit definitions by subscription tier
  private tierLimits: Record<string, TierLimits> = {
    'starter': {
      products: 100,
      locations: 1,
      users: 1,
      storage: 500, // MB
      apiCallsPerMonth: 1000,
      featuredProducts: 5
    },
    'professional': {
      products: 1000,
      locations: 5,
      users: 10,
      storage: 5000, // MB
      apiCallsPerMonth: 10000,
      featuredProducts: 20
    },
    'enterprise': {
      products: -1, // Unlimited
      locations: -1, // Unlimited
      users: -1, // Unlimited
      storage: -1, // Unlimited
      apiCallsPerMonth: -1, // Unlimited
      featuredProducts: 100
    }
  };

  constructor() {
    super('TenantPermissionContext', TENANT_PERMISSION_CACHE_OPTIONS);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TenantPermissionContext {
    if (!TenantPermissionContext.instance) {
      TenantPermissionContext.instance = new TenantPermissionContext();
    }
    return TenantPermissionContext.instance;
  }

  // ==========================================
  // Abstract Method Implementations
  // ==========================================

  /**
   * Check if a tenant has access to a specific feature
   */
  async hasFeature(tenantId: string, feature: string, options?: PermissionCheckOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Check cache first (unless skipCache is true)
      if (!options?.skipCache) {
        const cached = await this.getCachedPermission(tenantId, 'feature', feature);
        if (cached) {
          this.logPermissionCheck(tenantId, 'feature', feature, cached.granted, cached.source, Date.now() - startTime);
          return cached.granted;
        }
      }

      // Apply override-first logic
      const result = await this.applyOverrideLogic<boolean>(
        tenantId,
        'feature',
        feature,
        async () => {
          // Fall back to tier-based feature check
          return await this.checkTierFeature(tenantId, feature);
        }
      );

      // Cache the result
      const cacheEntry: PermissionCacheEntry = {
        granted: result.value,
        source: result.source,
        timestamp: Date.now(),
        ttl: this.defaultTTL
      };
      await this.setCachedPermission(tenantId, 'feature', feature, cacheEntry);

      this.logPermissionCheck(tenantId, 'feature', feature, result.value, result.source, Date.now() - startTime);
      return result.value;
    } catch (error) {
      this.handlePermissionError(tenantId, 'feature', feature, error);
    }
  }

  /**
   * Get the limit value for a specific limit type
   */
  async getLimit(tenantId: string, limitType: string, options?: PermissionCheckOptions): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Check cache first (unless skipCache is true)
      if (!options?.skipCache) {
        const cached = await this.getCachedPermission(tenantId, 'limit', limitType);
        if (cached) {
          this.logPermissionCheck(tenantId, 'limit', limitType, cached.granted, cached.source, Date.now() - startTime);
          return cached.granted ? (cached as any).limit : 0;
        }
      }

      // Apply override-first logic
      const result = await this.applyOverrideLogic<number>(
        tenantId,
        'limit',
        limitType,
        async () => {
          // Fall back to tier-based limit check
          return await this.getTierLimit(tenantId, limitType);
        }
      );

      // Cache the result
      const cacheEntry: PermissionCacheEntry = {
        granted: result.value > 0,
        source: result.source,
        timestamp: Date.now(),
        ttl: this.defaultTTL
      };
      (cacheEntry as any).limit = result.value;
      await this.setCachedPermission(tenantId, 'limit', limitType, cacheEntry);

      this.logPermissionCheck(tenantId, 'limit', limitType, result.value > 0, result.source, Date.now() - startTime);
      return result.value;
    } catch (error) {
      this.handlePermissionError(tenantId, 'limit', limitType, error);
    }
  }

  /**
   * Check if a tenant can access a specific resource with an action
   */
  async canAccess(tenantId: string, resource: string, action: string, options?: PermissionCheckOptions): Promise<boolean> {
    const startTime = Date.now();
    const permissionKey = `${resource}:${action}`;
    
    try {
      // Check cache first (unless skipCache is true)
      if (!options?.skipCache) {
        const cached = await this.getCachedPermission(tenantId, 'access', permissionKey);
        if (cached) {
          this.logPermissionCheck(tenantId, 'access', permissionKey, cached.granted, cached.source, Date.now() - startTime);
          return cached.granted;
        }
      }

      // Apply override-first logic
      const result = await this.applyOverrideLogic<boolean>(
        tenantId,
        'access',
        permissionKey,
        async () => {
          // Fall back to tier-based access check
          return await this.checkTierAccess(tenantId, resource, action);
        }
      );

      // Cache the result
      const cacheEntry: PermissionCacheEntry = {
        granted: result.value,
        source: result.source,
        timestamp: Date.now(),
        ttl: this.defaultTTL
      };
      await this.setCachedPermission(tenantId, 'access', permissionKey, cacheEntry);

      this.logPermissionCheck(tenantId, 'access', permissionKey, result.value, result.source, Date.now() - startTime);
      return result.value;
    } catch (error) {
      this.handlePermissionError(tenantId, 'access', permissionKey, error);
    }
  }

  /**
   * Get detailed permission result for a feature
   */
  async getFeaturePermission(tenantId: string, feature: string, options?: PermissionCheckOptions): Promise<FeaturePermission> {
    const startTime = Date.now();
    
    try {
      const result = await this.applyOverrideLogic<boolean>(
        tenantId,
        'feature',
        feature,
        async () => await this.checkTierFeature(tenantId, feature)
      );

      return {
        feature,
        granted: result.value,
        source: result.source,
        expiresAt: result.override?.expires_at || null,
        metadata: options?.includeMetadata ? { override: result.override } : undefined
      };
    } catch (error) {
      this.handlePermissionError(tenantId, 'feature', feature, error);
    }
  }

  /**
   * Get detailed permission result for a limit
   */
  async getLimitPermission(tenantId: string, limitType: string, options?: PermissionCheckOptions): Promise<LimitPermission> {
    const startTime = Date.now();
    
    try {
      const result = await this.applyOverrideLogic<number>(
        tenantId,
        'limit',
        limitType,
        async () => await this.getTierLimit(tenantId, limitType)
      );

      // Get current usage if available
      const current = await this.getCurrentUsage(tenantId, limitType);

      return {
        limitType,
        limit: result.value,
        current,
        remaining: current !== undefined ? Math.max(0, result.value - current) : undefined,
        granted: result.value > 0,
        source: result.source,
        expiresAt: result.override?.expires_at || null,
        metadata: options?.includeMetadata ? { override: result.override } : undefined
      };
    } catch (error) {
      this.handlePermissionError(tenantId, 'limit', limitType, error);
    }
  }

  // ==========================================
  // Tier-Based Permission Methods
  // ==========================================

  /**
   * Check tier-based feature access
   */
  private async checkTierFeature(tenantId: string, feature: string): Promise<boolean> {
    try {
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_tier: true }
      });

      if (!tenant) {
        this.logWarning(`Tenant not found: ${tenantId}`);
        return false;
      }

      const tier = tenant.subscription_tier || 'starter';
      const tierFeatures = this.tierFeatures[tier] || this.tierFeatures['starter'];

      return tierFeatures[feature as keyof TierFeatures] || false;
    } catch (error) {
      this.logError(`Error checking tier feature: ${feature}`, error);
      return false;
    }
  }

  /**
   * Get tier-based limit value
   */
  private async getTierLimit(tenantId: string, limitType: string): Promise<number> {
    try {
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_tier: true }
      });

      if (!tenant) {
        this.logWarning(`Tenant not found: ${tenantId}`);
        return 0;
      }

      const tier = tenant.subscription_tier || 'starter';
      const tierLimits = this.tierLimits[tier] || this.tierLimits['starter'];

      // Map limit type to tier limit field
      const limitMapping: Record<string, keyof TierLimits> = {
        'products': 'products',
        'locations': 'locations',
        'users': 'users',
        'storage': 'storage',
        'apiCallsPerMonth': 'apiCallsPerMonth',
        'api_calls_per_month': 'apiCallsPerMonth',
        'featuredProducts': 'featuredProducts',
        'featured_products': 'featuredProducts'
      };

      const limitKey = limitMapping[limitType];
      if (!limitKey) {
        this.logWarning(`Unknown limit type: ${limitType}`);
        return 0;
      }

      return tierLimits[limitKey];
    } catch (error) {
      this.logError(`Error getting tier limit: ${limitType}`, error);
      return 0;
    }
  }

  /**
   * Check tier-based access permissions
   */
  private async checkTierAccess(tenantId: string, resource: string, action: string): Promise<boolean> {
    try {
      // Map resource:action combinations to features
      const accessFeatureMapping: Record<string, string> = {
        'analytics:read': 'basicAnalytics',
        'analytics:write': 'advancedAnalytics',
        'branding:update': 'customBranding',
        'support:create': 'prioritySupport',
        'api:access': 'apiAccess',
        'bulk:execute': 'bulkOperations',
        'integrations:manage': 'customIntegrations',
        'whitelabel:enable': 'whiteLabel'
      };

      const accessKey = `${resource}:${action}`;
      const feature = accessFeatureMapping[accessKey];

      if (feature) {
        return await this.checkTierFeature(tenantId, feature);
      }

      // Default access rules
      // Read access is generally allowed for authenticated users
      if (action === 'read') {
        return true;
      }

      // Write access requires at least professional tier
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_tier: true }
      });

      const tier = tenant?.subscription_tier || 'starter';
      return tier !== 'starter';
    } catch (error) {
      this.logError(`Error checking tier access: ${resource}:${action}`, error);
      return false;
    }
  }

  /**
   * Get current usage for a limit type
   */
  private async getCurrentUsage(tenantId: string, limitType: string): Promise<number | undefined> {
    try {
      // Map limit types to database queries
      switch (limitType) {
        case 'products':
        case 'featured_products':
          const productCount = await this.prisma.inventory_items.count({
            where: { tenant_id: tenantId }
          });
          return productCount;

        case 'locations':
          // Use max_locations field from tenants table as the limit
          // For current usage, we'd need a locations table or count from another source
          // For now, return 0 as placeholder since locations aren't implemented yet
          return 0;

        case 'users':
          // Use tenant_users table if it exists, otherwise return placeholder
          // TODO: Implement proper user counting when tenant_users table is created
          return 0;

        default:
          return undefined;
      }
    } catch (error) {
      this.logError(`Error getting current usage for ${limitType}`, error);
      return undefined;
    }
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  /**
   * Get all features for a tenant
   */
  async getAllFeatures(tenantId: string): Promise<Record<string, boolean>> {
    try {
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_tier: true }
      });

      const tier = tenant?.subscription_tier || 'starter';
      const tierFeatures = this.tierFeatures[tier] || this.tierFeatures['starter'];

      // Check for overrides on each feature
      const features: Record<string, boolean> = {};
      
      for (const [feature, defaultValue] of Object.entries(tierFeatures)) {
        features[feature] = await this.hasFeature(tenantId, feature);
      }

      return features;
    } catch (error) {
      this.logError('Error getting all features', error);
      return {};
    }
  }

  /**
   * Get all limits for a tenant
   */
  async getAllLimits(tenantId: string): Promise<Record<string, number>> {
    try {
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_tier: true }
      });

      const tier = tenant?.subscription_tier || 'starter';
      const tierLimits = this.tierLimits[tier] || this.tierLimits['starter'];

      // Check for overrides on each limit
      const limits: Record<string, number> = {};
      
      for (const limitType of Object.keys(tierLimits)) {
        limits[limitType] = await this.getLimit(tenantId, limitType);
      }

      return limits;
    } catch (error) {
      this.logError('Error getting all limits', error);
      return {};
    }
  }

  /**
   * Get complete tenant permissions
   */
  async getTenantPermissions(tenantId: string): Promise<TenantPermissions> {
    const [features, limits] = await Promise.all([
      this.getAllFeatures(tenantId),
      this.getAllLimits(tenantId)
    ]);

    return { features, limits };
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  /**
   * Check if tenant can use advanced analytics
   */
  async canUseAdvancedAnalytics(tenantId: string): Promise<boolean> {
    return await this.hasFeature(tenantId, 'advancedAnalytics');
  }

  /**
   * Check if tenant can create custom branding
   */
  async canCreateCustomBranding(tenantId: string): Promise<boolean> {
    return await this.hasFeature(tenantId, 'customBranding');
  }

  /**
   * Check if tenant can access API
   */
  async canAccessAPI(tenantId: string): Promise<boolean> {
    return await this.hasFeature(tenantId, 'apiAccess');
  }

  /**
   * Check if tenant can create a location
   */
  async canCreateLocation(tenantId: string): Promise<boolean> {
    const limit = await this.getLimit(tenantId, 'locations');
    if (limit === -1) return true; // Unlimited
    
    const current = await this.getCurrentUsage(tenantId, 'locations');
    return current !== undefined && current < limit;
  }

  /**
   * Check if tenant can add a product
   */
  async canAddProduct(tenantId: string): Promise<boolean> {
    const limit = await this.getLimit(tenantId, 'products');
    if (limit === -1) return true; // Unlimited
    
    const current = await this.getCurrentUsage(tenantId, 'products');
    return current !== undefined && current < limit;
  }

  /**
   * Get remaining capacity for a limit
   */
  async getRemainingCapacity(tenantId: string, limitType: string): Promise<number> {
    const limit = await this.getLimit(tenantId, limitType);
    if (limit === -1) return -1; // Unlimited
    
    const current = await this.getCurrentUsage(tenantId, limitType);
    if (current === undefined) return limit;
    
    return Math.max(0, limit - current);
  }
}

// Export singleton instance and types
export const tenantPermissionContext = TenantPermissionContext.getInstance();
export { LimitPermission, FeaturePermission } from './BasePermissionService';
export default TenantPermissionContext;
