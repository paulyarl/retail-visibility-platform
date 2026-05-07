import { UniversalIdentifierCache } from './UniversalIdentifierCache';

export interface SingleProductResult {
  id: string;
  name: string;
  title: string;
  description: string;
  price: number | null;
  priceCents: number;
  listPriceCents: number;  // Add list price
  salePriceCents: number;  // Add sale price
  isOnSale: boolean;       // Add sale status
  discountPercentage: string; // Add discount percentage
  sku: string;
  availability: string;
  stock: number;
  quantity: number;
  // NEW: Slug registry fields for cross-tenant matching
  productSlug?: string;
  brandNormalized?: string;
  categoryNormalized?: string;
  slugType?: 'upc' | 'lpc';
  platformTenantCount?: number;
  platformPurchaseCount?: number;
  platformTotalStock?: number;
  otherTenantsCount?: number;
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
  productType?: 'physical' | 'digital' | 'hybrid';
  digitalDeliveryMethod?: string;
  digitalAssets?: any[];
  licenseType?: string;
  accessDurationDays?: number;
  downloadLimit?: number;
  variants?: Array<{
    id: string;
    sku: string;
    variant_name: string;
    price_cents: number | null;
    sale_price_cents: number | null;
    stock: number;
    image_url: string | null;
    attributes: any;
    sort_order: number | null;
    is_active: boolean | null;
    is_on_sale: boolean;
    discount_percentage: number;
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

    // Get variants separately if product has variants
    const variants = product.has_variants ? 
      await prisma.product_variants.findMany({
        where: { 
          parent_item_id: productId,
          is_active: true 
        },
        orderBy: { sort_order: 'asc' }
      }) : [];

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

    // Get category info separately - use directory_category table (tenant categories)
    const category = product.directory_category_id ? 
      await prisma.directory_category.findUnique({
        where: { id: product.directory_category_id },
        select: {
          id: true,
          name: true,
          slug: true,
          googleCategoryId: true
        }
      }) : null;

    // Get featured types and slug fields from mv_global_discovery materialized view
    let featuredTypes: string[] = [];
    let slugData: {
      product_slug?: string;
      brand_normalized?: string;
      category_normalized?: string;
      slug_type?: 'upc' | 'lpc';
      platform_tenant_count?: number;
      platform_purchase_count?: number;
      platform_total_stock?: number;
    } = {};
    try {
      const pool = require('../utils/db-pool').getDirectPool();
      const mvResult = await pool.query(
        `SELECT featured_type, product_slug, brand_normalized, category_normalized, 
                slug_type, platform_tenant_count, platform_purchase_count, platform_total_stock
         FROM mv_global_discovery 
         WHERE inventory_item_id = $1 
           AND is_actively_featured = true`,
        [productId]
      );
      
      if (mvResult.rows.length > 0) {
        featuredTypes = mvResult.rows.map((row: any) => row.featured_type).filter(Boolean);
        // Take slug data from first row
        slugData = {
          product_slug: mvResult.rows[0].product_slug,
          brand_normalized: mvResult.rows[0].brand_normalized,
          category_normalized: mvResult.rows[0].category_normalized,
          slug_type: mvResult.rows[0].slug_type,
          platform_tenant_count: mvResult.rows[0].platform_tenant_count,
          platform_purchase_count: mvResult.rows[0].platform_purchase_count,
          platform_total_stock: mvResult.rows[0].platform_total_stock
        };
      }
    } catch (error) {
      console.log('[SingleProductService] MV query failed:', error);
      // Continue without featured types/slug data if query fails
    }
    
    // Try to get slug data even if not featured
    if (!slugData.product_slug) {
      try {
        const pool = require('../utils/db-pool').getDirectPool();
        const slugResult = await pool.query(
          `SELECT product_slug, brand_normalized, category_normalized, 
                  slug_type, platform_tenant_count, platform_purchase_count, platform_total_stock
           FROM mv_global_discovery 
           WHERE inventory_item_id = $1 
           LIMIT 1`,
          [productId]
        );
        
        if (slugResult.rows.length > 0) {
          slugData = {
            product_slug: slugResult.rows[0].product_slug,
            brand_normalized: slugResult.rows[0].brand_normalized,
            category_normalized: slugResult.rows[0].category_normalized,
            slug_type: slugResult.rows[0].slug_type,
            platform_tenant_count: slugResult.rows[0].platform_tenant_count,
            platform_purchase_count: slugResult.rows[0].platform_purchase_count,
            platform_total_stock: slugResult.rows[0].platform_total_stock
          };
        }
      } catch (error) {
        console.log('[SingleProductService] Slug data query failed:', error);
      }
    }

    // Transform the product data
    const transformedProduct: SingleProductResult = {
      id: product.id,
      name: product.name,
      title: product.name, // Add title field
      description: product.description || '',
      price: product.sale_price_cents ? product.sale_price_cents / 100 : (product.price_cents ? product.price_cents / 100 : null),
      priceCents: product.sale_price_cents || product.price_cents || 0, // Use sale price if available
      listPriceCents: product.price_cents || 0, // Add list price
      salePriceCents: product.sale_price_cents || 0, // Add sale price
      isOnSale: !!(product.sale_price_cents && product.sale_price_cents < product.price_cents), // Determine if on sale
      discountPercentage: product.sale_price_cents && product.price_cents ? 
        Math.round(((product.price_cents - product.sale_price_cents) / product.price_cents) * 100).toString() : '0',
      sku: product.sku || '',
      availability: this.determineAvailability(product.stock, product.quantity),
      stock: product.stock || 0,
      // For simple products, quantity mirrors stock if not explicitly set
      quantity: product.quantity ?? product.stock ?? 0,
      images: photos.length > 0 ? photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        position: photo.position,
        isPrimary: photo.position === 0
      })) : (product.image_gallery && Array.isArray(product.image_gallery) && product.image_gallery.length > 0
        ? [
            // Prepend image_url as first image if it exists
            ...(product.image_url ? [{ id: 'primary', url: product.image_url, position: 0, isPrimary: true }] : []),
            // Then add gallery images
            ...product.image_gallery.map((url: string, index: number) => ({
              id: `gallery-${index}`,
              url,
              position: index + (product.image_url ? 1 : 0),
              isPrimary: index === 0 && !product.image_url
            }))
          ]
        : (product.image_url ? [{
            id: 'primary',
            url: product.image_url,
            position: 0,
            isPrimary: true
          }] : [])),
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
      manufacturer: product.manufacturer || '',
      imageUrl: product.image_url || '',
      currency: product.currency || 'USD',
      tenantCategoryId: product.directory_category_id || undefined,
      tenantCategory: category ? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        googleCategoryId: category.googleCategoryId
      } : undefined,
      // Add variants data
      variants: variants.map(v => ({
        id: v.id,
        sku: v.sku,
        variant_name: v.variant_name,
        price_cents: v.price_cents,
        sale_price_cents: v.sale_price_cents,
        stock: v.stock,
        image_url: v.image_url,
        attributes: v.attributes,
        sort_order: v.sort_order,
        is_active: v.is_active,
        is_on_sale: v.sale_price_cents && v.price_cents ? v.sale_price_cents < v.price_cents : false,
        discount_percentage: v.sale_price_cents && v.price_cents ? 
          Math.round(((v.price_cents - v.sale_price_cents) / v.price_cents) * 100) : 0
      })),
      // Add digital product fields
      productType: product.product_type || 'physical',
      digitalDeliveryMethod: product.digital_delivery_method || undefined,
      digitalAssets: Array.isArray(product.digital_assets) ? product.digital_assets : [],
      licenseType: product.license_type || undefined,
      accessDurationDays: product.access_duration_days || undefined,
      downloadLimit: product.download_limit || undefined,
      featuredTypes: featuredTypes || [],
      // NEW: Slug registry fields for cross-tenant matching
      productSlug: slugData.product_slug,
      brandNormalized: slugData.brand_normalized,
      categoryNormalized: slugData.category_normalized,
      slugType: slugData.slug_type,
      platformTenantCount: slugData.platform_tenant_count,
      platformPurchaseCount: slugData.platform_purchase_count,
      platformTotalStock: slugData.platform_total_stock,
      otherTenantsCount: slugData.platform_tenant_count && slugData.platform_tenant_count > 1 
        ? slugData.platform_tenant_count - 1 
        : 0
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

    const allCategories = await prisma.directory_category.findMany({
      where: { id: { in: products.map(p => p.directory_category_id).filter(Boolean) as string[] } },
      select: {
        id: true,
        name: true,
        slug: true,
        googleCategoryId: true
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
        price: product.sale_price_cents ? product.sale_price_cents / 100 : (product.price_cents ? product.price_cents / 100 : null),
        priceCents: product.sale_price_cents || product.price_cents || 0,
        listPriceCents: product.price_cents || 0,
        salePriceCents: product.sale_price_cents || 0,
        isOnSale: !!(product.sale_price_cents && product.sale_price_cents < product.price_cents),
        discountPercentage: product.sale_price_cents && product.price_cents ? 
          Math.round(((product.price_cents - product.sale_price_cents) / product.price_cents) * 100).toString() : '0',
        sku: product.sku || '',
        availability: this.determineAvailability(product.stock, product.quantity),
        stock: product.stock || 0,
        quantity: product.quantity ?? product.stock ?? 0,
        images: productPhotos.length > 0 ? productPhotos.map((photo: any) => ({
          id: photo.id,
          url: photo.url,
          position: photo.position,
          isPrimary: photo.position === 0
        })) : ((product as any).image_gallery && Array.isArray((product as any).image_gallery) && (product as any).image_gallery.length > 0
          ? [
              // Prepend image_url as first image if it exists
              ...((product as any).image_url ? [{ id: 'primary', url: (product as any).image_url, position: 0, isPrimary: true }] : []),
              // Then add gallery images
              ...(product as any).image_gallery.map((url: string, index: number) => ({
                id: `gallery-${index}`,
                url,
                position: index + ((product as any).image_url ? 1 : 0),
                isPrimary: index === 0 && !(product as any).image_url
              }))
            ]
          : ((product as any).image_url ? [{
              id: 'primary',
              url: (product as any).image_url,
              position: 0,
              isPrimary: true
            }] : [])),
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
          googleCategoryId: category.googleCategoryId || null
        } : null,
        // NEW: Slug registry fields (not available in batch lookup from inventory_items)
        // These would need a separate MV query for batch operations
        productSlug: undefined,
        brandNormalized: undefined,
        categoryNormalized: undefined,
        slugType: undefined,
        platformTenantCount: undefined,
        platformPurchaseCount: undefined,
        platformTotalStock: undefined,
        otherTenantsCount: undefined
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
   * Get product by product_slug with optional tenant filter
   * Used for cross-tenant product discovery
   */
  async getProductBySlug(productSlug: string, tenantId?: string): Promise<SingleProductResult | null> {
    const cacheKey = `product:slug:${productSlug}${tenantId ? `:${tenantId}` : ''}`;

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[SingleProductService] Cache hit for product slug: ${productSlug}`);
      return cached;
    }

    console.log(`[SingleProductService] Cache miss, fetching product by slug: ${productSlug}`);

    try {
      const pool = require('../utils/db-pool').getDirectPool();
      
      // Query mv_global_discovery for product by slug
      let query = `
        SELECT 
          inventory_item_id,
          product_name,
          product_title,
          product_description,
          sku,
          current_price_cents,
          list_price_cents,
          sale_price_cents,
          stock,
          image_url,
          brand,
          product_slug,
          brand_normalized,
          category_normalized,
          slug_type,
          platform_tenant_count,
          platform_purchase_count,
          platform_total_stock,
          tenant_id,
          tenant_name,
          tenant_slug,
          tenant_logo_url,
          tenant_city,
          tenant_state,
          product_category,
          product_category_slug,
          in_stock,
          item_status,
          visibility
        FROM mv_global_discovery
        WHERE product_slug = $1
          AND item_status = 'active'
          AND visibility = 'public'
      `;
      
      const params: any[] = [productSlug];
      
      if (tenantId) {
        query += ` AND tenant_id = $2`;
        params.push(tenantId);
      }
      
      query += ` LIMIT 1`;

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        console.log(`[SingleProductService] Product not found for slug: ${productSlug}`);
        return null;
      }

      const row = result.rows[0];

      // Get additional product details from inventory_items
      const { prisma } = await import('../prisma');
      const fullProduct = await prisma.inventory_items.findFirst({
        where: {
          id: row.inventory_item_id,
          item_status: 'active'
        }
      });

      if (!fullProduct) {
        console.log(`[SingleProductService] Full product not found for ID: ${row.inventory_item_id}`);
        return null;
      }

      // Get photos
      const photos = await prisma.photo_assets.findMany({
        where: { inventoryItemId: row.inventory_item_id },
        orderBy: { position: 'asc' }
      });

      // Get variants
      const variants = fullProduct.has_variants ? 
        await prisma.product_variants.findMany({
          where: { 
            parent_item_id: row.inventory_item_id,
            is_active: true 
          },
          orderBy: { sort_order: 'asc' }
        }) : [];

      // Get category
      const category = fullProduct.directory_category_id ? 
        await prisma.directory_category.findUnique({
          where: { id: fullProduct.directory_category_id },
          select: {
            id: true,
            name: true,
            slug: true,
            googleCategoryId: true
          }
        }) : null;

      // Transform the product data
      const transformedProduct: SingleProductResult = {
        id: fullProduct.id,
        name: fullProduct.name,
        title: fullProduct.name,
        description: fullProduct.description || '',
        price: fullProduct.sale_price_cents ? fullProduct.sale_price_cents / 100 : (fullProduct.price_cents ? fullProduct.price_cents / 100 : null),
        priceCents: fullProduct.sale_price_cents || fullProduct.price_cents || 0,
        listPriceCents: fullProduct.price_cents || 0,
        salePriceCents: fullProduct.sale_price_cents || 0,
        isOnSale: !!(fullProduct.sale_price_cents && fullProduct.sale_price_cents < fullProduct.price_cents),
        discountPercentage: fullProduct.sale_price_cents && fullProduct.price_cents ? 
          Math.round(((fullProduct.price_cents - fullProduct.sale_price_cents) / fullProduct.price_cents) * 100).toString() : '0',
        sku: fullProduct.sku || '',
        availability: this.determineAvailability(fullProduct.stock, fullProduct.quantity),
        stock: fullProduct.stock || 0,
        quantity: fullProduct.quantity ?? fullProduct.stock ?? 0,
        images: photos.length > 0 ? photos.map((photo: any) => ({
          id: photo.id,
          url: photo.url,
          position: photo.position,
          isPrimary: photo.position === 0
        })) : ((fullProduct as any).image_gallery && Array.isArray((fullProduct as any).image_gallery) && (fullProduct as any).image_gallery.length > 0
          ? [
              // Prepend image_url as first image if it exists
              ...((fullProduct as any).image_url ? [{ id: 'primary', url: (fullProduct as any).image_url, position: 0, isPrimary: true }] : []),
              // Then add gallery images
              ...(fullProduct as any).image_gallery.map((url: string, index: number) => ({
                id: `gallery-${index}`,
                url,
                position: index + ((fullProduct as any).image_url ? 1 : 0),
                isPrimary: index === 0 && !(fullProduct as any).image_url
              }))
            ]
          : ((fullProduct as any).image_url ? [{
              id: 'primary',
              url: (fullProduct as any).image_url,
              position: 0,
              isPrimary: true
            }] : [])),
        tenant: {
          id: row.tenant_id,
          name: row.tenant_name,
          slug: row.tenant_slug || '',
          subscriptionTier: undefined,
          city: row.tenant_city,
          state: row.tenant_state
        },
        category: category || undefined,
        brand: fullProduct.brand || '',
        condition: fullProduct.condition || '',
        createdAt: fullProduct.created_at,
        updatedAt: fullProduct.updated_at,
        metadata: fullProduct.metadata || {},
        tenantId: row.tenant_id,
        itemStatus: fullProduct.item_status || 'active',
        visibility: fullProduct.visibility || 'public',
        manufacturer: fullProduct.manufacturer || '',
        imageUrl: fullProduct.image_url || '',
        currency: fullProduct.currency || 'USD',
        tenantCategoryId: fullProduct.directory_category_id || undefined,
        tenantCategory: category ? {
          id: category.id,
          name: category.name,
          slug: category.slug,
          googleCategoryId: category.googleCategoryId
        } : undefined,
        variants: variants.map(v => ({
          id: v.id,
          sku: v.sku,
          variant_name: v.variant_name,
          price_cents: v.price_cents,
          sale_price_cents: v.sale_price_cents,
          stock: v.stock,
          image_url: v.image_url,
          attributes: v.attributes,
          sort_order: v.sort_order,
          is_active: v.is_active,
          is_on_sale: v.sale_price_cents && v.price_cents ? v.sale_price_cents < v.price_cents : false,
          discount_percentage: v.sale_price_cents && v.price_cents ? 
            Math.round(((v.price_cents - v.sale_price_cents) / v.price_cents) * 100) : 0
        })),
        productType: fullProduct.product_type || 'physical',
        digitalDeliveryMethod: fullProduct.digital_delivery_method || undefined,
        digitalAssets: Array.isArray(fullProduct.digital_assets) ? fullProduct.digital_assets : [],
        licenseType: fullProduct.license_type || undefined,
        accessDurationDays: fullProduct.access_duration_days || undefined,
        downloadLimit: fullProduct.download_limit || undefined,
        featuredTypes: [],
        // NEW: Slug registry fields for cross-tenant matching
        productSlug: row.product_slug,
        brandNormalized: row.brand_normalized,
        categoryNormalized: row.category_normalized,
        slugType: row.slug_type,
        platformTenantCount: row.platform_tenant_count,
        platformPurchaseCount: row.platform_purchase_count,
        platformTotalStock: row.platform_total_stock,
        otherTenantsCount: row.platform_tenant_count && row.platform_tenant_count > 1 
          ? row.platform_tenant_count - 1 
          : 0
      };

      // Cache the result
      this.setCache(cacheKey, transformedProduct);

      console.log(`[SingleProductService] Cached product by slug: ${productSlug}`);
      return transformedProduct;
    } catch (error) {
      console.error('[SingleProductService] Error fetching product by slug:', error);
      return null;
    }
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
      price: product.sale_price_cents ? product.sale_price_cents / 100 : (product.price_cents ? product.price_cents / 100 : null),
      priceCents: product.sale_price_cents || product.price_cents || 0,
      listPriceCents: product.price_cents || 0,
      salePriceCents: product.sale_price_cents || 0,
      isOnSale: !!(product.sale_price_cents && product.sale_price_cents < product.price_cents),
      discountPercentage: product.sale_price_cents && product.price_cents ? 
        Math.round(((product.price_cents - product.sale_price_cents) / product.price_cents) * 100).toString() : '0',
      sku: product.sku || '',
      availability: this.determineAvailability(product.stock, product.quantity),
      stock: product.stock || 0,
      quantity: product.quantity ?? product.stock ?? 0,
      images: (product.image_gallery && Array.isArray(product.image_gallery) && product.image_gallery.length > 0
        ? [
            // Prepend image_url as first image if it exists
            ...(product.image_url ? [{ id: 'primary', url: product.image_url, position: 0, isPrimary: true }] : []),
            // Then add gallery images
            ...product.image_gallery.map((url: string, index: number) => ({
              id: `gallery-${index}`,
              url,
              position: index + (product.image_url ? 1 : 0),
              isPrimary: index === 0 && !product.image_url
            }))
          ]
        : (product.image_url ? [{
            id: 'primary',
            url: product.image_url,
            position: 0,
            isPrimary: true
          }] : [])),
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
