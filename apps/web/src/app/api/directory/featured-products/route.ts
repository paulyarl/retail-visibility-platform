/**
 * Featured Products API Endpoint
 * 
 * Aggregates featured products from multiple shops based on filters
 * Supports tier-based visibility and various filtering criteria
 */

import { NextRequest, NextResponse } from 'next/server';
import { directorySingletonService } from '@/services/DirectorySingletonService';
import { shopsService } from '@/services/ShopsService';
import { FEATURED_TYPES } from '@/types/product-display';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params: QueryParams = Object.fromEntries(searchParams.entries());
    
    const limit = parseInt(params.limit || '20');
    const sortBy = params.sortBy || 'trending';
    
    // Get all public shops
    const shops = await directorySingletonService.getPublicShops();
    
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
    
    // Fetch featured products from each shop
    for (const shop of shops) {
      try {
        // Get featured products for this shop
        const shopFeaturedProducts = await directorySingletonService.getFeaturedProducts(shop.tenantId, 50);
        
        // Get shop info for tier and metadata
        const shopInfo = await shopsService.getShopByIdentifier(shop.tenantId);
        
        if (shopInfo) {
          featuredShops.set(shop.tenantId, {
            id: shop.tenantId,
            name: shop.name,
            slug: shop.slug || shop.tenantId,
            logo: shop.logo_url,
            tier: (shopInfo as any)?.tier || 'basic' // Cast to any since tier might not be in type
          });
        }
        
        // Process each product
        for (const product of shopFeaturedProducts) {
          // Add shop info to product
          const enrichedProduct = {
            ...product,
            shopName: shop.name,
            shopSlug: shop.slug || shop.tenantId,
            shopLocation: shop.city || 'Unknown',
            shopTier: (shopInfo as any)?.tier || 'basic',
            tenantId: shop.tenantId
          };
          
          // Apply filters
          if (params.search && !matchesSearch(enrichedProduct, params.search)) {
            continue;
          }
          
          if (params.category && enrichedProduct.categoryName !== params.category) {
            continue;
          }
          
          if (params.location && enrichedProduct.shopLocation !== params.location) {
            continue;
          }
          
          if (params.minRating && (!enrichedProduct.ratingAvg || parseFloat(enrichedProduct.ratingAvg) < parseFloat(params.minRating))) {
            continue;
          }
          
          if (params.minPrice && enrichedProduct.priceCents && (enrichedProduct.priceCents / 100) < parseFloat(params.minPrice)) {
            continue;
          }
          
          if (params.maxPrice && enrichedProduct.priceCents && (enrichedProduct.priceCents / 100) > parseFloat(params.maxPrice)) {
            continue;
          }
          
          if (params.inStock === 'true' && enrichedProduct.stock <= 0) {
            continue;
          }
          
          // Determine bucket based on featured types
          const featuredTypes = enrichedProduct.featuredTypes || [];
          
          if (featuredTypes.includes('store_selection') || enrichedProduct.featuredType === 'store_selection') {
            buckets.store_selection.push(enrichedProduct);
            bucketCounts.store_selection++;
            totalProducts++;
          }
          
          if (featuredTypes.includes('new_arrival') || enrichedProduct.featuredType === 'new_arrival') {
            buckets.new_arrival.push(enrichedProduct);
            bucketCounts.new_arrival++;
            totalProducts++;
          }
          
          if (featuredTypes.includes('seasonal') || enrichedProduct.featuredType === 'seasonal') {
            buckets.seasonal.push(enrichedProduct);
            bucketCounts.seasonal++;
            totalProducts++;
          }
          
          if (featuredTypes.includes('sale') || enrichedProduct.featuredType === 'sale') {
            buckets.sale.push(enrichedProduct);
            bucketCounts.sale++;
            totalProducts++;
          }
          
          // General featured bucket for high-rated or trending products
          if (
            (enrichedProduct.ratingAvg && parseFloat(enrichedProduct.ratingAvg) >= 4.0) ||
            (params.trending === 'true' && isTrending(enrichedProduct)) ||
            featuredTypes.includes('featured')
          ) {
            buckets.featured.push(enrichedProduct);
            bucketCounts.featured++;
            totalProducts++;
          }
        }
      } catch (error) {
        console.error(`Failed to fetch products for shop ${shop.tenantId}:`, error);
        continue;
      }
    }
    
    // Sort products within each bucket
    for (const bucketType of Object.keys(buckets)) {
      buckets[bucketType] = sortProducts(buckets[bucketType], sortBy);
    }
    
    // Limit products per bucket
    for (const bucketType of Object.keys(buckets)) {
      buckets[bucketType] = buckets[bucketType].slice(0, limit);
    }
    
    // Apply tier-based slot allocation (higher tiers get more visibility)
    const tierLimits: Record<string, number> = {
      premium: 100,    // No limit for premium
      plus: 50,        // 50 slots per bucket
      basic: 20        // 20 slots per bucket
    };
    
    // Apply tier limits
    for (const bucketType of Object.keys(buckets)) {
      buckets[bucketType] = applyTierLimits(buckets[bucketType], tierLimits);
    }
    
    return NextResponse.json({
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
    return NextResponse.json(
      { success: false, error: 'Failed to fetch featured products' },
      { status: 500 }
    );
  }
}

