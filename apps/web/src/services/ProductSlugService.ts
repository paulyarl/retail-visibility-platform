/**
 * Product Slug Service
 * 
 * Manages product slug generation, validation, and registration
 */

import { FlexibleApiSingleton, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface ProductSlugData {
  brand: string;
  name: string;
  category_path?: string[];
  gtin_upc?: string;
}

export interface ProductSlugRegistry {
  id: string;
  product_slug: string;
  universal_sku?: string;
  slug_hash: string;
  tenant_id?: string;
  original_sku?: string;
  created_at: string;
  updated_at: string;
}

export interface SlugValidationResult {
  isUnique: boolean;
  suggestions?: string[];
  existingProduct?: {
    id: string;
    name: string;
    brand?: string;
  };
}

/**
 * ProductSlugService
 * 
 * Provides slug generation and validation for products
 */
class ProductSlugService extends FlexibleApiSingleton {
  private static instance: ProductSlugService;

  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;
  protected defaultContext = AppContext.PRODUCT;
  protected defaultIsolation = CacheIsolation.GLOBAL;

  protected constructor() {
    super('product-slug-service', {
      ttl: 60 * 60 * 1000 // 1 hour for slug data
    });
  }

  public static getInstance(): ProductSlugService {
    if (!ProductSlugService.instance) {
      ProductSlugService.instance = new ProductSlugService();
    }
    return ProductSlugService.instance;
  }

  /**
   * Generate a slug from product name and brand
   */
  generateSlug(name: string, brand?: string): string {
    const parts: string[] = [];
    
    if (brand) {
      parts.push(brand.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    }
    
    parts.push(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    
    return parts
      .join('-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate a universal SKU
   */
  generateUniversalSKU(category: string, brand: string, identifier: string): string {
    const catCode = category.substring(0, 3).toUpperCase();
    const brandCode = brand.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
    const uniqueCode = identifier.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
    
    return `VS-${catCode}-${brandCode}-${uniqueCode}`;
  }

  /**
   * Validate slug uniqueness
   */
  async validateSlugUniqueness(
    slug: string,
    organizationId?: string,
    excludeProductId?: string
  ): Promise<SlugValidationResult> {
    try {
      const params = new URLSearchParams({
        slug,
        ...(organizationId && { organizationId }),
        ...(excludeProductId && { excludeProductId })
      });

      const result = await this.makePublicRequest<SlugValidationResult>(
        `/api/catalog/slugs/validate?${params.toString()}`,
        { method: 'GET' },
        `slug-validate:${slug}:${organizationId || 'global'}`,
        this.cacheTTL
      );

      return result.data || { isUnique: false };
    } catch (error) {
      clientLogger.error('[ProductSlugService] Error validating slug:', { detail: error });
      return { isUnique: false };
    }
  }

  /**
   * Check if a slug exists
   */
  async slugExists(slug: string): Promise<boolean> {
    const result = await this.validateSlugUniqueness(slug);
    return !result.isUnique;
  }

  /**
   * Register a new slug
   */
  async registerSlug(
    productSlug: string,
    universalSku: string,
    tenantId?: string,
    originalSku?: string
  ): Promise<ProductSlugRegistry | null> {
    try {
      const result = await this.makeSystemRequest<ProductSlugRegistry>(
        '/api/catalog/slugs/register',
        {
          method: 'POST',
          body: JSON.stringify({
            product_slug: productSlug,
            universal_sku: universalSku,
            tenant_id: tenantId,
            original_sku: originalSku
          })
        }
      );

      return result.data || null;
    } catch (error) {
      clientLogger.error('[ProductSlugService] Error registering slug:', { detail: error });
      return null;
    }
  }

  /**
   * Get slug registry entry
   */
  async getSlugRegistry(slug: string): Promise<ProductSlugRegistry | null> {
    try {
      const result = await this.makePublicRequest<ProductSlugRegistry>(
        `/api/catalog/slugs/${encodeURIComponent(slug)}`,
        { method: 'GET' },
        `slug-registry:${slug}`,
        this.cacheTTL
      );

      return result.data || null;
    } catch (error) {
      clientLogger.error('[ProductSlugService] Error fetching slug registry:', { detail: error });
      return null;
    }
  }

  /**
   * Get product by UPC from slug registry
   */
  async getProductByUPC(upc: string): Promise<ProductSlugRegistry | null> {
    try {
      const result = await this.makePublicRequest<ProductSlugRegistry>(
        `/api/catalog/slugs/upc/${encodeURIComponent(upc)}`,
        { method: 'GET' },
        `slug-upc:${upc}`,
        this.cacheTTL
      );

      return result.data || null;
    } catch (error) {
      clientLogger.error('[ProductSlugService] Error fetching product by UPC:', { detail: error });
      return null;
    }
  }
}

// Export singleton instance
export const productSlugService = ProductSlugService.getInstance();
export default productSlugService;
