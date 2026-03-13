/**
 * Tenant Limits Service
 * 
 * Layer 5: Extended Context Layer
 * 
 * Provides limit management with:
 * - Limit checking APIs
 * - Usage tracking
 * - Limit override management
 * - Quota enforcement
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Extends UniversalSingleton for consistent caching and metrics
 * - Follows singleton pattern with getInstance()
 * - Delegates to TenantPermissionContext for limit checks
 */

import { UniversalSingleton, SingletonCacheOptions } from '../../lib/UniversalSingleton';
import { PrismaClient } from '@prisma/client';
import { tenantPermissionContext, LimitPermission } from './TenantPermissionContext';

// Limit definition
export interface LimitDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: 'count' | 'bytes' | 'seconds';
  tierDefaults: Record<string, number>;
  configurable: boolean;
}

// Limit status
export interface LimitStatus {
  limitType: string;
  limit: number;
  current: number;
  remaining: number;
  percentage: number;
  exceeded: boolean;
  unlimited: boolean;
}

// Usage record
export interface UsageRecord {
  limitType: string;
  usage: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Cache options for tenant limits service
const LIMITS_SERVICE_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 5000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'authenticated'
};

/**
 * Tenant Limits Service
 * 
 * Singleton service for limit management
 */
class TenantLimitsService extends UniversalSingleton {
  private prisma: PrismaClient;
  private limitDefinitions: Map<string, LimitDefinition> = new Map();
  private static instance: TenantLimitsService;

