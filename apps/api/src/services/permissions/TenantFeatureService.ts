/**
 * Tenant Feature Service
 * 
 * Layer 5: Extended Context Layer
 * 
 * Provides feature management with:
 * - Feature delegation APIs
 * - Feature toggle management
 * - Feature usage tracking
 * - Feature analytics
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Extends UniversalSingleton for consistent caching and metrics
 * - Follows singleton pattern with getInstance()
 * - Delegates to TenantPermissionContext for permission checks
 */

import { UniversalSingleton, SingletonCacheOptions } from '../../lib/UniversalSingleton';
import { PrismaClient } from '@prisma/client';
import { tenantPermissionContext, FeaturePermission } from './TenantPermissionContext';

// Feature definition
export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  tierAvailability: string[];
  defaultValue: boolean;
  configurable: boolean;
}

// Feature toggle
export interface FeatureToggle {
  feature: string;
  enabled: boolean;
  source: 'tier' | 'override' | 'default';
  expiresAt?: Date | null;
}

// Feature usage stats
export interface FeatureUsageStats {
  feature: string;
  usageCount: number;
  lastUsed: Date | null;
  activeUsers: number;
}

// Cache options for tenant feature service
const FEATURE_SERVICE_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 5000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'authenticated'
};

/**
 * Tenant Feature Service
 * 
 * Singleton service for feature management
 */
class TenantFeatureService extends UniversalSingleton {
  private prisma: PrismaClient;
  private featureDefinitions: Map<string, FeatureDefinition> = new Map();
  private static instance: TenantFeatureService;

  constructor() {
    super('TenantFeatureService', FEATURE_SERVICE_CACHE_OPTIONS);
    this.prisma = new PrismaClient();
    this.initializeFeatureDefinitions();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TenantFeatureService {
    if (!TenantFeatureService.instance) {
      TenantFeatureService.instance = new TenantFeatureService();
    }
    return TenantFeatureService.instance as TenantFeatureService;
  }

  /**
   * Initialize feature definitions
   */
  private initializeFeatureDefinitions(): void {
    const features: FeatureDefinition[] = [
      {
        id: 'basicAnalytics',
        name: 'Basic Analytics',
        description: 'Access to basic analytics dashboard',
        category: 'analytics',
        tierAvailability: ['starter', 'professional', 'enterprise'],
        defaultValue: true,
        configurable: false
      },
      {
        id: 'advancedAnalytics',
        name: 'Advanced Analytics',
        description: 'Access to advanced analytics and reporting',
        category: 'analytics',
        tierAvailability: ['professional', 'enterprise'],
        defaultValue: false,
        configurable: true
      },
      {
        id: 'customBranding',
        name: 'Custom Branding',
        description: 'Ability to customize brand appearance',
        category: 'branding',
        tierAvailability: ['professional', 'enterprise'],
        defaultValue: false,
        configurable: true
      },
      {
        id: 'prioritySupport',
        name: 'Priority Support',
        description: 'Access to priority support channels',
        category: 'support',
        tierAvailability: ['enterprise'],
        defaultValue: false,
        configurable: true
      },
      {
        id: 'apiAccess',
        name: 'API Access',
        description: 'Access to public API endpoints',
        category: 'integration',
        tierAvailability: ['professional', 'enterprise'],
        defaultValue: false,
        configurable: true
      },
      {
        id: 'bulkOperations',
        name: 'Bulk Operations',
        description: 'Ability to perform bulk operations',
        category: 'operations',
        tierAvailability: ['professional', 'enterprise'],
        defaultValue: false,
        configurable: true
      },
      {
        id: 'customIntegrations',
        name: 'Custom Integrations',
        description: 'Ability to create custom integrations',
        category: 'integration',
        tierAvailability: ['enterprise'],
        defaultValue: false,
        configurable: true
      },
      {
        id: 'whiteLabel',
        name: 'White Label',
        description: 'White label solution for resellers',
        category: 'branding',
        tierAvailability: ['enterprise'],
        defaultValue: false,
        configurable: true
      }
    ];

    features.forEach(feature => {
      this.featureDefinitions.set(feature.id, feature);
    });
  }

  // ==========================================
  // Feature Delegation APIs
  // ==========================================

  /**
   * Check if a feature is enabled for a tenant
   */
  async isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
    return await tenantPermissionContext.hasFeature(tenantId, feature);
  }