function matchesSearch(product: any, query: string): boolean {
  const searchLower = query.toLowerCase();
  return (
    product.name?.toLowerCase().includes(searchLower) ||
    product.description?.toLowerCase().includes(searchLower) ||
    product.brand?.toLowerCase().includes(searchLower) ||
    product.shopName?.toLowerCase().includes(searchLower)
  );
}

function isTrending(product: any): boolean {
  // Simple trending logic - could be enhanced with actual analytics
  const createdAt = new Date(product.createdAt);
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Products created in the last 30 days with good ratings are trending
  return daysSinceCreation <= 30 && product.ratingAvg && parseFloat(product.ratingAvg) >= 4.0;
}

function sortProducts(products: any[], sortBy: string): any[] {
  return products.sort((a, b) => {
    switch (sortBy) {
      case 'trending':
        // Trending score based on rating and recency
        const aScore = calculateTrendingScore(a);
        const bScore = calculateTrendingScore(b);
        return bScore - aScore;
        
      case 'rating':
        const aRating = parseFloat(a.ratingAvg || '0');
        const bRating = parseFloat(b.ratingAvg || '0');
        return bRating - aRating;
        
      case 'newest':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        
      case 'price_low':
        const aPrice = a.priceCents ? a.priceCents / 100 : 0;
        const bPrice = b.priceCents ? b.priceCents / 100 : 0;
        return aPrice - bPrice;
        
      case 'price_high':
        const aPriceHigh = a.priceCents ? a.priceCents / 100 : 0;
        const bPriceHigh = b.priceCents ? b.priceCents / 100 : 0;
        return bPriceHigh - aPriceHigh;
        
      default:
        return 0;
    }
  });
}

function calculateTrendingScore(product: any): number {
  let score = 0;
  
  // Rating contributes 50% to score
  const rating = parseFloat(product.ratingAvg || '0');
  score += rating * 50;
  
  // Recency contributes 30% to score
  const createdAt = new Date(product.createdAt);
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 30 - daysSinceCreation) / 30; // Decay over 30 days
  score += recencyScore * 30;
  
  // Stock availability contributes 20% to score
  if (product.stock > 0) {
    score += 20;
  }
  
  return score;
}

function applyTierLimits(products: any[], tierLimits: Record<string, number>): any[] {
  // Group products by tier
  const tierGroups: Record<string, any[]> = {};
  
  for (const product of products) {
    const tier = product.shopTier || 'basic';
    if (!tierGroups[tier]) {
      tierGroups[tier] = [];
    }
    tierGroups[tier].push(product);
  }
  
  // Apply limits per tier
  const limitedProducts: any[] = [];
  
  // Premium first (no limit)
  if (tierGroups.premium) {
    limitedProducts.push(...tierGroups.premium);
  }
  
  // Plus tier
  if (tierGroups.plus) {
    limitedProducts.push(...tierGroups.plus.slice(0, tierLimits.plus));
  }
  
  // Basic tier
  if (tierGroups.basic) {
    limitedProducts.push(...tierGroups.basic.slice(0, tierLimits.basic));
  }
  
  return limitedProducts;
}
