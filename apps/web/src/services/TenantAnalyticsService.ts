import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface TenantAnalytics {
  performanceMetrics: {
    apiCalls: {
      total: number;
      average: number;
      today: number;
      lastHour: number;
    };
    responseTime: {
      average: number;
      p95: number;
      p99: number;
    };
    errorRate: number;
  };
  usage: {
    storage: {
      total: number;
      used: number;
      available: number;
      percentage: number;
    };
    bandwidth: {
      total: number;
      used: number;
      available: number;
      percentage: number;
    };
  };
  activity: {
    logins: number;
    activeUsers: number;
    pageViews: number;
    apiRequests: number;
  };
  features: {
    productsCreated: number;
    categoriesCreated: number;
    ordersProcessed: number;
    scansCompleted: number;
  };
}

/**
 * Service for managing tenant-specific analytics and usage data
 * Handles tenant analytics, usage statistics, and performance metrics
 */
export class TenantAnalyticsService extends TenantApiSingleton {
  private static instance: TenantAnalyticsService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-analytics*',
      'usage-statistics*',
      'performance-metrics*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-analytics*');
    await this.invalidateCachePattern('usage-statistics*');
    await this.invalidateCachePattern('performance-metrics*');
  }

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes cache for analytics
      ...cacheOptions
    });
  }

  static getInstance(): TenantAnalyticsService {
    if (!TenantAnalyticsService.instance) {
      TenantAnalyticsService.instance = new TenantAnalyticsService('tenant-analytics-service');
    }
    return TenantAnalyticsService.instance;
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsage(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Use default request type (TENANT) for primary operation
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/usage`,
      {},
      `platform-tenant-usage-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant usage:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get tenant category
   */
  async getTenantCategory(tenantId: string, categoryId: string): Promise<any> {
    if (!tenantId || !categoryId) {
      throw new Error('Tenant ID and Category ID are required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
      {},
      `platform-tenant-category-${tenantId}-${categoryId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant category:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get tenant performance metrics
   */
  async getTenantPerformanceMetrics(tenantId: string, timeframe: string = '7d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/performance?timeframe=${timeframe}`,
      {},
      `platform-tenant-performance-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant performance metrics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant product analytics
   */
  async getTenantProductAnalytics(tenantId: string, timeframe: string = '30d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/products?timeframe=${timeframe}`,
      {},
      `platform-tenant-product-analytics-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant product analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant customer analytics
   */
  async getTenantCustomerAnalytics(tenantId: string, timeframe: string = '30d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/customers?timeframe=${timeframe}`,
      {},
      `platform-tenant-customer-analytics-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant customer analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant sales analytics
   */
  async getTenantSalesAnalytics(tenantId: string, timeframe: string = '30d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/sales?timeframe=${timeframe}`,
      {},
      `platform-tenant-sales-analytics-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant sales analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant inventory analytics
   */
  async getTenantInventoryAnalytics(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/inventory`,
      {},
      `platform-tenant-inventory-analytics-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant inventory analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant engagement metrics
   */
  async getTenantEngagementMetrics(tenantId: string, timeframe: string = '30d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/engagement?timeframe=${timeframe}`,
      {},
      `platform-tenant-engagement-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant engagement metrics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant API usage analytics
   */
  async getTenantApiUsageAnalytics(tenantId: string, timeframe: string = '7d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/api-usage?timeframe=${timeframe}`,
      {},
      `platform-tenant-api-usage-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant API usage analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant error analytics
   */
  async getTenantErrorAnalytics(tenantId: string, timeframe: string = '7d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/errors?timeframe=${timeframe}`,
      {},
      `platform-tenant-error-analytics-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant error analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant storage usage analytics
   */
  async getTenantStorageAnalytics(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/storage`,
      {},
      `platform-tenant-storage-analytics-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant storage analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant bandwidth usage analytics
   */
  async getTenantBandwidthAnalytics(tenantId: string, timeframe: string = '30d'): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/bandwidth?timeframe=${timeframe}`,
      {},
      `platform-tenant-bandwidth-analytics-${tenantId}-${timeframe}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant bandwidth analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Export tenant analytics data
   */
  async exportTenantAnalytics(tenantId: string, type: string, format: string = 'csv', params: any = {}): Promise<any> {
    if (!tenantId || !type) {
      throw new Error('Tenant ID and analytics type are required');
    }

    const queryParams = new URLSearchParams({ format, ...params });
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/analytics/export/${type}?${queryParams}`,
      {},
      `platform-export-tenant-analytics-${tenantId}-${type}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error(`[TenantAnalyticsService] Failed to export tenant ${type} analytics:`, result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant dashboard summary
   */
  async getTenantDashboardSummary(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/dashboard/summary`,
      {},
      `platform-tenant-dashboard-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantAnalyticsService] Failed to get tenant dashboard summary:', result.error);
      return null;
    }

    return result.data || null;
  }
}

// Export singleton instance
export const tenantAnalyticsService = TenantAnalyticsService.getInstance();
