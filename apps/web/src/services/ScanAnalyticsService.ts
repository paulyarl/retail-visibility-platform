import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface Analytics {
  totalScanned: number;
  recentScans: {
    last7Days: number;
    last30Days: number;
  };
  dataQuality: {
    withNutrition: number;
    withImages: number;
    withEnvironmental: number;
    withAllergens: number;
    nutritionPercentage: string;
    imagesPercentage: string;
    environmentalPercentage: string;
    allergensPercentage: string;
  };
  topProducts: Array<{
    sku: string;
    name: string;
    brand: string;
    scanCount: number;
  }>;
  cacheBenefit: {
    cacheHits: number;
    apiCallsSaved: number;
    estimatedSavings: string;
  };
}

export interface ProductPreview {
  found: boolean;
  product?: {
    name: string;
    brand: string;
    dataAvailable: {
      nutrition: boolean;
      images: boolean;
      allergens: boolean;
      environmental: boolean;
    };
    popularity: number;
  };
  message?: string;
}

/**
 * Scan Analytics Service
 * Handles scan analytics and product preview operations with proper caching
 * Used for tenant insights and product data preview
 */
class ScanAnalyticsService extends TenantApiSingleton {
  private static instance: ScanAnalyticsService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'scan-analytics*',
      'product-preview*',
      'scan-insights*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('scan-analytics*');
    await this.invalidateCachePattern('product-preview*');
    await this.invalidateCachePattern('scan-insights*');
  }

  // TTL for different types of data
  private readonly ANALYTICS_TTL = 5 * 60 * 1000; // 5 minutes for analytics
  private readonly PREVIEW_TTL = 30 * 60 * 1000; // 30 minutes for product previews

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes cache for scan analytics
      ...cacheOptions
    });
  }

  public static getInstance(): ScanAnalyticsService {
    if (!ScanAnalyticsService.instance) {
      ScanAnalyticsService.instance = new ScanAnalyticsService('scan-analytics-service');
    }
    return ScanAnalyticsService.instance;
  }

  /**
   * Get tenant scan analytics
   * Uses the /api/scan/tenant/:tenantId/analytics endpoint
   */
  async getTenantAnalytics(tenantId: string): Promise<Analytics | null> {
    try {
      // Use default request type (TENANT) for primary operation
      const response = await this.makeDefaultRequest<{
        success: boolean;
        analytics: Analytics;
      }>(
        `/api/scan/tenant/${tenantId}/analytics`,
        {},
        `tenant-analytics-${tenantId}`
      );

      return response?.data?.analytics || null;
    } catch (error) {
      console.error('[ScanAnalyticsService] Failed to get tenant analytics:', error);
      return null;
    }
  }

  /**
   * Preview product data by barcode
   * Uses the /api/scan/preview/:barcode endpoint
   */
  async previewProduct(barcode: string): Promise<ProductPreview | null> {
    try {
      if (!barcode.trim()) {
        throw new Error('Barcode is required');
      }

      const response = await this.makeDefaultRequest<{
        success: boolean;
        product?: any;
        message?: string;
      }>(
        `/api/scan/preview/${barcode}`,
        {},
        `product-preview-${barcode}`,
        this.PREVIEW_TTL
      );

      if (!response?.data?.success) {
        return {
          found: false,
          message: response?.data?.message || 'Product not found'
        };
      }

      return {
        found: true,
        product: {
          name: response.data.product.name,
          brand: response.data.product.brand,
          dataAvailable: {
            nutrition: response.data.product.nutrition ? true : false,
            images: response.data.product.images ? true : false,
            allergens: response.data.product.allergens ? true : false,
            environmental: response.data.product.environmental ? true : false,
          },
          popularity: response.data.product.popularity || 0
        }
      };
    } catch (error) {
      console.error('[ScanAnalyticsService] Failed to preview product:', error);
      return {
        found: false,
        message: 'Failed to preview product'
      };
    }
  }

  /**
   * Invalidate analytics cache for tenant
   */
  public async invalidateAnalyticsCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`tenant-analytics-${tenantId}`);
  }

  /**
   * Get scan session statistics for admin
   * Uses the /api/admin/scan-sessions/stats endpoint
   */
  async getScanSessionStats(tenantId?: string): Promise<{ active: number; total: number } | null> {
    try {
      const url = tenantId 
        ? `/api/scan/tenant/${tenantId}/session-stats`
        : '/api/scan/session-stats';
      
      const response = await this.makeDefaultRequest<{ active: number; total: number }>(
        url,
        {},
        `scan-session-stats-${tenantId || 'all'}`
      );

      return response.data || null;
    } catch (error) {
      console.error('[ScanAnalyticsService] Failed to get scan session stats:', error);
      return null;
    }
  }

  /**
   * Cleanup scan sessions for admin
   * Uses the /api/admin/scan-sessions/cleanup endpoint
   */
  async cleanupScanSessions(tenantId?: string): Promise<{ cleaned: number }> {
    try {
      const response = await this.makeDefaultRequest<{ cleaned: number }>(
        `/api/scan/tenant/${tenantId || 'current'}/cleanup-sessions`,
        {
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        'cleanup-scan-sessions'
      );

      if (!response.data) {
        throw new Error('Failed to cleanup scan sessions: No data returned');
      }
      return response.data;
    } catch (error) {
      console.error('[ScanAnalyticsService] Failed to cleanup scan sessions:', error);
      throw error;
    }
  }

  /**
   * Invalidate product preview cache
   */
  public async invalidatePreviewCache(barcode: string): Promise<void> {
    await this.invalidateCache(`product-preview-${barcode}`);
  }
}

// Export singleton instance
export const scanAnalyticsService = ScanAnalyticsService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateAnalyticsCache = async (tenantId: string): Promise<void> => {
  await scanAnalyticsService.invalidateAnalyticsCache(tenantId);
};

export const invalidatePreviewCache = async (barcode: string): Promise<void> => {
  await scanAnalyticsService.invalidatePreviewCache(barcode);
};
