/**
 * Variant-Aware Products Service - UniversalSingleton Implementation
 * Handles product queries with variant relationships using the new materialized views
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';

export interface VariantAwareProduct {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  title: string;
  description: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  brand?: string;
  item_status: string;
  availability: string;
  has_variants: boolean;
  tenant_category_id?: string;
  created_at: Date;
  updated_at: Date;
  metadata?: any;
  
  // Featured product fields
  featured_type?: string;
  featured_priority?: number;
  featured_at?: Date;
  featured_expires_at?: Date;
  auto_unfeature?: boolean;
  is_featured_active?: boolean;
  days_until_expiration?: number;
  is_expired?: boolean;
  is_expiring_soon?: boolean;
  
  // Smart sale tagging
  is_on_sale?: boolean;
  auto_tagged_as_sale?: boolean;
  discount_percentage?: string;
  
  // Product type classification
  product_type?: string;
  
  // Variant relationships with full attributes
  parent_item_id?: string;
  variant_attributes?: Record<string, string>; // Full JSON attributes
  variant_name?: string;
  variant_sort_order?: number;
  variant_is_active?: boolean;
  variant_group?: Array<{
    id: string;
    sku: string;
    variant_name: string;
    price_cents: number;
    sale_price_cents?: number;
    stock: number;
    image_url?: string;
    attributes: Record<string, string>; // Full attributes for each variant
    sort_order: number;
    is_active: boolean;
    is_on_sale?: boolean;
    discount_percentage?: number;
  }>;
  parent_product?: any;
}

export interface ProductWithVariants extends VariantAwareProduct {
  variants?: VariantAwareProduct[];
  variant_count?: number;
  price_range?: {
    min_price: number;
    max_price: number;
    min_sale_price?: number;
    max_sale_price?: number;
  };
}

export interface ProductQueryOptions {
  tenant_id: string;
  page?: number;
  limit?: number;
  featured_type?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  on_sale?: boolean;
  has_variants?: boolean;
  product_type?: string;
  search?: string;
  sort_by?: 'name' | 'price' | 'created_at' | 'featured_priority' | 'stock';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedProducts {
  products: VariantAwareProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class VariantAwareProductsService extends BaseService {
  private static instance: VariantAwareProductsService;
  
  private constructor() {
    super();
  }

  static getInstance(): VariantAwareProductsService {
    if (!VariantAwareProductsService.instance) {
      VariantAwareProductsService.instance = new VariantAwareProductsService();
    }
    return VariantAwareProductsService.instance;
  }

  /**
   * Get variant-aware products with filtering and pagination
   */
  async getVariantAwareProducts(options: ProductQueryOptions): Promise<PaginatedProducts> {
    try {
      const {
        tenant_id,
        page = 1,
        limit = 50,
        featured_type,
        category_id,
        min_price,
        max_price,
        on_sale,
        has_variants,
        product_type,
        search,
        sort_by = 'name',
        sort_order = 'asc'
      } = options;

      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const whereConditions: string[] = [
        'tenant_id = $1',
        'item_status = $2',
        'stock > 0'
      ];

      const params: any[] = [tenant_id, 'active'];
      let paramIndex = 3;

      if (featured_type) {
        whereConditions.push(`featured_type = $${paramIndex}`);
        params.push(featured_type);
        paramIndex++;
      }

      if (category_id) {
        whereConditions.push(`tenant_category_id = $${paramIndex}`);
        params.push(category_id);
        paramIndex++;
      }

      if (min_price !== undefined) {
        whereConditions.push(`price_cents >= $${paramIndex}`);
        params.push(min_price);
        paramIndex++;
      }

      if (max_price !== undefined) {
        whereConditions.push(`price_cents <= $${paramIndex}`);
        params.push(max_price);
        paramIndex++;
      }

      if (on_sale !== undefined) {
        whereConditions.push(`is_on_sale = $${paramIndex}`);
        params.push(on_sale);
        paramIndex++;
      }

      if (has_variants !== undefined) {
        whereConditions.push(`has_variants = $${paramIndex}`);
        params.push(has_variants);
        paramIndex++;
      }

      if (product_type) {
        whereConditions.push(`product_type = $${paramIndex}`);
        params.push(product_type);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Build ORDER BY clause
      const validSortFields = {
        name: 'name',
        price: 'price_cents',
        created_at: 'created_at',
        featured_priority: 'featured_priority',
        stock: 'stock'
      };

      const sortField = validSortFields[sort_by] || 'name';
      const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const orderByClause = `ORDER BY ${sortField} ${sortDirection}`;

      // Build the main query
      const whereClause = whereConditions.join(' AND ');
      
      const query = `
        SELECT *
        FROM storefront_products_mv
        WHERE ${whereClause}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM storefront_products_mv
        WHERE ${whereClause}
      `;

      // Execute queries
      const [productsResult, countResult] = await Promise.all([
        this.query(query, params),
        this.query(countQuery, params.slice(0, -2))
      ]);

      const products = productsResult;
      const total = parseInt(countResult[0]?.total || '0');

      const totalPages = Math.ceil(total / limit);

      logger.info(`Retrieved ${products.length} variant-aware products for tenant ${tenant_id}`);

      return {
        products,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (error: unknown) {
      logger.error('Failed to get variant-aware products: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to retrieve variant-aware products: ${errorMessage}`);
    }
  }

  /**
   * Get a single variant-aware product by ID
   */
  async getVariantAwareProduct(productId: string, includeVariants: boolean = false): Promise<ProductWithVariants | null> {
    try {
      // Get main product
      const productQuery = `
        SELECT *
        FROM storefront_products_mv
        WHERE id = $1
      `;

      const products = await this.query(productQuery, [productId]);
      
      if (!products || products.length === 0) {
        return null;
      }

      const product = products[0];

      if (!includeVariants || !product.has_variants) {
        return product;
      }

      // Get variants if requested
      const variantsQuery = `
        SELECT *
        FROM storefront_variants_mv
        WHERE parent_item_id = $1
        ORDER BY variant_sort_order ASC, variant_name ASC
      `;

      const variants = await this.query(variantsQuery, [productId]);

      // Calculate price range
      let priceRange = null;
      if (variants && variants.length > 0) {
        const prices = variants.map((v: any) => v.price_cents).filter((p: any) => p != null);
        const salePrices = variants.map((v: any) => v.sale_price_cents).filter((p: any) => p != null);
        
        if (prices.length > 0) {
          priceRange = {
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            min_sale_price: salePrices.length > 0 ? Math.min(...salePrices) : undefined,
            max_sale_price: salePrices.length > 0 ? Math.max(...salePrices) : undefined,
          };
        }
      }

      return {
        ...product,
        variants,
        variant_count: variants?.length || 0,
        price_range: priceRange
      };
    } catch (error: unknown) {
      logger.error('Failed to get variant-aware product: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to retrieve variant-aware product ${productId}: ${errorMessage}`);
    }
  }

  /**
   * Get parent products with their variants
   */
  async getParentProductsWithVariants(tenantId: string, options: Partial<ProductQueryOptions> = {}): Promise<ProductWithVariants[]> {
    try {
      const { limit = 50, page = 1 } = options;
      const offset = (page - 1) * limit;

      const query = `
        SELECT 
          spmv.*,
          json_agg(
            json_build_object(
              'id', svmv.id,
              'sku', svmv.sku,
              'variant_name', svmv.variant_name,
              'price_cents', svmv.price_cents,
              'sale_price_cents', svmv.sale_price_cents,
              'stock', svmv.stock,
              'image_url', svmv.image_url,
              'variant_attributes', svmv.variant_attributes,
              'variant_sort_order', svmv.variant_sort_order,
              'variant_is_active', svmv.variant_is_active
            ) ORDER BY svmv.variant_sort_order, svmv.variant_name
          ) as variants
        FROM storefront_products_mv spmv
        LEFT JOIN storefront_variants_mv svmv ON spmv.id = svmv.parent_item_id
        WHERE spmv.tenant_id = $1 
          AND spmv.has_variants = true
          AND spmv.item_status = 'active'
        GROUP BY spmv.id
        ORDER BY spmv.name ASC
        LIMIT $2 OFFSET $3
      `;

      const results = await this.query(query, [tenantId, limit, offset]);

      // Process results to add variant counts and price ranges
      const processedResults = results.map(result => {
        const variants = result.variants || [];
        const activeVariants = variants.filter((v: any) => v.variant_is_active);
        
        let priceRange = null;
        if (activeVariants.length > 0) {
          const prices = activeVariants.map((v: any) => v.price_cents).filter((p: any) => p != null);
          const salePrices = activeVariants.map((v: any) => v.sale_price_cents).filter((p: any) => p != null);
          
          if (prices.length > 0) {
            priceRange = {
              min_price: Math.min(...prices),
              max_price: Math.max(...prices),
              min_sale_price: salePrices.length > 0 ? Math.min(...salePrices) : undefined,
              max_sale_price: salePrices.length > 0 ? Math.max(...salePrices) : undefined,
            };
          }
        }

        return {
          ...result,
          variants: activeVariants,
          variant_count: activeVariants.length,
          price_range: priceRange
        };
      });

      logger.info(`Retrieved ${processedResults.length} parent products with variants for tenant ${tenantId}`);
      return processedResults;
    } catch (error) {
      logger.error('Failed to get parent products with variants: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve parent products with variants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get individual variants (products that are variants)
   */
  async getIndividualVariants(tenantId: string, options: Partial<ProductQueryOptions> = {}): Promise<VariantAwareProduct[]> {
    try {
      const { limit = 50, page = 1, featured_type, on_sale } = options;
      const offset = (page - 1) * limit;

      const whereConditions = [
        'tenant_id = $1',
        'product_type = $2',
        'variant_is_active = true'
      ];

      const params: any[] = [tenantId, 'variant'];
      let paramIndex = 3;

      if (featured_type) {
        whereConditions.push(`featured_type = $${paramIndex}`);
        params.push(featured_type);
        paramIndex++;
      }

      if (on_sale !== undefined) {
        whereConditions.push(`is_on_sale = $${paramIndex}`);
        params.push(on_sale);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT 
          spmv.*,
          svmv.parent_item_id,
          svmv.variant_attributes,
          svmv.variant_name,
          svmv.variant_sort_order,
          svmv.variant_is_active,
          svmv.parent_product
        FROM storefront_products_mv spmv
        JOIN storefront_variants_mv svmv ON spmv.id = svmv.id
        WHERE ${whereClause}
        ORDER BY svmv.parent_item_id, svmv.variant_sort_order, spmv.name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const results = await this.query(query, params);

      logger.info(`Retrieved ${results.length} individual variants for tenant ${tenantId}`);
      return results;
    } catch (error) {
      logger.error('Failed to get individual variants: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve individual variants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get featured products with variant awareness
   */
  async getFeaturedVariantAwareProducts(tenantId: string, options: {
    featured_type?: string;
    limit?: number;
    include_variants?: boolean;
  } = {}): Promise<VariantAwareProduct[]> {
    try {
      const { featured_type, limit = 20, include_variants = false } = options;

      const whereConditions = [
        'tenant_id = $1',
        'is_featured_active = true',
        'stock > 0'
      ];

      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (featured_type) {
        whereConditions.push(`featured_type = $${paramIndex}`);
        params.push(featured_type);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      let query = `
        SELECT *
        FROM storefront_products_mv
        WHERE ${whereClause}
        ORDER BY featured_priority DESC, name ASC
        LIMIT $${paramIndex}
      `;

      params.push(limit);

      const results = await this.query(query, params);

      if (include_variants) {
        // Enrich with variant data for parent products
        const enrichedResults = await Promise.all(
          results.map(async (product) => {
            if (product.has_variants) {
              return this.getVariantAwareProduct(product.id, true);
            }
            return product;
          })
        );

        return enrichedResults.filter(Boolean);
      }

      logger.info(`Retrieved ${results.length} featured variant-aware products for tenant ${tenantId}`);
      return results;
    } catch (error) {
      logger.error('Failed to get featured variant-aware products: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve featured variant-aware products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get products on sale with variant awareness
   */
  async getSaleVariantAwareProducts(tenantId: string, options: {
    limit?: number;
    include_variants?: boolean;
    min_discount?: number;
  } = {}): Promise<VariantAwareProduct[]> {
    try {
      const { limit = 20, include_variants = false, min_discount } = options;

      const whereConditions = [
        'tenant_id = $1',
        'is_on_sale = true',
        'stock > 0'
      ];

      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (min_discount) {
        whereConditions.push(`CAST(discount_percentage AS NUMERIC) >= $${paramIndex}`);
        params.push(min_discount);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT *
        FROM storefront_products_mv
        WHERE ${whereClause}
        ORDER BY CAST(discount_percentage AS NUMERIC) DESC, name ASC
        LIMIT $${paramIndex}
      `;

      params.push(limit);

      const results = await this.query(query, params);

      if (include_variants) {
        // Enrich with variant data for parent products
        const enrichedResults = await Promise.all(
          results.map(async (product) => {
            if (product.has_variants) {
              return this.getVariantAwareProduct(product.id, true);
            }
            return product;
          })
        );

        return enrichedResults.filter(Boolean);
      }

      logger.info(`Retrieved ${results.length} sale variant-aware products for tenant ${tenantId}`);
      return results;
    } catch (error) {
      logger.error('Failed to get sale variant-aware products: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve sale variant-aware products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search products with variant awareness
   */
  async searchVariantAwareProducts(tenantId: string, query: string, options: {
    limit?: number;
    include_variants?: boolean;
  } = {}): Promise<VariantAwareProduct[]> {
    try {
      const { limit = 50, include_variants = false } = options;

      const searchQuery = `
        SELECT *
        FROM storefront_products_mv
        WHERE tenant_id = $1
          AND stock > 0
          AND (
            name ILIKE $2 
            OR description ILIKE $2 
            OR sku ILIKE $2
            OR brand ILIKE $2
          )
        ORDER BY 
          CASE 
            WHEN name ILIKE $2 THEN 1
            WHEN sku ILIKE $2 THEN 2
            WHEN brand ILIKE $2 THEN 3
            ELSE 4
          END,
          featured_priority DESC,
          name ASC
        LIMIT $3
      `;

      const results = await this.query(searchQuery, [tenantId, `%${query}%`, limit]);

      if (include_variants) {
        // Enrich with variant data for parent products
        const enrichedResults = await Promise.all(
          results.map(async (product) => {
            if (product.has_variants) {
              return this.getVariantAwareProduct(product.id, true);
            }
            return product;
          })
        );

        return enrichedResults.filter(Boolean);
      }

      logger.info(`Found ${results.length} products matching "${query}" for tenant ${tenantId}`);
      return results;
    } catch (error) {
      logger.error('Failed to search variant-aware products: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to search variant-aware products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get product statistics with variant awareness
   */
  async getVariantAwareProductStats(tenantId: string): Promise<{
    total_products: number;
    simple_products: number;
    parent_products: number;
    variant_products: number;
    products_on_sale: number;
    featured_products: number;
    average_discount: number;
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN product_type = 'simple' THEN 1 END) as simple_products,
          COUNT(CASE WHEN product_type = 'parent' THEN 1 END) as parent_products,
          COUNT(CASE WHEN has_variants = true THEN 1 END) as products_with_variants,
          COUNT(CASE WHEN is_on_sale = true THEN 1 END) as products_on_sale,
          COUNT(CASE WHEN featured_type IS NOT NULL THEN 1 END) as featured_products,
          AVG(CASE WHEN is_on_sale = true THEN CAST(discount_percentage AS NUMERIC) ELSE NULL END) as average_discount
        FROM storefront_products_mv
        WHERE tenant_id = $1
          AND item_status = 'active'
      `;

      const result = await this.query(statsQuery, [tenantId]);
      const stats = result[0] || {};

      // Get variant count from variants MV
      const variantCountQuery = `
        SELECT COUNT(*) as variant_count
        FROM storefront_variants_mv
        WHERE tenant_id = $1
          AND variant_is_active = true
      `;

      const variantResult = await this.query(variantCountQuery, [tenantId]);
      const variant_count = parseInt(variantResult[0]?.variant_count || '0');

      return {
        total_products: parseInt(stats.total_products || '0'),
        simple_products: parseInt(stats.simple_products || '0'),
        parent_products: parseInt(stats.parent_products || '0'),
        variant_products: variant_count,
        products_on_sale: parseInt(stats.products_on_sale || '0'),
        featured_products: parseInt(stats.featured_products || '0'),
        average_discount: parseFloat(stats.average_discount || '0')
      };
    } catch (error) {
      logger.error('Failed to get variant-aware product statistics: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve variant-aware product statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper method to execute raw SQL queries
   */
  private async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await this.prisma.$queryRawUnsafe(sql, ...params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      logger.error('Database query error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error, sql, params });
      throw error;
    }
  }
}