  /**
   * Get detailed feature permission
   */
  async getFeaturePermission(tenantId: string, feature: string): Promise<FeaturePermission> {
    return await tenantPermissionContext.getFeaturePermission(tenantId, feature);
  }

  /**
   * Get all features for a tenant
   */
  async getAllFeatures(tenantId: string): Promise<Record<string, boolean>> {
    return await tenantPermissionContext.getAllFeatures(tenantId);
  }

  /**
   * Get feature toggles for a tenant
   */
  async getFeatureToggles(tenantId: string): Promise<FeatureToggle[]> {
    const features = await this.getAllFeatures(tenantId);
    const toggles: FeatureToggle[] = [];

    for (const [feature, enabled] of Object.entries(features)) {
      const permission = await this.getFeaturePermission(tenantId, feature);
      toggles.push({
        feature,
        enabled,
        source: permission.source,
        expiresAt: permission.expiresAt
      });
    }

    return toggles;
  }

  // ==========================================
  // Feature Management APIs
  // ==========================================

  /**
   * Enable a feature for a tenant (creates override)
   */
  async enableFeature(
    tenantId: string,
    feature: string,
    options?: { expiresAt?: Date; grantedBy?: string }
  ): Promise<void> {
    try {
      // Check if feature is configurable
      const definition = this.featureDefinitions.get(feature);
      if (definition && !definition.configurable) {
        throw new Error(`Feature ${feature} is not configurable`);
      }

      // Create or update override
      await this.prisma.tenant_feature_overrides_list.upsert({
        where: {
          tenant_id_feature: {
            tenant_id: tenantId,
            feature: feature
          }
        },
        create: {
          id: `override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          feature: feature,
          granted: true,
          expires_at: options?.expiresAt || null,
          granted_by: options?.grantedBy || 'system',
          created_at: new Date(),
          updated_at: new Date()
        },
        update: {
          granted: true,
          expires_at: options?.expiresAt || null,
          updated_at: new Date()
        }
      });

      // Invalidate cache
      await tenantPermissionContext.invalidatePermissionCache(tenantId, 'feature', feature);

      this.logInfo(`Feature ${feature} enabled for tenant ${tenantId}`);
    } catch (error) {
      this.logError(`Error enabling feature ${feature}`, error);
      throw error;
    }
  }

  /**
   * Disable a feature for a tenant (removes override)
   */
  async disableFeature(tenantId: string, feature: string): Promise<void> {
    try {
      // Remove override
      await this.prisma.tenant_feature_overrides_list.deleteMany({
        where: {
          tenant_id: tenantId,
          feature: feature
        }
      });

      // Invalidate cache
      await tenantPermissionContext.invalidatePermissionCache(tenantId, 'feature', feature);

      this.logInfo(`Feature ${feature} disabled for tenant ${tenantId}`);
    } catch (error) {
      this.logError(`Error disabling feature ${feature}`, error);
      throw error;
    }
  }

  /**
   * Set feature expiration
   */
  async setFeatureExpiration(
    tenantId: string,
    feature: string,
    expiresAt: Date | null
  ): Promise<void> {
    try {
      await this.prisma.tenant_feature_overrides_list.updateMany({
        where: {
          tenant_id: tenantId,
          feature: feature
        },
        data: {
          expires_at: expiresAt,
          updated_at: new Date()
        }
      });

      // Invalidate cache
      await tenantPermissionContext.invalidatePermissionCache(tenantId, 'feature', feature);

      this.logInfo(`Feature ${feature} expiration set for tenant ${tenantId}`);
    } catch (error) {
      this.logError(`Error setting feature expiration`, error);
      throw error;
    }
  }

  // ==========================================
  // Feature Definition APIs
  // ==========================================

  /**
   * Get feature definition
   */
  getFeatureDefinition(feature: string): FeatureDefinition | undefined {
    return this.featureDefinitions.get(feature);
  }

  /**
   * Get all feature definitions
   */
  getAllFeatureDefinitions(): FeatureDefinition[] {
    return Array.from(this.featureDefinitions.values());
  }

  /**
   * Get features by category
   */
  getFeaturesByCategory(category: string): FeatureDefinition[] {
    return Array.from(this.featureDefinitions.values())
      .filter(f => f.category === category);
  }

  /**
   * Get features available for a tier
   */
  getFeaturesForTier(tier: string): FeatureDefinition[] {
    return Array.from(this.featureDefinitions.values())
      .filter(f => f.tierAvailability.includes(tier));
  }

  // ==========================================
  // Feature Usage Tracking
  // ==========================================

  /**
   * Track feature usage
   */
  async trackFeatureUsage(tenantId: string, feature: string, userId?: string): Promise<void> {
    try {
      // Store usage in cache for quick access
      const usageKey = `feature_usage:${tenantId}:${feature}`;
      const currentCount = await this.getCache<number>(usageKey) || 0;
      await this.setCache(usageKey, currentCount + 1, { ttl: 86400 }); // 24 hours

      // Track last used
      const lastUsedKey = `feature_last_used:${tenantId}:${feature}`;
      await this.setCache(lastUsedKey, new Date().toISOString(), { ttl: 86400 });

      // Track active users if userId provided
      if (userId) {
        const activeUsersKey = `feature_active_users:${tenantId}:${feature}`;
        const activeUsers = await this.getCache<Set<string>>(activeUsersKey) || new Set();
        activeUsers.add(userId);
        await this.setCache(activeUsersKey, activeUsers, { ttl: 86400 });
      }

      this.logInfo(`Feature usage tracked: ${feature} for tenant ${tenantId}`);
    } catch (error) {
      this.logError('Error tracking feature usage', error);
    }
  }

  /**
   * Get feature usage statistics
   */
  async getFeatureUsageStats(tenantId: string, feature: string): Promise<FeatureUsageStats> {
    const usageKey = `feature_usage:${tenantId}:${feature}`;
    const lastUsedKey = `feature_last_used:${tenantId}:${feature}`;
    const activeUsersKey = `feature_active_users:${tenantId}:${feature}`;

    const usageCount = await this.getCache<number>(usageKey) || 0;
    const lastUsedStr = await this.getCache<string>(lastUsedKey);
    const activeUsersSet = await this.getCache<Set<string>>(activeUsersKey);

    return {
      feature,
      usageCount,
      lastUsed: lastUsedStr ? new Date(lastUsedStr) : null,
      activeUsers: activeUsersSet ? activeUsersSet.size : 0
    };
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  /**
   * Enable multiple features at once
   */
  async enableFeatures(
    tenantId: string,
    features: string[],
    options?: { expiresAt?: Date; grantedBy?: string }
  ): Promise<void> {
    for (const feature of features) {
      await this.enableFeature(tenantId, feature, options);
    }
    this.logInfo(`Enabled ${features.length} features for tenant ${tenantId}`);
  }

  /**
   * Disable multiple features at once
   */
  async disableFeatures(tenantId: string, features: string[]): Promise<void> {
    for (const feature of features) {
      await this.disableFeature(tenantId, feature);
    }
    this.logInfo(`Disabled ${features.length} features for tenant ${tenantId}`);
  }

  /**
   * Get feature summary for a tenant
   */
  async getFeatureSummary(tenantId: string): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, number>;
  }> {
    const features = await this.getAllFeatures(tenantId);
    const definitions = this.getAllFeatureDefinitions();

    let enabled = 0;
    let disabled = 0;
    const byCategory: Record<string, number> = {};

    for (const [feature, isEnabled] of Object.entries(features)) {
      if (isEnabled) {
        enabled++;
        const definition = definitions.find(d => d.id === feature);
        if (definition) {
          byCategory[definition.category] = (byCategory[definition.category] || 0) + 1;
        }
      } else {
        disabled++;
      }
    }

    return {
      total: definitions.length,
      enabled,
      disabled,
      byCategory
    };
  }

  // ==========================================
  // Cleanup
  // ==========================================

  /**
   * Cleanup service resources
   */
  async cleanupService(): Promise<void> {
    await this.cleanup();
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
export const tenantFeatureService = TenantFeatureService.getInstance();
export default TenantFeatureService;
