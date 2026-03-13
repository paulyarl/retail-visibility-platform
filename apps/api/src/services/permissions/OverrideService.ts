/**
 * Override Service
 * 
 * Provides API for managing feature overrides that temporarily grant
 * permissions beyond a tenant's subscription tier.
 * 
 * Features:
 * - Grant/revoke overrides
 * - Bulk operations
 * - Expiration management
 * - Audit trail
 * - Cache invalidation integration
 * 
 * Aligned with Feature Override System:
 * - Uses tenant_feature_overrides_list table
 * - Integrates with permission cache invalidation
 * - Supports override-first logic in permission checks
 */

import { UniversalSingleton, SingletonCacheOptions } from '../../lib/UniversalSingleton';
import { PrismaClient } from '@prisma/client';
import { permissionServiceFactory } from './PermissionServiceFactory';

// Override input types
export interface GrantOverrideInput {
  tenantId: string;
  feature: string;
  value?: number | boolean; // For limit overrides, the new limit value
  reason: string;
  expiresAt?: Date | null; // null = permanent
  grantedBy: string;
}

export interface BulkGrantOverrideInput {
  tenantIds: string[];
  feature: string;
  value?: number | boolean;
  reason: string;
  expiresAt?: Date | null;
  grantedBy: string;
}

export interface OverrideRecord {
  id: string;
  tenantId: string;
  feature: string;
  granted: boolean;
  value?: number | boolean;
  reason: string | null;
  expiresAt: Date | null;
  grantedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OverrideFilter {
  tenantId?: string;
  feature?: string;
  activeOnly?: boolean;
  expiringWithinDays?: number;
}

export interface OverrideHistoryRecord extends OverrideRecord {
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
  action: 'granted' | 'revoked' | 'extended' | 'updated';
}

// Cache options
const OVERRIDE_SERVICE_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 2000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'authenticated'
};

/**
 * Override Service
 * 
 * Singleton service for managing feature overrides
 */
class OverrideService extends UniversalSingleton {
  private prisma: PrismaClient;
  private static instance: OverrideService;

  constructor() {
    super('OverrideService', OVERRIDE_SERVICE_CACHE_OPTIONS);
    this.prisma = new PrismaClient();
  }

  static getInstance(): OverrideService {
    if (!OverrideService.instance) {
      OverrideService.instance = new OverrideService();
    }
    return OverrideService.instance;
  }

  // ==========================================
  // Grant Overrides
  // ==========================================

