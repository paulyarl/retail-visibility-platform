"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FeaturedProductsSingleton } from '../../providers/data/FeaturedProductsSingleton';
import { storefrontService } from '../../services/StorefrontService';

// Featured product interface
interface FeaturedProduct {
  id: string;
  inventory_item_id?: string; // Add this for compatibility
  name: string;
  price: number;
  imageUrl?: string;
  shopName: string;
  shopSlug: string;
  category?: string;
  featured: boolean;
  createdAt: string;
}

// Featured bucket interface
interface FeaturedBucket {
  id: string;
  name: string;
  description: string;
  products: FeaturedProduct[];
  totalCount: number;
  lastUpdated: string;
}

/**
 * Hook for fetching and managing featured products buckets
 * Loads actual products for each bucket type (New Arrivals, Sale & Deals, etc.)
 */
export function useShopsFeaturedBuckets() {
  const [buckets, setBuckets] = useState<FeaturedBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch featured products buckets
   */
  const fetchBuckets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useShopsFeaturedBuckets] Loading featured products for buckets...');

      // Get featured products data using FeaturedProductsSingleton
      const featuredProductsSingleton = FeaturedProductsSingleton.getInstance();
      // TODO: Get tenantId from context or URL parameter
      const tenantId = null; // No fallback - require explicit tenant
      if (!tenantId) {
        console.error('[useShopsFeaturedBuckets] No tenantId provided');
        return;
      }
      const featuredProductsResult = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 100);
      console.log('[useShopsFeaturedBuckets] Featured products loaded:', featuredProductsResult?.buckets?.length || 0, 'buckets');

      // Get all products using StorefrontService
      const storefrontServiceInstance = storefrontService;
      // TODO: Get tenant ID from context or URL parameter
      const productsTenantId = tenantId; // Use same tenantId
      const allProductsResult = await storefrontServiceInstance.getFeaturedProducts(productsTenantId, { limit: 100 });
      console.log('[useShopsFeaturedBuckets] All products loaded:', allProductsResult?.items?.length || 0);

      // Extract data from results
      const featuredProducts = featuredProductsResult?.buckets?.flatMap(bucket => bucket.products || []) || [];
      const allProducts = allProductsResult?.items || [];

      // Helper function to deduplicate within a specific bucket only
      // This allows the same product to appear in different buckets if it has multiple featured-types
      const deduplicateWithinBucket = (products: any[], bucketPrefix: string) => {
        const seenInBucket = new Map<string, any>();
        
        return products
          .filter(product => {
            const key = product.id;
            if (seenInBucket.has(key)) {
              return false; // Skip if already seen in THIS bucket
            }
            seenInBucket.set(key, product);
            return true;
          })
          .map((product, index) => ({
            ...product,
            id: `${product.id}-${bucketPrefix}-${index}`, // Unique key with bucket prefix
            inventory_item_id: product.id,
            shopName: product.tenantId || 'Unknown Shop',
            shopSlug: product.tenantId || 'unknown',
            createdAt: (product as any).featuredAt || (product as any).createdAt || new Date().toISOString()
          }));
      };

      // Create buckets with actual products
      const buckets: FeaturedBucket[] = [];

      // New Arrivals bucket - sort by some criteria since createdAt doesn't exist
      const newProducts = allProducts
        .sort((a, b) => b.priceCents - a.priceCents) // Sort by price as fallback
        .slice(0, 8);
      if (newProducts.length > 0) {
        const uniqueNewProducts = deduplicateWithinBucket(newProducts, 'new');
        buckets.push({
          id: 'new',
          name: 'New Arrivals',
          description: 'Fresh products just added to our marketplace',
          products: uniqueNewProducts.map(product => ({
            id: product.id,
            inventory_item_id: product.inventory_item_id,
            name: product.name,
            price: product.priceCents ? product.priceCents / 100 : 0,
            imageUrl: product.imageUrl,
            shopName: product.shopName,
            shopSlug: product.shopSlug,
            category: product.categoryName,
            featured: false,
            createdAt: product.createdAt
          })),
          totalCount: uniqueNewProducts.length,
          lastUpdated: new Date().toISOString()
        });
      }

      // Sale & Deals bucket - use products with sale prices
      const saleProducts = allProducts
        .filter(product => product.salePriceCents && product.salePriceCents < product.priceCents)
        .slice(0, 8);
      if (saleProducts.length > 0) {
        const uniqueSaleProducts = deduplicateWithinBucket(saleProducts, 'sale');
        buckets.push({
          id: 'sale',
          name: 'Sale & Deals',
          description: 'Limited-time offers and special promotions',
          products: uniqueSaleProducts.map(product => ({
            id: product.id,
            inventory_item_id: product.inventory_item_id,
            name: product.name,
            price: product.priceCents ? product.priceCents / 100 : 0,
            imageUrl: product.imageUrl,
            shopName: product.shopName,
            shopSlug: product.shopSlug,
            category: product.categoryName,
            featured: false,
            createdAt: product.createdAt
          })),
          totalCount: uniqueSaleProducts.length,
          lastUpdated: new Date().toISOString()
        });
      }

      // Staff Picks bucket - use featured products marked as staff picks
      const staffPickProducts = featuredProducts
        .filter(fp => fp.featuredType === 'staff_pick')
        .slice(0, 8);
      if (staffPickProducts.length > 0) {
        const uniqueStaffProducts = deduplicateWithinBucket(staffPickProducts, 'staff');
        buckets.push({
          id: 'staff',
          name: 'Staff Picks',
          description: 'Hand-picked favorites from our team',
          products: uniqueStaffProducts.map(product => ({
            id: product.id,
            inventory_item_id: product.inventory_item_id,
            name: product.name,
            price: product.priceCents ? product.priceCents / 100 : 0,
            imageUrl: product.imageUrl,
            shopName: product.shopName,
            shopSlug: product.shopSlug,
            category: product.categoryName || 'featured',
            featured: true,
            createdAt: product.createdAt
          })),
          totalCount: uniqueStaffProducts.length,
          lastUpdated: new Date().toISOString()
        });
      }

      // Seasonal Picks bucket - use featured products marked as seasonal
      const seasonalProducts = featuredProducts
        .filter(fp => fp.featuredType === 'seasonal')
        .slice(0, 8);
      if (seasonalProducts.length > 0) {
        const uniqueSeasonalProducts = deduplicateWithinBucket(seasonalProducts, 'seasonal');
        buckets.push({
          id: 'seasonal',
          name: 'Seasonal Picks',
          description: 'Perfect products for the current season',
          products: uniqueSeasonalProducts.map(product => ({
            id: product.id,
            inventory_item_id: product.inventory_item_id,
            name: product.name,
            price: product.priceCents ? product.priceCents / 100 : 0,
            imageUrl: product.imageUrl,
            shopName: product.shopName,
            shopSlug: product.shopSlug,
            category: product.categoryName || 'seasonal',
            featured: true,
            createdAt: product.createdAt
          })),
          totalCount: uniqueSeasonalProducts.length,
          lastUpdated: new Date().toISOString()
        });
      }

      // Discover Something New bucket - random selection
      const randomProducts = allProducts
        .sort(() => Math.random() - 0.5)
        .slice(0, 8);
      if (randomProducts.length > 0) {
        const uniqueRandomProducts = deduplicateWithinBucket(randomProducts, 'random');
        buckets.push({
          id: 'random',
          name: 'Discover Something New',
          description: 'Randomly selected gems from our curated collection',
          products: uniqueRandomProducts.map(product => ({
            id: product.id,
            inventory_item_id: product.inventory_item_id,
            name: product.name,
            price: product.priceCents ? product.priceCents / 100 : 0,
            imageUrl: product.imageUrl,
            shopName: product.shopName,
            shopSlug: product.shopSlug,
            category: product.categoryName,
            featured: false,
            createdAt: product.createdAt
          })),
          totalCount: uniqueRandomProducts.length,
          lastUpdated: new Date().toISOString()
        });
      }

      // Store Selections bucket - use featured products marked as store selections
      const storeSelectionProducts = featuredProducts
        .filter(fp => fp.featuredType === 'store_selection')
        .slice(0, 8);
      if (storeSelectionProducts.length > 0) {
        const uniqueStoreSelectionProducts = deduplicateWithinBucket(storeSelectionProducts, 'selection');
        buckets.push({
          id: 'selection',
          name: 'Store Selections',
          description: 'Curated collections from individual shops',
          products: uniqueStoreSelectionProducts.map(product => ({
            id: product.id,
            inventory_item_id: product.inventory_item_id,
            name: product.name,
            price: product.priceCents ? product.priceCents / 100 : 0,
            imageUrl: product.imageUrl,
            shopName: product.shopName,
            shopSlug: product.shopSlug,
            category: product.categoryName || 'store_selection',
            featured: true,
            createdAt: product.createdAt
          })),
          totalCount: uniqueStoreSelectionProducts.length,
          lastUpdated: new Date().toISOString()
        });
      }

