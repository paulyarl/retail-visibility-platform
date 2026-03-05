import { UniversalIdentifierCache } from './UniversalIdentifierCache';

export interface SingleProductResult {
  id: string;
  name: string;
  title: string;
  description: string;
  price: number | null;
  priceCents: number;
  sku: string;
  availability: string;
  stock: number;
  quantity: number;
  images: Array<{
    id: string;
    url: string;
    position: number;
    isPrimary: boolean;
  }>;
  tenant: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier?: string;
    city?: string;
    state?: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  brand?: string;
  condition?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  tags?: string[];
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
  // Featured types
  featuredTypes?: string[];
  metadata?: any;
  tenantId: string;
  itemStatus: string;
  visibility: string;
  gtin?: string;
  mpn?: string;
  manufacturer?: string;
  imageUrl?: string;
  currency: string;
  tenantCategoryId?: string;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
    googleCategoryId?: string | null;
  } | null;
}

export class SingleProductService {
  private static instance: SingleProductService;
  private cache: Map<string, { data: SingleProductResult; timestamp: number }> = new Map();
  private readonly cacheTTL = 15 * 60 * 1000; // 15 minutes for individual products

  private constructor() {
    // Clean up expired cache entries periodically
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  static getInstance(): SingleProductService {
    if (!SingleProductService.instance) {
      SingleProductService.instance = new SingleProductService();
    }
    return SingleProductService.instance;
  }

  /**
   * Get single product by ID with full details
   */
  async getProductById(productId: string): Promise<SingleProductResult | null> {
    const cacheKey = `product:${productId}`;

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[SingleProductService] Cache hit for product: ${productId}`);
      return cached;
    }

    console.log(`[SingleProductService] Cache miss, fetching product: ${productId}`);

    const { prisma } = await import('../prisma');

    const product = await prisma.inventory_items.findFirst({
      where: {
        id: productId,
        item_status: 'active' as const
      }
    });

    if (!product) {
      console.log(`[SingleProductService] Product not found: ${productId}`);
      return null;
    }

    // Get photos separately
    const photos = await prisma.photo_assets.findMany({
      where: { inventoryItemId: productId },
      orderBy: { position: 'asc' }
    });

    // Get tenant info separately
    const tenant = await prisma.tenants.findUnique({
      where: { id: product.tenant_id },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true
      }
    });

    // Get category info separately
    const category = product.directory_category_id ? 
      await prisma.platform_categories.findUnique({
        where: { id: product.directory_category_id },
        select: {
          id: true,
          name: true,
          slug: true
        }
      }) : null;

    // Get featured types from mv_global_discovery using Prisma model
    let featuredTypes: string[] = [];
    try {
      const mvData = await prisma.mv_global_discovery.findUnique({
        where: { inventory_item_id: productId },
        select: { featured_type_array: true }
      });
      if (mvData?.featured_type_array && Array.isArray(mvData.featured_type_array)) {
        featuredTypes = mvData.featured_type_array as string[];
      }
    } catch (err) {
      console.log('[SingleProductService] Could not fetch featured types from MV:', err);
    }

    // Transform the product data
    const transformedProduct: SingleProductResult = {
      id: product.id,
      name: product.name,
      title: product.name, // Add title field
      description: product.description || '',
      price: product.price_cents ? product.price_cents / 100 : null,
      priceCents: product.price_cents || 0, // Add priceCents field
      sku: product.sku || '',
      availability: this.determineAvailability(product.stock, product.quantity),
      stock: product.stock || 0,
      quantity: product.quantity || 0,
      images: photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        position: photo.position,
        isPrimary: photo.position === 0
      })),
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug || '',
        subscriptionTier: tenant.subscription_tier || undefined,
        city: undefined, // Not available in tenant schema
        state: undefined // Not available in tenant schema
      } : {
        id: product.tenant_id,
        name: 'Unknown Store',
        slug: '',
        subscriptionTier: undefined,
        city: undefined,
        state: undefined
      },
      category: category || undefined,
      brand: product.brand || '',
      condition: product.condition || '',
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      // Add missing fields from the working API
      metadata: product.metadata || {},
      tenantId: product.tenant_id,
      itemStatus: product.item_status || 'unknown',
      visibility: product.visibility || 'public',
      gtin: product.gtin || undefined,
      mpn: product.mpn || undefined,
      manufacturer: product.manufacturer || undefined,
      imageUrl: photos.length > 0 ? photos[0].url : undefined,
      currency: 'USD', // Default currency
      tenantCategoryId: product.directory_category_id || undefined,
      tenantCategory: category ? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        googleCategoryId: null
      } : null,
      // Featured types from MV
      featuredTypes: featuredTypes
    };

    // Cache the result
    this.setCache(cacheKey, transformedProduct);

    console.log(`[SingleProductService] Cached product: ${productId}`);
    return transformedProduct;
  }

  /**
   * Get multiple products by IDs (batch lookup)
   */
  async getProductsByIds(productIds: string[]): Promise<SingleProductResult[]> {
    if (productIds.length === 0) return [];

    console.log(`[SingleProductService] Batch lookup for ${productIds.length} products`);

    const { prisma } = await import('../prisma');

    const products = await prisma.inventory_items.findMany({
      where: {
        id: { in: productIds },
        item_status: 'active' as const
      }
    });

    // Get all related data in batch
    const allPhotos = await prisma.photo_assets.findMany({
      where: { inventoryItemId: { in: productIds } },
      orderBy: { position: 'asc' }
    });

    const allTenants = await prisma.tenants.findMany({
      where: { id: { in: products.map(p => p.tenant_id) } },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true
      }
    });

    const allCategories = await prisma.platform_categories.findMany({
      where: { id: { in: products.map(p => p.directory_category_id).filter(Boolean) as string[] } },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });

    // Create lookup maps
    const photosMap = new Map(allPhotos.map(photo => [photo.inventoryItemId, photo]));
    const tenantsMap = new Map(allTenants.map(tenant => [tenant.id, tenant]));
    const categoriesMap = new Map(allCategories.map(cat => [cat.id, cat]));

    const transformedProducts: SingleProductResult[] = products.map((product: any) => {
      const productPhotos = Array.from(photosMap.values()).filter(photo => photo.inventoryItemId === product.id);
      const tenant = tenantsMap.get(product.tenant_id);
      const category = product.directory_category_id ? categoriesMap.get(product.directory_category_id) : null;

      return {
        id: product.id,
        name: product.name,
        title: product.name, // Add title field
        description: product.description || '',
        price: product.price_cents ? product.price_cents / 100 : null,
        priceCents: product.price_cents || 0, // Add priceCents field
        sku: product.sku || '',
        availability: this.determineAvailability(product.stock, product.quantity),
        stock: product.stock || 0,
        quantity: product.quantity || 0,
        images: productPhotos.map((photo: any) => ({
          id: photo.id,
          url: photo.url,
          position: photo.position,
          isPrimary: photo.position === 0
        })),
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug || '',
          subscriptionTier: tenant.subscription_tier || undefined,
          city: undefined,
          state: undefined
        } : {
          id: product.tenant_id,
          name: 'Unknown Store',
          slug: '',
          subscriptionTier: undefined,
          city: undefined,
          state: undefined
        },
        category: category || undefined,
        brand: (product as any).brand || '',
        manufacturer: (product as any).manufacturer || undefined,
        condition: (product as any).condition || '',
        weight: (product as any).weight,
        dimensions: this.parseDimensions((product as any).dimensions),
        tags: this.parseTags((product as any).tags),
        variants: [],
        createdAt: product.created_at,
        updatedAt: product.updated_at,
        // Add missing required fields
        metadata: (product as any).metadata || {},
        tenantId: product.tenant_id,
        itemStatus: (product as any).item_status || 'unknown',
        visibility: (product as any).visibility || 'public',
        gtin: (product as any).gtin || undefined,
        mpn: (product as any).mpn || undefined,
        imageUrl: productPhotos.length > 0 ? productPhotos[0].url : undefined,
        currency: 'USD',
        tenantCategoryId: (product as any).directory_category_id || undefined,
        tenantCategory: category ? {
          id: category.id,
          name: category.name,
          slug: category.slug,
          googleCategoryId: null
        } : null
      };
    });

    // Cache individual products
    transformedProducts.forEach(product => {
      this.setCache(`product:${product.id}`, product);
    });

    console.log(`[SingleProductService] Cached ${transformedProducts.length} products from batch lookup`);
    return transformedProducts;
  }

  /**
   * Get products by tenant and SKU
   */
  async getProductByTenantAndSku(tenantId: string, sku: string): Promise<SingleProductResult | null> {
    console.log(`[SingleProductService] Getting product by tenant ${tenantId} and SKU ${sku}`);

    const { prisma } = await import('../prisma');

    const product = await prisma.inventory_items.findFirst({
      where: {
        tenant_id: tenantId,
        sku: sku,
        item_status: 'active' as const
      },
      include: {
        photo_assets: {
          orderBy: { position: 'asc' }
        },
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscription_tier: true
          }
        }
      }
    });

    if (!product) {
      console.log(`[SingleProductService] Product not found for tenant ${tenantId}, SKU ${sku}`);
      return null;
    }

    // Transform and cache
    const transformedProduct = this.transformProduct(product);
    this.setCache(`product:${product.id}`, transformedProduct);

    return transformedProduct;
  }

  /**
   * Invalidate product cache (call when product is updated)
   */
  invalidateProductCache(productId: string): void {
    console.log(`[SingleProductService] Invalidating cache for product: ${productId}`);
    this.cache.delete(`product:${productId}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: string[];
    totalMemoryUsage: number;
  } {
    const entries = Array.from(this.cache.keys());
    let totalMemoryUsage = 0;

    this.cache.forEach((value, key) => {
      totalMemoryUsage += key.length * 2;
      totalMemoryUsage += JSON.stringify(value.data).length * 2;
      totalMemoryUsage += 16;
    });

    return {
      size: this.cache.size,
      entries,
      totalMemoryUsage
    };
  }

  private transformProduct(product: any): SingleProductResult {
    return {
      id: product.id,
      name: product.name,
      title: product.name, // Add title field
      description: product.description || '',
      price: product.price_cents ? product.price_cents / 100 : null,
      priceCents: product.price_cents || 0, // Add priceCents field
      sku: product.sku || '',
      availability: this.determineAvailability(product.stock, product.quantity),
      stock: product.stock || 0,
      quantity: product.quantity || 0,
      images: [], // Should be populated by the calling method
      tenant: {
        id: product.tenant_id,
        name: 'Unknown Store',
        slug: '',
        subscriptionTier: undefined,
        city: undefined,
        state: undefined
      },
      category: undefined, // Should be populated by the calling method
      brand: (product as any).brand || '',
      manufacturer: (product as any).manufacturer || undefined,
      condition: (product as any).condition || '',
      weight: (product as any).weight,
      dimensions: this.parseDimensions((product as any).dimensions),
      tags: this.parseTags((product as any).tags),
      variants: [],
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      // Add missing required fields
      metadata: (product as any).metadata || {},
      tenantId: product.tenant_id,
      itemStatus: (product as any).item_status || 'unknown',
      visibility: (product as any).visibility || 'public',
      gtin: (product as any).gtin || undefined,
      mpn: (product as any).mpn || undefined,
      imageUrl: undefined, // Should be populated by the calling method
      currency: 'USD',
      tenantCategoryId: (product as any).directory_category_id || undefined,
      tenantCategory: null // Should be populated by the calling method
    };
  }

  private determineAvailability(stock: number | null, quantity: number | null): 'in_stock' | 'out_of_stock' | 'limited' {
    const totalAvailable = (stock || 0) + (quantity || 0);
    if (totalAvailable === 0) return 'out_of_stock';
    if (totalAvailable <= 5) return 'limited';
    return 'in_stock';
  }

  private parseDimensions(dimensions: any): { length?: number; width?: number; height?: number } | undefined {
    if (!dimensions) return undefined;

    try {
      if (typeof dimensions === 'string') {
        const parsed = JSON.parse(dimensions);
        return {
          length: parsed.length,
          width: parsed.width,
          height: parsed.height
        };
      }
      return dimensions;
    } catch {
      return undefined;
    }
  }

  private parseTags(tags: any): string[] | undefined {
    if (!tags) return undefined;

    try {
      if (typeof tags === 'string') {
        return JSON.parse(tags);
      }
      if (Array.isArray(tags)) {
        return tags;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private getFromCache(key: string): SingleProductResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: SingleProductResult): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTTL) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`[SingleProductService] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }
}
