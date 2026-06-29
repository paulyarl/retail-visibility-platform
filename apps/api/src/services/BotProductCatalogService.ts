/**
 * Bot Product Catalog Service
 *
 * Queries mv_storefront_discovery to give the bot awareness of a tenant's
 * product catalog. Provides keyword search and category filtering optimized
 * for bot context injection into GPT prompts.
 *
 * Uses the existing materialized view — no new MV needed.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface BotProductSummary {
  inventoryItemId: string;
  productName: string;
  productSlug: string | null;
  description: string | null;
  marketingDescription: string | null;
  brand: string | null;
  sku: string;
  price: number;
  currentPriceCents: number;
  isOnSale: boolean;
  discountPercentage: number;
  stock: number;
  stockStatus: string;
  productCategory: string | null;
  productType: string;
  currency: string;
  image_url: string | null;
  features: string[];
  tags: string[];
  hasVariants: boolean;
  badges: string[];
}

export interface BotProductSearchResult {
  products: BotProductSummary[];
  total: number;
}

export type ProductBadge =
  | 'featured'
  | 'new_arrival'
  | 'staff_pick'
  | 'seasonal'
  | 'sale'
  | 'clearance'
  | 'store_selection'
  | 'trending'
  | 'recommended'
  | 'bestseller'
  | 'random_featured';

class BotProductCatalogService {
  private static instance: BotProductCatalogService;

  private constructor() {}

  static getInstance(): BotProductCatalogService {
    if (!BotProductCatalogService.instance) {
      BotProductCatalogService.instance = new BotProductCatalogService();
    }
    return BotProductCatalogService.instance;
  }

  /**
   * Search a tenant's product catalog by keyword.
   * Queries mv_storefront_discovery for fast, pre-computed results.
   * Supports featured-badge filters (e.g., sale, new, clearance, seasonal).
   */
  async searchProducts(
    tenantId: string,
    query: string,
    options?: {
      limit?: number;
      badge?: ProductBadge;
      inStockOnly?: boolean;
      productTypes?: string[];
    }
  ): Promise<BotProductSearchResult> {
    const limit = Math.min(options?.limit || 5, 20);
    const searchPattern = `%${query.toLowerCase()}%`;
    const badgeArray = options?.badge ? JSON.stringify([options.badge]) : null;
    const inStockOnly = options?.inStockOnly ?? true;
    const productTypes = options?.productTypes && options.productTypes.length > 0
      ? options.productTypes
      : null;

    const results = await prisma.$queryRaw<any[]>`
      SELECT
        inventory_item_id,
        product_name,
        product_slug,
        product_description,
        marketing_description,
        brand,
        sku,
        price,
        current_price_cents,
        is_on_sale,
        discount_percentage,
        inventory_quantity,
        stock_status,
        product_category,
        product_type,
        currency,
        image_url,
        features,
        tags,
        is_variant,
        featured_type_array
      FROM mv_storefront_discovery
      WHERE tenant_id = ${tenantId}
        AND (
          LOWER(product_name) LIKE ${searchPattern}
          OR LOWER(product_description) LIKE ${searchPattern}
          OR LOWER(marketing_description) LIKE ${searchPattern}
          OR LOWER(sku) LIKE ${searchPattern}
          OR LOWER(brand) LIKE ${searchPattern}
          OR EXISTS (
            SELECT 1 FROM unnest(tags) AS tag WHERE LOWER(tag) LIKE ${searchPattern}
          )
          OR EXISTS (
            SELECT 1 FROM unnest(features) AS feat WHERE LOWER(feat) LIKE ${searchPattern}
          )
        )
        AND (${badgeArray}::jsonb IS NULL OR featured_type_array @> ${badgeArray}::jsonb)
        AND (${inStockOnly} = false OR stock_status IN ('in_stock', 'low_stock'))
        AND (${productTypes} IS NULL OR product_type = ANY(${productTypes}))
      ORDER BY
        CASE
          WHEN LOWER(product_name) LIKE ${searchPattern} THEN 1
          WHEN LOWER(marketing_description) LIKE ${searchPattern} THEN 2
          WHEN LOWER(product_description) LIKE ${searchPattern} THEN 3
          ELSE 4
        END,
        trending_score DESC
      LIMIT ${limit}
    `;

    const products: BotProductSummary[] = results.map((r: any) => this.toSummary(r));
    return { products, total: products.length };
  }

  private toSummary(r: any): BotProductSummary {
    return {
      inventoryItemId: r.inventory_item_id,
      productName: r.product_name,
      productSlug: r.product_slug,
      description: r.product_description,
      marketingDescription: r.marketing_description,
      brand: r.brand,
      sku: r.sku,
      price: parseFloat(r.price?.toString() || '0'),
      currentPriceCents: r.current_price_cents,
      isOnSale: r.is_on_sale,
      discountPercentage: r.discount_percentage,
      stock: r.inventory_quantity,
      stockStatus: r.stock_status,
      productCategory: r.product_category,
      productType: r.product_type,
      currency: r.currency || 'USD',
      image_url: r.image_url,
      features: r.features || [],
      tags: r.tags || [],
      hasVariants: r.is_variant,
      badges: r.featured_type_array || [],
    };
  }

  /**
   * Get a specific product by ID for context injection
   * (e.g., when customer is viewing a product page).
   */
  async getProductById(tenantId: string, productId: string): Promise<BotProductSummary | null> {
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        inventory_item_id,
        product_name,
        product_slug,
        product_description,
        marketing_description,
        brand,
        sku,
        price,
        current_price_cents,
        is_on_sale,
        discount_percentage,
        inventory_quantity,
        stock_status,
        product_category,
        product_type,
        currency,
        image_url,
        features,
        tags,
        is_variant,
        featured_type_array
      FROM mv_storefront_discovery
      WHERE tenant_id = ${tenantId}
        AND inventory_item_id = ${productId}
      LIMIT 1
    `;

    if (results.length === 0) return null;
    return this.toSummary(results[0]);
  }

  /**
   * Get featured products for a tenant (for "what's popular" type questions).
   */
  async getFeaturedProducts(tenantId: string, limit: number = 5): Promise<BotProductSummary[]> {
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        inventory_item_id,
        product_name,
        product_slug,
        product_description,
        marketing_description,
        brand,
        sku,
        price,
        current_price_cents,
        is_on_sale,
        discount_percentage,
        inventory_quantity,
        stock_status,
        product_category,
        product_type,
        currency,
        image_url,
        features,
        tags,
        is_variant,
        featured_type_array
      FROM mv_storefront_discovery
      WHERE tenant_id = ${tenantId}
        AND is_actively_featured = true
      ORDER BY bucket_priority ASC, trending_score DESC
      LIMIT ${limit}
    `;

    return results.map((r: any) => this.toSummary(r));
  }

  /**
   * Get products by featured badge (sale, new_arrival, clearance, seasonal, etc.).
   */
  async getProductsByBadge(
    tenantId: string,
    badge: ProductBadge,
    limit: number = 5,
    inStockOnly: boolean = true
  ): Promise<BotProductSummary[]> {
    const badgeArray = JSON.stringify([badge]);

    const results = await prisma.$queryRaw<any[]>`
      SELECT
        inventory_item_id,
        product_name,
        product_slug,
        product_description,
        marketing_description,
        brand,
        sku,
        price,
        current_price_cents,
        is_on_sale,
        discount_percentage,
        inventory_quantity,
        stock_status,
        product_category,
        product_type,
        currency,
        image_url,
        features,
        tags,
        is_variant,
        featured_type_array
      FROM mv_storefront_discovery
      WHERE tenant_id = ${tenantId}
        AND featured_type_array @> ${badgeArray}::jsonb
        AND (${inStockOnly} = false OR stock_status IN ('in_stock', 'low_stock'))
      ORDER BY bucket_priority ASC, trending_score DESC
      LIMIT ${limit}
    `;

    return results.map((r: any) => this.toSummary(r));
  }

  /**
   * Get products on sale for a tenant.
   */
  async getSaleProducts(tenantId: string, limit: number = 5): Promise<BotProductSummary[]> {
    return this.getProductsByBadge(tenantId, 'sale', limit);
  }

  /**
   * Get new arrivals for a tenant.
   */
  async getNewArrivals(tenantId: string, limit: number = 5): Promise<BotProductSummary[]> {
    return this.getProductsByBadge(tenantId, 'new_arrival', limit);
  }

  /**
   * Get clearance products for a tenant.
   */
  async getClearanceProducts(tenantId: string, limit: number = 5): Promise<BotProductSummary[]> {
    return this.getProductsByBadge(tenantId, 'clearance', limit);
  }

  /**
   * Get seasonal products for a tenant.
   */
  async getSeasonalProducts(tenantId: string, limit: number = 5): Promise<BotProductSummary[]> {
    return this.getProductsByBadge(tenantId, 'seasonal', limit);
  }

  /**
   * List all product categories for a tenant (for "what do you sell" questions).
   */
  async listCategories(tenantId: string): Promise<{ name: string; productCount: number }[]> {
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        product_category,
        COUNT(*) as product_count
      FROM mv_storefront_discovery
      WHERE tenant_id = ${tenantId}
        AND product_category IS NOT NULL
      GROUP BY product_category
      ORDER BY product_count DESC
    `;

    return results.map((r: any) => ({
      name: r.product_category,
      productCount: parseInt(r.product_count),
    }));
  }

  /**
   * Detect badge intent from a natural language query.
   * Maps phrases like "what's on sale?", "show me new arrivals", "any clearance items?"
   * to the corresponding ProductBadge type.
   */
  detectBadgeIntent(query: string): ProductBadge | null {
    const q = query.toLowerCase().trim();

    const intentMap: { patterns: string[]; badge: ProductBadge }[] = [
      { patterns: ['sale', 'on sale', 'discount', 'deal', 'deals', 'markdown', 'clearance sale'], badge: 'sale' },
      { patterns: ['new arrival', 'new arrivals', 'new product', 'new items', 'just in', 'newly added', 'new stock'], badge: 'new_arrival' },
      { patterns: ['clearance', 'closeout', 'final sale', 'while supplies last', 'liquidation'], badge: 'clearance' },
      { patterns: ['seasonal', 'holiday', 'christmas', 'thanksgiving', 'halloween', 'easter', 'summer', 'winter', 'spring', 'fall'], badge: 'seasonal' },
      { patterns: ['staff pick', 'staff picks', 'staff favorite', 'recommended by staff', 'our pick', 'our picks'], badge: 'staff_pick' },
      { patterns: ['trending', 'popular right now', 'hot right now', 'gaining popularity', 'buzz', 'viral'], badge: 'trending' },
      { patterns: ['bestseller', 'best seller', 'best-selling', 'top seller', 'top selling', 'most sold', 'most popular'], badge: 'bestseller' },
      { patterns: ['featured', 'spotlight', 'highlighted', 'showcase'], badge: 'featured' },
      { patterns: ['store selection', 'store pick', 'curated', 'hand-picked', 'hand picked', 'our selection'], badge: 'store_selection' },
      { patterns: ['recommended', 'recommendation', 'for you', 'suggested', 'you might like'], badge: 'recommended' },
    ];

    for (const entry of intentMap) {
      for (const pattern of entry.patterns) {
        if (q.includes(pattern)) {
          return entry.badge;
        }
      }
    }

    return null;
  }

  /**
   * Handle a natural language badge query.
   * Detects badge intent and returns matching products.
   * If no badge intent is detected, returns null.
   */
  async handleBadgeQuery(
    tenantId: string,
    query: string,
    limit: number = 5
  ): Promise<{ badge: ProductBadge; products: BotProductSummary[] } | null> {
    const badge = this.detectBadgeIntent(query);
    if (!badge) return null;

    const products = await this.getProductsByBadge(tenantId, badge, limit);
    return { badge, products };
  }

  /**
   * Format product summaries into a context string for GPT prompt injection.
   */
  formatProductContext(products: BotProductSummary[]): string {
    if (products.length === 0) return '';

    const lines = products.map((p, i) => {
      const badgeNote = p.badges.length > 0 ? ` (${p.badges.join(', ')})` : '';
      const parts = [
        `${i + 1}. ${p.productName}${badgeNote}`,
        `   Price: ${p.currency} ${p.price.toFixed(2)}${p.isOnSale ? ` (ON SALE — ${p.discountPercentage}% off)` : ''}`,
        `   Brand: ${p.brand || 'N/A'}`,
        `   Category: ${p.productCategory || 'Uncategorized'}`,
        `   Stock: ${p.stockStatus} (${p.stock} units)`,
        p.description ? `   Description: ${p.description.slice(0, 200)}` : null,
        p.features.length > 0 ? `   Features: ${p.features.slice(0, 5).join(', ')}` : null,
        p.productSlug ? `   URL: /p/${p.productSlug}` : null,
      ].filter(Boolean);
      return parts.join('\n');
    });

    return '\n\nAvailable products from the catalog:\n' + lines.join('\n\n');
  }
}

export default BotProductCatalogService;
