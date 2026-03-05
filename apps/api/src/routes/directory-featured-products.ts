/**
 * Directory Featured Products API Route
 * 
 * Aggregates featured products from multiple shops based on filters
 * Uses existing storefront endpoint for data retrieval
 * This is the proper backend implementation
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../prisma';

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
    
    // Use the existing working storefront endpoint
    const storefrontUrl = `http://localhost:4000/api/storefront/tid-m8ijkrnk/featured-products?limit=100`;
    
    const response = await axios.get(storefrontUrl, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data || !response.data.items) {
      return res.json({
        success: true,
        data: {
          totalCount: 0,
          buckets: {
            store_selection: [],
            new_arrival: [],
            seasonal: [],
            sale: [],
            featured: []
          },
          bucketCounts: {
            store_selection: 0,
            new_arrival: 0,
            seasonal: 0,
            sale: 0,
            featured: 0
          },
          shops: [],
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
    }
    
    const allFeaturedProducts = response.data.items;
    
    // Fetch featured_type_array from database using Prisma model
    const productIds = allFeaturedProducts.map((p: any) => p.id);
    const featuredTypesData = await prisma.mv_global_discovery.findMany({
      where: {
        inventory_item_id: { in: productIds }
      },
      select: {
        inventory_item_id: true,
        featured_type_array: true
      }
    });
    
    // Create a map of product id to featured_type_array
    const featuredTypesMap = new Map<string, string[]>();
    featuredTypesData.forEach((item: any) => {
      if (item.featured_type_array && Array.isArray(item.featured_type_array)) {
        featuredTypesMap.set(item.inventory_item_id, item.featured_type_array);
      }
    });
    
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
    
    let totalProducts = 0;
    const featuredShops = new Map<string, { id: string; name: string; slug: string; logo?: string; tier: string }>();
    const usedProductIds = new Set<string>(); // Track unique products
    
    // Process featured products
    for (const product of allFeaturedProducts) {
      // Skip if product already used
      if (usedProductIds.has(product.id)) {
        continue;
      }
      
      // Add shop info to the Map if not already present
      if (product.tenantId && product.tenantName && !featuredShops.has(product.tenantId)) {
        featuredShops.set(product.tenantId, {
          id: product.tenantId,
          name: product.tenantName,
          slug: product.tenantSlug || product.tenantId,
          logo: product.tenantLogoUrl,
          tier: 'professional' // Default tier for now
        });
      }
      
      // Map API fields to expected frontend fields
      const mappedProduct = {
        ...product,
        shopName: product.tenant_name || product.tenantName,
        shopSlug: product.tenant_slug || product.tenantSlug || product.tenantId,
        tenantName: product.tenant_name || product.tenantName,
        tenantLogo: product.tenant_logo_url || product.tenantLogoUrl,
        featuredTypes: featuredTypesMap.get(product.id) || (product.featuredType ? [product.featuredType] : [])
      };
      
      // Apply filters
      if (params.search && !matchesSearch(mappedProduct, params.search)) {
        continue;
      }
      
      if (params.category && mappedProduct.categoryName !== params.category) {
        continue;
      }
      
      if (params.location && mappedProduct.tenantCity !== params.location) {
        continue;
      }
      
      if (params.minRating && (!mappedProduct.averageRating || parseFloat(mappedProduct.averageRating) < parseFloat(params.minRating))) {
        continue;
      }
      
      if (params.minPrice && mappedProduct.priceCents && (mappedProduct.priceCents / 100) < parseFloat(params.minPrice)) {
        continue;
      }
      
      if (params.maxPrice && mappedProduct.priceCents && (mappedProduct.priceCents / 100) > parseFloat(params.maxPrice)) {
        continue;
      }
      
      if (params.inStock === 'true' && !mappedProduct.inStock) {
        continue;
      }
      
      // Determine bucket based on featured type (priority order)
      let placedInBucket = false;
      
      // Priority 1: Explicit featured types
      if (mappedProduct.featuredType === 'store_selection') {
        buckets.store_selection.push(mappedProduct);
        bucketCounts.store_selection++;
        totalProducts++;
        usedProductIds.add(product.id);
        placedInBucket = true;
      } else if (mappedProduct.featuredType === 'new_arrival') {
        buckets.new_arrival.push(mappedProduct);
        bucketCounts.new_arrival++;
        totalProducts++;
        usedProductIds.add(product.id);
        placedInBucket = true;
      } else if (mappedProduct.featuredType === 'seasonal') {
        buckets.seasonal.push(mappedProduct);
        bucketCounts.seasonal++;
        totalProducts++;
        usedProductIds.add(product.id);
        placedInBucket = true;
      } else if (mappedProduct.featuredType === 'sale') {
        buckets.sale.push(mappedProduct);
        bucketCounts.sale++;
        totalProducts++;
        usedProductIds.add(product.id);
        placedInBucket = true;
      }
      
      // Priority 2: Auto-featured (only if not already placed)
      if (!placedInBucket) {
        if (
          (mappedProduct.averageRating && parseFloat(mappedProduct.averageRating) >= 4.0) ||
          (params.trending === 'true' && isTrending(mappedProduct)) ||
          mappedProduct.featuredType === 'featured'
        ) {
          buckets.featured.push(mappedProduct);
          bucketCounts.featured++;
          totalProducts++;
          usedProductIds.add(product.id);
          placedInBucket = true;
        }
      }
    }
    
    // Sort products within each bucket
    for (const bucketType of Object.keys(buckets)) {
      buckets[bucketType] = sortProducts(buckets[bucketType], sortBy);
    }
    
    // Limit products per bucket
    for (const bucketType of Object.keys(buckets)) {
      buckets[bucketType] = applyTierLimits(buckets[bucketType], limit);
    }
    
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
