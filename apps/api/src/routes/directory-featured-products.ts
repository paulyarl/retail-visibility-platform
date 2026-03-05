/**
 * Directory Featured Products API Route
 * 
 * Aggregates featured products from multiple shops based on filters
 * Queries mv_global_discovery directly for featured products
 */

import { Router, Request, Response } from 'express';

const router = Router();

interface QueryParams {
  search?: string;
  category?: string;
  location?: string;
  minRating?: string;
  minPrice?: string;
  maxPrice?: string;
  trending?: string;
  inStock?: string;
  sortBy?: string;
  limit?: string;
}

// Tier-based slot limits
const tierLimits = {
  premium: 100,
  plus: 50,
  basic: 20
};

function matchesSearch(product: any, search: string): boolean {
  const searchLower = search.toLowerCase();
  return (
    product.name?.toLowerCase().includes(searchLower) ||
    product.description?.toLowerCase().includes(searchLower) ||
    product.brand?.toLowerCase().includes(searchLower) ||
    product.shopName?.toLowerCase().includes(searchLower)
  );
}

function isTrending(product: any): boolean {
  const createdAt = new Date(product.createdAt);
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceCreation <= 30 && product.averageRating && parseFloat(product.averageRating) >= 4.0;
}

function sortProducts(products: any[], sortBy: string): any[] {
  return products.sort((a, b) => {
    switch (sortBy) {
      case 'trending':
        return (parseFloat(b.trendingScore) || 0) - (parseFloat(a.trendingScore) || 0);
      case 'rating':
        return (parseFloat(b.averageRating) || 0) - (parseFloat(a.averageRating) || 0);
      case 'price_low':
        return (a.priceCents || 0) - (b.priceCents || 0);
      case 'price_high':
        return (b.priceCents || 0) - (a.priceCents || 0);
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      default:
        return 0;
    }
  });
}

function applyTierLimits(products: any[], limit: number): any[] {
  return products.slice(0, limit);
}

