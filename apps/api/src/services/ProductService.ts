import { UniversalIdentifierCache } from './UniversalIdentifierCache';

export interface ProductQuery {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductResult {
  id: string;
  name: string;
  description: string;
  price: number | null;
  imageUrl: string | null;
  sku: string;
  availability: string;
  tenant: {
    id: string;
    name: string;
    slug: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ProductResponse {
  products: ProductResult[];
  pagination: ProductPagination;
}

export class ProductService {
  private static instance: ProductService;
  private cache: UniversalIdentifierCache;

  private constructor() {
    this.cache = UniversalIdentifierCache.getInstance();
  }

  static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  /**
   * Get products by tenant identifier (universal identifier support)
   */
  async getProductsByTenant(identifier: string, query: ProductQuery = {}): Promise<ProductResponse> {
    console.log(`[ProductService] Getting products for identifier: ${identifier}`);

    // Resolve tenant using universal identifier cache
    const resolvedTenant = await this.cache.resolveIdentifier(identifier);

    if (!resolvedTenant) {
      throw new Error(`Tenant not found for identifier: ${identifier}`);
    }

    console.log(`[ProductService] Resolved tenant: ${resolvedTenant.id} (${resolvedTenant.type})`);

    // Build database query
    const where: any = {
      tenant_id: resolvedTenant.id,
      item_status: 'active' as const,
    };

    // Add search filter if provided
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } }
      ];
    }

    // Add category filter if provided
    if (query.category) {
      where.directory_category_id = query.category;
    }

