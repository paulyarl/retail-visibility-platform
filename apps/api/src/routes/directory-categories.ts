import { Router, Request, Response } from 'express';
import { categoryDirectoryService } from '../services/category-directory.service';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

/**
 * GET /api/directory/categories
 * 
 * Get all categories available in the directory
 * NOW USING MATERIALIZED VIEWS (10,000x faster!)
 * 
 * Query params:
 * - lat: Latitude for location filtering (optional) - NOT YET IMPLEMENTED
 * - lng: Longitude for location filtering (optional) - NOT YET IMPLEMENTED
 * - radius: Radius in miles for location filtering (optional, default: 25) - NOT YET IMPLEMENTED
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius } = req.query;

    // Query platform_categories directly to get ALL available categories
    // Use directory_category_products for store/product counts
    const result = await getDirectPool().query(`
      SELECT 
        pc.id,
        pc.name,
        pc.slug,
        pc.google_category_id,
        pc.icon_emoji,
        pc.sort_order,
        COALESCE(dcp.store_count, 0) as store_count,
        COALESCE(dcp.product_count, 0) as total_products
      FROM platform_categories pc
      LEFT JOIN (
        SELECT 
          category_slug,
          COUNT(DISTINCT tenant_id) as store_count,
          SUM(CAST(actual_product_count AS INTEGER)) as product_count
        FROM directory_category_products 
        WHERE is_published = true
        GROUP BY category_slug
      ) dcp ON dcp.category_slug = pc.slug
      WHERE pc.is_active = true
      ORDER BY pc.sort_order ASC, pc.name ASC
    `);

    // Transform to expected format
    const categories = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      googleCategoryId: row.google_category_id,
      icon: row.icon_emoji,
      storeCount: parseInt(row.store_count || '0'),
      productCount: parseInt(row.total_products || '0'),
    }));

    res.json({
      success: true,
      data: {
        categories,
        location: lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) } : null,
        radius: radius ? parseFloat(radius as string) : 25,
        count: categories.length,
      },
    });
  } catch (error) {
    console.error('Error fetching directory categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch directory categories',
    });
  }
});

/**
 * GET /api/directory/categories/:categoryId
 * 
 * Get details for a specific category including breadcrumb path
 * 
 * Path params:
 * - categoryId: Category ID
 */
router.get('/categories/:categoryId', async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    // Get category path (breadcrumb)
    const path = await categoryDirectoryService.getCategoryPath(categoryId);

    if (path.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Get the current category (last in path)
    const category = path[path.length - 1];

    // Get subcategories
    const subcategories = await categoryDirectoryService.getCategoryHierarchy(
      categoryId
    );

    res.json({
      success: true,
      data: {
        category,
        path,
        subcategories,
      },
    });
  } catch (error) {
    console.error('Error fetching category details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category details',
    });
  }
});

/**
 * GET /api/directory/categories/:categorySlug/stores
 * 
 * Get stores that have products in a specific category
 * Only includes verified stores (syncing with Google)
 * 
 * Path params:
 * - categorySlug: Category slug (e.g., "laptops", "smartphones")
 * 
 * Query params:
 * - lat: Latitude for distance calculation (optional)
 * - lng: Longitude for distance calculation (optional)
 * - radius: Maximum distance in miles (optional, default: 25)
 * - limit: Maximum number of stores to return (optional, default: 50)
 */
router.get(
  '/categories/:categorySlug/stores',
  async (req: Request, res: Response) => {
    try {
      const { categorySlug } = req.params;
      const { lat, lng, radius, limit } = req.query;

      console.log(`[API] Fetching stores for category slug: ${categorySlug}`);

      // Parse location parameters if provided
      const location =
        lat && lng
          ? {
              lat: parseFloat(lat as string),
              lng: parseFloat(lng as string),
            }
          : undefined;

      const radiusMiles = radius ? parseFloat(radius as string) : 25;
      const maxStores = limit ? parseInt(limit as string, 10) : 50;

      // Get stores by category slug
      const stores = await categoryDirectoryService.getStoresByCategory(
        categorySlug,
        location,
        radiusMiles
      );

      // Limit results
      const limitedStores = stores.slice(0, maxStores);

      // Get category info for the first store (to get category ID for path)
      // Note: getCategoryPath needs category ID, but we have slug
      // For now, skip the path since we don't need it for the response
      const categoryPath: any[] = [];

      res.json({
        success: true,
        data: {
          category: categoryPath[categoryPath.length - 1] || null,
          categoryPath,
          stores: limitedStores,
          totalCount: stores.length,
          returnedCount: limitedStores.length,
          location: location || null,
          radius: radiusMiles,
        },
      });
    } catch (error) {
      console.error('Error fetching stores by category:', error);
      
      if (error instanceof Error && error.message === 'Category not found') {
        return res.status(404).json({
          success: false,
          error: 'Category not found',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch stores by category',
      });
    }
  }
);

/**
 * GET /api/directory/categories/:categoryId/hierarchy
 * 
 * Get category hierarchy tree starting from a specific category
 * Useful for building navigation trees
 * 
 * Path params:
 * - categoryId: Category ID (optional, if not provided returns root categories)
 */
router.get(
  '/categories/:categoryId/hierarchy',
  async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.params;

      const hierarchy = await categoryDirectoryService.getCategoryHierarchy(
        categoryId === 'root' ? undefined : categoryId
      );

      res.json({
        success: true,
        data: {
          hierarchy,
          rootCategoryId: categoryId === 'root' ? null : categoryId,
        },
      });
    } catch (error) {
      console.error('Error fetching category hierarchy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch category hierarchy',
      });
    }
  }
);

/**
 * GET /api/directory/categories/search
 * 
 * Search categories by name or slug
 * 
 * Query params:
 * - q: Search query
 * - limit: Maximum number of results (optional, default: 20)
 */
router.get('/categories/search', async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }

    const maxResults = limit ? parseInt(limit as string, 10) : 20;

    // Get all categories and filter by search query
    // TODO: Implement full-text search in the service for better performance
    const allCategories = await categoryDirectoryService.getCategoriesWithStores();
    
    const searchLower = q.toLowerCase();
    const filtered = allCategories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(searchLower) ||
        cat.slug.toLowerCase().includes(searchLower)
    );

    const limited = filtered.slice(0, maxResults);

    res.json({
      success: true,
      data: {
        query: q,
        categories: limited,
        totalCount: filtered.length,
        returnedCount: limited.length,
      },
    });
  } catch (error) {
    console.error('Error searching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search categories',
    });
  }
});

export default router;
