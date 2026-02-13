/**
 * SWIS Preview Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached SWIS preview operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

interface SwisPreviewItem {
  sku: string;
  title: string;
  brand?: string;
  price: number;
  currency: string;
  image_url?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  updated_at: string;
  categoryPath?: string[];
  badges?: Array<'new' | 'sale' | 'low_stock'>;
}

interface UseSwisPreviewOptions {
  tenantId: string;
  limit?: number;
  sortOrder?: 'updated_desc' | 'price_asc' | 'alpha_asc';
}

interface UseSwisPreviewReturn {
  items: SwisPreviewItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refetch: () => void;
}

interface SwisPreviewResponse {
  items: SwisPreviewItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

class SwisPreviewSingletonService extends AuthenticatedApiSingleton {
  private static instance: SwisPreviewSingletonService;

  private constructor() {
    super('swis-preview-singleton');
    this.cacheTTL = 3 * 60 * 1000; // 3 minutes for preview data (changes frequently)
  }

  public static getInstance(): SwisPreviewSingletonService {
    if (!SwisPreviewSingletonService.instance) {
      SwisPreviewSingletonService.instance = new SwisPreviewSingletonService();
    }
    return SwisPreviewSingletonService.instance;
  }

  /**
   * Get SWIS preview items for a specific tenant
   */
  async getSwisPreview(tenantId: string, limit: number = 12, sortOrder: 'updated_desc' | 'price_asc' | 'alpha_asc' = 'updated_desc'): Promise<SwisPreviewResponse | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const params = new URLSearchParams({
        limit: limit.toString(),
        sort: sortOrder,
      });

      const result = await this.makeAuthenticatedRequest<SwisPreviewResponse>(
        `/api/tenant/${tenantId}/swis/preview?${params}`,
        {},
        `swis-preview-${tenantId}-${limit}-${sortOrder}`
      );

      return result || null;
    } catch (error) {
      console.error('[SwisPreviewSingleton] Failed to get SWIS preview:', error);
      return null;
    }
  }

  /**
   * Invalidate SWIS preview cache for a specific tenant
   */
  public async invalidateSwisPreviewCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`swis-preview-${tenantId}*`);
  }

  /**
   * Invalidate all SWIS preview cache
   */
  public async invalidateAllSwisPreviewCache(): Promise<void> {
    await this.invalidateCache('swis-preview-*');
  }
}

// Export singleton instance
export const swisPreviewService = SwisPreviewSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateSwisPreviewCache = async (tenantId: string): Promise<void> => {
  const service = SwisPreviewSingletonService.getInstance();
  await service.invalidateSwisPreviewCache(tenantId);
};

export const invalidateAllSwisPreviewCache = async (): Promise<void> => {
  const service = SwisPreviewSingletonService.getInstance();
  await service.invalidateAllSwisPreviewCache();
};