    // Add price filters if provided
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price_cents = {};
      if (query.minPrice !== undefined) {
        where.price_cents.gte = Math.round(query.minPrice * 100);
      }
      if (query.maxPrice !== undefined) {
        where.price_cents.lte = Math.round(query.maxPrice * 100);
      }
    }

    // Build order clause
    const sort = query.sort || 'created_at';
    const order = query.order || 'desc';
    const orderBy: any = { [sort]: order };

    const limit = Math.min(query.limit || 20, 100); // Cap at 100
    const offset = query.offset || 0;

    // Import prisma dynamically to avoid circular imports
    const { prisma } = await import('../prisma');

    // Execute query with pagination
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

    console.log(`[ProductService] Found ${products.length} products for tenant ${resolvedTenant.id}`);

    // Transform results
    const transformedProducts: ProductResult[] = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price_cents ? product.price_cents / 100 : null,
      imageUrl: product.image_url || null,
      sku: product.sku,
      availability: (product.stock > 0 || (product.quantity && product.quantity > 0)) ? 'in_stock' : 'out_of_stock',
      tenant: product.tenants || {
        id: resolvedTenant.id,
        name: resolvedTenant.name,
        slug: resolvedTenant.slug
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
   * Get featured products by tenant identifier
   */
  async getFeaturedProductsByTenant(identifier: string, limit: number = 10): Promise<ProductResult[]> {
    console.log(`[ProductService] Getting featured products for identifier: ${identifier}`);

    // Resolve tenant using universal identifier cache
    const resolvedTenant = await this.cache.resolveIdentifier(identifier);

    if (!resolvedTenant) {
      throw new Error(`Tenant not found for identifier: ${identifier}`);
    }

    // Use direct pool query for optimized featured products
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const sqlQuery = `
      SELECT DISTINCT
        mv.*
      FROM mv_storefront_discovery mv
      WHERE mv.tenant_id = $1
        AND mv.featured_is_active = true
        AND mv.item_status = 'active'
        AND mv.visibility = 'public'
      ORDER BY mv.featured_priority DESC, mv.featured_at DESC
      LIMIT $2
    `;

    const result = await pool.query(sqlQuery, [resolvedTenant.id, limit * 3]);

    const featuredProducts = result.rows;

    // Randomize selection and limit
    const shuffled = featuredProducts.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, limit);

    // Transform to ProductResult format
    const transformedProducts: ProductResult[] = selected.map((fp: any) => ({
      id: fp.inventory_item_id,
      name: fp.product_name,
      description: fp.product_description,
      price: fp.current_price_cents ? fp.current_price_cents / 100 : null,
      imageUrl: fp.image_url || null,
      sku: fp.sku,
      availability: fp.in_stock ? 'in_stock' : 'out_of_stock',
      tenant: {
        id: resolvedTenant.id,
        name: resolvedTenant.name,
        slug: resolvedTenant.slug
      },
      createdAt: new Date(fp.created_at),
      updatedAt: new Date(fp.updated_at)
    }));

    console.log(`[ProductService] Found ${transformedProducts.length} featured products for tenant ${resolvedTenant.id}`);

    return transformedProducts;
  }

  /**
   * Search products across all tenants (global search)
   */
  async searchProducts(query: ProductQuery): Promise<ProductResponse> {
    if (!query.search) {
      throw new Error('Search query is required');
    }

    console.log(`[ProductService] Global product search: "${query.search}"`);

    const where: any = {
      item_status: 'active' as const,
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
        { sku: { contains: query.search, mode: 'insensitive' as const } }
      ]
    };

    const sort = query.sort || 'created_at';
    const order = query.order || 'desc';
    const orderBy: any = { [sort]: order };

    const limit = Math.min(query.limit || 20, 100);
    const offset = query.offset || 0;

    const { prisma } = await import('../prisma');

    const [products, total] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy,
        include: {
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

    const transformedProducts: ProductResult[] = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price_cents ? product.price_cents / 100 : null,
      imageUrl: product.image_url || null,
      sku: product.sku,
      availability: (product.stock > 0 || (product.quantity && product.quantity > 0)) ? 'in_stock' : 'out_of_stock',
      tenant: product.tenants || {
        id: 'unknown',
        name: 'Unknown Store',
        slug: null
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
   * Get single product by ID
   */
  async getProductById(productId: string): Promise<ProductResult | null> {
    console.log(`[ProductService] Getting product by ID: ${productId}`);

    const { prisma } = await import('../prisma');

    const product = await prisma.inventory_items.findFirst({
      where: {
        id: productId,
        item_status: 'active' as const
      },
      include: {
        photo_assets: true,
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!product) {
      return null;
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price_cents ? product.price_cents / 100 : null,
      imageUrl: product.image_url || null,
      sku: product.sku,
      availability: (product.stock > 0 || (product.quantity && product.quantity > 0)) ? 'in_stock' : 'out_of_stock',
      tenant: product.tenants || {
        id: 'unknown',
        name: 'Unknown Store',
        slug: null
      },
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };
  }

  /**
   * Get products by category ID
   */
  async getProductsByCategory(categoryId: string, query: ProductQuery = {}): Promise<ProductResponse> {
    console.log(`[ProductService] Getting products for category: ${categoryId}`);

    // Build database query
    const where: any = {
      directory_category_id: categoryId,
      item_status: 'active' as const,
    };

    // Add search filter if provided
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } }
      ];
    }

    // Add price filters if provided
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price_cents = {};
      if (query.minPrice !== undefined) {
        where.price_cents.gte = Math.round(query.minPrice * 100);
      }
      if (query.maxPrice !== undefined) {
        where.price_cents.lte = Math.round(query.maxPrice * 100);
      }
    }

    // Build order clause
    const sort = query.sort || 'created_at';
    const order = query.order || 'desc';
    const orderBy: any = { [sort]: order };

    const limit = Math.min(query.limit || 20, 100); // Cap at 100
    const offset = query.offset || 0;

    // Import prisma dynamically to avoid circular imports
    const { prisma } = await import('../prisma');

    // Execute query with pagination
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

    console.log(`[ProductService] Found ${products.length} products for category ${categoryId}`);

    // Transform results
    const transformedProducts: ProductResult[] = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price_cents ? product.price_cents / 100 : null,
      imageUrl: product.image_url || null,
      sku: product.sku,
      availability: (product.stock > 0 || (product.quantity && product.quantity > 0)) ? 'in_stock' : 'out_of_stock',
      tenant: product.tenants || {
        id: 'unknown',
        name: 'Unknown Store',
        slug: null
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
}