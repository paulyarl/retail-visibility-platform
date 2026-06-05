/**
 * Public Categories Service
 * 
 * Handles public category browsing and taxonomy operations
 * Extends PublicApiSingleton for proper caching and context management
 * 
 * MIGRATION: Replaces direct fetch calls in:
 * - /src/app/api/categories/route.ts
 * - /src/app/api/categories/search/route.ts
 * - /src/app/api/categories/[id]/route.ts
 * - /src/app/api/taxonomy/browse/route.ts
 * - /src/app/api/taxonomy/search/route.ts
 * - /src/components/categories/CategoryEditModal.tsx
 * - /src/components/inventory/wizards/steps/OrganizationStep.tsx
 * - /src/components/inventory/wizards/steps/ReviewStep.tsx
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  level: number;
  path: string;
  imageUrl?: string;
  icon?: string;
  isActive: boolean;
  productCount: number;
  subcategoryCount: number;
  tenantId?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
  };
  metadata?: {
    googleCategoryId?: string;
    googleCategoryName?: string;
    customAttributes?: Record<string, any>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTree {
  id: string;
  name: string;
  slug: string;
  description?: string;
  level: number;
  path: string;
  imageUrl?: string;
  icon?: string;
  isActive: boolean;
  productCount: number;
  children: CategoryTree[];
  tenantId?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
  };
}

export interface CategorySearchResult {
  categories: PublicCategory[];
  total: number;
  page: number;
  limit: number;
  query: string;
  filters?: {
    tenantId?: string;
    level?: number;
    parentId?: string;
    isActive?: boolean;
  };
}

export interface TaxonomyNode {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  level: number;
  path: string;
  parentId?: string;
  children?: TaxonomyNode[];
  isActive: boolean;
  isSelectable: boolean;
  metadata?: {
    googleCategoryId?: string;
    synonyms?: string[];
    commonName?: string;
    customAttributes?: Record<string, any>;
  };
}

export interface TaxonomySearchResult {
  nodes: TaxonomyNode[];
  total: number;
  query: string;
  suggestions?: string[];
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  categoriesByLevel: Array<{
    level: number;
    count: number;
  }>;
  categoriesByTenant: Array<{
    tenantId: string;
    tenantName: string;
    count: number;
  }>;
  recentlyAdded: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
}

export class PublicCategoriesService extends PublicApiSingleton {
  private static instance: PublicCategoriesService;

  private constructor() {
    super('PublicCategoriesService');
  }

  static getInstance(): PublicCategoriesService {
    if (!PublicCategoriesService.instance) {
      PublicCategoriesService.instance = new PublicCategoriesService();
    }
    return PublicCategoriesService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'public-categories-*',
      'public-category-*',
      'public-taxonomy-*',
      'public-category-tree-*',
      'public-category-search-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(categoryId?: string, tenantId?: string, ...params: any[]): Promise<void> {
    if (categoryId) {
      await this.invalidateCache(`public-category-${categoryId}`);
      await this.invalidateCache(`public-category-tree-${categoryId}`);
    }
    if (tenantId) {
      await this.invalidateCache(`public-categories-tenant-${tenantId}`);
    } else {
      await this.invalidateCache('public-categories-*');
      await this.invalidateCache('public-category-*');
      await this.invalidateCache('public-taxonomy-*');
      await this.invalidateCache('public-category-tree-*');
      await this.invalidateCache('public-category-search-*');
    }
  }

  /**
   * Get all public categories (paginated)
   */
  async getCategories(options?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    level?: number;
    parentId?: string;
    isActive?: boolean;
    sortBy?: 'name' | 'productCount' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<CategorySearchResult> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.tenantId) params.append('tenantId', options.tenantId);
    if (options?.level) params.append('level', options.level.toString());
    if (options?.parentId) params.append('parentId', options.parentId);
    if (options?.isActive !== undefined) params.append('isActive', options.isActive.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
    
    const result = await this.makeDefaultRequest<CategorySearchResult>(
      `/api/categories${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'public-categories-list'
    );
    
    if (!result.success) {
      console.log(`Failed to get categories: ${result.error}`);
      return { categories: [], total: 0, page: 1, limit: 20, query: '' };
    }
    
    return result.data || { categories: [], total: 0, page: 1, limit: 20, query: '' };
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId: string): Promise<PublicCategory | null> {
    const result = await this.makeDefaultRequest<PublicCategory>(
      `/api/categories/${categoryId}`,
      {},
      `public-category-${categoryId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get category: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async getCategoryTree(options?: {
    tenantId?: string;
    rootOnly?: boolean;
    maxDepth?: number;
    includeInactive?: boolean;
  }): Promise<CategoryTree[]> {
    const params = new URLSearchParams();
    if (options?.tenantId) params.append('tenantId', options.tenantId);
    if (options?.rootOnly) params.append('rootOnly', 'true');
    if (options?.maxDepth) params.append('maxDepth', options.maxDepth.toString());
    if (options?.includeInactive) params.append('includeInactive', 'true');
    
    const result = await this.makeDefaultRequest<CategoryTree[]>(
      `/api/categories/tree${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'public-category-tree'
    );
    
    if (!result.success) {
      console.log(`Failed to get category tree: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get category tree starting from specific category
   */
  async getCategoryTreeById(categoryId: string, options?: {
    maxDepth?: number;
    includeInactive?: boolean;
  }): Promise<CategoryTree | null> {
    const params = new URLSearchParams();
    if (options?.maxDepth) params.append('maxDepth', options.maxDepth.toString());
    if (options?.includeInactive) params.append('includeInactive', 'true');
    
    const result = await this.makeDefaultRequest<CategoryTree>(
      `/api/categories/${categoryId}/tree${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      `public-category-tree-${categoryId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get category tree by ID: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Search categories
   */
  async searchCategories(query: string, options?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    level?: number;
    parentId?: string;
    fuzzy?: boolean;
  }): Promise<CategorySearchResult> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.tenantId) params.append('tenantId', options.tenantId);
    if (options?.level) params.append('level', options.level.toString());
    if (options?.parentId) params.append('parentId', options.parentId);
    if (options?.fuzzy) params.append('fuzzy', 'true');
    
    const result = await this.makeDefaultRequest<CategorySearchResult>(
      `/api/categories/search${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      `public-category-search-${query}`
    );
    
    if (!result.success) {
      console.log(`Failed to search categories: ${result.error}`);
      return { categories: [], total: 0, page: 1, limit: 20, query };
    }
    
    return result.data || { categories: [], total: 0, page: 1, limit: 20, query };
  }

  /**
   * Get popular categories
   */
  async getPopularCategories(options?: {
    limit?: number;
    tenantId?: string;
    timeRange?: 'day' | 'week' | 'month' | 'year';
  }): Promise<PublicCategory[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.tenantId) params.append('tenantId', options.tenantId);
    if (options?.timeRange) params.append('timeRange', options.timeRange);
    
    const result = await this.makeDefaultRequest<PublicCategory[]>(
      `/api/categories/popular${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'public-categories-popular'
    );
    
    if (!result.success) {
      console.log(`Failed to get popular categories: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get featured categories
   */
  async getFeaturedCategories(options?: {
    limit?: number;
    tenantId?: string;
  }): Promise<PublicCategory[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.tenantId) params.append('tenantId', options.tenantId);
    
    const result = await this.makeDefaultRequest<PublicCategory[]>(
      `/api/categories/featured${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'public-categories-featured'
    );
    
    if (!result.success) {
      console.log(`Failed to get featured categories: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get taxonomy nodes
   */
  async getTaxonomyNodes(options?: {
    parentId?: string;
    level?: number;
    maxDepth?: number;
    includeInactive?: boolean;
  }): Promise<TaxonomyNode[]> {
    const params = new URLSearchParams();
    if (options?.parentId) params.append('parentId', options.parentId);
    if (options?.level) params.append('level', options.level.toString());
    if (options?.maxDepth) params.append('maxDepth', options.maxDepth.toString());
    if (options?.includeInactive) params.append('includeInactive', 'true');
    
    const result = await this.makeDefaultRequest<TaxonomyNode[]>(
      `/api/taxonomy/browse${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'public-taxonomy-browse'
    );
    
    if (!result.success) {
      console.log(`Failed to get taxonomy nodes: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Search taxonomy
   */
  async searchTaxonomy(query: string, options?: {
    limit?: number;
    fuzzy?: boolean;
    includeSynonyms?: boolean;
  }): Promise<TaxonomySearchResult> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.fuzzy) params.append('fuzzy', 'true');
    if (options?.includeSynonyms) params.append('includeSynonyms', 'true');
    
    const result = await this.makeDefaultRequest<TaxonomySearchResult>(
      `/api/taxonomy/search${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      `public-taxonomy-search-${query}`
    );
    
    if (!result.success) {
      console.log(`Failed to search taxonomy: ${result.error}`);
      return { nodes: [], total: 0, query };
    }
    
    return result.data || { nodes: [], total: 0, query };
  }

  /**
   * Get taxonomy suggestions
   */
  async getTaxonomySuggestions(query: string, options?: {
    limit?: number;
    context?: string;
  }): Promise<string[]> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.context) params.append('context', options.context);
    
    const result = await this.makeDefaultRequest<string[]>(
      `/api/taxonomy/suggestions${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      `public-taxonomy-suggestions-${query}`
    );
    
    if (!result.success) {
      console.log(`Failed to get taxonomy suggestions: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get Google taxonomy by ID
   */
  async getGoogleTaxonomyById(googleCategoryId: string): Promise<TaxonomyNode | null> {
    const result = await this.makeDefaultRequest<TaxonomyNode>(
      `/api/public/google-taxonomy/${googleCategoryId}`,
      {},
      `public-google-taxonomy-${googleCategoryId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get Google taxonomy: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(options?: {
    tenantId?: string;
    timeRange?: 'day' | 'week' | 'month' | 'year';
  }): Promise<CategoryStats> {
    const params = new URLSearchParams();
    if (options?.tenantId) params.append('tenantId', options.tenantId);
    if (options?.timeRange) params.append('timeRange', options.timeRange);
    
    const result = await this.makeDefaultRequest<CategoryStats>(
      `/api/categories/stats${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'public-categories-stats'
    );
    
    if (!result.success) {
      console.log(`Failed to get category stats: ${result.error}`);
      return { 
        totalCategories: 0, 
        activeCategories: 0, 
        categoriesByLevel: [], 
        categoriesByTenant: [], 
        recentlyAdded: [] 
      };
    }
    
    return result.data || { 
      totalCategories: 0, 
      activeCategories: 0, 
      categoriesByLevel: [], 
      categoriesByTenant: [], 
      recentlyAdded: [] 
    };
  }

  /**
   * Get breadcrumb path for category
   */
  async getCategoryBreadcrumb(categoryId: string): Promise<PublicCategory[]> {
    const result = await this.makeDefaultRequest<PublicCategory[]>(
      `/api/categories/${categoryId}/breadcrumb`,
      {},
      `public-category-breadcrumb-${categoryId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get category breadcrumb: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get related categories
   */
  async getRelatedCategories(categoryId: string, options?: {
    limit?: number;
    algorithm?: 'products' | 'taxonomy' | 'behavior';
  }): Promise<PublicCategory[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.algorithm) params.append('algorithm', options.algorithm);
    
    const result = await this.makeDefaultRequest<PublicCategory[]>(
      `/api/categories/${categoryId}/related${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      `public-categories-related-${categoryId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get related categories: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }
}

// Export singleton instance
export default PublicCategoriesService.getInstance();
