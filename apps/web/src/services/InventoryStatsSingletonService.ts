/**
 * Inventory Stats Singleton Service
 * 
 * Handles inventory statistics operations with automatic caching and error handling.
 * Extends UniversalSingleton for authenticated requests.
 * 
 * Features:
 * - Inventory statistics and analytics
 * - Product count and status tracking
 * - Performance metrics
 * - Automatic caching with appropriate TTLs
 * - Error handling and logging
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface InventoryStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalStock: number;
  totalValue: number;
  averagePrice: number;
  recentOrders: number;
  totalViews: number;
  conversionRate: number;
  productsWithVariants: number;
}

export interface InventoryMetrics {
  totalItems: number;
  queuedItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  averageProcessingTime?: number;
  successRate?: number;
  throughput?: number;
}

class InventoryStatsSingletonService extends TenantApiSingleton {
  private static instance: InventoryStatsSingletonService;
  
  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'inventory-stats*',
      'inventory-metrics*',
      'stock-analytics*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('inventory-stats*');
    await this.invalidateCachePattern('inventory-metrics*');
    await this.invalidateCachePattern('stock-analytics*');
  }
  
  // Different TTLs for different data types
  private readonly CACHE_TTL_SHORT = 2 * 60 * 1000; // 2 minutes for real-time stats
  private readonly CACHE_TTL_MEDIUM = 5 * 60 * 1000; // 5 minutes for semi-static stats
  private readonly CACHE_TTL_LONG = 15 * 60 * 1000; // 15 minutes for historical data

  static getInstance(): InventoryStatsSingletonService {
    if (!InventoryStatsSingletonService.instance) {
      InventoryStatsSingletonService.instance = new InventoryStatsSingletonService();
    }
    return InventoryStatsSingletonService.instance;
  }

  constructor() {
    super('InventoryStatsSingletonService');
  }

  /**
   * Get inventory statistics for a tenant
   * Authenticated endpoint for inventory analytics
   */
  async getInventoryStats(tenantId: string): Promise<InventoryStats | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<InventoryStats>(
      `/api/inventory/stats/${tenantId}`,
      {},
      `inventory-stats-${tenantId}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      clientLogger.error('[InventoryStatsSingleton] Failed to get inventory stats:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Get inventory metrics and performance data
   * Authenticated endpoint for inventory monitoring
   */
  async getInventoryMetrics(tenantId: string): Promise<InventoryMetrics | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<InventoryMetrics>(
      `/api/inventory/metrics/${tenantId}`,
      {},
      `inventory-metrics-${tenantId}`,
      this.CACHE_TTL_SHORT
    );

    if (!response.success) {
      clientLogger.error('[InventoryStatsSingleton] Failed to get inventory metrics:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Get inventory health check
   * Authenticated endpoint for inventory health monitoring
   */
  async getInventoryHealth(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/inventory/health/${tenantId}`,
        {},
        `inventory-health-${tenantId}`,
        this.CACHE_TTL_SHORT
      );

      return response?.data || response;
    } catch (error) {
      clientLogger.error('[InventoryStatsSingleton] Failed to get inventory health:', { detail: error });
      return null;
    }
  }

  /**
   * Get inventory trends and analytics
   * Authenticated endpoint for inventory analytics
   */
  async getInventoryTrends(tenantId: string, options: {
    period?: 'day' | 'week' | 'month' | 'year';
    metric?: 'products' | 'value' | 'categories';
    limit?: number;
  } = {}): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const searchParams = new URLSearchParams();
      if (options.period) searchParams.append('period', options.period);
      if (options.metric) searchParams.append('metric', options.metric);
      if (options.limit) searchParams.append('limit', options.limit.toString());

      const response = await this.makeDefaultRequest<any>(
        `/api/inventory/trends/${tenantId}?${searchParams.toString()}`,
        {},
        `inventory-trends-${tenantId}-${JSON.stringify(options)}`,
        this.CACHE_TTL_LONG
      );

      return response?.data || response;
    } catch (error) {
      clientLogger.error('[InventoryStatsSingleton] Failed to get inventory trends:', { detail: error });
      return null;
    }
  }

  /**
   * Refresh inventory stats (force cache invalidation)
   * Authenticated endpoint for manual refresh
   */
  async refreshInventoryStats(tenantId: string): Promise<InventoryStats | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Invalidate cache first
      this.invalidateCache(`inventory-stats-${tenantId}`);
      this.invalidateCache(`inventory-metrics-${tenantId}`);

      // Fetch fresh data
      const stats = await this.getInventoryStats(tenantId);
      return stats;
    } catch (error) {
      clientLogger.error('[InventoryStatsSingleton] Failed to refresh inventory stats:', { detail: error });
      return null;
    }
  }
}

// Export singleton instance
export const inventoryStatsService = InventoryStatsSingletonService.getInstance();
