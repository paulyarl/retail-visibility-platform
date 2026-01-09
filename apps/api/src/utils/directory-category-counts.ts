import { getDirectPool } from './db-pool';

export interface DirectoryCategoryCount {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryIcon?: string;
  categoryLevel?: number;
  totalStores: number;
  totalProducts: number;
  avgQualityScore?: number;
  featuredStores?: number;
  avgPriceDollars?: number;
  statesRepresented?: number;
  recentlyUpdatedProducts?: number;
  highVolumeStores?: number;
}

/**
 * Get directory-wide category statistics using the actual directory tables
 * Performance: <50ms (vs 100ms+ for direct queries)
 * 
 * @param options - Optional filtering options
 * @returns Array of directory categories with aggregated statistics
 */
export async function getDirectoryCategoryCounts(options?: {
  state?: string;
  minProducts?: number;
  featuredOnly?: boolean;
}): Promise<DirectoryCategoryCount[]> {
  try {
    const { minProducts = 1, featuredOnly = false } = options || {};
    
    // Use actual directory tables instead of non-existent materialized view
    const query = `
      SELECT 
        dc.slug as "categorySlug",
        dc.name as "categoryName",
        COALESCE(dc."googleCategoryId", '') as "categoryId",
        COUNT(DISTINCT dlc.listing_id) as "totalStores",
        0 as "totalProducts", -- Product counts need separate calculation
        0 as "avgQualityScore",
        0 as "featuredStores",
        0 as "avgPriceDollars",
        0 as "statesRepresented",
        0 as "recentlyUpdatedProducts",
        0 as "highVolumeStores"
      FROM directory_category dc
      LEFT JOIN directory_listing_categories dlc ON dc.id = dlc.category_id
      WHERE dc."isActive" = true
      GROUP BY dc.id, dc.slug, dc.name, dc."googleCategoryId"
      HAVING COUNT(DISTINCT dlc.listing_id) >= $1
      ORDER BY COUNT(DISTINCT dlc.listing_id) DESC, dc.name ASC
    `;
    
    const result = await getDirectPool().query(query, [minProducts]);
    
    console.log(`[Directory Category Counts] Retrieved ${result.rows.length} categories from directory tables`);
    return result.rows;
    
  } catch (error) {
    console.error('[Directory Category Counts] Error:', error);
    throw new Error('Failed to get directory category counts');
  }
}

/**
 * Get featured categories across the directory
 * Categories with at least 3 stores and high product counts
 */
export async function getFeaturedCategories(limit: number = 10): Promise<DirectoryCategoryCount[]> {
  return getDirectoryCategoryCounts({
    minProducts: 10, // Higher threshold for featured
    featuredOnly: false
  }).then(categories => categories.slice(0, limit));
}

/**
 * Get Platform Directory Category statistics
 * Counts stores by platform directory categories (International Foods, Electronics store, etc.)
 * Performance: <50ms
 * 
 * @returns Array of platform categories with store counts
 */
export async function getPlatformDirectoryCategoryCounts(): Promise<DirectoryCategoryCount[]> {
  try {
    // Query using actual directory tables
    const query = `
      SELECT 
        dc.slug as "categorySlug",
        dc.name as "categoryName",
        COALESCE(dc."googleCategoryId", '') as "categoryId",
        COUNT(DISTINCT dlc.listing_id) as "totalStores",
        0 as "totalProducts" -- Will be calculated separately if needed
      FROM directory_category dc
      LEFT JOIN directory_listing_categories dlc ON dc.id = dlc.category_id
      WHERE dc."isActive" = true
      GROUP BY dc.id, dc.slug, dc.name, dc."googleCategoryId"
      HAVING COUNT(DISTINCT dlc.listing_id) > 0
      ORDER BY COUNT(DISTINCT dlc.listing_id) DESC, dc.name ASC
    `;
    
    const result = await getDirectPool().query(query);
    
    console.log(`[Platform Directory Category Counts] Retrieved ${result.rows.length} platform categories`);
    return result.rows;
    
  } catch (error) {
    console.error('[Platform Directory Category Counts] Error:', error);
    throw new Error('Failed to get platform directory category counts');
  }
}

/**
 * Get category summary for a specific category
 * Provides detailed statistics for a single category
 */
export async function getCategorySummary(categoryId: string): Promise<DirectoryCategoryCount | null> {
  try {
    const query = `
      SELECT 
        dc.slug as "categorySlug",
        dc.name as "categoryName",
        COALESCE(dc."googleCategoryId", '') as "categoryId",
        COUNT(DISTINCT dlc.listing_id) as "totalStores",
        0 as "totalProducts",
        0 as "avgQualityScore",
        0 as "featuredStores",
        0 as "avgPriceDollars",
        0 as "statesRepresented",
        0 as "recentlyUpdatedProducts",
        0 as "highVolumeStores"
      FROM directory_category dc
      LEFT JOIN directory_listing_categories dlc ON dc.id = dlc.category_id
      WHERE dc.id = $1 AND dc."isActive" = true
      GROUP BY dc.id, dc.slug, dc.name, dc."googleCategoryId"
    `;
    
    const result = await getDirectPool().query(query, [categoryId]);
    return result.rows[0] || null;
    
  } catch (error) {
    console.error('[Category Summary] Error:', error);
    throw new Error('Failed to get category summary');
  }
}

/**
 * Get directory-wide statistics
 * Overall metrics for the entire directory
 */
export async function getDirectoryStats(): Promise<{
  totalStores: number;
  totalProducts: number;
  totalCategories: number;
  featuredStores: number;
  avgQualityScore: number;
  statesRepresented: number;
  recentlyUpdatedProducts: number;
}> {
  try {
    const query = `
      SELECT 
        COUNT(DISTINCT dlc.listing_id) as "totalStores",
        0 as "totalProducts", -- Need separate calculation
        COUNT(DISTINCT dc.id) as "totalCategories",
        0 as "featuredStores", -- Need separate calculation
        0 as "avgQualityScore",
        0 as "statesRepresented", -- Need separate calculation
        0 as "recentlyUpdatedProducts"
      FROM directory_category dc
      LEFT JOIN directory_listing_categories dlc ON dc.id = dlc.category_id
      WHERE dc."isActive" = true
    `;
    
    const result = await getDirectPool().query(query);
    const stats = result.rows[0];
    
    return {
      totalStores: parseInt(stats.totalStores || '0'),
      totalProducts: parseInt(stats.totalProducts || '0'),
      totalCategories: parseInt(stats.totalCategories || '0'),
      featuredStores: parseInt(stats.featuredStores || '0'),
      avgQualityScore: parseFloat(stats.avgQualityScore || '0'),
      statesRepresented: parseInt(stats.statesRepresented || '0'),
      recentlyUpdatedProducts: parseInt(stats.recentlyUpdatedProducts || '0'),
    };
    
  } catch (error) {
    console.error('[Directory Stats] Error:', error);
    throw new Error('Failed to get directory stats');
  }
}
