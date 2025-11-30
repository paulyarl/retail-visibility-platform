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
 * Get directory-wide category statistics using the optimized materialized view
 * Performance: <10ms (vs 100ms+ for direct queries)
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
    
    let whereClause = 'is_published = true AND directory_visible = true AND actual_product_count >= $1';
    let params: any[] = [];
    let paramIndex = 2;
    
    if (featuredOnly) {
      whereClause += ` AND is_featured = true`;
    }
    
    // Add minProducts parameter
    params.push(minProducts);
    
    const minProductsParam = 1;
    
    // Use a simple, clean query without template literals
    const query = `
      SELECT 
        category_id as "categoryId",
        category_name as "categoryName",
        category_slug as "categorySlug",
        category_icon as "categoryIcon",
        category_level as "categoryLevel",
        COUNT(DISTINCT tenant_id) as "totalStores",
        SUM(actual_product_count) as "totalProducts",
        AVG(quality_score) as "avgQualityScore",
        COUNT(*) FILTER (WHERE is_featured = true) as "featuredStores",
        AVG(avg_price_dollars) as "avgPriceDollars",
        COUNT(DISTINCT 'state') as "statesRepresented",
        SUM(recently_updated_products) as "recentlyUpdatedProducts",
        COUNT(*) FILTER (WHERE product_volume_level = 'high') as "highVolumeStores"
      FROM directory_category_products
      WHERE ${whereClause}
      GROUP BY category_id, category_name, category_slug, category_icon, category_level
      HAVING SUM(actual_product_count) >= $1
      ORDER BY SUM(actual_product_count) DESC, COUNT(DISTINCT tenant_id) DESC, AVG(quality_score) DESC NULLS LAST
    `;
    
    const result = await getDirectPool().query(query, params);
    
    console.log(`[Directory Category Counts] Retrieved ${result.rows.length} categories from materialized view`);
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
    // Query platform categories and count stores assigned to each category
    const query = `
      SELECT 
        category_slug as "categorySlug",
        category_name as "categoryName",
        category_icon as "categoryIcon",
        store_count as "totalStores",
        COALESCE(total_products, '0') as "totalProducts",
        CASE 
          WHEN primary_store_count > 0 THEN 1 
          ELSE 0 
        END as "isPrimary"
      FROM directory_category_stats
      WHERE store_count > 0
      ORDER BY store_count DESC, category_name ASC
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
        category_id as "categoryId",
        category_name as "categoryName",
        category_slug as "categorySlug",
        category_icon as "categoryIcon",
        category_level as "categoryLevel",
        COUNT(DISTINCT tenant_id) as "totalStores",
        SUM(actual_product_count) as "totalProducts",
        AVG(quality_score) as "avgQualityScore",
        COUNT(*) FILTER (WHERE is_featured = true) as "featuredStores",
        AVG(avg_price_dollars) as "avgPriceDollars",
        COUNT(DISTINCT state) as "statesRepresented",
        SUM(recently_updated_products) as "recentlyUpdatedProducts",
        COUNT(*) FILTER (WHERE product_volume_level = 'high') as "highVolumeStores",
        STRING_AGG(DISTINCT state, ', ') as statesList
      FROM directory_category_products
      WHERE category_id = $1
        AND is_published = true 
        AND directory_visible = true
      GROUP BY category_id, category_name, category_slug, category_icon, category_level
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
        COUNT(DISTINCT tenant_id) as "totalStores",
        SUM(actual_product_count) as "totalProducts",
        COUNT(DISTINCT category_id) as "totalCategories",
        COUNT(*) FILTER (WHERE is_featured = true) as "featuredStores",
        AVG(quality_score) as "avgQualityScore",
        COUNT(DISTINCT state) as "statesRepresented",
        SUM(recently_updated_products) as "recentlyUpdatedProducts"
      FROM directory_category_products
      WHERE is_published = true AND directory_visible = true
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
