import { UniversalIdentifierCache } from './UniversalIdentifierCache';
import { UniversalSingleton } from '../lib/UniversalSingleton';

export interface PlatformCategoryResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  parentId?: string;
  children: PlatformCategoryResult[];
}

export interface PlatformCategoryTree extends PlatformCategoryResult {
  children: PlatformCategoryResult[];
}

export class PlatformCategoryService extends UniversalSingleton {
  private static instance: PlatformCategoryService;
  private cache: UniversalIdentifierCache;

  protected constructor() {
    super('platform-category-service');
    this.cache = UniversalIdentifierCache.getInstance();
  }

  static getInstance(): PlatformCategoryService {
    if (!PlatformCategoryService.instance) {
      PlatformCategoryService.instance = new PlatformCategoryService();
    }
    return PlatformCategoryService.instance;
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      totalCategories: 0,
      activeCategories: 0,
      categoryTreeDepth: 0
    };
  }

  /**
   * Get all platform categories with product counts
   */
  async getCategories(): Promise<PlatformCategoryResult[]> {
    const cacheKey = 'platform_categories:all';

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<PlatformCategoryResult[]>(cacheKey);
    if (cached !== null) {
      console.log(`[PlatformCategoryService] Cache hit for categories`);
      return cached;
    }

    console.log(`[PlatformCategoryService] Cache miss, fetching categories from database`);

    const { prisma } = await import('../prisma');

    const categories = await prisma.platform_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    const categoryIds = categories.map((c: any) => c.id);
    const productCounts = await prisma.inventory_items.groupBy({
      by: ['directory_category_id'],
      where: {
        directory_category_id: { in: categoryIds },
        item_status: 'active'
      },
      _count: {
        id: true
      }
    });

    const countMap = productCounts.reduce((acc: Record<string, number>, item: any) => {
      acc[item.directory_category_id] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const transformedCategories: PlatformCategoryResult[] = categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      productCount: countMap[category.id] || 0,
      parentId: category.parent_id || undefined,
      children: [] // Initialize empty children array
    }));

    // Cache the result
    await this.setCache(cacheKey, transformedCategories);

    console.log(`[PlatformCategoryService] Cached ${transformedCategories.length} categories`);
    return transformedCategories;
  }

  /**
   * Get category tree with hierarchical structure
   */
  async getCategoryTree(): Promise<PlatformCategoryTree[]> {
    const cacheKey = 'platform_categories:tree';

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<PlatformCategoryTree[]>(cacheKey);
    if (cached !== null) {
      console.log(`[PlatformCategoryService] Cache hit for category tree`);
      return cached;
    }

    console.log(`[PlatformCategoryService] Cache miss, building category tree`);

    const allCategories = await this.getCategories();

    // Build hierarchical structure
    const categoryMap = new Map<string, PlatformCategoryTree>();
    const rootCategories: PlatformCategoryTree[] = [];

    // First pass: create all category objects
    allCategories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: []
      });
    });

    // Second pass: build hierarchy
    allCategories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!;

      if (category.parentId) {
        // Has parent, add to parent's children
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        } else {
          // Parent not found, treat as root
          rootCategories.push(categoryWithChildren);
        }
      } else {
        // No parent, it's a root category
        rootCategories.push(categoryWithChildren);
      }
    });

    // Sort children by name
    rootCategories.forEach(category => {
      this.sortCategoryChildren(category);
    });

    // Cache the result
    await this.setCache(cacheKey, rootCategories);

    console.log(`[PlatformCategoryService] Built category tree with ${rootCategories.length} root categories`);
    return rootCategories;
  }

  /**
   * Get single category by slug
   */
  async getCategoryBySlug(slug: string): Promise<PlatformCategoryResult | null> {
    const cacheKey = `platform_categories:slug:${slug}`;

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<PlatformCategoryResult>(cacheKey);
    if (cached !== null) {
      console.log(`[PlatformCategoryService] Cache hit for category slug: ${slug}`);
      return cached;
    }

    console.log(`[PlatformCategoryService] Cache miss, fetching category: ${slug}`);

    const { prisma } = await import('../prisma');

    const category = await prisma.platform_categories.findFirst({
      where: {
        slug,
        is_active: true
      }
    });

    if (!category) {
      console.log(`[PlatformCategoryService] Category not found: ${slug}`);
      return null;
    }

    // Get product count for this category
    const productCount = await prisma.inventory_items.count({
      where: {
        directory_category_id: category.id,
        item_status: 'active'
      }
    });

    const transformedCategory: PlatformCategoryResult = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      productCount,
      parentId: category.parent_id || undefined,
      children: [] // Initialize empty children array
    };

    // Cache the result
    await this.setCache(cacheKey, transformedCategory);

    return transformedCategory;
  }

  /**
   * Get products by category identifier
   */
  async getProductsByCategory(categorySlug: string, options: {
    limit?: number;
    offset?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    minPrice?: number;
    maxPrice?: number;
  } = {}): Promise<{
    products: any[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    console.log(`[PlatformCategoryService] Getting products for category: ${categorySlug}`);

    // First get the category
    const category = await this.getCategoryBySlug(categorySlug);
    if (!category) {
      throw new Error(`Category not found: ${categorySlug}`);
    }

    const where: any = {
      directory_category_id: category.id,
      item_status: 'active' as const
    };

    // Add price filters if provided
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      where.price_cents = {};
      if (options.minPrice !== undefined) {
        where.price_cents.gte = Math.round(options.minPrice * 100);
      }
      if (options.maxPrice !== undefined) {
        where.price_cents.lte = Math.round(options.maxPrice * 100);
      }
    }

    const sort = options.sort || 'created_at';
    const order = options.order || 'desc';
    const orderBy: any = { [sort]: order };

    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    const { prisma } = await import('../prisma');

    const [products, total] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy,
        select: {
          id: true,
          name: true,
          description: true,
          price_cents: true,
          image_url: true,
          sku: true,
          stock: true,
          quantity: true,
          created_at: true,
          updated_at: true,
          tenants: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }),
      prisma.inventory_items.count({ where })
    ]);

    const transformedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price_cents ? product.price_cents / 100 : null,
      imageUrl: product.image_url || null,
      sku: product.sku,
      availability: (product.stock > 0 || (product.quantity && product.quantity > 0)) ? 'in_stock' : 'out_of_stock',
      tenant: product.tenants || {
        id: 'unknown',
        name: 'Unknown Store',
        slug: 'unknown-store'
      },
      createdAt: product.created_at,
      updatedAt: product.updated_at
    }));

    return {
      products: transformedProducts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  /**
   * Invalidate category cache (call when categories are updated)
   */
  invalidateCache(): void {
    console.log(`[PlatformCategoryService] Invalidating all category caches`);
    // UniversalSingleton handles cache invalidation
    this.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: string[];
    totalMemoryUsage: number;
  } {
    // Get UniversalSingleton metrics
    const metrics = this.getMetrics();
    return {
      size: metrics.cacheSize,
      entries: Array.from(this.memoryCache.keys()),
      totalMemoryUsage: this.memoryCache.size * 100 // Rough estimate
    };
  }

  private sortCategoryChildren(category: PlatformCategoryTree): void {
    if (category.children && category.children.length > 0) {
      category.children.sort((a, b) => a.name.localeCompare(b.name));
      category.children.forEach(child => this.sortCategoryChildren(child));
    }
  }
}
