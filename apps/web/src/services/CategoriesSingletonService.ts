/**
 * Categories Singleton Service
 *
 * Extends UniversalSingletonClient to provide cached categories operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

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

class CategoriesSingletonService {
  private static instance: CategoriesSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 10 * 60 * 1000, // 10 minutes for categories (moderate change frequency)
      enableLogging: true,
      enableMetrics: true
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
    try {
      const result = await this.client.makeRequest<any>(
        `/api/directory/categories?includeChildren=${includeChildren}`
      );

      return result.success && result.data?.categories ? result.data.categories : [];
    } catch (error) {
      console.error('[CategoriesSingleton] Failed to get categories:', error);
      return [];
    }
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

    try {
      const result = await this.client.makeRequest<any>(
        `/api/directory/categories/${slug}`
      );

      return result.success && result.data?.category ? result.data.category : null;
    } catch (error) {
      console.error('[CategoriesSingleton] Failed to get category by slug:', error);
      return null;
    }
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

    try {
      const result = await this.client.makeRequest<any>(
        `/api/directory/categories?tenantId=${tenantId}&includeChildren=${includeChildren}`
      );

      return result.success && result.data?.categories ? result.data.categories : [];
    } catch (error) {
      console.error('[CategoriesSingleton] Failed to get categories by tenant:', error);
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
  }
}

// Export singleton instance
export const categoriesService = CategoriesSingletonService.getInstance();
