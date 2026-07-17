import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

interface SelectedCategory {
  id: string;
  name: string;
}

interface CategoryMapping {
  gbpCategoryId: string;
  gbpCategoryName: string;
  platformCategory: {
    id: string;
    name: string;
    slug: string;
    icon: string;
  } | null;
  mappingConfidence: string;
  isMapped: boolean;
}

interface GBPCategoryUpdateData {
  primary: {
    id: string;
    name: string;
  };
  secondary: {
    id: string;
    name: string;
  }[];
}

interface GBPCategory {
  id: string;
  name: string;
  path: string[];
}

class GBPCategoryService extends TenantApiSingleton {
  private static instance: GBPCategoryService | null = null;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'gbp-categories*',
      'category-mappings*',
      'gbp-taxonomy*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('gbp-categories*');
    await this.invalidateCachePattern('category-mappings*');
    await this.invalidateCachePattern('gbp-taxonomy*');
  }

  private constructor() {
    super('gbp-category');
  }

  public static getInstance(): GBPCategoryService {
    if (!GBPCategoryService.instance) {
      GBPCategoryService.instance = new GBPCategoryService();
    }
    return GBPCategoryService.instance;
  }

  /**
   * Get GBP category mappings for specified categories
   */
  async getCategoryMappings(categoryIds: string[]): Promise<CategoryMapping[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const idsParam = categoryIds.join(',');
    const result = await this.makeDefaultRequest(
      `/api/gbp/mappings?categoryIds=${encodeURIComponent(idsParam)}`,
      {
        method: 'GET'
      },
      `gbp-mappings-${idsParam}`,
      5 * 60 * 1000 // 5 minutes TTL
    );

    if (!result.success) {
      clientLogger.error('[GBPCategoryService] Failed to fetch mappings:', { detail: result.error });
      return [];
    }

    return (result.data as any)?.data || (result.data as any) || [];
  }

  /**
   * Update GBP categories for a tenant
   */
  async updateGBPCategories(tenantId: string, data: GBPCategoryUpdateData): Promise<boolean> {
    const result = await this.makeDefaultRequest(
      `/api/tenant/gbp-category`,
      {
        method: 'PUT',
        body: JSON.stringify({
          tenantId,
          ...data
        })
      },
      `gbp-category-update-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[GBPCategoryService] Failed to update GBP categories:', { detail: result.error });
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to save GBP categories');
    }

    // Invalidate mappings cache for this tenant
    await this.invalidateCache(`gbp-mappings-*`);

    return true;
  }

  /**
   * Get tenant GBP category profile
   */
  async getTenantGBPCategoryProfile(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest(
      `/api/tenant/profile?tenant_id=${tenantId}`,
      {
        method: 'GET'
      },
      `tenant-gbp-profile-${tenantId}`,
      10 * 60 * 1000 // 10 minutes TTL
    );

    if (!result.success) {
      clientLogger.error('[GBPCategoryService] Failed to get tenant GBP profile:', { detail: result.error });
      return null;
    }

    return result.data;
  }

  /**
   * Get popular GBP categories for tenant
   */
  async getPopularGBPCategories(tenantId: string): Promise<GBPCategory[]> {
    const result = await this.makeDefaultRequest(
      `/api/gbp/categories/popular?tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'GET'
      },
      `gbp-popular-categories-${tenantId}`,
      15 * 60 * 1000 // 15 minutes TTL
    );

    if (!result.success) {
      clientLogger.error('[GBPCategoryService] Failed to fetch popular GBP categories:', { detail: result.error });
      return [];
    }

    return (result.data as any)?.data?.items || (result.data as any)?.items || [];
  }

  /**
   * Search GBP categories
   */
  async searchGBPCategories(query: string, tenantId: string, limit: number = 20): Promise<GBPCategory[]> {
    const result = await this.makeDefaultRequest(
      `/api/gbp/categories?query=${encodeURIComponent(query)}&limit=${limit}&tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'GET'
      },
      `gbp-category-search-${tenantId}-${query}`,
      5 * 60 * 1000 // 5 minutes TTL for search
    );

    if (!result.success) {
      clientLogger.error('[GBPCategoryService] Failed to search GBP categories:', { detail: result.error });
      return [];
    }

    return (result.data as any)?.data?.items || (result.data as any)?.items || [];
  }
}

// Export singleton instance
export const gbpCategoryService = GBPCategoryService.getInstance();
export default gbpCategoryService;
