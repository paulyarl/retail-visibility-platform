/**
 * Categories Service - API Server Singleton
 * 
 * Manages hierarchical categories and product categorization
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

// Category Types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  level: number; // 0 = root, 1 = child, 2 = grandchild, etc.
  path: string; // Full path like "electronics/computers/laptops"
  imageUrl?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
  metadata: {
    productCount: number;
    subcategoryCount: number;
    depth: number;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    lastModifiedBy?: string;
    attributes?: Record<string, any>;
  };
  children?: Category[];
  parent?: Category;
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  rootCategories: number;
  maxDepth: number;
  categoriesByLevel: Record<number, number>;
  totalProducts: number;
  productsByCategory: Record<string, number>;
  topLevelCategories: Array<{
    categoryId: string;
    name: string;
    slug: string;
    productCount: number;
    subcategoryCount: number;
  }>;
  recentlyUpdated: Array<{
    categoryId: string;
    name: string;
    updatedAt: string;
  }>;
}

export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  metadata?: Record<string, any>;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, any>;
}

export interface CategoryFilter {
  parentId?: string;
  level?: number;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'sortOrder' | 'productCount' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  includeChildren?: boolean;
}

class CategoryService extends UniversalSingleton {
  private static instance: CategoryService;
  private categoryCache: Map<string, Category> = new Map();
  private categoryTreeCache: Map<string, Category[]> = new Map();

  constructor() {
    super('category-service', {
      enableCache: true,
      enableEncryption: false,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 3600, // 1 hour
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize with mock data for testing
    this.initializeMockData();
  }

  static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }
    return CategoryService.instance;
  }

  // ====================
  // CATEGORY MANAGEMENT
  // ====================

  /**
   * Get category by ID
   */
  async getCategory(categoryId: string): Promise<Category | null> {
    // Check local cache first
    const localCached = this.categoryCache.get(categoryId);
    if (localCached) {
      return localCached;
    }

    // Check persistent cache
    const cacheKey = `category-${categoryId}`;
    const cached = await this.getFromCache<Category>(cacheKey);
    if (cached) {
      this.categoryCache.set(categoryId, cached);
      return cached;
    }

    try {
      // Query database for category
      const category = await this.queryCategory(categoryId);
      
      if (category) {
        // Update caches
        this.categoryCache.set(categoryId, category);
        await this.setCache(cacheKey, category);
        return category;
      }

      return null;
    } catch (error) {
      this.logError('Error fetching category', error);
      return null;
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const categories = await this.listCategories();
      return categories.find(category => category.slug === slug) || null;
    } catch (error) {
      this.logError('Error fetching category by slug', error);
      return null;
    }
  }

  /**
   * Create new category
   */
  async createCategory(request: CreateCategoryRequest): Promise<Category> {
    // Calculate level and path
    let level = 0;
    let path = request.slug;
    let parent: Category | null = null;

    if (request.parentId) {
      parent = await this.getCategory(request.parentId);
      if (!parent) {
        throw new Error('Parent category not found');
      }
      level = parent.level + 1;
      path = `${parent.path}/${request.slug}`;
    }

    const newCategory: Category = {
      id: this.generateId(),
      name: request.name,
      slug: request.slug,
      description: request.description,
      parentId: request.parentId,
      level,
      path,
      imageUrl: request.imageUrl,
      icon: request.icon,
      color: request.color,
      isActive: true,
      sortOrder: request.sortOrder || 0,
      metadata: {
        productCount: 0,
        subcategoryCount: 0,
        depth: level,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attributes: request.metadata || {}
      }
    };

    try {
      // Store in database
      await this.storeCategory(newCategory);
      
      // Update parent's subcategory count
      if (parent) {
        await this.updateSubcategoryCount(parent.id);
      }
      
      // Update caches
      this.categoryCache.set(newCategory.id, newCategory);
      const cacheKey = `category-${newCategory.id}`;
      await this.setCache(cacheKey, newCategory);
      
      // Clear tree cache
      this.categoryTreeCache.clear();

      this.logInfo('Category created successfully', { categoryId: newCategory.id, name: newCategory.name });
      
      return newCategory;
    } catch (error) {
      this.logError('Error creating category', error);
      throw new Error('Failed to create category');
    }
  }

  /**
   * Update category
   */
  async updateCategory(categoryId: string, updates: UpdateCategoryRequest): Promise<Category> {
    const existingCategory = await this.getCategory(categoryId);
    if (!existingCategory) {
      throw new Error('Category not found');
    }

    const updatedCategory: Category = {
      ...existingCategory,
      ...updates,
      metadata: updates.metadata ? {
        ...existingCategory.metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString()
      } : existingCategory.metadata
    };

    try {
      // Update in database
      await this.updateCategoryInDatabase(categoryId, updates);
      
      // Update caches
      this.categoryCache.set(categoryId, updatedCategory);
      const cacheKey = `category-${categoryId}`;
      await this.setCache(cacheKey, updatedCategory);
      
      // Clear tree cache
      this.categoryTreeCache.clear();

      this.logInfo('Category updated successfully', { categoryId, updates });
      
      return updatedCategory;
    } catch (error) {
      this.logError('Error updating category', error);
      throw new Error('Failed to update category');
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const category = await this.getCategory(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has subcategories
    const hasSubcategories = category.metadata.subcategoryCount > 0;
    if (hasSubcategories) {
      throw new Error('Cannot delete category with subcategories');
    }

    // Check if category has products
    if (category.metadata.productCount > 0) {
      throw new Error('Cannot delete category with associated products');
    }

    try {
      // Delete from database
      await this.deleteCategoryFromDatabase(categoryId);
      
      // Update parent's subcategory count
      if (category.parentId) {
        await this.updateSubcategoryCount(category.parentId, -1);
      }
      
      // Clear caches
      this.categoryCache.delete(categoryId);
      const cacheKey = `category-${categoryId}`;
      await this.clearCache(cacheKey);
      
      // Clear tree cache
      this.categoryTreeCache.clear();

      this.logInfo('Category deleted successfully', { categoryId });
    } catch (error) {
      this.logError('Error deleting category', error);
      throw new Error('Failed to delete category');
    }
  }

  /**
   * List all categories
   */
  async listCategories(filters: CategoryFilter = {}): Promise<Category[]> {
    try {
      const cacheKey = `categories-${JSON.stringify(filters)}`;
      
      // Check cache first for tree requests
      if (filters.includeChildren) {
        const cached = await this.getFromCache<Category[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      let categories = await this.queryCategories(filters);
      
      // Apply filters
      if (filters.parentId) {
        categories = categories.filter(cat => cat.parentId === filters.parentId);
      }
      
      if (filters.level !== undefined) {
        categories = categories.filter(cat => cat.level === filters.level);
      }
      
      if (filters.isActive !== undefined) {
        categories = categories.filter(cat => cat.isActive === filters.isActive);
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        categories = categories.filter(cat => 
          cat.name.toLowerCase().includes(searchLower) ||
          cat.description?.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply sorting
      if (filters.sortBy) {
        categories.sort((a, b) => {
          const aValue = this.getSortValue(a, filters.sortBy!);
          const bValue = this.getSortValue(b, filters.sortBy!);
          
          if (filters.sortOrder === 'desc') {
            return bValue - aValue;
          }
          return aValue - bValue;
        });
      }
      
      // Apply pagination
      if (filters.offset || filters.limit) {
        const start = filters.offset || 0;
        const end = filters.limit ? start + filters.limit : undefined;
        categories = categories.slice(start, end);
      }
      
      // Build tree structure if requested
      if (filters.includeChildren) {
        categories = await this.buildCategoryTree(categories);
        
        // Cache the tree structure
        await this.setCache(cacheKey, categories, { ttl: 600 }); // 10 minutes cache
      }
      
      return categories;
    } catch (error) {
      this.logError('Error listing categories', error);
      return [];
    }
  }

  /**
   * Get category tree
   */
  async getCategoryTree(rootId?: string): Promise<Category[]> {
    try {
      const cacheKey = `category-tree-${rootId || 'root'}`;
      const cached = await this.getFromCache<Category[]>(cacheKey);
      if (cached) {
        return cached;
      }

      let categories: Category[] = [];
      
      if (rootId) {
        // Get specific subtree
        const root = await this.getCategory(rootId);
        if (root) {
          categories = await this.listCategories({ parentId: rootId, includeChildren: true });
          categories.unshift(root);
        }
      } else {
        // Get full tree
        categories = await this.listCategories({ level: 0, includeChildren: true });
      }
      
      // Cache the tree structure
      await this.setCache(cacheKey, categories, { ttl: 600 }); // 10 minutes cache
      
      return categories;
    } catch (error) {
      this.logError('Error fetching category tree', error);
      return [];
    }
  }

  // ====================
  // CATEGORY ANALYTICS
  // ====================

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<CategoryStats> {
    try {
      const cacheKey = 'category-stats';
      const cached = await this.getFromCache<CategoryStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const categories = Array.from(this.categoryCache.values());
      const stats = await this.calculateCategoryStats(categories);
      
      // Cache for 30 minutes
      await this.setCache(cacheKey, stats, { ttl: 1800 });
      
      return stats;
    } catch (error) {
      this.logError('Error fetching category stats', error);
      throw new Error('Failed to fetch category statistics');
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private getSortValue(category: Category, sortBy: string): number {
    switch (sortBy) {
      case 'name':
        return category.name.toLowerCase().charCodeAt(0);
      case 'sortOrder':
        return category.sortOrder;
      case 'productCount':
        return category.metadata.productCount;
      case 'createdAt':
        return new Date(category.metadata.createdAt).getTime();
      case 'updatedAt':
        return new Date(category.metadata.updatedAt).getTime();
      default:
        return 0;
    }
  }

  private async buildCategoryTree(flatCategories: Category[]): Promise<Category[]> {
    const categoryMap = new Map<string, Category>();
    flatCategories.forEach(cat => categoryMap.set(cat.id, cat));
    
    // Build tree structure
    const tree: Category[] = [];
    const rootCategories = flatCategories.filter(cat => !cat.parentId);
    
    for (const root of rootCategories) {
      const categoryWithChildren = await this.buildCategoryChildren(root, categoryMap);
      tree.push(categoryWithChildren);
    }
    
    return tree;
  }

  private async buildCategoryChildren(parent: Category, categoryMap: Map<string, Category>): Promise<Category> {
    const children = Array.from(categoryMap.values())
      .filter(cat => cat.parentId === parent.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    
    const categoryWithChildren = {
      ...parent,
      children: []
    };
    
    for (const child of children) {
      const childWithChildren = await this.buildCategoryChildren(child, categoryMap);
      categoryWithChildren.children!.push(childWithChildren);
    }
    
    return categoryWithChildren;
  }

  private async updateSubcategoryCount(parentId: string, delta: number = 1): Promise<void> {
    const parent = await this.getCategory(parentId);
    if (parent) {
      const updatedCategory = await this.updateCategory(parentId, {
        metadata: {
          ...parent.metadata,
          subcategoryCount: parent.metadata.subcategoryCount + delta
        }
      });
    }
  }

  // ====================
  // MOCK DATA IMPLEMENTATION
  // ====================

  private initializeMockData(): void {
    // Create mock categories for testing
    const mockCategories: Category[] = [
      {
        id: 'cat-001',
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and accessories',
        level: 0,
        path: 'electronics',
        imageUrl: 'https://example.com/images/electronics.jpg',
        icon: '📱',
        color: '#3B82F6',
        isActive: true,
        sortOrder: 1,
        metadata: {
          productCount: 150,
          subcategoryCount: 3,
          depth: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        }
      },
      {
        id: 'cat-002',
        name: 'Computers',
        slug: 'computers',
        description: 'Desktop and laptop computers',
        parentId: 'cat-001',
        level: 1,
        path: 'electronics/computers',
        imageUrl: 'https://example.com/images/computers.jpg',
        icon: '💻',
        color: '#4CAF50',
        isActive: true,
        sortOrder: 1,
        metadata: {
          productCount: 75,
          subcategoryCount: 2,
          depth: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        }
      },
      {
        id: 'cat-003',
        name: 'Laptops',
        slug: 'laptops',
        description: 'Portable computers',
        parentId: 'cat-002',
        level: 2,
        path: 'electronics/computers/laptops',
        imageUrl: 'https://example.com/images/laptops.jpg',
        icon: '💻',
        color: '#2196F3',
        isActive: true,
        sortOrder: 1,
        metadata: {
          productCount: 50,
          subcategoryCount: 0,
          depth: 2,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        }
      },
      {
        id: 'cat-004',
        name: 'Desktops',
        slug: 'desktops',
        description: 'Desktop computers',
        parentId: 'cat-002',
        level: 2,
        path: 'electronics/computers/desktops',
        imageUrl: 'https://example.com/images/desktops.jpg',
        icon: '🖥️',
        color: '#FF9800',
        isActive: true,
        sortOrder: 2,
        metadata: {
          productCount: 25,
          subcategoryCount: 0,
          depth: 2,
          createdAt: '2024-01-04T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        }
      },
      {
        id: 'cat-005',
        name: 'Mobile Phones',
        slug: 'mobile-phones',
        description: 'Smartphones and mobile devices',
        parentId: 'cat-001',
        level: 1,
        path: 'electronics/mobile-phones',
        imageUrl: 'https://example.com/images/mobile-phones.jpg',
        icon: '📱',
        color: '#9C27B0',
        isActive: true,
        sortOrder: 2,
        metadata: {
          productCount: 60,
          subcategoryCount: 2,
          depth: 1,
          createdAt: '2024-01-05T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        }
      },
      {
        'id': 'cat-006',
        'name': 'Smartphones',
        'slug': 'smartphones',
        'description': 'Modern smartphones',
        'parentId': 'cat-005',
        'level': 2,
        'path': 'electronics/mobile-phones/smartphones',
        'imageUrl': 'https://example.com/images/smartphones.jpg',
        'icon': '📱',
        'color': '#E91E63',
        'isActive': true,
        'sortOrder': 1,
        'metadata': {
          'productCount': 40,
          'subcategoryCount': 0,
          'depth': 2,
          'createdAt': '2024-01-06T00:00:00.000Z',
          'updatedAt': new Date().toISOString()
        }
      },
      {
        'id': 'cat-007',
        'name': 'Tablets',
        'slug': 'tablets',
        'description': 'Tablet computers',
        'parentId': 'cat-005',
        'level': 2,
        'path': 'electronics/mobile-phones/tablets',
        'imageUrl': 'https://example.com/images/tablets.jpg',
        'icon': '📱',
        'color': '#673AB7',
        'isActive': true,
        'sortOrder': 2,
        'metadata': {
          'productCount': 20,
          'subcategoryCount': 0,
          'depth': 2,
          'createdAt': '2024-01-07T00:00:00.000Z',
          'updatedAt': new Date().toISOString()
        }
      },
      {
        'id': 'cat-008',
        'name': 'Clothing',
        'slug': 'clothing',
        'description': 'Apparel and accessories',
        'level': 0,
        'path': 'clothing',
        'imageUrl': 'https://example.com/images/clothing.jpg',
        'icon': '👕',
        'color': '#FF5722',
        'isActive': true,
        'sortOrder': 2,
        'metadata': {
          'productCount': 200,
          'subcategoryCount': 4,
          'depth': 0,
          'createdAt': '2024-01-08T00:00:00.000Z',
          'updatedAt': new Date().toISOString()
        }
      },
      {
        'id': 'cat-009',
        'name': 'Men\'s Clothing',
        'slug': 'mens-clothing',
        'description': 'Clothing for men',
        'parentId': 'cat-008',
        'level': 1,
        'path': 'clothing/mens-clothing',
        'imageUrl': 'https://example.com/images/mens-clothing.jpg',
        'icon': '👔',
        'color': '#2196F3',
        'isActive': true,
        'sortOrder': 1,
        'metadata': {
          'productCount': 80,
          'subcategoryCount': 0,
          'depth': 1,
          'createdAt': '2024-01-09T00:00:00.000Z',
          'updatedAt': new Date().toISOString()
        }
      },
      {
        'id': 'cat-010',
        'name': 'Women\'s Clothing',
        'slug': 'womens-clothing',
        'description': 'Clothing for women',
        'parentId': 'cat-008',
        'level': 1,
        'path': 'clothing/womens-clothing',
        'imageUrl': 'https://example.com/images/womens-clothing.jpg',
        'icon': '👗',
        'color': '#E91E63',
        'isActive': true,
        'sortOrder': 2,
        'metadata': {
          'productCount': 120,
          'subcategoryCount': 0,
          'depth': 1,
          'createdAt': '2024-01-10T00:00:00.000Z',
          'updatedAt': new Date().toISOString()
        }
      }
    ];

    // Cache mock categories
    mockCategories.forEach(category => {
      this.categoryCache.set(category.id, category);
    });
  }

  // ====================
  // DATABASE STUBS
  // ====================

  private async queryCategory(categoryId: string): Promise<Category | null> {
    console.log('Querying category:', categoryId);
    return this.categoryCache.get(categoryId) || null;
  }

  private async storeCategory(category: Category): Promise<void> {
    console.log('Storing category:', category.id);
    this.categoryCache.set(category.id, category);
  }

  private async updateCategoryInDatabase(categoryId: string, updates: UpdateCategoryRequest): Promise<void> {
    console.log('Updating category in database:', categoryId, updates);
  }

  private async deleteCategoryFromDatabase(categoryId: string): Promise<void> {
    console.log('Deleting category from database:', categoryId);
  }

  private async queryCategories(filters: CategoryFilter): Promise<Category[]> {
    console.log('Querying categories with filters:', filters);
    let categories = Array.from(this.categoryCache.values());

    // Apply filters
    if (filters.parentId) {
      categories = categories.filter(cat => cat.parentId === filters.parentId);
    }
    
    if (filters.level !== undefined) {
      categories = categories.filter(cat => cat.level === filters.level);
    }
    
    if (filters.isActive !== undefined) {
      categories = categories.filter(cat => cat.isActive === filters.isActive);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      categories = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchLower) ||
        cat.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply sorting
    if (filters.sortBy) {
      categories.sort((a, b) => {
        const aValue = this.getSortValue(a, filters.sortBy!);
        const bValue = this.getSortValue(b, filters.sortBy!);
        
        if (filters.sortOrder === 'desc') {
          return bValue - aValue;
        }
        return aValue - bValue;
      });
    }
    
    // Apply pagination
    if (filters.offset || filters.limit) {
      const start = filters.offset || 0;
      const end = filters.limit ? start + filters.limit : undefined;
      categories = categories.slice(start, end);
    }

    return categories;
  }

  private async calculateCategoryStats(categories: Category[]): Promise<CategoryStats> {
    const totalCategories = categories.length;
    const activeCategories = categories.filter(cat => cat.isActive).length;
    const rootCategories = categories.filter(cat => cat.level === 0).length;
    const maxDepth = Math.max(...categories.map(cat => cat.level));
    
    const categoriesByLevel = categories.reduce((acc, category) => {
      acc[category.level] = (acc[category.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const totalProducts = categories.reduce((sum, category) => sum + category.metadata.productCount, 0);
    
    const productsByCategory = categories.reduce((acc, category) => {
      acc[category.id] = category.metadata.productCount;
      return acc;
    }, {} as Record<string, number>);
    
    const topLevelCategories = categories
      .filter(cat => cat.level === 0)
      .sort((a, b) => b.metadata.productCount - a.metadata.productCount)
      .slice(0, 5)
      .map(category => ({
        categoryId: category.id,
        name: category.name,
        slug: category.slug,
        productCount: category.metadata.productCount,
        subcategoryCount: category.metadata.subcategoryCount
      }));
    
    const recentlyUpdated = categories
      .sort((a, b) => new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime())
      .slice(0, 5)
      .map(category => ({
        categoryId: category.id,
        name: category.name,
        updatedAt: category.metadata.updatedAt
      }));

    return {
      totalCategories,
      activeCategories,
      rootCategories,
      maxDepth,
      categoriesByLevel,
      totalProducts,
      productsByCategory,
      topLevelCategories,
      recentlyUpdated
    };
  }
}

export default CategoryService;
