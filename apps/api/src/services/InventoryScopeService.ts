/**
 * Inventory Scope Service - Tenant-Scoped Data Access
 * 
 * Provides scoped data access for inventory items with:
 * - Tenant-isolated queries
 * - Flexible includes (variants, categories, analytics)
 * - Advanced filtering and pagination
 * - Performance-optimized queries
 * 
 * Ensures data isolation between tenants while providing
 * flexible access patterns for different use cases.
 */

import { Pool, PoolClient } from 'pg';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

// Query Options Interface
export interface ScopedQueryOptions {
  includeVariants?: boolean;
  includeCategories?: boolean;
  includeAnalytics?: boolean;
  includeMetadata?: boolean;
  limit?: number;
  offset?: number;
  filters?: {
    category?: string;
    status?: string;
    search?: string;
    priceRange?: { min: number; max: number };
    stockRange?: { min: number; max: number };
    dateRange?: { start: Date; end: Date };
    hasVariants?: boolean;
  };
  sort?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
}

// Scoped Product Result Interface
export interface ScopedProductResult {
  products: any[];
  totalCount: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  filters: any;
  sort: any;
}

// Scoped Variant Result Interface
export interface ScopedVariantResult {
  variants: any[];
  totalCount: number;
  productId: string;
}

// Scoped Analytics Interface
export interface ScopedAnalytics {
  totalOrders: number;
  totalSold: number;
  totalRevenue: number;
  averagePrice: number;
  uniqueCustomers: number;
  conversionRate: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

// Date Range Interface
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Inventory Scope Service
 * 
 * Provides tenant-scoped data access with performance optimization
 * and flexible query options
 */
export class InventoryScopeService {
  private pool: Pool;

  constructor() {
    this.pool = getDirectPool();
  }

