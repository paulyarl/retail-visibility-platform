/**
 * Inventory Transfer Analytics Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached analytics operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { safeTransformToCamel } from '@/utils/case-transform';
import { clientLogger } from '@/lib/client-logger';

// Types
export interface TransferAnalytics {
  totalTransfers: number;
  activeTransfers: number;
  completedTransfers: number;
  averageTransferTime: number;
  topSKUs: Array<{
    sku: string;
    transferCount: number;
    totalQuantity: number;
  }>;
  statusBreakdown: {
    pending: number;
    approved: number;
    shipped: number;
    received: number;
    cancelled: number;
  };
  monthlyTrends: Array<{
    month: string;
    transfers: number;
    quantity: number;
  }>;
  lowStockAlerts: Array<{
    locationId: string;
    sku: string;
    currentStock: number;
    threshold: number;
  }>;
}

// ====================
// INVENTORY ANALYTICS SINGLETON
// ====================

export class InventoryAnalyticsService extends TenantApiSingleton {
  public getServiceCachePatterns(): string[] {
    return ['analytics-*', 'status-breakdown-*', 'top-skus-*', 'monthly-trends-*', 'performance-*'];
  }
  
  public invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    const patterns = this.getServiceCachePatterns();
    if (tenantId) {
      return this.invalidateCachePattern(`*-${tenantId}`);
    }
    return Promise.resolve();
  }

  private static instance: InventoryAnalyticsService;

  private constructor() {
    super('inventory-analytics-service');
  }

  static getInstance(): InventoryAnalyticsService {
    if (!InventoryAnalyticsService.instance) {
      InventoryAnalyticsService.instance = new InventoryAnalyticsService();
    }
    return InventoryAnalyticsService.instance;
  }

  /**
   * Get comprehensive inventory analytics
   */
  async getInventoryAnalytics(tenantId: string): Promise<TransferAnalytics> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: TransferAnalytics }>(
        `/api/tenant/inventory-transfers/analytics/inventory`,
        {
          method: 'GET'
        },
        `analytics-${tenantId}`,
        undefined,
        {
          tenantId
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch analytics');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      clientLogger.error('Failed to fetch analytics:', { detail: error });
      throw error;
    }
  }

  /**
   * Get transfer status breakdown
   */
  async getStatusBreakdown(tenantId: string): Promise<TransferAnalytics['statusBreakdown']> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: TransferAnalytics['statusBreakdown'] }>(
        `/api/tenant/inventory-transfers/analytics/status-breakdown`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': tenantId
          }
        },
        `status-breakdown-${tenantId}`
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch status breakdown');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      clientLogger.error('Failed to fetch status breakdown:', { detail: error });
      throw error;
    }
  }

  /**
   * Get top transferred SKUs
   */
  async getTopSKUs(tenantId: string, limit: number = 10): Promise<TransferAnalytics['topSKUs']> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: TransferAnalytics['topSKUs'] }>(
        `/api/tenant/inventory-transfers/analytics/top-skus?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': tenantId
          }
        },
        `top-skus-${tenantId}`
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch top SKUs');
      }

      return (result.data as unknown as any[]).map((sku: any) => safeTransformToCamel(sku));
    } catch (error) {
      clientLogger.error('Failed to fetch top SKUs:', { detail: error });
      throw error;
    }
  }

  /**
   * Get monthly transfer trends
   */
  async getMonthlyTrends(tenantId: string, months: number = 12): Promise<TransferAnalytics['monthlyTrends']> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: TransferAnalytics['monthlyTrends'] }>(
        `/api/tenant/inventory-transfers/analytics/monthly-trends?months=${months}`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': tenantId
          }
        },
        `monthly-trends-${tenantId}`
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch monthly trends');
      }

      return (result.data as unknown as any[]).map((trend: any) => safeTransformToCamel(trend));
    } catch (error) {
      clientLogger.error('Failed to fetch monthly trends:', { detail: error });
      throw error;
    }
  }

  /**
   * Get transfer performance metrics
   */
  async getPerformanceMetrics(tenantId: string): Promise<{
    averageTransferTime: number;
    completionRate: number;
    onTimeDeliveryRate: number;
    accuracyRate: number;
  }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: any }>(
        `/api/tenant/inventory-transfers/analytics/performance`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': tenantId
          }
        },
        `performance-${tenantId}`
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch performance metrics');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      clientLogger.error('Failed to fetch performance metrics:', { detail: error });
      throw error;
    }
  }
}

// Export singleton instance
export const inventoryAnalyticsService = InventoryAnalyticsService.getInstance();
