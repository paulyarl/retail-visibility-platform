/**
 * Analytics Service
 * 
 * Extends AdminApiSingleton to provide analytics and reporting
 * Handles enrichment analytics, product search, and subdomain statistics with admin privileges
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface Analytics {
  totalProducts: number;
  enrichedProducts: number;
  pendingEnrichment: number;
  failedEnrichment: number;
  enrichmentRate: number;
  lastUpdated: string;
  trends: {
    daily: Array<{
      date: string;
      enriched: number;
      failed: number;
      pending: number;
    }>;
    weekly: Array<{
      week: string;
      enriched: number;
      failed: number;
      pending: number;
    }>;
  };
  sources: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  categories: Array<{
    category: string;
    enriched: number;
    total: number;
    rate: number;
  }>;
}

export interface EnrichmentSearchParams {
  search?: string;
  source?: string;
  status?: 'enriched' | 'pending' | 'failed';
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'enrichmentScore';
  sortOrder?: 'asc' | 'desc';
}

export interface EnrichmentProduct {
  id: string;
  barcode: string;
  name?: string;
  brand?: string;
  category?: string;
  source?: string;
  status: 'enriched' | 'pending' | 'failed';
  enrichmentScore?: number;
  enrichedAt?: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  tenant?: {
    id: string;
    name: string;
  };
  enrichmentData?: {
    description?: string;
    features?: string[];
    specifications?: Record<string, any>;
    images?: string[];
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export interface SubdomainStats {
  totalSubdomains: number;
  activeSubdomains: number;
  pendingSubdomains: number;
  totalTraffic: number;
  uniqueVisitors: number;
  averagePageViews: number;
  bounceRate: number;
  topSubdomains: Array<{
    subdomain: string;
    tenantName: string;
    traffic: number;
    visitors: number;
    pageViews: number;
    status: 'active' | 'pending' | 'inactive';
  }>;
  trafficTrends: Array<{
    date: string;
    traffic: number;
    visitors: number;
    pageViews: number;
  }>;
}

/**
 * Service for managing analytics and reporting operations
 * Handles enrichment analytics, product search, and subdomain statistics
 */
