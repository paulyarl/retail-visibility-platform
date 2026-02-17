import { AuthenticatedApiSingleton } from '../providers/base/UniversalSingleton';

export interface AdminAnalytics {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  recentOrders: number;
  revenue: {
    total: number;
    monthly: number;
    growth: number;
  };
  storage: {
    total: number;
    used: number;
    available: number;
  };
  apiCalls: {
    total: number;
    today: number;
    average: number;
  };
}

export interface DirectoryStats {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  rejectedListings: number;
  recentListings: number;
  categories: {
    total: number;
    active: number;
  };
  locations: {
    total: number;
    active: number;
  };
}

export interface EnrichmentAnalytics {
  totalEnrichments: number;
  successfulEnrichments: number;
  failedEnrichments: number;
  pendingEnrichments: number;
  averageProcessingTime: number;
  enrichmentRate: number;
  errorTypes: Record<string, number>;
}

/**
 * Service for managing admin analytics and reporting
 * Handles admin dashboard analytics, directory stats, and enrichment analytics
 */
export class AdminAnalyticsService extends AuthenticatedApiSingleton {
  private static instance: AdminAnalyticsService;

  private constructor() {
    super('AdminAnalyticsService');
  }

  static getInstance(): AdminAnalyticsService {
    if (!AdminAnalyticsService.instance) {
      AdminAnalyticsService.instance = new AdminAnalyticsService();
    }
    return AdminAnalyticsService.instance;
  }

  /**
   * Get admin directory stats
   */
  async getAdminDirectoryStats(): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      '/api/admin/directory/stats',
      {},
      'platform-admin-directory-stats',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get admin directory stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get admin directory listings with filters
   */
  async getAdminDirectoryListings(filters: {
    status?: string;
    tier?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    listings: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | null> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.tier) params.append('tier', filters.tier);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const result = await this.makeAuthenticatedRequest<{
      listings: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(
      `/api/admin/directory/listings?${params}`,
      {},
      'platform-admin-directory-listings',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get admin directory listings:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get admin enrichment analytics
   */
  async getAdminEnrichmentAnalytics(): Promise<EnrichmentAnalytics | null> {
    const result = await this.makeAuthenticatedRequest<EnrichmentAnalytics>(
      `/api/admin/enrichment/analytics?_t=${Date.now()}`,
      {},
      'platform-admin-enrichment-analytics',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get admin enrichment analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Search admin enrichment products
   */
  async searchAdminEnrichmentProducts(params: {
    search?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.source) queryParams.append('source', params.source);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/enrichment/products/search?${queryParams}`,
      {},
      'platform-admin-enrichment-search',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to search admin enrichment products:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get admin subdomain statistics
   */
  async getAdminSubdomainStats(): Promise<any> {
    const result = await this.makeAuthenticatedRequest<{ data: any }>(
      '/api/analytics/subdomain-stats',
      {},
      'platform-admin-subdomain-stats',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get admin subdomain stats:', result.error);
      return null;
    }

    return result.data?.data || null;
  }

  /**
   * Get platform overview analytics
   */
  async getPlatformOverview(): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      '/api/admin/analytics/overview',
      {},
      'platform-admin-overview',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get platform overview:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsageStats(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/analytics/tenant/${tenantId}/usage`,
      {},
      `platform-tenant-usage-stats-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get tenant usage stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoptionMetrics(timeframe: string = '30d'): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/analytics/feature-adoption?timeframe=${timeframe}`,
      {},
      'platform-feature-adoption-metrics',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get feature adoption metrics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(timeframe: string = '24h'): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/analytics/performance?timeframe=${timeframe}`,
      {},
      'platform-performance-metrics',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get performance metrics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get user activity analytics
   */
  async getUserActivityAnalytics(timeframe: string = '7d'): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/analytics/user-activity?timeframe=${timeframe}`,
      {},
      'platform-user-activity-analytics',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get user activity analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(timeframe: string = '30d'): Promise<any> {
    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/analytics/revenue?timeframe=${timeframe}`,
      {},
      'platform-revenue-analytics',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminAnalyticsService] Failed to get revenue analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(type: string, format: string = 'csv', params: any = {}): Promise<any> {
    const queryParams = new URLSearchParams({ format, ...params });
    
    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/analytics/export/${type}?${queryParams}`,
      {},
      `platform-export-analytics-${type}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error(`[AdminAnalyticsService] Failed to export ${type} analytics:`, result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get custom report
   */
  async getCustomReport(reportId: string, params: any = {}): Promise<any> {
    if (!reportId) {
      throw new Error('Report ID is required');
    }

    const queryParams = new URLSearchParams(params);
    const result = await this.makeAuthenticatedRequest<any>(
      `/api/admin/reports/${reportId}?${queryParams}`,
      {},
      `platform-custom-report-${reportId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error(`[AdminAnalyticsService] Failed to get custom report ${reportId}:`, result.error);
      return null;
    }

    return result.data || null;
  }
}

// Export singleton instance
export const adminAnalyticsService = AdminAnalyticsService.getInstance();
