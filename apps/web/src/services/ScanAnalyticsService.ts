import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

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
class ScanAnalyticsService extends AuthenticatedApiSingleton {
  private static instance: ScanAnalyticsService;

  // TTL for different types of data
  private readonly ANALYTICS_TTL = 5 * 60 * 1000; // 5 minutes for analytics
  private readonly PREVIEW_TTL = 30 * 60 * 1000; // 30 minutes for product previews

  private constructor() {
    super('scan-analytics-singleton');
  }

  public static getInstance(): ScanAnalyticsService {
    if (!ScanAnalyticsService.instance) {
      ScanAnalyticsService.instance = new ScanAnalyticsService();
    }
    return ScanAnalyticsService.instance;
  }

  /**
   * Get tenant scan analytics
   * Uses the /api/scan/tenant/:tenantId/analytics endpoint
   */
  async getTenantAnalytics(tenantId: string): Promise<Analytics | null> {
    try {
      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        analytics: Analytics;
      }>(
        `/api/scan/tenant/${tenantId}/analytics`,
        {},
        `tenant-analytics-${tenantId}`,
        this.ANALYTICS_TTL
      );

      return response?.analytics || null;
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

      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        product?: any;
        message?: string;
      }>(
        `/api/scan/preview/${barcode}`,
        {},
        `product-preview-${barcode}`,
        this.PREVIEW_TTL
      );

      if (!response?.success) {
        return {
          found: false,
          message: response?.message || 'Product not found'
        };
      }

      return {
        found: true,
        product: {
          name: response.product.name,
          brand: response.product.brand,
          dataAvailable: {
            nutrition: response.product.nutrition ? true : false,
            images: response.product.images ? true : false,
            allergens: response.product.allergens ? true : false,
            environmental: response.product.environmental ? true : false,
          },
          popularity: response.product.popularity || 0
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
        ? `/api/admin/scan-sessions/stats?tenantId=${tenantId}`
        : '/api/admin/scan-sessions/stats';
      
      const response = await this.makeAuthenticatedRequest<{ active: number; total: number }>(
        url,
        {},
        `scan-session-stats-${tenantId || 'all'}`,
        this.ANALYTICS_TTL
      );

      return response;
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
      const response = await this.makeAuthenticatedRequest<{ cleaned: number }>(
        '/api/admin/scan-sessions/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        'cleanup-scan-sessions',
        0 // No caching for write operations
      );

      return response;
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
