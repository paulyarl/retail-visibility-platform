/**
 * Categories Singleton Service
 *
 * Extends PublicApiSingleton to provide cached categories operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  children?: Category[];
  level: number;
  sortOrder: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface CategoriesResponse {
  categories: Category[];
  total: number;
  hasChildren: boolean;
}

class CategoriesSingletonService extends PublicApiSingleton {
  private static instance: CategoriesSingletonService;

  private constructor() {
    super('categories-singleton', {
      ttl: 10 * 60 * 1000 // 10 minutes for categories (moderate change frequency)
    });
  }

  public static getInstance(): CategoriesSingletonService {
    if (!CategoriesSingletonService.instance) {
      CategoriesSingletonService.instance = new CategoriesSingletonService();
    }
    return CategoriesSingletonService.instance;
  }

  /**
   * Get all categories with optional children with caching
   * Uses the /directory/categories endpoint
   */
  async getCategories(includeChildren: boolean = true): Promise<Category[]> {
    const result = await this.makeDefaultRequest<{ categories: Category[] }>(
      `/api/directory/categories?includeChildren=${includeChildren}`,
      {},
      `categories-${includeChildren}`
    );

    if (!result.success) {
      console.error('[CategoriesSingleton] Failed to get categories:', result.error);
      return [];
    }

    return result.data?.categories || [];
  }

  /**
   * Get category by slug with caching
   * Uses the /directory/categories/:slug endpoint
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    if (!slug) {
      console.error('[CategoriesSingleton] getCategoryBySlug: slug is required');
      return null;
    }

    const result = await this.makeDefaultRequest<{ category: Category }>(
      `/api/directory/categories/${slug}`,
      {},
      `category-${slug}`
    );

    if (!result.success) {
      console.error('[CategoriesSingleton] Failed to get category by slug:', result.error);
      return null;
    }

    return result.data?.category || null;
  }

  /**
   * Get categories for a specific tenant with caching
   * Uses the /directory/categories endpoint with tenant filtering
   */
  async getCategoriesByTenant(tenantId: string, includeChildren: boolean = true): Promise<Category[]> {
    if (!tenantId) {
      console.error('[CategoriesSingleton] getCategoriesByTenant: tenantId is required');
      return [];
    }

    const result = await this.makeDefaultRequest<{ categories: Category[] }>(
      `/api/directory/categories?tenantId=${tenantId}&includeChildren=${includeChildren}`,
      {},
      `categories-tenant-${tenantId}-${includeChildren}`
    );

    if (!result.success) {
      console.error('[CategoriesSingleton] Failed to get categories by tenant:', result.error);
      return [];
    }

    return result.data?.categories || [];
  }

}

// Export singleton instance
export const categoriesService = CategoriesSingletonService.getInstance();
