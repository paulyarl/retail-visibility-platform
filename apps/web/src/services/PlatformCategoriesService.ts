/**
 * Platform Categories Service
 * 
 * Extends AdminApiSingleton to provide platform-wide category management
 * Handles category CRUD, ordering, and bulk operations with admin privileges
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface PlatformCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  googleCategoryId?: string;
  parentId?: string;
  isActive: boolean;
  sortOrder: number;
  level: number;
  path: string;
  createdAt: string;
  updatedAt: string;
  children?: PlatformCategory[];
}

/**
 * Service for managing platform-wide categories
 * Handles category CRUD, reordering, and bulk import operations
 */
export class PlatformCategoriesService extends AdminApiSingleton {
  private static instance: PlatformCategoriesService;

  private constructor() {
    super('platform-categories-service', {
      ttl: 30 * 60 * 1000 // 30 minutes for category data
    });
  }

  static getInstance(): PlatformCategoriesService {
    if (!PlatformCategoriesService.instance) {
      PlatformCategoriesService.instance = new PlatformCategoriesService();
    }
    return PlatformCategoriesService.instance;
  }

  /**
   * Get platform categories
   */
  async getPlatformCategories(): Promise<PlatformCategory[] | null> {
    const response = await this.makeDefaultRequest<PlatformCategory[]>(
      '/api/admin/platform-categories',
      {},
      'platform-categories',
      30 * 60 * 1000 // 30 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Create platform category
   */
  async createPlatformCategory(categoryData: Partial<PlatformCategory>): Promise<PlatformCategory | null> {
    const response = await this.makeDefaultRequest<PlatformCategory>(
      '/api/admin/platform-categories',
      {
        method: 'POST',
        body: JSON.stringify(categoryData),
      },
      'create-platform-category',
      0 // No cache for creation
    );

    // Invalidate categories cache
    this.invalidateAdminCache('platform-categories');

    return response?.data || null;
  }

  /**
   * Update platform category
   */
  async updatePlatformCategory(categoryId: string, categoryData: Partial<PlatformCategory>): Promise<PlatformCategory | null> {
    if (!categoryId) {
      throw new Error('Category ID is required');
    }

    const response = await this.makeDefaultRequest<PlatformCategory>(
      `/api/admin/platform-categories/${categoryId}`,
      {
        method: 'PUT',
        body: JSON.stringify(categoryData),
      },
      `category-${categoryId}`,
      0 // No cache for updates
    );

    // Invalidate categories cache
    this.invalidateAdminCache('platform-categories');

    return response?.data || null;
  }

  /**
   * Delete platform category
   */
  async deletePlatformCategory(categoryId: string): Promise<void> {
    if (!categoryId) {
      throw new Error('Category ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/platform-categories/${categoryId}`,
      {
        method: 'DELETE',
      },
      `delete-category-${categoryId}`,
      0 // No cache for deletion
    );

    // Invalidate categories cache
    this.invalidateAdminCache('platform-categories');
  }

  /**
   * Reorder platform categories
   */
  async reorderPlatformCategories(categoryIds: string[]): Promise<void> {
    const response = await this.makeDefaultRequest<void>(
      '/api/admin/platform-categories/reorder',
      {
        method: 'POST',
        body: JSON.stringify({ categoryIds }),
      },
      'reorder-categories',
      0 // No cache for reordering
    );

    // Invalidate categories cache
    this.invalidateAdminCache('platform-categories');
  }

  /**
   * Bulk import platform categories
   */
  async bulkImportPlatformCategories(source: string): Promise<any> {
    const response = await this.makeDefaultRequest<any>(
      '/api/platform/categories/bulk-import',
      {
        method: 'POST',
        body: JSON.stringify({ source }),
      },
      'bulk-import-categories',
      0 // No cache for bulk operations
    );

    // Invalidate categories cache
    this.invalidateAdminCache('platform-categories');

    return response;
  }

  /**
   * Create platform category from Google
   */
  async createPlatformCategoryFromGoogle(categoryData: {
    name: string;
    slug: string;
    googleCategoryId: string;
    parentId?: string;
  }): Promise<PlatformCategory | null> {
    const response = await this.makeDefaultRequest<PlatformCategory>(
      '/api/admin/platform-categories/from-google',
      {
        method: 'POST',
        body: JSON.stringify(categoryData),
      },
      'create-category-from-google',
      0 // No cache for creation
    );

    // Invalidate categories cache
    this.invalidateAdminCache('platform-categories');

    return response?.data || null;
  }
}

// Export singleton instance
export const platformCategoriesService = PlatformCategoriesService.getInstance();