export class AnalyticsService extends AdminApiSingleton {
  private static instance: AnalyticsService;
  private constructor() {
    super('analytics-service', {
      ttl: 5 * 60 * 1000 // 5 minutes for analytics data
    });
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Get admin enrichment analytics
   */
  async getAdminEnrichmentAnalytics(): Promise<Analytics | null> {
    const response = await this.makeDefaultRequest<Analytics>(
      `/api/admin/enrichment/analytics?_t=${Date.now()}`,
      {},
      'enrichment-analytics',
      5 * 60 * 1000 // 5 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Search admin enrichment products
   */
  async searchAdminEnrichmentProducts(params: EnrichmentSearchParams): Promise<{
    products: EnrichmentProduct[];
    total: number;
    hasMore: boolean;
  } | null> {
    // Build query string from params
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.append('search', params.search);
    if (params.source) queryParams.append('source', params.source);
    if (params.status) queryParams.append('status', params.status);
    if (params.category) queryParams.append('category', params.category);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/api/admin/enrichment/products/search${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeDefaultRequest<{
      products: EnrichmentProduct[];
      total: number;
      hasMore: boolean;
    }>(
      endpoint,
      {},
      `enrichment-search-${JSON.stringify(params)}`,
      3 * 60 * 1000 // 3 minutes cache for search results
    );

    return response?.data || null;
  }

  /**
   * Get admin enrichment product details
   */
  async getAdminEnrichmentProduct(barcode: string): Promise<EnrichmentProduct | null> {
    if (!barcode) {
      throw new Error('Barcode is required');
    }

    const response = await this.makeDefaultRequest<EnrichmentProduct>(
      `/api/admin/enrichment/products/${barcode}`,
      {},
      `enrichment-product-${barcode}`,
      10 * 60 * 1000 // 10 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Get admin subdomain stats
   */
  async getAdminSubdomainStats(): Promise<SubdomainStats | null> {
    const response = await this.makeDefaultRequest<SubdomainStats>(
      '/api/analytics/subdomain-stats',
      {},
      'subdomain-stats',
      10 * 60 * 1000 // 10 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Get enrichment trends
   */
  async getEnrichmentTrends(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<{
    trends: Array<{
      period: string;
      enriched: number;
      failed: number;
      pending: number;
      total: number;
      rate: number;
    }>;
  } | null> {
    const response = await this.makeDefaultRequest<{
      trends: Array<{
        period: string;
        enriched: number;
        failed: number;
        pending: number;
        total: number;
        rate: number;
      }>;
    }>(
      `/api/admin/enrichment/trends?period=${period}`,
      {},
      `enrichment-trends-${period}`,
      15 * 60 * 1000 // 15 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Get source analytics
   */
  async getSourceAnalytics(): Promise<Array<{
    source: string;
    total: number;
    enriched: number;
    failed: number;
    pending: number;
    rate: number;
  }> | null> {
    const response = await this.makeDefaultRequest<{
      sources: Array<{
        source: string;
        total: number;
        enriched: number;
        failed: number;
        pending: number;
        rate: number;
      }>;
    }>(
      '/api/admin/enrichment/sources',
      {},
      'source-analytics',
      20 * 60 * 1000 // 20 minutes cache
    );

    if (!response?.success) {
      clientLogger.error('[AnalyticsService] Failed to get source analytics:', { detail: response?.error });
      return null;
    }

    return response.data?.sources || null;
  }

  /**
   * Get category enrichment analytics
   */
  async getCategoryEnrichmentAnalytics(): Promise<Array<{
    category: string;
    total: number;
    enriched: number;
    failed: number;
    pending: number;
    rate: number;
  }> | null> {
    const response = await this.makeDefaultRequest<{
      categories: Array<{
        category: string;
        total: number;
        enriched: number;
        failed: number;
        pending: number;
        rate: number;
      }>;
    }>(
      '/api/admin/enrichment/categories',
      {},
      'category-enrichment-analytics',
      20 * 60 * 1000 // 20 minutes cache
    );

    if (!response?.success) {
      clientLogger.error('[AnalyticsService] Failed to get category enrichment analytics:', { detail: response?.error });
      return null;
    }

    return response.data?.categories || null;
  }

  /**
   * Trigger enrichment for products
   */
  async triggerEnrichment(productIds: string[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  } | null> {
    const response = await this.makeDefaultRequest<{
      success: number;
      failed: number;
      errors: string[];
    }>(
      '/api/admin/enrichment/trigger',
      {
        method: 'POST',
        body: JSON.stringify({ productIds }),
      },
      'trigger-enrichment',
      0 // No cache for triggering
    );

    // Invalidate enrichment analytics cache
    this.invalidateCache('enrichment-analytics');

    return response?.data || null;
  }

  /**
   * Get failed enrichment reasons
   */
  async getFailedEnrichmentReasons(): Promise<Array<{
    reason: string;
    count: number;
    percentage: number;
    lastOccurred: string;
  }> | null> {
    const response = await this.makeDefaultRequest<{
      reasons: Array<{
        reason: string;
        count: number;
        percentage: number;
        lastOccurred: string;
      }>;
    }>(
      '/api/admin/enrichment/failures',
      {},
      'failed-enrichment-reasons',
      30 * 60 * 1000 // 30 minutes cache
    );

    if (!response?.success) {
      clientLogger.error('[AnalyticsService] Failed to get failed enrichment reasons:', { detail: response?.error });
      return null;
    }

    return response.data?.reasons || null;
  }

  /**
   * Export enrichment data
   */
  async exportEnrichmentData(format: 'csv' | 'json' | 'xlsx' = 'csv'): Promise<{
    downloadUrl: string;
    expiresAt: string;
  } | null> {
    const response = await this.makeDefaultRequest<{
      downloadUrl: string;
      expiresAt: string;
    }>(
      `/api/admin/enrichment/export?format=${format}`,
      {
        method: 'POST',
      },
      `export-enrichment-${format}`,
      0 // No cache for exports
    );

    if (!response?.success) {
      clientLogger.error('[AnalyticsService] Failed to export enrichment data:', { detail: response?.error });
      return null;
    }

    return response.data || null;
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance();
