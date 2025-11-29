import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { GBPCategorySyncService } from '../services/GBPCategorySync';

const router = Router();

// Database connection pool for directory queries
let directPool: Pool | null = null;

const getDirectPool = () => {
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!directPool) {
    let connectionString = isProduction
      ? process.env.DIRECT_DATABASE_URL
      : process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('Database connection string not configured');
    }

    // In development, modify connection string to disable SSL
    if (!isProduction) {
      console.log('[GBP Pool] Development mode - modifying connection string for SSL');
      // Remove any existing sslmode parameter and add sslmode=disable
      if (connectionString.includes('sslmode=')) {
        connectionString = connectionString.replace(/sslmode=[^&]+/, 'sslmode=disable');
      } else {
        const separator = connectionString.includes('?') ? '&' : '?';
        connectionString += `${separator}sslmode=disable`;
      }
    }

    const config: any = {
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    // Also set SSL config object for development
    if (!isProduction) {
      config.ssl = {
        rejectUnauthorized: false
      };
    }

    directPool = new Pool(config);
  }

  return directPool;
};

/**
 * GET /api/gbp/categories
 * Search Google Business Profile categories
 * Query params:
 * - query: Search term
 * - limit: Max results (default: 10)
 * - tenantId: Tenant ID (for context, optional)
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { query, limit = '10', tenantId } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Query must be at least 2 characters',
        items: []
      });
    }

    const searchTerm = query.trim().toLowerCase();
    const maxLimit = Math.min(50, Number(limit));

    // Search platform_categories table
    const searchQuery = `
      SELECT 
        id,
        name,
        slug,
        google_category_id,
        icon_emoji,
        level,
        parent_id
      FROM platform_categories
      WHERE 
        is_active = true
        AND (
          LOWER(name) LIKE $1
          OR LOWER(slug) LIKE $1
          OR google_category_id::text LIKE $1
        )
      ORDER BY 
        CASE 
          WHEN LOWER(name) = $2 THEN 1
          WHEN LOWER(name) LIKE $3 THEN 2
          ELSE 3
        END,
        name ASC
      LIMIT $4
    `;

    const result = await getDirectPool().query(searchQuery, [
      `%${searchTerm}%`,  // $1 - LIKE pattern
      searchTerm,          // $2 - Exact match
      `${searchTerm}%`,    // $3 - Starts with
      maxLimit             // $4 - Limit
    ]);

    const items = result.rows.map((row: any) => ({
      id: row.google_category_id || row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon_emoji,
      level: row.level,
      parentId: row.parent_id,
    }));

    return res.json({
      items,
      count: items.length,
      query: searchTerm,
    });

  } catch (error) {
    console.error('[GBP Categories] Search error:', error);
    return res.status(500).json({ 
      error: 'Failed to search categories',
      items: []
    });
  }
});

/**
 * GET /api/gbp/categories/popular
 * Get popular/recommended GBP categories
 * Query params:
 * - limit: Max results (default: 10)
 * - tenantId: Tenant ID (for personalization, optional)
 */
router.get('/categories/popular', async (req: Request, res: Response) => {
  try {
    const { limit = '10', tenantId } = req.query;
    const maxLimit = Math.min(50, Number(limit));

    // Get categories with most stores
    const popularQuery = `
      SELECT 
        pc.id,
        pc.name,
        pc.slug,
        pc.google_category_id,
        pc.icon_emoji,
        pc.level,
        pc.parent_id,
        COUNT(DISTINCT dlc.listing_id) as store_count
      FROM platform_categories pc
      LEFT JOIN directory_listing_categories dlc ON dlc.category_id = pc.id
      WHERE pc.is_active = true
      GROUP BY pc.id, pc.name, pc.slug, pc.google_category_id, pc.icon_emoji, pc.level, pc.parent_id
      HAVING COUNT(DISTINCT dlc.listing_id) > 0
      ORDER BY store_count DESC, pc.name ASC
      LIMIT $1
    `;

    const result = await getDirectPool().query(popularQuery, [maxLimit]);

    const items = result.rows.map((row: any) => ({
      id: row.google_category_id || row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon_emoji,
      level: row.level,
      parentId: row.parent_id,
      storeCount: parseInt(row.store_count || '0'),
    }));

    return res.json({
      items,
      count: items.length,
    });

  } catch (error) {
    console.error('[GBP Categories] Popular error:', error);
    return res.status(500).json({ 
      error: 'Failed to get popular categories',
      items: []
    });
  }
});