/**
 * GET /api/directory/featured-products
 * Get featured products from all shops with filtering and tier-based visibility
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const params = req.query as QueryParams;
    const limit = parseInt(params.limit || '20');
    const sortBy = params.sortBy || 'trending';
    
    // Query featured products directly from mv_global_discovery
    const query = `
      SELECT 
        inventory_item_id,
        tenant_id,
        sku,
        product_name,
        product_title,
        product_description,
        current_price_cents,
        sale_price_cents,
        stock,
        image_url,
        brand,
        item_status,
        availability,
        product_category,
        product_category_name_lower,
        tenant_name,
        tenant_slug,
        tenant_logo_url,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_is_active,
        marketing_description,
        condition,
        gtin,
        mpn,
        currency,
        product_metadata
      FROM mv_global_discovery
      WHERE featured_is_active = true
        AND item_status = 'active'
        AND visibility = 'public'
      ORDER BY featured_priority DESC, featured_at DESC
      LIMIT $1
    `;
    
    const { getDirectPool } = await import('../utils/db-pool');
    const result = await getDirectPool().query(query, [limit * 5]); // Get more to account for filtering
    
    // Initialize buckets
    const buckets: Record<string, any[]> = {
      store_selection: [],
      new_arrival: [],
      seasonal: [],
      sale: [],
      featured: []
    };
    
    const bucketCounts: Record<string, number> = {
      store_selection: 0,
      new_arrival: 0,
      seasonal: 0,
      sale: 0,
      featured: 0
    };
    
    const featuredShops = new Map<string, { id: string; name: string; slug: string; logo?: string; tier: string }>();
    const usedProductIds = new Set<string>();
    
    // Process products
    for (const product of result.rows) {
      if (usedProductIds.has(product.inventory_item_id)) {
        continue;
      }
      
      // Add shop info
      if (product.tenant_id && product.tenant_name && !featuredShops.has(product.tenant_id)) {
        featuredShops.set(product.tenant_id, {
          id: product.tenant_id,
          name: product.tenant_name,
          slug: product.tenant_slug || product.tenant_id,
          logo: product.tenant_logo_url,
          tier: 'professional'
        });
      }
      
      const mappedProduct = {
        id: product.inventory_item_id,
        tenantId: product.tenant_id,
        sku: product.sku,
        name: product.product_name,
        title: product.product_title,
        description: product.product_description,
        priceCents: product.current_price_cents,
        salePriceCents: product.sale_price_cents,
        stock: product.stock,
        imageUrl: product.image_url,
        brand: product.brand,
        itemStatus: product.item_status,
        availability: product.availability,
        categoryName: product.product_category_name_lower,
        categorySlug: product.product_category,
        tenantName: product.tenant_name,
        tenantSlug: product.tenant_slug,
        tenantLogoUrl: product.tenant_logo_url,
        featuredType: product.featured_type,
        featuredTypes: product.featured_type_array || (product.featured_type ? [product.featured_type] : []),
        marketingDescription: product.marketing_description,
        condition: product.condition,
        gtin: product.gtin,
        mpn: product.mpn,
        currency: product.currency,
        metadata: product.product_metadata
      };
      
      // Apply filters
      if (params.search) {
        const searchLower = params.search.toLowerCase();
        const matches = 
          mappedProduct.name?.toLowerCase().includes(searchLower) ||
          mappedProduct.description?.toLowerCase().includes(searchLower) ||
          mappedProduct.brand?.toLowerCase().includes(searchLower) ||
          mappedProduct.tenantName?.toLowerCase().includes(searchLower);
        if (!matches) continue;
      }
      
      if (params.category && mappedProduct.categoryName !== params.category) {
        continue;
      }
      
      if (params.inStock === 'true' && (!mappedProduct.stock || mappedProduct.stock === 0)) {
        continue;
      }
      
      // Place in bucket based on featured type
      let placedInBucket = false;
      const featuredType = mappedProduct.featuredType;
      
      if (featuredType === 'store_selection' || mappedProduct.featuredTypes?.includes('store_selection')) {
        buckets.store_selection.push(mappedProduct);
        bucketCounts.store_selection++;
        placedInBucket = true;
      } else if (featuredType === 'new_arrival' || mappedProduct.featuredTypes?.includes('new_arrival')) {
        buckets.new_arrival.push(mappedProduct);
        bucketCounts.new_arrival++;
        placedInBucket = true;
      } else if (featuredType === 'seasonal' || mappedProduct.featuredTypes?.includes('seasonal')) {
        buckets.seasonal.push(mappedProduct);
        bucketCounts.seasonal++;
        placedInBucket = true;
      } else if (featuredType === 'sale' || mappedProduct.featuredTypes?.includes('sale')) {
        buckets.sale.push(mappedProduct);
        bucketCounts.sale++;
        placedInBucket = true;
      }
      
      if (!placedInBucket) {
        buckets.featured.push(mappedProduct);
        bucketCounts.featured++;
      }
      
      usedProductIds.add(product.inventory_item_id);
    }
    
    // Sort products within each bucket
    for (const bucketType of Object.keys(buckets)) {
      buckets[bucketType] = sortProducts(buckets[bucketType], sortBy);
      buckets[bucketType] = applyTierLimits(buckets[bucketType], limit);
    }
    
    const totalProducts = Object.values(bucketCounts).reduce((a, b) => a + b, 0);
    
    return res.json({
      success: true,
      data: {
        totalCount: totalProducts,
        buckets,
        bucketCounts,
        shops: Array.from(featuredShops.values()),
        filters: {
          search: params.search,
          category: params.category,
          location: params.location,
          minRating: params.minRating,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          trending: params.trending === 'true',
          inStock: params.inStock === 'true',
          sortBy
        }
      }
    });
    
  } catch (error) {
    console.error('Featured products API error:', error);
    return res.status(500).json(
      { success: false, error: 'Failed to fetch featured products' }
    );
  }
});

export default router;