  /**
   * Grant an override to a tenant
   */
  async grantOverride(input: GrantOverrideInput): Promise<OverrideRecord> {
    try {
      const id = `override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      // Upsert the override (one per tenant per feature)
      const override = await this.prisma.tenant_feature_overrides_list.upsert({
        where: {
          tenant_id_feature: {
            tenant_id: input.tenantId,
            feature: input.feature
          }
        },
        update: {
          granted: true,
          reason: input.reason,
          expires_at: input.expiresAt || null,
          granted_by: input.grantedBy,
          updated_at: now
        },
        create: {
          id,
          tenant_id: input.tenantId,
          feature: input.feature,
          granted: true,
          reason: input.reason,
          expires_at: input.expiresAt || null,
          granted_by: input.grantedBy,
          created_at: now,
          updated_at: now
        }
      });

      // Invalidate tenant permission cache
      await this.invalidateTenantCache(input.tenantId);

      // Log the action
      this.logInfo(`Override granted: ${input.feature} to tenant ${input.tenantId}`, {
        tenantId: input.tenantId,
        feature: input.feature,
        grantedBy: input.grantedBy,
        expiresAt: input.expiresAt
      });

      return this.mapToOverrideRecord(override);
    } catch (error) {
      this.logError('Error granting override', error);
      throw error;
    }
  }

  /**
   * Grant overrides to multiple tenants
   */
  async bulkGrantOverrides(input: BulkGrantOverrideInput): Promise<{
    success: string[];
    failed: Array<{ tenantId: string; error: string }>;
  }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ tenantId: string; error: string }>
    };

    for (const tenantId of input.tenantIds) {
      try {
        await this.grantOverride({
          tenantId,
          feature: input.feature,
          value: input.value,
          reason: input.reason,
          expiresAt: input.expiresAt,
          grantedBy: input.grantedBy
        });
        results.success.push(tenantId);
      } catch (error) {
        results.failed.push({
          tenantId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.logInfo(`Bulk override granted: ${input.feature}`, {
      feature: input.feature,
      successCount: results.success.length,
      failedCount: results.failed.length,
      grantedBy: input.grantedBy
    });

    return results;
  }

  // ==========================================
  // Revoke Overrides
  // ==========================================

  /**
   * Revoke an override
   */
  async revokeOverride(
    tenantId: string,
    feature: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.prisma.tenant_feature_overrides_list.delete({
        where: {
          tenant_id_feature: {
            tenant_id: tenantId,
            feature
          }
        }
      });

      // Invalidate tenant permission cache
      await this.invalidateTenantCache(tenantId);

      this.logInfo(`Override revoked: ${feature} from tenant ${tenantId}`, {
        tenantId,
        feature,
        revokedBy,
        reason
      });
    } catch (error) {
      this.logError('Error revoking override', error);
      throw error;
    }
  }

  /**
   * Revoke all overrides for a tenant
   */
  async revokeAllTenantOverrides(
    tenantId: string,
    revokedBy: string,
    reason?: string
  ): Promise<number> {
    try {
      const result = await this.prisma.tenant_feature_overrides_list.deleteMany({
        where: { tenant_id: tenantId }
      });

      // Invalidate tenant permission cache
      await this.invalidateTenantCache(tenantId);

      this.logInfo(`All overrides revoked for tenant ${tenantId}`, {
        tenantId,
        count: result.count,
        revokedBy,
        reason
      });

      return result.count;
    } catch (error) {
      this.logError('Error revoking all tenant overrides', error);
      throw error;
    }
  }

  // ==========================================
  // Extend/Update Overrides
  // ==========================================

  /**
   * Extend an override's expiration
   */
  async extendOverride(
    tenantId: string,
    feature: string,
    newExpiresAt: Date
  ): Promise<OverrideRecord | null> {
    try {
      const override = await this.prisma.tenant_feature_overrides_list.update({
        where: {
          tenant_id_feature: {
            tenant_id: tenantId,
            feature
          }
        },
        data: {
          expires_at: newExpiresAt,
          updated_at: new Date()
        }
      });

      // Invalidate cache
      await this.invalidateTenantCache(tenantId);

      this.logInfo(`Override extended: ${feature} for tenant ${tenantId}`, {
        tenantId,
        feature,
        newExpiresAt
      });

      return this.mapToOverrideRecord(override);
    } catch (error) {
      this.logError('Error extending override', error);
      return null;
    }
  }

  /**
   * Update override reason
   */
  async updateOverrideReason(
    tenantId: string,
    feature: string,
    reason: string
  ): Promise<OverrideRecord | null> {
    try {
      const override = await this.prisma.tenant_feature_overrides_list.update({
        where: {
          tenant_id_feature: {
            tenant_id: tenantId,
            feature
          }
        },
        data: {
          reason,
          updated_at: new Date()
        }
      });

      return this.mapToOverrideRecord(override);
    } catch (error) {
      this.logError('Error updating override reason', error);
      return null;
    }
  }

  // ==========================================
  // Query Overrides
  // ==========================================

  /**
   * Get all overrides for a tenant
   */
  async getTenantOverrides(tenantId: string): Promise<OverrideRecord[]> {
    try {
      const overrides = await this.prisma.tenant_feature_overrides_list.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' }
      });

      return overrides.map(this.mapToOverrideRecord);
    } catch (error) {
      this.logError('Error getting tenant overrides', error);
      return [];
    }
  }

  /**
   * Get active (non-expired) overrides for a tenant
   */
  async getActiveOverrides(tenantId: string): Promise<OverrideRecord[]> {
    try {
      const now = new Date();
      const overrides = await this.prisma.tenant_feature_overrides_list.findMany({
        where: {
          tenant_id: tenantId,
          granted: true,
          OR: [
            { expires_at: null },
            { expires_at: { gt: now } }
          ]
        },
        orderBy: { created_at: 'desc' }
      });

      return overrides.map(this.mapToOverrideRecord);
    } catch (error) {
      this.logError('Error getting active overrides', error);
      return [];
    }
  }

  /**
   * Check if tenant has an active override for a feature
   */
  async hasActiveOverride(tenantId: string, feature: string): Promise<boolean> {
    try {
      const now = new Date();
      const override = await this.prisma.tenant_feature_overrides_list.findFirst({
        where: {
          tenant_id: tenantId,
          feature,
          granted: true,
          OR: [
            { expires_at: null },
            { expires_at: { gt: now } }
          ]
        }
      });

      return !!override;
    } catch (error) {
      this.logError('Error checking active override', error);
      return false;
    }
  }

  /**
   * Get a specific override
   */
  async getOverride(tenantId: string, feature: string): Promise<OverrideRecord | null> {
    try {
      const override = await this.prisma.tenant_feature_overrides_list.findUnique({
        where: {
          tenant_id_feature: {
            tenant_id: tenantId,
            feature
          }
        }
      });

      return override ? this.mapToOverrideRecord(override) : null;
    } catch (error) {
      this.logError('Error getting override', error);
      return null;
    }
  }

  /**
   * Get overrides expiring within a number of days
   */
  async getExpiringOverrides(options: { withinDays: number }): Promise<OverrideRecord[]> {
    try {
      const now = new Date();
      const expiresBefore = new Date(now.getTime() + options.withinDays * 24 * 60 * 60 * 1000);

      const overrides = await this.prisma.tenant_feature_overrides_list.findMany({
        where: {
          granted: true,
          expires_at: {
            gt: now,
            lte: expiresBefore
          }
        },
        orderBy: { expires_at: 'asc' }
      });

      return overrides.map(this.mapToOverrideRecord);
    } catch (error) {
      this.logError('Error getting expiring overrides', error);
      return [];
    }
  }

  /**
   * Get all overrides with filtering
   */
  async getOverrides(filter?: OverrideFilter): Promise<OverrideRecord[]> {
    try {
      const where: any = {};

      if (filter?.tenantId) {
        where.tenant_id = filter.tenantId;
      }

      if (filter?.feature) {
        where.feature = filter.feature;
      }

      if (filter?.activeOnly) {
        const now = new Date();
        where.granted = true;
        where.OR = [
          { expires_at: null },
          { expires_at: { gt: now } }
        ];
      }

      if (filter?.expiringWithinDays) {
        const now = new Date();
        const expiresBefore = new Date(now.getTime() + filter.expiringWithinDays * 24 * 60 * 60 * 1000);
        where.expires_at = {
          gt: now,
          lte: expiresBefore
        };
      }

      const overrides = await this.prisma.tenant_feature_overrides_list.findMany({
        where,
        orderBy: { created_at: 'desc' }
      });

      return overrides.map(this.mapToOverrideRecord);
    } catch (error) {
      this.logError('Error getting overrides', error);
      return [];
    }
  }

  // ==========================================
  // Maintenance
  // ==========================================

  /**
   * Prune expired overrides from database
   */
  async pruneExpiredOverrides(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.prisma.tenant_feature_overrides_list.deleteMany({
        where: {
          expires_at: { lt: now }
        }
      });

      this.logInfo(`Pruned ${result.count} expired overrides`);

      return result.count;
    } catch (error) {
      this.logError('Error pruning expired overrides', error);
      return 0;
    }
  }

  /**
   * Get override statistics
   */
  async getOverrideStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    permanent: number;
    byFeature: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const all = await this.prisma.tenant_feature_overrides_list.findMany();

      const stats = {
        total: all.length,
        active: all.filter(o => o.granted && (!o.expires_at || o.expires_at > now)).length,
        expired: all.filter(o => o.expires_at && o.expires_at <= now).length,
        permanent: all.filter(o => !o.expires_at).length,
        byFeature: {} as Record<string, number>
      };

      // Count by feature
      for (const override of all) {
        stats.byFeature[override.feature] = (stats.byFeature[override.feature] || 0) + 1;
      }

      return stats;
    } catch (error) {
      this.logError('Error getting override stats', error);
      return { total: 0, active: 0, expired: 0, permanent: 0, byFeature: {} };
    }
  }

  // ==========================================
  // Helpers
  // ==========================================

  /**
   * Map database record to OverrideRecord type
   */
  private mapToOverrideRecord(db: any): OverrideRecord {
    return {
      id: db.id,
      tenantId: db.tenant_id,
      feature: db.feature,
      granted: db.granted,
      reason: db.reason,
      expiresAt: db.expires_at,
      grantedBy: db.granted_by,
      createdAt: db.created_at,
      updatedAt: db.updated_at
    };
  }

  /**
   * Invalidate tenant permission cache
   */
  private async invalidateTenantCache(tenantId: string): Promise<void> {
    try {
      await permissionServiceFactory.invalidateTenantCache(tenantId);
    } catch (error) {
      this.logError('Error invalidating tenant cache', error);
    }
  }

  /**
   * Cleanup service resources
   */
  async cleanupService(): Promise<void> {
    await this.cleanup();
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
export const overrideService = OverrideService.getInstance();
export default OverrideService;
