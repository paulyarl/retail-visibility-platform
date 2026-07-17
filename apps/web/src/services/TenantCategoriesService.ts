import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface Category {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlignmentStatus {
  total: number;
  mapped: number;
  unmapped: number;
  mappingCoverage: number;
  isCompliant: boolean;
  status: string;
}

export interface CategoryFormData {
  name: string;
  slug?: string;
  googleCategoryId?: string;
  sortOrder: number;
  isActive?: boolean;
}

export interface GoogleTaxonomyCategory {
  id: string;
  name: string;
  path: string[];
  level: number;
  hasChildren?: boolean;
}

/**
 * Tenant Categories Singleton Service
 * Handles all tenant category operations with proper authentication and caching
 */
class TenantCategoriesService extends TenantApiSingleton {
  private static instance: TenantCategoriesService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-categories-service*',
      'tenant-categories*',
      'category-management*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-categories-service*');
    await this.invalidateCachePattern('tenant-categories*');
    await this.invalidateCachePattern('category-management*');
  }

  // Different TTL for different category operations
  private readonly CATEGORIES_TTL = 5 * 60 * 1000; // 5 minutes for categories
  private readonly ALIGNMENT_TTL = 2 * 60 * 1000; // 2 minutes for alignment status
  private readonly TAXONOMY_TTL = 30 * 60 * 1000; // 30 minutes for taxonomy (static)

  protected constructor() {
    super('tenant-categories-singleton');
  }

  public static getInstance(): TenantCategoriesService {
    if (!TenantCategoriesService.instance) {
      TenantCategoriesService.instance = new TenantCategoriesService();
    }
    return TenantCategoriesService.instance;
  }

  /**
   * Get a single Google taxonomy category by ID
   * Uses the /api/taxonomy/:id endpoint
   */
  async getGoogleTaxonomyById(googleCategoryId: string): Promise<GoogleTaxonomyCategory | null> {
    try {
      const response = await this.makeDefaultRequest<{ success: boolean; data: GoogleTaxonomyCategory }>(
        `/api/taxonomy/${googleCategoryId}`,
        {},
        `google-taxonomy-${googleCategoryId}`,
        this.TAXONOMY_TTL
      );

      return response.data?.data || null;
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to get Google taxonomy:', { detail: error });
      return null;
    }
  }

  /**
   * Search Google taxonomy categories
   * Uses the /api/taxonomy/search endpoint
   */
  async searchGoogleTaxonomy(query: string, limit: number = 20): Promise<GoogleTaxonomyCategory[]> {
    try {
      const response = await this.makeDefaultRequest<{ success: boolean; results: GoogleTaxonomyCategory[] }>(
        `/api/taxonomy/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        {},
        `google-taxonomy-search-${query}`,
        this.TAXONOMY_TTL
      );

      return response.data?.results || [];
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to search Google taxonomy:', { detail: error });
      return [];
    }
  }

  /**
   * Browse Google taxonomy categories
   * Uses the /api/taxonomy/browse endpoint
   */
  async browseGoogleTaxonomy(path?: string): Promise<GoogleTaxonomyCategory[]> {
    try {
      const url = path 
        ? `/api/taxonomy/browse?path=${encodeURIComponent(path)}`
        : '/api/taxonomy/browse';

      const response = await this.makeDefaultRequest<{ success: boolean; categories: GoogleTaxonomyCategory[] }>(
        url,
        {},
        `google-taxonomy-browse-${path || 'root'}`,
        this.TAXONOMY_TTL
      );

      return response.data?.categories || [];
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to browse Google taxonomy:', { detail: error });
      return [];
    }
  }

  /**
   * Get tenant categories
   * Uses the /api/v1/tenants/:tenantId/categories endpoint
   * @param tenantId - The tenant ID
   * @param includeInactive - If true, includes inactive categories (default: false)
   */
  async getTenantCategories(tenantId: string, includeInactive: boolean = false): Promise<Category[]> {
    try {
      const query = includeInactive ? '?includeInactive=true' : '';
      const response = await this.makeDefaultRequest<{ data: Category[] }>(
        `/api/v1/tenants/${tenantId}/categories${query}`,
        {},
        `tenant-categories-${tenantId}${includeInactive ? '-all' : ''}`,
        this.CATEGORIES_TTL
      );
      if (!response.data) {
        return [];
      }

      return response.data?.data || [];
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to get tenant categories:', { detail: error });
      return [];
    }
  }

  /**
   * Get categories alignment status
   * Uses the /api/v1/tenants/:tenantId/categories-alignment-status endpoint
   */
  async getAlignmentStatus(tenantId: string): Promise<AlignmentStatus | null> {
    try {
      const response = await this.makeDefaultRequest<{ data: AlignmentStatus }>(
        `/api/v1/tenants/${tenantId}/categories-alignment-status`,
        {},
        `alignment-status-${tenantId}`,
        this.ALIGNMENT_TTL
      );

      return response.data?.data || null;
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to get alignment status:', { detail: error });
      return null;
    }
  }

  /**
   * Create new category
   * Uses the /api/v1/tenants/:tenantId/categories endpoint
   */
  async createCategory(tenantId: string, data: CategoryFormData): Promise<Category | null> {
    try {
      // Generate slug: lowercase, replace spaces with dashes, remove special chars except dashes
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/\s+/g, '-')           // Replace spaces with dashes
          .replace(/&/g, '-and-')          // Replace & with -and-
          .replace(/[^a-z0-9-]/g, '')      // Remove any other special chars
          .replace(/-+/g, '-')             // Collapse multiple dashes
          .replace(/^-|-$/g, '');           // Remove leading/trailing dashes
      };

      const response = await this.makeDefaultRequest<{ success: boolean; data: Category }>(
        `/api/v1/tenants/${tenantId}/categories`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            slug: data.slug || generateSlug(data.name),
            googleCategoryId: data.googleCategoryId,
            sortOrder: data.sortOrder,
            isActive: data.isActive
          }),
        },
        `tenant-categories-${tenantId}`
      );
      
      if (!response?.success) {
        clientLogger.error('[TenantCategoriesService] Failed to create category:', { detail: response.error });
        throw response.error;
      }

      // Invalidate cached categories
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      
      // makeDefaultRequest returns the raw response: { success: true, data: Category }
      // Extract the Category object from response.data
      if (response && typeof response === 'object' && 'data' in response) {
        return (response as any).data;
      }
      return null;
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to create category:', { detail: error });
      return null;
    }
  }

  /**
   * Update existing category
   * Uses the /api/v1/tenants/:tenantId/categories/:categoryId endpoint
   */
  async updateCategory(tenantId: string, categoryId: string, data: Partial<CategoryFormData>): Promise<Category | null> {
    try {
      const results = await this.makeDefaultRequest<Category>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: data.name,
            sortOrder: data.sortOrder,
            isActive: data.isActive
          }),
        },
        `tenant-categories-${tenantId}`
      );
      if (!results?.success) {
        clientLogger.error('[TenantCategoriesService] Failed to update category:', { detail: results.error });
        throw results.error;
      }

      // Invalidate cached categories
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      
      return results.data || null;
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to update category:', { detail: error });
      return null;
    }
  }

  /**
   * Delete category
   * Uses the /api/v1/tenants/:tenantId/categories/:categoryId endpoint
   */
  async deleteCategory(tenantId: string, categoryId: string): Promise<boolean> {
    try {
      const results = await this.makeDefaultRequest<void>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
        {
          method: 'DELETE',
        },
        `tenant-categories-${tenantId}`
      );

      if (!results?.success) {
        clientLogger.error('[TenantCategoriesService] Failed to delete category:', { detail: results.error });
        throw results.error;
      }

      // Invalidate cached categories
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      
      return true;
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to delete category:', { detail: error });
      return false;
    }
  }

  /**
   * Align category with Google category
   * Uses the /api/v1/tenants/:tenantId/categories/:categoryId/align endpoint
   */
  async alignCategory(tenantId: string, categoryId: string, googleCategoryId: string): Promise<boolean> {
    try {
      const results = await this.makeDefaultRequest<void>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}/align`,
        {
          method: 'POST',
          body: JSON.stringify({ googleCategoryId }),
        },
        `alignment-status-${tenantId}`
      );
      if (!results?.success) {
        clientLogger.error('[TenantCategoriesService] Failed to align category:', { detail: results.error });
        throw results.error;
      }

      // Invalidate cached alignment status
      await this.invalidateCache(`alignment-status-${tenantId}`);
      
      return true;
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to align category:', { detail: error });
      return false;
    }
  }

  /**
   * Bulk delete categories
   */
  async bulkDeleteCategories(tenantId: string, categoryIds: string[]): Promise<{ success: string[], failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    try {
      const deletePromises = categoryIds.map(async (id) => {
        try {
          await this.deleteCategory(tenantId, id);
          success.push(id);
        } catch (error) {
          failed.push(id);
        }
      });

      await Promise.all(deletePromises);
      
      // Invalidate cached data
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      await this.invalidateCache(`alignment-status-${tenantId}`);
      
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to bulk delete categories:', { detail: error });
    }

    return { success, failed };
  }

  /**
   * Quick start categories setup
   * Uses the /api/v1/tenants/:tenantId/categories/quick-start endpoint
   */
  async quickStartCategories(tenantId: string, businessType: string, categoryCount: number, storefrontType?: string): Promise<Category[]> {
    try {
      const response = await this.makeDefaultRequest<{ data: Category[] }>(
        `/api/v1/tenants/${tenantId}/categories/quick-start`,
        {
          method: 'POST',
          body: JSON.stringify({ businessType, categoryCount, storefrontType }),
        },
        `tenant-categories-${tenantId}`
      );

      if (!response?.success) {
        clientLogger.error('[TenantCategoriesService] Failed to quick start categories:', { detail: response.error });
        throw response.error;
      }

      // Invalidate cached categories and alignment status
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      await this.invalidateCache(`alignment-status-${tenantId}`);
      
      return response.data?.data || [];
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to quick start categories:', { detail: error });
      return [];
    }
  }

  /**
   * Propagate categories to hero tenants
   * Uses the /api/v1/tenants/:heroTenantId/categories/propagate endpoint
   */
  async propagateCategories(heroTenantId: string, mode: string = 'all'): Promise<boolean> {
    try {
      const results = await this.makeDefaultRequest<void>(
        `/api/v1/tenants/${heroTenantId}/categories/propagate`,
        {
          method: 'POST',
          body: JSON.stringify({ mode }),
        },
        `propagation-${heroTenantId}`
      );
      if (!results.success){
        clientLogger.error('[TenantCategoriesService] Failed to propagate categories:', { detail: results.error });
        throw results.error;
      }

      return true;
    } catch (error) {
      clientLogger.error('[TenantCategoriesService] Failed to propagate categories:', { detail: error });
      return false;
    }
  }

  /**
   * Invalidate all tenant category cache
   */
  public async invalidateTenantCategoriesCache(tenantId: string): Promise<void> {
    const patterns = [
      `tenant-categories-${tenantId}`,
      `alignment-status-${tenantId}`,
      `propagation-${tenantId}`
    ];

    for (const pattern of patterns) {
      await this.invalidateCache(pattern);
    }
  }
}

// Export singleton instance
export const tenantCategoriesService = TenantCategoriesService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateTenantCategoriesCache = async (tenantId: string): Promise<void> => {
  await tenantCategoriesService.invalidateTenantCategoriesCache(tenantId);
};