/**
 * POST /api/gbp/sync-to-directory
 * Sync GBP categories to directory listings
 * Body:
 * - tenantId: Tenant ID
 * - gbpCategories: { primary: { id, name }, secondary: [{ id, name }] }
 */
router.post('/sync-to-directory', async (req: Request, res: Response) => {
  try {
    const { tenantId, gbpCategories } = req.body;

    if (!tenantId || !gbpCategories?.primary) {
      return res.status(400).json({ 
        error: 'Missing required fields: tenantId, gbpCategories.primary' 
      });
    }

    // Initialize sync service
    const syncService = new GBPCategorySyncService(getDirectPool());

    // Perform sync
    const result = await syncService.syncGBPToDirectory(tenantId, gbpCategories);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Sync failed',
        syncedCategories: result.syncedCategories,
        unmappedCategories: result.unmappedCategories,
      });
    }

    // Update usage statistics
    const allCategoryIds = [
      gbpCategories.primary.id,
      ...(gbpCategories.secondary || []).map((s: any) => s.id),
    ];
    
    await syncService.updateUsageStats(allCategoryIds);

    return res.json({
      success: true,
      syncedCategories: result.syncedCategories,
      unmappedCategories: result.unmappedCategories,
      message: result.unmappedCategories.length > 0
        ? `Synced ${result.syncedCategories} categories. ${result.unmappedCategories.length} categories need mapping.`
        : `Successfully synced ${result.syncedCategories} categories`,
    });

  } catch (error) {
    console.error('[GBP Sync] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to sync GBP categories to directory',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gbp/mappings
 * Get platform category mappings for GBP categories
 * Query params:
 * - categoryIds: Comma-separated GBP category IDs
 */
router.get('/mappings', async (req: Request, res: Response) => {
  try {
    const { categoryIds } = req.query;

    if (!categoryIds || typeof categoryIds !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required parameter: categoryIds' 
      });
    }

    const ids = categoryIds.split(',').filter(id => id.trim());
    
    if (ids.length === 0) {
      return res.json({ mappings: [] });
    }

    const syncService = new GBPCategorySyncService(getDirectPool());
    const mappings = await syncService.getGBPMappings(ids);

    // Enrich with platform category details
    const enrichedMappings = await Promise.all(
      mappings.map(async (mapping) => {
        if (!mapping.platform_category_id) {
          return {
            gbpCategoryId: mapping.gbp_category_id,
            gbpCategoryName: mapping.gbp_category_name,
            platformCategory: null,
            mappingConfidence: mapping.mapping_confidence,
            isMapped: false,
          };
        }

        // Get platform category details
        const categoryQuery = `
          SELECT id, name, slug, icon_emoji, level, parent_id
          FROM platform_categories
          WHERE id = $1
        `;
        const categoryResult = await getDirectPool().query(categoryQuery, [mapping.platform_category_id]);
        
        return {
          gbpCategoryId: mapping.gbp_category_id,
          gbpCategoryName: mapping.gbp_category_name,
          platformCategory: categoryResult.rows[0] ? {
            id: categoryResult.rows[0].id,
            name: categoryResult.rows[0].name,
            slug: categoryResult.rows[0].slug,
            icon: categoryResult.rows[0].icon_emoji,
            level: categoryResult.rows[0].level,
            parentId: categoryResult.rows[0].parent_id,
          } : null,
          mappingConfidence: mapping.mapping_confidence,
          isMapped: true,
        };
      })
    );

    return res.json({
      mappings: enrichedMappings,
      count: enrichedMappings.length,
    });

  } catch (error) {
    console.error('[GBP Mappings] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to get category mappings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
