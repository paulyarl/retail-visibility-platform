/**
 * Admin Categories Service - Admin API Pattern
 * 
 * Manages admin category operations for platform administration
 * Uses google_taxonomy_list table for Google Product Categories
 * Extends AdminApiSingleton for admin privilege validation and caching
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { googleTaxonomyPublicService, type GoogleTaxonomyPath } from './GoogleTaxonomyPublicService';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface AdminCategory {
  id: string;
  category_id: string;
  name: string;
  full_path: string;
  level: number;
  parent_id: string | null;
  is_active: boolean;
}

export interface CreateCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  icon_emoji?: string;
  googleCategoryId?: string;
  parentId?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  icon_emoji?: string;
  googleCategoryId?: string;
  parentId?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/**
 * Admin Categories Service - Authenticated API Pattern
 * 
 * Manages admin category operations for platform administration
 * Uses AdminApiSingleton for admin privilege validation and caching
 */
class AdminCategoriesService extends AdminApiSingleton {

    protected defaultContext: AppContext = AppContext.ADMIN;
    protected defaultIsolation: CacheIsolation = CacheIsolation.ADMIN;
  private static instance: AdminCategoriesService;

  // TTL constants for different data types
  private readonly CATEGORIES_TTL = 10 * 60 * 1000; // 10 minutes for categories
  private readonly TAXONOMY_TTL = 30 * 60 * 1000; // 30 minutes for taxonomy data

  private constructor() {
    super('admin-categories-service');
  }

  static getInstance(): AdminCategoriesService {
    if (!AdminCategoriesService.instance) {
      AdminCategoriesService.instance = new AdminCategoriesService();
    }
    return AdminCategoriesService.instance;
  }