  /**
   * Get scoped products with flexible options
   */
  public async getScopedProducts(tenantId: string, options: ScopedQueryOptions = {}): Promise<ScopedProductResult> {
    const {
      includeVariants = false,
      includeCategories = false,
      includeAnalytics = false,
      includeMetadata = false,
      limit = 50,
      offset = 0,
      filters = {},
      sort = { field: 'created_at', order: 'DESC' }
    } = options;

    // Validate tenant access
    if (!tenantId) {
      throw new Error('Tenant ID is required for scoped queries');
    }

    // Build main query
    let query = `
      SELECT 
        i.*,
        ${includeVariants ? this.getVariantSubquery() : 'NULL as variants'},
        ${includeCategories ? this.getCategorySubquery() : 'NULL as category'},
        ${includeAnalytics ? this.getAnalyticsSubquery() : 'NULL as analytics'},
        ${includeMetadata ? 'i.metadata' : 'NULL as metadata'}
      FROM inventory_items i
      WHERE i.tenant_id = $1
      AND i.item_status != 'trashed'
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Apply filters
    const filterQuery = this.buildFilterClause(filters, paramIndex);
    query += filterQuery.clause;
    params.push(...filterQuery.params);
    paramIndex += filterQuery.params.length;

    // Apply sorting
    const sortField = this.validateSortField(sort.field);
    query += ` ORDER BY ${sortField} ${sort.order}`;

    // Apply pagination
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    return {
      products: result.rows,
      totalCount: await this.getScopedCount(tenantId, filters),
      hasMore: result.rows.length === limit,
      limit,
      offset,
      filters,
      sort
    };
  }

  /**
   * Get scoped variants for a product
   */
  public async getScopedVariants(productId: string, tenantId: string): Promise<ScopedVariantResult> {
    // Validate tenant access
    if (!tenantId) {
      throw new Error('Tenant ID is required for scoped queries');
    }

    const query = `
      SELECT 
        v.*,
        i.name as product_name,
        i.sku as product_sku
      FROM product_variants v
      JOIN inventory_items i ON v.product_id = i.id
      WHERE v.product_id = $1
      AND i.tenant_id = $2
      AND v.is_active = true
      ORDER BY v.sort_order ASC
    `;

    const result = await this.pool.query(query, [productId, tenantId]);

    return {
      variants: result.rows,
      totalCount: result.rows.length,
      productId
    };
  }

  /**
   * Get scoped analytics for a product
   */
  public async getScopedAnalytics(productId: string, tenantId: string, dateRange?: DateRange): Promise<ScopedAnalytics> {
    // Validate tenant access
    if (!tenantId) {
      throw new Error('Tenant ID is required for scoped queries');
    }

    const query = `
      SELECT 
        COUNT(DISTINCT oi.id) as total_orders,
        SUM(oi.quantity) as total_sold,
        SUM(oi.price_cents * oi.quantity) as total_revenue,
        AVG(oi.price_cents) as average_price,
        COUNT(DISTINCT o.customer_id) as unique_customers,
        COUNT(DISTINCT CASE WHEN o.created_at >= COALESCE($3, NOW() - INTERVAL '30 days') THEN o.id END) * 100.0 / 
        COUNT(DISTINCT o.id) as conversion_rate
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = $1
      AND o.tenant_id = $2
      AND o.status = 'completed'
      ${dateRange ? `AND o.created_at BETWEEN $3 AND $4` : ''}
    `;

    const params = dateRange 
      ? [productId, tenantId, dateRange.start, dateRange.end]
      : [productId, tenantId];

    const result = await this.pool.query(query, params);

    return {
      ...result.rows[0],
      dateRange: dateRange || { start: null, end: null }
    };
  }

  /**
   * Get scoped count with filters
   */
  private async getScopedCount(tenantId: string, filters: any = {}): Promise<number> {
    let query = `
      SELECT COUNT(*) as count
      FROM inventory_items i
      WHERE i.tenant_id = $1
      AND i.item_status != 'trashed'
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Apply same filters as main query
    const filterQuery = this.buildFilterClause(filters, paramIndex);
    query += filterQuery.clause;
    params.push(...filterQuery.params);

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Build filter clause for queries
   */
  private buildFilterClause(filters: any, startParamIndex: number): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startParamIndex;

    if (filters.category) {
      conditions.push(`AND i.category_id = $${paramIndex++}`);
      params.push(filters.category);
    }

    if (filters.status) {
      conditions.push(`AND i.item_status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.search) {
      conditions.push(`AND (i.name ILIKE $${paramIndex++} OR i.sku ILIKE $${paramIndex++})`);
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.priceRange) {
      conditions.push(`AND i.price_cents BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(filters.priceRange.min, filters.priceRange.max);
    }

    if (filters.stockRange) {
      conditions.push(`AND i.stock BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(filters.stockRange.min, filters.stockRange.max);
    }

    if (filters.dateRange) {
      conditions.push(`AND i.created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(filters.dateRange.start, filters.dateRange.end);
    }

    if (filters.hasVariants !== undefined) {
      conditions.push(`AND i.has_variants = $${paramIndex++}`);
      params.push(filters.hasVariants);
    }

    return {
      clause: conditions.length > 0 ? conditions.join(' ') : '',
      params
    };
  }

  /**
   * Validate sort field to prevent SQL injection
   */
  private validateSortField(field: string): string {
    const allowedFields = [
      'name', 'sku', 'price_cents', 'stock', 'created_at', 'updated_at',
      'item_status', 'category_id', 'view_count', 'order_count'
    ];

    if (!allowedFields.includes(field)) {
      logger.warn('Invalid sort field provided, using default', undefined, { field });
      return 'created_at';
    }

    return field;
  }

  /**
   * Get variant subquery for including variants
   */
  private getVariantSubquery(): string {
    return `
      (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', v.id,
            'sku', v.sku,
            'variantName', v.variant_name,
            'priceCents', v.price_cents,
            'salePriceCents', v.sale_price_cents,
            'stock', v.stock,
            'imageUrl', v.image_url,
            'attributes', v.attributes,
            'sortOrder', v.sort_order,
            'isActive', v.is_active
          )
          ORDER BY v.sort_order ASC
        )
        FROM product_variants v
        WHERE v.product_id = i.id
        AND v.is_active = true
      ) as variants
    `;
  }

  /**
   * Get category subquery for including category information
   */
  private getCategorySubquery(): string {
    return `
      (
        SELECT JSON_BUILD_OBJECT(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'description', c.description
        )
        FROM item_categories c
        WHERE c.id = i.category_id
      ) as category
    `;
  }

  /**
   * Get analytics subquery for including analytics
   */
  private getAnalyticsSubquery(): string {
    return `
      (
        SELECT JSON_BUILD_OBJECT(
          'totalOrders', COALESCE(orders.total_orders, 0),
          'totalSold', COALESCE(orders.total_sold, 0),
          'totalRevenue', COALESCE(orders.total_revenue, 0),
          'averagePrice', COALESCE(orders.average_price, 0),
          'uniqueCustomers', COALESCE(orders.unique_customers, 0)
        )
        FROM (
          SELECT 
            COUNT(DISTINCT oi.id) as total_orders,
            SUM(oi.quantity) as total_sold,
            SUM(oi.price_cents * oi.quantity) as total_revenue,
            AVG(oi.price_cents) as average_price,
            COUNT(DISTINCT o.customer_id) as unique_customers
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = i.id
          AND o.status = 'completed'
        ) orders
      ) as analytics
    `;
  }

  /**
   * Get tenant inventory summary
   */
  public async getTenantInventorySummary(tenantId: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN item_status = 'active' THEN 1 END) as active_products,
        COUNT(CASE WHEN item_status = 'draft' THEN 1 END) as draft_products,
        COUNT(CASE WHEN item_status = 'archived' THEN 1 END) as archived_products,
        COUNT(CASE WHEN has_variants = true THEN 1 END) as products_with_variants,
        SUM(stock) as total_stock,
        SUM(price_cents) as total_value,
        AVG(price_cents) as average_price,
        COUNT(CASE WHEN stock <= 5 THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock_items
      FROM inventory_items
      WHERE tenant_id = $1
      AND item_status != 'trashed'
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows[0];
  }

  /**
   * Health check for the service
   */
  public async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      await this.pool.query('SELECT 1');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Inventory scope service health check failed:', undefined, { error: errorMessage });
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default InventoryScopeService;
