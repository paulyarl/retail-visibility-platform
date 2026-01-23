/**
 * Store Statistics Calculator
 * Calculates store-level statistics from storefront_category_counts materialized view
 */

export interface StoreStats {
  totalProducts: number;
  totalInStock: number;
  uniqueCategories: number;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    count: number;
    inStockProducts: number;
  }>;
  // Rating fields from MV
  ratingAvg?: number;
  ratingCount?: number;
  rating1Count?: number;
  rating2Count?: number;
  rating3Count?: number;
  rating4Count?: number;
  rating5Count?: number;
  verifiedPurchaseCount?: number;
  lastReviewAt?: string | null;
}

export interface CategoryStats {
  id: string;
  name: string;
  slug: string;
  count: number;
  inStockProducts: number;
  avgPriceCents?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
}

/**
 * Calculate store statistics from storefront_category_counts data
 */
export function calculateStoreStats(categoryData: CategoryStats[]): StoreStats {
  if (!categoryData || categoryData.length === 0) {
    return {
      totalProducts: 0,
      totalInStock: 0,
      uniqueCategories: 0,
      categories: []
    };
  }

  // Calculate totals
  const totalProducts = categoryData.reduce((sum, cat) => sum + (cat.count || 0), 0);
  const totalInStock = categoryData.reduce((sum, cat) => sum + (cat.inStockProducts || 0), 0);
  const uniqueCategories = categoryData.length;

  // Transform category data for EnhancedStoreCard
  const categories = categoryData.map(cat => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    count: cat.count,
    inStockProducts: cat.inStockProducts || 0
  }));

  return {
    totalProducts,
    totalInStock,
    uniqueCategories,
    categories
  };
}

/**
 * Fetch store statistics for multiple tenants in parallel
 */
export async function fetchMultipleStoreStats(tenantIds: string[]): Promise<Record<string, StoreStats>> {
  const results: Record<string, StoreStats> = {};
  
  // Check cache first for all tenants
  const uncachedTenants: string[] = [];
  const now = Date.now();
  
  tenantIds.forEach(tenantId => {
    const cached = statsCache.get(tenantId);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      results[tenantId] = cached.data;
    } else {
      uncachedTenants.push(tenantId);
    }
  });
  
  console.log(`Store Stats Batch: ${tenantIds.length - uncachedTenants.length} cache hits, ${uncachedTenants.length} API calls needed`);
  
  // Fetch uncached tenants in parallel
  if (uncachedTenants.length > 0) {
    const promises = uncachedTenants.map(async (tenantId) => {
      try {
        const stats = await fetchStoreStats(tenantId);
        return { tenantId, stats };
      } catch (error) {
        console.error(`Error fetching stats for ${tenantId}:`, error);
        return { 
          tenantId, 
          stats: {
            totalProducts: 0,
            totalInStock: 0,
            uniqueCategories: 0,
            categories: [],
            ratingAvg: 0,
            ratingCount: 0,
            rating1Count: 0,
            rating2Count: 0,
            rating3Count: 0,
            rating4Count: 0,
            rating5Count: 0,
            verifiedPurchaseCount: 0,
            lastReviewAt: null
          }
        };
      }
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ tenantId, stats }) => {
      results[tenantId] = stats;
    });
  }
  
  return results;
}
// Simple in-memory cache with 5-minute TTL
const statsCache = new Map<string, { data: StoreStats; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchStoreStats(tenantId: string): Promise<StoreStats> {
  // Check cache first
  const cached = statsCache.get(tenantId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log('Store Stats Cache HIT for', tenantId);
    return cached.data;
  }
  
  console.log('Store Stats Cache MISS for', tenantId);
  
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    // Add cache-busting timestamp to force fresh data
    const timestamp = Date.now();
    const response = await fetch(`${apiUrl}/api/storefront/${tenantId}/storefront/categories-stats?t=${timestamp}`, {
      cache: 'no-store', // Disable caching
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch store stats: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Use the pre-calculated storeStats from API, but transform categories for EnhancedStoreCard
    const categories = data.categories?.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count,
      inStockProducts: cat.inStockProducts || 0
    })) || [];
    
    const result = {
      totalProducts: data.storeStats?.totalProducts || 0,
      totalInStock: data.storeStats?.totalInStock || 0,
      uniqueCategories: data.storeStats?.uniqueCategories || 0,
      categories,
      // Rating fields from API
      ratingAvg: data.storeStats?.ratingAvg || 0,
      ratingCount: data.storeStats?.ratingCount || 0,
      rating1Count: data.storeStats?.rating1Count || 0,
      rating2Count: data.storeStats?.rating2Count || 0,
      rating3Count: data.storeStats?.rating3Count || 0,
      rating4Count: data.storeStats?.rating4Count || 0,
      rating5Count: data.storeStats?.rating5Count || 0,
      verifiedPurchaseCount: data.storeStats?.verifiedPurchaseCount || 0,
      lastReviewAt: data.storeStats?.lastReviewAt || null
    };
    
    // Cache the result
    statsCache.set(tenantId, { data: result, timestamp: now });
    
    return result;
  } catch (error) {
    console.error('Error fetching store stats:', error);
    return {
      totalProducts: 0,
      totalInStock: 0,
      uniqueCategories: 0,
      categories: [],
      // Rating fields (default to 0 on error)
      ratingAvg: 0,
      ratingCount: 0,
      rating1Count: 0,
      rating2Count: 0,
      rating3Count: 0,
      rating4Count: 0,
      rating5Count: 0,
      verifiedPurchaseCount: 0,
      lastReviewAt: null
    };
  }
}