//      console.log('[useShopsFeaturedBuckets] Buckets created:', buckets.length, buckets.map(b => `${b.id}: ${b.products.length} products`));

      setBuckets(buckets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch featured buckets');
      console.error('[useShopsFeaturedBuckets] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh buckets
   */
  const refresh = useCallback(() => {
    setBuckets([]);
    fetchBuckets();
  }, [fetchBuckets]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  // Return buckets in the expected format for the page
  const bucketMap = useMemo(() => {
    const map = buckets.reduce((acc, bucket) => {
      acc[bucket.id] = bucket.products;
      return acc;
    }, {} as Record<string, FeaturedProduct[]>);

    // Debug: Log the bucketMap structure
    /* console.log('[useShopsFeaturedBuckets] bucketMap created:', {
      bucketMap: map,
      bucketsLength: buckets.length,
      featuredShopsProducts: map['featured-shops'],
      featuredShopsLength: map['featured-shops']?.length || 0
    }); */

    return map;
  }, [buckets]);

  return {
    // Array format for new components
    buckets,
    loading,
    error,
    refresh,
    getBucketById: (bucketId: string) => buckets.find(b => b.id === bucketId) || null,
    getProductsFromBucket: (bucketId: string) => bucketMap[bucketId] || [],
    fetchBuckets,
    // Legacy format for existing page
    trending: bucketMap['featured-shops'] || [],
    new: bucketMap['new'] || [],
    sale: bucketMap['sale'] || [],
    seasonal: bucketMap['seasonal'] || [],
    staff: bucketMap['staff'] || [],
    selection: bucketMap['selection'] || [],
    random: bucketMap['random'] || []
  };
}

/**
 * Hook for managing a single featured bucket
 */
export function useFeaturedBucket(bucketId: string = 'featured-shops') {
  const { buckets, loading, error, getBucketById, getProductsFromBucket } = useShopsFeaturedBuckets();
  
  const bucket = getBucketById(bucketId);
  const products = getProductsFromBucket(bucketId);

  return {
    bucket,
    products,
    loading,
    error,
    hasData: !!bucket && bucket.products.length > 0,
    isEmpty: !!bucket && bucket.products.length === 0
  };
}

export type { FeaturedProduct, FeaturedBucket };

// Backward compatibility exports (deprecated)
export const ProductCache = {
  getInstance: () => ({
    clearCache: () => console.warn('ProductCache.clearCache is deprecated'),
    getCacheStats: () => ({ size: 0, hitRate: 0, pendingRequests: 0 })
  })
};

export const ProductAPISingleton = {
  getInstance: () => ({
    fetchProduct: () => console.warn('ProductAPISingleton.fetchProduct is deprecated'),
    makePublicApiRequest: () => console.warn('ProductAPISingleton.makePublicApiRequest is deprecated')
  })
};