  /**
   * Get all Google Product Taxonomy categories
   * Uses /api/admin/taxonomy endpoint (google_taxonomy_list table)
   * @param forceRefresh - Bypass cache and fetch fresh data
   */
  async getCategories(forceRefresh: boolean = false): Promise<AdminCategory[]> {
    // If forceRefresh, use unique cache key to bypass stale cache
    const cacheKey = forceRefresh 
      ? `admin-taxonomy-list-${Date.now()}` 
      : 'admin-taxonomy-list';
    
    const result = await this.makeDefaultRequest<{ success: boolean; data: AdminCategory[]; pagination: { total: number } }>(
      '/api/admin/taxonomy',
      {},
      cacheKey,
      forceRefresh ? 0 : this.CATEGORIES_TTL
    );

    if (!result.success) {
      clientLogger.error('[AdminCategoriesService] Failed to get categories:', { detail: result.error });
      return [];
    }

    // makeDefaultRequest wraps the API response: result.data = { success: true, data: Category[], pagination }
    const apiResponse = result.data;
    if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
      return apiResponse.data;
    }
    clientLogger.warn('[AdminCategoriesService] Expected array but got:', { detail: typeof apiResponse?.data, detail2: apiResponse });
    return [];
  }

  /**
   * Search Google Product Taxonomy categories
   * Uses /api/taxonomy/search which searches the JSON file directly (fast, no DB)
   * @param query - Search query
   * @param limit - Max results (default 100)
   */
  async searchCategories(query: string, limit: number = 100): Promise<AdminCategory[]> {
    if (!query.trim()) {
      return this.getCategories(true);
    }

    interface TaxonomySearchResult {
      id: string;
      name: string;
      path: string[];
      level: number;
    }

    const result = await this.makeDefaultRequest<{ success: boolean; results: TaxonomySearchResult[]; total: number }>(
      `/api/taxonomy/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {},
      `taxonomy-search-${query}-${limit}`,
      60 * 1000 // 1 minute TTL
    );

    if (!result.success) {
      clientLogger.error('[AdminCategoriesService] Search failed:', { detail: result.error });
      return [];
    }

    // API returns { success: true, results: [...], total: n }
    const apiResponse = result.data;
    if (apiResponse && Array.isArray(apiResponse.results)) {
      // Map to AdminCategory format
      return apiResponse.results.map(cat => ({
        id: cat.id,
        category_id: cat.id,
        name: cat.name,
        full_path: Array.isArray(cat.path) ? cat.path.join(' > ') : cat.name,
        level: cat.level || (cat.path?.length || 1),
        parent_id: null,
        is_active: true,
      }));
    }
    return [];
  }

  /**
   * Propagate selected categories to tenant catalogs
   * Admin-only operation to push Google taxonomy categories to tenant directory_category tables
   */
  async propagateCategories(params: {
    categories: Array<{ category_id: string; name: string; full_path: string }>;
    scope: 'tenant' | 'organization' | 'platform';
    tenantId?: string;
    organizationId?: string;
    dryRun: boolean;
  }): Promise<{ success: boolean; propagated: number; tenantsAffected: number; dryRun: boolean; error?: string }> {
    try {
      const response = await this.makeDefaultRequest<{ success: boolean; propagated: number; tenantsAffected: number; dryRun: boolean }>(
        '/api/admin/categories/propagate',
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
        `admin-propagate-${Date.now()}`,
        0 // No cache for mutations
      );

      if (!response.success) {
        clientLogger.error('[AdminCategoriesService] Propagation failed:', { detail: response.error });
        const errorMsg = typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
        return { success: false, propagated: 0, tenantsAffected: 0, dryRun: params.dryRun, error: errorMsg };
      }

      return response.data || { success: true, propagated: 0, tenantsAffected: 0, dryRun: params.dryRun };
    } catch (error: any) {
      clientLogger.error('[AdminCategoriesService] Propagation error:', { detail: error });
      return { success: false, propagated: 0, tenantsAffected: 0, dryRun: params.dryRun, error: error.message };
    }
  }

  /**
   * Get premium featured products
   */
  async getPremiumFeaturedProducts(limit: number = 20): Promise<{ products: any[] }> {
    const response = await this.makeDefaultRequest<{ products: any[] }>(
      `/api/directory/premium-featured-products?limit=${limit}`,
      {},
      'directory-premium-featured-products',
      10 * 60 * 1000 // 10 minutes cache
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to get premium featured products:', { detail: response.error });
      return { products: [] };
    }

    return response.data || { products: [] };
  }

  /**
   * Get GBP seed categories
   */
  async getGbpSeedCategories(): Promise<{ categories: any[] }> {
    const response = await this.makeDefaultRequest<{ categories: any[] }>(
      '/api/platform/categories/gbp-seed',
      {},
      'platform-gbp-seed-categories',
      30 * 60 * 1000 // 30 minutes cache
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to get GBP seed categories:', { detail: response.error });
      return { categories: [] };
    }

    return response.data || { categories: [] };
  }

  /**
   * Get category by ID
   */
  async getCategory(categoryId: string): Promise<AdminCategory | null> {
    const result = await this.makeDefaultRequest<AdminCategory>(
      `/api/platform/categories/${categoryId}`,
      {},
      `admin-category-${categoryId}`,
      this.CATEGORIES_TTL
    );

    if (!result.success) {
      console.error('[AdminCategoriesService] Failed to get category:', {
        categoryId,
        error: result.error,
        status: result.status
      });
      return null;
    }

    return result.data || null;
  }

  /**
   * Create a new category
   */
  async createCategory(categoryData: CreateCategoryRequest): Promise<AdminCategory | null> {
    const response = await this.makeDefaultRequest<AdminCategory>(
      '/api/platform/categories',
      {
        method: 'POST',
        body: JSON.stringify(categoryData)
      },
      `admin-create-category-${Date.now()}`,
      this.CATEGORIES_TTL
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to create category:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Update an existing category
   */
  async updateCategory(categoryId: string, categoryData: UpdateCategoryRequest): Promise<AdminCategory | null> {
    const response = await this.makeDefaultRequest<AdminCategory>(
      `/api/platform/categories/${categoryId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(categoryData)
      },
      `admin-update-category-${categoryId}-${Date.now()}`,
      this.CATEGORIES_TTL
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to update category:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    const response = await this.makeDefaultRequest<void>(
      `/api/platform/categories/${categoryId}`,
      { method: 'DELETE' },
      `admin-delete-category-${categoryId}-${Date.now()}`,
      this.CATEGORIES_TTL
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to delete category:', { detail: response.error });
      return false;
    }

    return true;
  }

  /**
   * Reorder categories
   */
  async reorderCategories(categoryIds: string[]): Promise<boolean> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/admin/platform-categories/reorder',
        {
          method: 'POST',
          body: JSON.stringify({ categoryIds })
        },
        `admin-reorder-categories-${Date.now()}`,
        this.CATEGORIES_TTL
      );

      return true;
    } catch (error) {
      clientLogger.error('[AdminCategoriesService] Failed to reorder categories:', { detail: error });
      return false;
    }
  }

  /**
   * Get Google taxonomy path for a category
   */
  async getGoogleTaxonomyPath(googleCategoryId: string): Promise<GoogleTaxonomyPath | null> {
    try {
      // Use the dedicated public service for Google taxonomy operations
      return await googleTaxonomyPublicService.getGoogleTaxonomyPath(googleCategoryId);
    } catch (error) {
      clientLogger.error('[AdminCategoriesService] Failed to get Google taxonomy path:', { detail: error });
      return null;
    }
  }

  /**
   * Get categories for quick start
   */
  async getQuickStartCategories(businessType: string, categoryCount: number, storefrontType?: string): Promise<AdminCategory[]> {
    const response = await this.makeDefaultRequest<{
      categories: AdminCategory[];
    }>(
      '/api/platform/categories/quick-start',
      {
        method: 'POST',
        body: JSON.stringify({ businessType, categoryCount, storefrontType })
      },
      `admin-quick-start-${businessType}-${categoryCount}`,
      this.CATEGORIES_TTL
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to get quick start categories:', { detail: response.error });
      return [];
    }

    return response.data?.categories || [];
  }

  /**
   * Seed GBP categories
   */
  async seedGBPCategories(): Promise<boolean> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/platform/categories/gbp-seed',
        { method: 'POST' },
        'admin-seed-gbp-categories',
        this.CATEGORIES_TTL
      );

      return true;
    } catch (error) {
      clientLogger.error('[AdminCategoriesService] Failed to seed GBP categories:', { detail: error });
      return false;
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<{
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    categoriesWithGoogleMapping: number;
    categoriesWithoutGoogleMapping: number;
    totalProductCount: number;
    totalTenantCount: number;
  }> {
    const response = await this.makeDefaultRequest<{
      totalCategories: number;
      activeCategories: number;
      inactiveCategories: number;
      categoriesWithGoogleMapping: number;
      categoriesWithoutGoogleMapping: number;
      totalProductCount: number;
      totalTenantCount: number;
    }>(
      '/api/admin/categories/stats',
      {},
      'admin-category-stats',
      this.CATEGORIES_TTL
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to get category stats:', { detail: response.error });
      return {
        totalCategories: 0,
        activeCategories: 0,
        inactiveCategories: 0,
        categoriesWithGoogleMapping: 0,
        categoriesWithoutGoogleMapping: 0,
        totalProductCount: 0,
        totalTenantCount: 0,
      };
    }

    return response.data || {
      totalCategories: 0,
      activeCategories: 0,
      inactiveCategories: 0,
      categoriesWithGoogleMapping: 0,
      categoriesWithoutGoogleMapping: 0,
      totalProductCount: 0,
      totalTenantCount: 0,
    };
  }

  /**
   * Get mirror last run summary
   */
  async getMirrorLastRunSummary(tenantId?: string): Promise<any> {
    const qs = new URLSearchParams();
    if (tenantId) qs.set('tenantId', tenantId);
    qs.set('strategy', 'platform_to_gbp');

    const response = await this.makeDefaultRequest<any>(
      `/api/admin/mirror/last-run?${qs.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      'admin-mirror-last-run',
      5 * 60 * 1000 // 5 minutes cache
    );

    if (!response.success) {
      clientLogger.error('[AdminCategoriesService] Failed to get mirror last run summary:', { detail: response.error });
      return null;
    }

    return response.data;
  }
}

// Export singleton instance
export const adminCategoriesService = AdminCategoriesService.getInstance();
