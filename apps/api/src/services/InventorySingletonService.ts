/**
 * Inventory Singleton Service - Centralized Product Information Provider
 * 
 * Provides consistent product data including:
 * - Product resolution by multiple identifiers (ID, SKU, variant ID, autoId)
 * - URL generation and caching
 * - Product metadata and variants
 * - Analytics and performance data
 * 
 * This is the single source of truth for all product-related data
 * that other services can depend on for consistency and performance.
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { logger } from '../logger';
import { basePrisma } from '../prisma';
import slugSingletonService from './SlugSingletonService';

// Product Information Interface
export interface ProductInfo {
  id: string;
  sku: string;
  name: string;
  slug?: string;
  autoId?: string;
  description?: string;
  priceCents: number;
  stock: number;
  status: 'active' | 'draft' | 'archived' | 'out_of_stock' | 'low_stock';
  categoryId?: string;
  tenantId: string;
  imageUrl?: string;
  imageGallery?: string[];
  metadata?: Record<string, any>;
  
  // Variant information
  hasVariants: boolean;
  defaultVariantId?: string;
  variants?: ProductVariant[];
  
  // Analytics
  viewCount?: number;
  orderCount?: number;
  revenue?: number;
  
  // URLs
  urls: ProductUrls;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Product Variant Interface
export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  variantName: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  imageUrl?: string;
  imageGallery?: string[];
  attributes: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Product URLs Interface
export interface ProductUrls {
  skuUrl: string;
  productIdUrl: string;
  autoIdUrl?: string;
  canonicalUrl: string;
  storefrontUrl: string;
  directoryUrl: string;
}

// Product Identifiers Interface
export interface ProductIdentifiers {
  productId: string;
  sku: string;
  variantId?: string;
  autoId?: string;
  urls: ProductUrls;
}

// Product Resolution Interface
export interface ProductResolution {
  productId?: string;
  sku?: string;
  variantId?: string;
  autoId?: string;
  found: boolean;
  product?: ProductInfo;
}

// Location Information for URL Generation
export interface LocationInfo {
  city?: string;
  state?: string;
  country?: string;
  address?: string;
}

/**
 * Inventory Singleton Service
 * 
 * Extends UniversalSingleton to provide centralized product information
 * with caching, metrics, and multi-identifier resolution
 */
export class InventorySingletonService extends UniversalSingleton {
  private static instance: InventorySingletonService;

  private constructor(options?: SingletonCacheOptions) {
    super('inventory-singleton', {
      defaultTTL: 300, // 5 minutes
      maxCacheSize: 2000,
      enableMetrics: true,
      enableLogging: true,
      ...options
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: SingletonCacheOptions): InventorySingletonService {
    if (!InventorySingletonService.instance) {
      InventorySingletonService.instance = new InventorySingletonService(options);
    }
    return InventorySingletonService.instance;
  }

  /**
   * Resolve product by any identifier (ID, SKU, variant ID, autoId)
   */
  public async resolveProductByIdentifier(identifier: string): Promise<ProductResolution> {
    const cacheKey = `resolve-${identifier}`;
    
    // Check cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached as ProductResolution;
    }

    this.metrics.cacheMisses++;
    
    let resolution: ProductResolution = { found: false };

    // Try to resolve as product ID
    try {
      const product = await this.getProductById(identifier);
      if (product) {
        resolution = {
          productId: product.id,
          sku: product.sku,
          found: true,
          product
        };
      }
    } catch (error) {
      // Product ID lookup failed, continue to next method
    }

    // Try to resolve as SKU if not found
    if (!resolution.found) {
      try {
        const product = await this.getProductBySku(identifier);
        if (product) {
          resolution = {
            productId: product.id,
            sku: product.sku,
            found: true,
            product
          };
        }
      } catch (error) {
        // SKU lookup failed, continue to next method
      }
    }

    // Try to resolve as variant ID if not found
    if (!resolution.found) {
      try {
        const variant = await this.getVariantById(identifier);
        if (variant) {
          const product = await this.getProductById(variant.productId);
          resolution = {
            productId: variant.productId,
            sku: product?.sku,
            variantId: variant.id,
            found: true,
            product: product || undefined
          };
        }
      } catch (error) {
        // Variant ID lookup failed, continue to next method
      }
    }

    // Try to resolve as autoId if not found
    if (!resolution.found) {
      try {
        const product = await this.getProductByAutoId(identifier);
        if (product) {
          resolution = {
            productId: product.id,
            sku: product.sku,
            autoId: identifier,
            found: true,
            product
          };
        }
      } catch (error) {
        // AutoId lookup failed
      }
    }

    // Cache the result
    await this.setCache(cacheKey, resolution, { ttl: 300 }); // 5 minutes
    
    return resolution;
  }

  /**
   * Get product identifiers and URLs
   */
  public async getProductIdentifiersAsync(productId: string): Promise<ProductIdentifiers> {
    const cacheKey = `product-identifiers-${productId}`;
    
    // Check cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached as ProductIdentifiers;
    }

    this.metrics.cacheMisses++;
    
    // Fetch from database
    const product = await this.getProductById(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    const identifiers: ProductIdentifiers = {
      productId: product.id,
      sku: product.sku,
      variantId: product.defaultVariantId,
      autoId: product.autoId,
      urls: await this.generateProductUrls(product)
    };

    // Cache the result
    await this.setCache(cacheKey, identifiers, { ttl: 300 }); // 5 minutes
    this.metrics.apiCalls++;

    return identifiers;
  }

  /**
   * Generate all possible URLs for a product
   */
  public async generateProductUrls(product: ProductInfo): Promise<ProductUrls> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    
    return {
      // Primary URL (SKU-based)
      skuUrl: `/products/${product.sku}`,
      
      // Product ID URL
      productIdUrl: `/products/id/${product.id}`,
      
      // Auto ID URL (if available)
      autoIdUrl: product.autoId ? `/products/auto/${product.autoId}` : undefined,
      
      // Canonical URL (most SEO-friendly)
      canonicalUrl: product.slug ? `/products/${product.slug}` : `/products/${product.sku}`,
      
      // Storefront URL
      storefrontUrl: `/shop/products/${product.sku}`,
      
      // Directory URL
      directoryUrl: `/directory/products/${product.sku}`
    };
  }

