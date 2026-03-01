/**
 * Tenant Usage Service
 * 
 * Handles tenant usage analytics and metrics
 * Uses TenantApiSingleton for tenant-specific operations
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface TenantUsage {
  tenantId: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    apiCalls: number;
    storageUsed: number; // in bytes
    bandwidthUsed: number; // in bytes
    activeUsers: number;
    products: number;
    orders: number;
    revenue?: number; // in cents
  };
  limits?: {
    apiCalls: number;
    storage: number; // in bytes
    bandwidth: number; // in bytes
    users: number;
    products: number;
  };
  usageBreakdown?: {
    daily: Array<{
      date: string;
      apiCalls: number;
      storageUsed: number;
      bandwidthUsed: number;
      activeUsers: number;
    }>;
    endpoints: Array<{
      endpoint: string;
      calls: number;
      avgResponseTime: number;
    }>;
  };
}

export interface UsageSummary {
  currentPeriod: TenantUsage;
  previousPeriod?: TenantUsage;
  trends: {
    apiCalls: number; // percentage change
    storage: number; // percentage change
    bandwidth: number; // percentage change
    users: number; // percentage change
    products: number; // percentage change
    orders: number; // percentage change
  };
  alerts: Array<{
    type: 'warning' | 'critical';
    metric: string;
    message: string;
    threshold: number;
    current: number;
  }>;
}

class TenantUsageService extends TenantApiSingleton {
  private static instance: TenantUsageService;

  private constructor() {
    super('tenant-usage-service', {
      ttl: 5 * 60 * 1000 // 5 minutes for usage data
    });
  }

  public static getInstance(): TenantUsageService {
    if (!TenantUsageService.instance) {
      TenantUsageService.instance = new TenantUsageService();
    }
    return TenantUsageService.instance;
  }

  /**
   * Get tenant usage data
   */
  async getUsage(tenantId: string, period?: { start: string; end: string }): Promise<TenantUsage> {
    try {
      const queryParams = new URLSearchParams();
      if (period) {
        queryParams.append('start', period.start);
        queryParams.append('end', period.end);
      }
      
      const result = await this.makeDefaultRequest<TenantUsage>(
        `/api/tenants/${tenantId}/usage?${queryParams.toString()}`,
        {},
        `tenant-usage-${tenantId}-${period?.start || 'default'}`
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to get tenant usage');
      }
      
      return result.data;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get usage:', error);
      throw new Error('Failed to fetch tenant usage data');
    }
  }

  /**
   * Get usage summary with trends and alerts
   */
  async getUsageSummary(tenantId: string): Promise<UsageSummary> {
    try {
      const result = await this.makeDefaultRequest<UsageSummary>(
        `/api/tenants/${tenantId}/usage/summary`,
        {},
        `tenant-usage-summary-${tenantId}`
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to get usage summary');
      }
      
      return result.data;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get usage summary:', error);
      throw new Error('Failed to fetch usage summary');
    }
  }

  /**
   * Get API usage breakdown by endpoint
   */
  async getApiUsageBreakdown(tenantId: string, period?: { start: string; end: string }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (period) {
        queryParams.append('start', period.start);
        queryParams.append('end', period.end);
      }
      
      const result = await this.makeDefaultRequest<{ endpoints: any[] }>(
        `/api/tenants/${tenantId}/usage/api?${queryParams.toString()}`,
        {},
        `tenant-api-usage-${tenantId}-${period?.start || 'default'}`
      );
      
      return result.data?.endpoints || [];
    } catch (error) {
      console.error('[TenantUsageService] Failed to get API usage breakdown:', error);
      return [];
    }
  }

  /**
   * Get storage usage breakdown
   */
  async getStorageUsageBreakdown(tenantId: string): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/usage/storage`,
        {},
        `tenant-storage-usage-${tenantId}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get storage usage breakdown:', error);
      return null;
    }
  }

  /**
   * Get bandwidth usage breakdown
   */
  async getBandwidthUsageBreakdown(tenantId: string, period?: { start: string; end: string }): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (period) {
        queryParams.append('start', period.start);
        queryParams.append('end', period.end);
      }
      
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/usage/bandwidth?${queryParams.toString()}`,
        {},
        `tenant-bandwidth-usage-${tenantId}-${period?.start || 'default'}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get bandwidth usage breakdown:', error);
      return null;
    }
  }

  /**
   * Get user activity metrics
   */
  async getUserActivityMetrics(tenantId: string, period?: { start: string; end: string }): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (period) {
        queryParams.append('start', period.start);
        queryParams.append('end', period.end);
      }
      
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/usage/users?${queryParams.toString()}`,
        {},
        `tenant-user-activity-${tenantId}-${period?.start || 'default'}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get user activity metrics:', error);
      return null;
    }
  }

  /**
   * Get order metrics
   */
  async getOrderMetrics(tenantId: string, period?: { start: string; end: string }): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (period) {
        queryParams.append('start', period.start);
        queryParams.append('end', period.end);
      }
      
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/usage/orders?${queryParams.toString()}`,
        {},
        `tenant-order-metrics-${tenantId}-${period?.start || 'default'}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get order metrics:', error);
      return null;
    }
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(tenantId: string, period?: { start: string; end: string }): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (period) {
        queryParams.append('start', period.start);
        queryParams.append('end', period.end);
      }
      
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/usage/revenue?${queryParams.toString()}`,
        {},
        `tenant-revenue-metrics-${tenantId}-${period?.start || 'default'}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get revenue metrics:', error);
      return null;
    }
  }

  /**
   * Export usage data as CSV
   */
  async exportUsageData(tenantId: string, format: 'csv' | 'json' = 'csv', period?: { start: string; end: string }): Promise<Blob> {
    try {
      const queryParams = new URLSearchParams({ format });
      if (period) {
        queryParams.append('start', period.start);
        queryParams.append('end', period.end);
      }
      
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/usage/export?${queryParams.toString()}`,
        {},
        `tenant-usage-export-${tenantId}-${format}-${period?.start || 'default'}`
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to export usage data');
      }
      
      // Convert response data to blob
      const csvContent = result.data.csv || JSON.stringify(result.data, null, 2);
      return new Blob([csvContent], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
    } catch (error) {
      console.error('[TenantUsageService] Failed to export usage data:', error);
      throw new Error('Failed to export usage data');
    }
  }

  /**
   * Get real-time usage metrics (for dashboard)
   */
  async getRealTimeMetrics(tenantId: string): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/usage/realtime`,
        {},
        `tenant-realtime-usage-${tenantId}`,
        30 * 1000 // 30 seconds cache for real-time data
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantUsageService] Failed to get real-time metrics:', error);
      return null;
    }
  }
}

// Export the singleton instance
export const tenantUsageService = TenantUsageService.getInstance();
