/**
 * Admin Categories Service - Admin API Pattern
 * 
 * Manages admin category operations for platform administration
 * Extends AdminApiSingleton for admin privilege validation and caching
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { googleTaxonomyPublicService, type GoogleTaxonomyPath } from './GoogleTaxonomyPublicService';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface AdminCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  icon_emoji?: string;
  googleCategoryId?: string;
  parentId?: string;
  level?: number;
  path?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
  tenantCount?: number;
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
   * Get all platform categories
   */
  async getCategories(): Promise<AdminCategory[]> {
    const result = await this.makeDefaultRequest<{
      categories: AdminCategory[];
    }>(
      '/api/platform/categories',
      {},
      'admin-categories-list',
      this.CATEGORIES_TTL
    );

    if (!result.success) {
      console.error('[AdminCategoriesService] Failed to get categories:', result.error);
      return [];
    }

    return result.data?.categories || [];
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
      console.error('[AdminCategoriesService] Failed to get premium featured products:', response.error);
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
      console.error('[AdminCategoriesService] Failed to get GBP seed categories:', response.error);
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
      console.error('[AdminCategoriesService] Failed to create category:', response.error);
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
      console.error('[AdminCategoriesService] Failed to update category:', response.error);
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
      console.error('[AdminCategoriesService] Failed to delete category:', response.error);
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
      console.error('[AdminCategoriesService] Failed to reorder categories:', error);
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
      console.error('[AdminCategoriesService] Failed to get Google taxonomy path:', error);
      return null;
    }
  }

  /**
   * Get categories for quick start
   */
  async getQuickStartCategories(businessType: string, categoryCount: number): Promise<AdminCategory[]> {
    const response = await this.makeDefaultRequest<{
      categories: AdminCategory[];
    }>(
      '/api/platform/categories/quick-start',
      {
        method: 'POST',
        body: JSON.stringify({ businessType, categoryCount })
      },
      `admin-quick-start-${businessType}-${categoryCount}`,
      this.CATEGORIES_TTL
    );

    if (!response.success) {
      console.error('[AdminCategoriesService] Failed to get quick start categories:', response.error);
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
      console.error('[AdminCategoriesService] Failed to seed GBP categories:', error);
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
      console.error('[AdminCategoriesService] Failed to get category stats:', response.error);
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
      console.error('[AdminCategoriesService] Failed to get mirror last run summary:', response.error);
      return null;
    }

    return response.data;
  }
}

// Export singleton instance
export const adminCategoriesService = AdminCategoriesService.getInstance();