  constructor() {
    super('TenantLimitsService', LIMITS_SERVICE_CACHE_OPTIONS);
    this.prisma = new PrismaClient();
    this.initializeLimitDefinitions();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TenantLimitsService {
    if (!TenantLimitsService.instance) {
      TenantLimitsService.instance = new TenantLimitsService();
    }
    return TenantLimitsService.instance as TenantLimitsService;
  }

  /**
   * Initialize limit definitions
   */
  private initializeLimitDefinitions(): void {
    const limits: LimitDefinition[] = [
      {
        id: 'products',
        name: 'Products',
        description: 'Maximum number of products in inventory',
        category: 'inventory',
        unit: 'count',
        tierDefaults: {
          starter: 100,
          professional: 1000,
          enterprise: -1 // Unlimited
        },
        configurable: true
      },
      {
        id: 'locations',
        name: 'Locations',
        description: 'Maximum number of business locations',
        category: 'business',
        unit: 'count',
        tierDefaults: {
          starter: 1,
          professional: 5,
          enterprise: -1
        },
        configurable: true
      },
      {
        id: 'users',
        name: 'Users',
        description: 'Maximum number of team members',
        category: 'team',
        unit: 'count',
        tierDefaults: {
          starter: 1,
          professional: 10,
          enterprise: -1
        },
        configurable: true
      },
      {
        id: 'storage',
        name: 'Storage',
        description: 'Maximum storage in megabytes',
        category: 'resources',
        unit: 'bytes',
        tierDefaults: {
          starter: 500,
          professional: 5000,
          enterprise: -1
        },
        configurable: true
      },
      {
        id: 'apiCallsPerMonth',
        name: 'API Calls per Month',
        description: 'Maximum API calls per month',
        category: 'api',
        unit: 'count',
        tierDefaults: {
          starter: 1000,
          professional: 10000,
          enterprise: -1
        },
        configurable: true
      },
      {
        id: 'featuredProducts',
        name: 'Featured Products',
        description: 'Maximum number of featured products',
        category: 'marketing',
        unit: 'count',
        tierDefaults: {
          starter: 5,
          professional: 20,
          enterprise: 100
        },
        configurable: true
      }
    ];

    limits.forEach(limit => {
      this.limitDefinitions.set(limit.id, limit);
    });
  }

  // ==========================================
  // Limit Checking APIs
  // ==========================================

  /**
   * Get limit value for a tenant
   */
  async getLimit(tenantId: string, limitType: string): Promise<number> {
    return await tenantPermissionContext.getLimit(tenantId, limitType);
  }

  /**
   * Get detailed limit permission
   */
  async getLimitPermission(tenantId: string, limitType: string): Promise<LimitPermission> {
    return await tenantPermissionContext.getLimitPermission(tenantId, limitType);
  }

  /**
   * Get current usage for a limit type
   */
  async getCurrentUsage(tenantId: string, limitType: string): Promise<number> {
    try {
      switch (limitType) {
        case 'products':
          return await this.prisma.inventory_items.count({
            where: { tenant_id: tenantId }
          });

        case 'locations':
          // tenant_locations table doesn't exist yet, return 0 as placeholder
          return 0;

        case 'users':
          return await this.prisma.user_tenants.count({
            where: { tenant_id: tenantId }
          });

        case 'storage':
          // digital_assets table doesn't exist yet, return 0 as placeholder
          return 0;

        case 'apiCallsPerMonth':
          // Get from cache or analytics
          const cacheKey = `api_calls:${tenantId}:${new Date().getMonth()}`;
          return await this.getCache<number>(cacheKey) || 0;

        case 'featuredProducts':
          return await this.prisma.inventory_items.count({
            where: { 
              tenant_id: tenantId,
              is_featured: true
            }
          });

        default:
          return 0;
      }
    } catch (error) {
      this.logError(`Error getting current usage for ${limitType}`, error);
      return 0;
    }
  }

  /**
   * Get limit status (includes usage and remaining)
   */
  async getLimitStatus(tenantId: string, limitType: string): Promise<LimitStatus> {
    const limit = await this.getLimit(tenantId, limitType);
    const current = await this.getCurrentUsage(tenantId, limitType);

    const unlimited = limit === -1;
    const remaining = unlimited ? -1 : Math.max(0, limit - current);
    const percentage = unlimited ? 0 : (current / limit) * 100;
    const exceeded = !unlimited && current >= limit;

    return {
      limitType,
      limit,
      current,
      remaining,
      percentage,
      exceeded,
      unlimited
    };
  }

  /**
   * Check if a limit would be exceeded
   */
  async wouldExceedLimit(
    tenantId: string,
    limitType: string,
    additional: number = 1
  ): Promise<boolean> {
    const status = await this.getLimitStatus(tenantId, limitType);
    
    if (status.unlimited) {
      return false;
    }

    return status.current + additional > status.limit;
  }

  /**
   * Check if a limit is exceeded
   */
  async isLimitExceeded(tenantId: string, limitType: string): Promise<boolean> {
    const status = await this.getLimitStatus(tenantId, limitType);
    return status.exceeded;
  }

  // ==========================================
  // Limit Management APIs
  // ==========================================

  /**
   * Set limit override for a tenant
   */
  async setLimitOverride(
    tenantId: string,
    limitType: string,
    limitValue: number,
    options?: { expiresAt?: Date; grantedBy?: string }
  ): Promise<void> {
    try {
      // Check if limit is configurable
      const definition = this.limitDefinitions.get(limitType);
      if (definition && !definition.configurable) {
        throw new Error(`Limit ${limitType} is not configurable`);
      }

      // Create or update override
      await this.prisma.tenant_feature_overrides_list.upsert({
        where: {
          tenant_id_feature: {
            tenant_id: tenantId,
            feature: `limit:${limitType}`
          }
        },
        create: {
          id: `limit-override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          feature: `limit:${limitType}`,
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

      // Store limit value in metadata
      // Note: This would require a metadata column or separate table

      // Invalidate cache
      await tenantPermissionContext.invalidatePermissionCache(tenantId, 'limit', limitType);

      this.logInfo(`Limit ${limitType} set to ${limitValue} for tenant ${tenantId}`);
    } catch (error) {
      this.logError(`Error setting limit override for ${limitType}`, error);
      throw error;
    }
  }

  /**
   * Remove limit override
   */
  async removeLimitOverride(tenantId: string, limitType: string): Promise<void> {
    try {
      await this.prisma.tenant_feature_overrides_list.deleteMany({
        where: {
          tenant_id: tenantId,
          feature: `limit:${limitType}`
        }
      });

      // Invalidate cache
      await tenantPermissionContext.invalidatePermissionCache(tenantId, 'limit', limitType);

      this.logInfo(`Limit override removed for ${limitType} for tenant ${tenantId}`);
    } catch (error) {
      this.logError(`Error removing limit override for ${limitType}`, error);
      throw error;
    }
  }

  // ==========================================
  // Usage Tracking APIs
  // ==========================================

  /**
   * Track usage increment
   */
  async trackUsage(
    tenantId: string,
    limitType: string,
    increment: number = 1,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const usageKey = `usage:${tenantId}:${limitType}`;
      const current = await this.getCache<number>(usageKey) || 0;
      await this.setCache(usageKey, current + increment, { ttl: 3600 }); // 1 hour

      // Track usage history
      const historyKey = `usage_history:${tenantId}:${limitType}`;
      const history = await this.getCache<UsageRecord[]>(historyKey) || [];
      history.push({
        limitType,
        usage: increment,
        timestamp: new Date(),
        metadata
      });
      // Keep last 100 records
      if (history.length > 100) {
        history.shift();
      }
      await this.setCache(historyKey, history, { ttl: 86400 }); // 24 hours

      this.logInfo(`Usage tracked: ${limitType} +${increment} for tenant ${tenantId}`);
    } catch (error) {
      this.logError('Error tracking usage', error);
    }
  }

  /**
   * Get usage history
   */
  async getUsageHistory(
    tenantId: string,
    limitType: string,
    limit?: number
  ): Promise<UsageRecord[]> {
    const historyKey = `usage_history:${tenantId}:${limitType}`;
    const history = await this.getCache<UsageRecord[]>(historyKey) || [];
    
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  // ==========================================
  // Quota Enforcement APIs
  // ==========================================

  /**
   * Enforce quota before action
   * Throws error if quota exceeded
   */
  async enforceQuota(
    tenantId: string,
    limitType: string,
    required: number = 1
  ): Promise<void> {
    const wouldExceed = await this.wouldExceedLimit(tenantId, limitType, required);
    
    if (wouldExceed) {
      const status = await this.getLimitStatus(tenantId, limitType);
      throw new Error(
        `Quota exceeded for ${limitType}. ` +
        `Current: ${status.current}, Limit: ${status.limit}, Required: ${required}`
      );
    }
  }

  /**
   * Check and consume quota
   * Returns true if successful, false if quota exceeded
   */
  async consumeQuota(
    tenantId: string,
    limitType: string,
    amount: number = 1
  ): Promise<boolean> {
    try {
      await this.enforceQuota(tenantId, limitType, amount);
      await this.trackUsage(tenantId, limitType, amount);
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================
  // Limit Definition APIs
  // ==========================================

  /**
   * Get limit definition
   */
  getLimitDefinition(limitType: string): LimitDefinition | undefined {
    return this.limitDefinitions.get(limitType);
  }

  /**
   * Get all limit definitions
   */
  getAllLimitDefinitions(): LimitDefinition[] {
    return Array.from(this.limitDefinitions.values());
  }

  /**
   * Get limits by category
   */
  getLimitsByCategory(category: string): LimitDefinition[] {
    return Array.from(this.limitDefinitions.values())
      .filter(l => l.category === category);
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  /**
   * Get all limits status for a tenant
   */
  async getAllLimitsStatus(tenantId: string): Promise<Record<string, LimitStatus>> {
    const limits = this.getAllLimitDefinitions();
    const statuses: Record<string, LimitStatus> = {};

    for (const limit of limits) {
      statuses[limit.id] = await this.getLimitStatus(tenantId, limit.id);
    }

    return statuses;
  }

  /**
   * Get limits summary
   */
  async getLimitsSummary(tenantId: string): Promise<{
    total: number;
    exceeded: number;
    nearLimit: number; // > 80%
    healthy: number;
  }> {
    const statuses = await this.getAllLimitsStatus(tenantId);
    
    let exceeded = 0;
    let nearLimit = 0;
    let healthy = 0;

    for (const status of Object.values(statuses)) {
      if (status.exceeded) {
        exceeded++;
      } else if (status.percentage > 80) {
        nearLimit++;
      } else {
        healthy++;
      }
    }

    return {
      total: Object.keys(statuses).length,
      exceeded,
      nearLimit,
      healthy
    };
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  /**
   * Check if can add product
   */
  async canAddProduct(tenantId: string): Promise<boolean> {
    return !(await this.wouldExceedLimit(tenantId, 'products'));
  }

  /**
   * Check if can add location
   */
  async canAddLocation(tenantId: string): Promise<boolean> {
    return !(await this.wouldExceedLimit(tenantId, 'locations'));
  }

  /**
   * Check if can add user
   */
  async canAddUser(tenantId: string): Promise<boolean> {
    return !(await this.wouldExceedLimit(tenantId, 'users'));
  }

  /**
   * Check if can feature product
   */
  async canFeatureProduct(tenantId: string): Promise<boolean> {
    return !(await this.wouldExceedLimit(tenantId, 'featuredProducts'));
  }

  /**
   * Get remaining products
   */
  async getRemainingProducts(tenantId: string): Promise<number> {
    const status = await this.getLimitStatus(tenantId, 'products');
    return status.remaining;
  }

  /**
   * Get remaining storage
   */
  async getRemainingStorage(tenantId: string): Promise<number> {
    const status = await this.getLimitStatus(tenantId, 'storage');
    return status.remaining;
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
export const tenantLimitsService = TenantLimitsService.getInstance();
export default TenantLimitsService;