  /**
   * Get product by ID
   */
  private async getProductById(productId: string): Promise<ProductInfo | null> {
    try {
      const result = await basePrisma.inventory_items.findUnique({
        where: { id: productId },
        include: {}
      });

      if (!result) return null;

      return this.mapDbToProductInfo(result);
    } catch (error) {
      logger.error('Error fetching product by ID:', undefined, { productId, error });
      throw error;
    }
  }

  /**
   * Get product by SKU
   */
  private async getProductBySku(sku: string): Promise<ProductInfo | null> {
    try {
      const result = await basePrisma.inventory_items.findFirst({
        where: { sku },
        include: {}
      });

      if (!result) return null;

      return this.mapDbToProductInfo(result);
    } catch (error) {
      logger.error('Error fetching product by SKU:', undefined, { sku, error });
      throw error;
    }
  }

  /**
   * Get product by autoId
   */
  private async getProductByAutoId(autoId: string): Promise<ProductInfo | null> {
    try {
      const result = await basePrisma.inventory_items.findFirst({
        where: { 
          metadata: {
            path: ['autoId'],
            equals: autoId
          }
        },
        include: {}
      });

      if (!result) return null;

      return this.mapDbToProductInfo(result);
    } catch (error) {
      logger.error('Error fetching product by autoId:', undefined, { autoId, error });
      throw error;
    }
  }

  /**
   * Get variant by ID
   */
  private async getVariantById(variantId: string): Promise<ProductVariant | null> {
    try {
      const result = await basePrisma.product_variants.findUnique({
        where: { id: variantId }
      });

      if (!result) return null;

      return this.mapDbToVariant(result);
    } catch (error) {
      logger.error('Error fetching variant by ID:', undefined, { variantId, error });
      throw error;
    }
  }

  /**
   * Map database result to ProductInfo
   */
  private mapDbToProductInfo(dbResult: any): ProductInfo {
    const metadata = dbResult.metadata as Record<string, any> || {};
    
    return {
      id: dbResult.id,
      sku: dbResult.sku,
      name: dbResult.name,
      slug: metadata.slug,
      autoId: metadata.autoId,
      description: dbResult.description,
      priceCents: dbResult.price_cents,
      stock: dbResult.stock,
      status: dbResult.item_status,
      categoryId: dbResult.category_id,
      tenantId: dbResult.tenant_id,
      imageUrl: dbResult.image_url,
      imageGallery: metadata.imageGallery || [],
      metadata,
      hasVariants: dbResult.has_variants,
      defaultVariantId: dbResult.default_variant_id,
      variants: dbResult.variants?.map(this.mapDbToVariant) || [],
      viewCount: metadata.viewCount || 0,
      orderCount: metadata.orderCount || 0,
      revenue: metadata.revenue || 0,
      urls: {} as ProductUrls, // Will be populated by generateProductUrls
      createdAt: dbResult.created_at,
      updatedAt: dbResult.updated_at
    };
  }

  /**
   * Map database result to ProductVariant
   */
  private mapDbToVariant(dbResult: any): ProductVariant {
    return {
      id: dbResult.id,
      productId: dbResult.product_id,
      sku: dbResult.sku,
      variantName: dbResult.variant_name,
      priceCents: dbResult.price_cents,
      salePriceCents: dbResult.sale_price_cents || undefined,
      stock: dbResult.stock,
      imageUrl: dbResult.image_url,
      imageGallery: dbResult.image_gallery || [],
      attributes: dbResult.attributes as Record<string, string> || {},
      sortOrder: dbResult.sort_order,
      isActive: dbResult.is_active,
      createdAt: dbResult.created_at,
      updatedAt: dbResult.updated_at
    };
  }

  /**
   * Get metrics for monitoring
   */
  public getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Clear cache for specific product
   */
  public async clearProductCache(productId: string): Promise<void> {
    const keys = [
      `product-${productId}`,
      `product-identifiers-${productId}`,
      `resolve-${productId}`
    ];

    for (const key of keys) {
      await this.clearCache(key);
    }

    if (this.options.enableLogging) {
      logger.info('Product cache cleared', undefined, { productId, keys });
    }
  }

  /**
   * Clear all inventory cache
   */
  public async clearAllCache(): Promise<void> {
    await this.clearCache(); // Clear all cache
    
    if (this.options.enableLogging) {
      logger.info('All inventory cache cleared');
    }
  }
}

export default InventorySingletonService;
