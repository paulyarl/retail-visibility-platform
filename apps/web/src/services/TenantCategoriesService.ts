import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';
import { googleTaxonomyPublicService, type GoogleTaxonomyPath } from './GoogleTaxonomyPublicService';

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
}

/**
 * Tenant Categories Singleton Service
 * Handles all tenant category operations with proper authentication and caching
 */
class TenantCategoriesService extends AuthenticatedApiSingleton {
  private static instance: TenantCategoriesService;

  // Different TTL for different category operations
  private readonly CATEGORIES_TTL = 5 * 60 * 1000; // 5 minutes for categories
  private readonly ALIGNMENT_TTL = 2 * 60 * 1000; // 2 minutes for alignment status
  private readonly TAXONOMY_TTL = 30 * 60 * 1000; // 30 minutes for taxonomy (static)

  private constructor() {
    super('tenant-categories-singleton');
  }

  public static getInstance(): TenantCategoriesService {
    if (!TenantCategoriesService.instance) {
      TenantCategoriesService.instance = new TenantCategoriesService();
    }
    return TenantCategoriesService.instance;
  }

  /**
   * Get tenant categories
   * Uses the /api/v1/tenants/:tenantId/categories endpoint
   */
  async getTenantCategories(tenantId: string): Promise<Category[]> {
    try {
      const response = await this.makeAuthenticatedRequest<{ data: Category[] }>(
        `/api/v1/tenants/${tenantId}/categories`,
        {},
        `tenant-categories-${tenantId}`,
        this.CATEGORIES_TTL
      );

      return response.data || [];
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to get tenant categories:', error);
      return [];
    }
  }

  /**
   * Get categories alignment status
   * Uses the /api/v1/tenants/:tenantId/categories-alignment-status endpoint
   */
  async getAlignmentStatus(tenantId: string): Promise<AlignmentStatus | null> {
    try {
      const response = await this.makeAuthenticatedRequest<{ data: AlignmentStatus }>(
        `/api/v1/tenants/${tenantId}/categories-alignment-status`,
        {},
        `alignment-status-${tenantId}`,
        this.ALIGNMENT_TTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to get alignment status:', error);
      return null;
    }
  }

  /**
   * Create new category
   * Uses the /api/v1/tenants/:tenantId/categories endpoint
   */
  async createCategory(tenantId: string, data: CategoryFormData): Promise<Category | null> {
    try {
      const response = await this.makeAuthenticatedRequest<Category>(
        `/api/v1/tenants/${tenantId}/categories`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
            sortOrder: data.sortOrder
          }),
        },
        `tenant-categories-${tenantId}`
      );

      // Invalidate cached categories
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      
      return response;
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to create category:', error);
      return null;
    }
  }

  /**
   * Update existing category
   * Uses the /api/v1/tenants/:tenantId/categories/:categoryId endpoint
   */
  async updateCategory(tenantId: string, categoryId: string, data: Partial<CategoryFormData>): Promise<Category | null> {
    try {
      const response = await this.makeAuthenticatedRequest<Category>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: data.name,
            sortOrder: data.sortOrder
          }),
        },
        `tenant-categories-${tenantId}`
      );

      // Invalidate cached categories
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      
      return response;
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to update category:', error);
      return null;
    }
  }

  /**
   * Delete category
   * Uses the /api/v1/tenants/:tenantId/categories/:categoryId endpoint
   */
  async deleteCategory(tenantId: string, categoryId: string): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
        {
          method: 'DELETE',
        },
        `tenant-categories-${tenantId}`
      );

      // Invalidate cached categories
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      
      return true;
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to delete category:', error);
      return false;
    }
  }

  /**
   * Align category with Google category
   * Uses the /api/v1/tenants/:tenantId/categories/:categoryId/align endpoint
   */
  async alignCategory(tenantId: string, categoryId: string, googleCategoryId: string): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}/align`,
        {
          method: 'POST',
          body: JSON.stringify({ googleCategoryId }),
        },
        `alignment-status-${tenantId}`
      );

      // Invalidate cached alignment status
      await this.invalidateCache(`alignment-status-${tenantId}`);
      
      return true;
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to align category:', error);
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
      console.error('[TenantCategoriesService] Failed to bulk delete categories:', error);
    }

    return { success, failed };
  }

  /**
   * Quick start categories setup
   * Uses the /api/v1/tenants/:tenantId/categories/quick-start endpoint
   */
  async quickStartCategories(tenantId: string, businessType: string, categoryCount: number): Promise<Category[]> {
    try {
      const response = await this.makeAuthenticatedRequest<{ data: Category[] }>(
        `/api/v1/tenants/${tenantId}/categories/quick-start`,
        {
          method: 'POST',
          body: JSON.stringify({ businessType, categoryCount }),
        },
        `tenant-categories-${tenantId}`
      );

      // Invalidate cached categories and alignment status
      await this.invalidateCache(`tenant-categories-${tenantId}`);
      await this.invalidateCache(`alignment-status-${tenantId}`);
      
      return response.data || [];
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to quick start categories:', error);
      return [];
    }
  }

  /**
   * Propagate categories to hero tenants
   * Uses the /api/v1/tenants/:heroTenantId/categories/propagate endpoint
   */
  async propagateCategories(heroTenantId: string, mode: string = 'all'): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/v1/tenants/${heroTenantId}/categories/propagate`,
        {
          method: 'POST',
          body: JSON.stringify({ mode }),
        },
        `propagation-${heroTenantId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to propagate categories:', error);
      return false;
    }
  }

  /**
   * Get Google taxonomy path for a category ID
   * Uses the public Google taxonomy service
   */
  async getGoogleTaxonomyPath(googleCategoryId: string): Promise<GoogleTaxonomyPath | null> {
    try {
      // Use the dedicated public service for Google taxonomy operations
      return await googleTaxonomyPublicService.getGoogleTaxonomyPath(googleCategoryId);
    } catch (error) {
      console.error('[TenantCategoriesService] Failed to get Google taxonomy path:', error);
      return null;
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
