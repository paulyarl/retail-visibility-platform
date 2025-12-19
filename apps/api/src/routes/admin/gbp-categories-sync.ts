import { Router, Request, Response } from 'express';
import { getDirectPool } from '../../utils/db-pool';
import { GBPCategorySyncService } from '../../services/GBPCategorySyncService';

const router = Router();
const gbpCategorySyncService = new GBPCategorySyncService();

/**
 * GET /api/admin/gbp-categories/list
 * Get all GBP business categories from Google's API
 * Returns the official Google Business Profile category list
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { regionCode = 'US', languageCode = 'en' } = req.query;

    const result = await gbpCategorySyncService.fetchLatestCategories({
      regionCode: regionCode as string,
      languageCode: languageCode as string,
    });

    return res.json({
      success: true,
      data: {
        categories: result.categories,
        totalCount: result.totalCount,
        version: result.version,
      },
    });
  } catch (error) {
    console.error('[GBP Categories Sync] List error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch GBP categories from Google',
    });
  }
});

/**
 * GET /api/admin/gbp-categories/search
 * Search GBP business categories by name
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 50 } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const result = await gbpCategorySyncService.fetchLatestCategories({
      regionCode: 'US',
      languageCode: 'en',
    });

    // Filter categories by search term
    const searchTerm = q.toLowerCase();
    const filtered = result.categories.filter((cat: any) =>
      cat.display_name.toLowerCase().includes(searchTerm) ||
      cat.categoryId.toLowerCase().includes(searchTerm)
    ).slice(0, Number(limit));

    return res.json({
      success: true,
      data: {
        categories: filtered,
        totalCount: filtered.length,
        query: q,
      },
    });
  } catch (error) {
    console.error('[GBP Categories Sync] Search error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search GBP categories',
    });
  }
});

/**
 * POST /api/admin/gbp-categories/sync
 * Sync GBP categories from Google API to database
 * Updates gbp_categories_list table with latest from Google
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { dryRun = true } = req.body;

    // Check for updates
    const updateCheck = await gbpCategorySyncService.checkForUpdates();

    if (!updateCheck.hasUpdates) {
      return res.json({
        success: true,
        message: 'No updates needed - categories are up to date',
        data: {
          changes: [],
          applied: 0,
        },
      });
    }

    if (dryRun) {
      return res.json({
        success: true,
        message: 'Dry run - changes detected but not applied',
        data: {
          changes: updateCheck.changes,
          wouldApply: updateCheck.changes.length,
        },
      });
    }

    // Apply updates
    const result = await gbpCategorySyncService.applyUpdates(updateCheck.changes);

    return res.json({
      success: true,
      message: `Synced ${result.applied} categories`,
      data: {
        changes: updateCheck.changes,
        applied: result.applied,
        failed: result.failed,
      },
    });
  } catch (error) {
    console.error('[GBP Categories Sync] Sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync GBP categories',
    });
  }
});

/**
 * POST /api/admin/gbp-categories/seed
 * Seed hardcoded GBP categories as fallback
 * Use when OAuth is not available
 */
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const seeded = await gbpCategorySyncService.seedHardcodedCategories();

    return res.json({
      success: true,
      message: `Seeded ${seeded} GBP categories`,
      data: {
        seeded,
      },
    });
  } catch (error) {
    console.error('[GBP Categories Sync] Seed error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to seed GBP categories',
    });
  }
});

/**
 * GET /api/admin/gbp-categories/mappings
 * Get platform category to GBP category mappings
 */
router.get('/mappings', async (req: Request, res: Response) => {
  try {
    const result = await getDirectPool().query(`
      SELECT 
        pc.id as platform_category_id,
        pc.name as platform_category_name,
        pc.slug,
        pc.gcid,
        pc.google_category_id,
        gc.id as gbp_category_id,
        gc.display_name as gbp_category_name
      FROM platform_categories pc
      LEFT JOIN gbp_categories_list gc ON pc.gcid = gc.id
      WHERE pc.is_active = true
      ORDER BY pc.sort_order, pc.name
    `);

    return res.json({
      success: true,
      data: {
        mappings: result.rows,
        count: result.rows.length,
        unmapped: result.rows.filter((r: any) => !r.gbp_category_id).length,
      },
    });
  } catch (error) {
    console.error('[GBP Categories Sync] Mappings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch category mappings',
    });
  }
});

/**
 * PATCH /api/admin/gbp-categories/map/:platformCategoryId
 * Map a platform category to a GBP category
 */
router.patch('/map/:platformCategoryId', async (req: Request, res: Response) => {
  try {
    const { platformCategoryId } = req.params;
    const { gcid } = req.body;

    if (!gcid) {
      return res.status(400).json({
        success: false,
        error: 'gcid is required',
      });
    }

    // Verify the gcid exists in gbp_categories_list
    const gbpCategory = await getDirectPool().query(
      'SELECT id, display_name FROM gbp_categories_list WHERE id = $1',
      [gcid]
    );

    if (gbpCategory.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'GBP category not found',
      });
    }

    // Update the platform category with the gcid
    const result = await getDirectPool().query(
      `UPDATE platform_categories 
       SET gcid = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [gcid, platformCategoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Platform category not found',
      });
    }

    return res.json({
      success: true,
      data: {
        platformCategory: result.rows[0],
        gbpCategory: gbpCategory.rows[0],
      },
    });
  } catch (error) {
    console.error('[GBP Categories Sync] Map error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to map category',
    });
  }
});

/**
 * POST /api/admin/gbp-categories/auto-map
 * Automatically map platform categories to GBP categories based on name similarity
 */
router.post('/auto-map', async (req: Request, res: Response) => {
  try {
    const { dryRun = true } = req.body;

    // Get unmapped platform categories
    const unmapped = await getDirectPool().query(`
      SELECT id, name, slug 
      FROM platform_categories 
      WHERE gcid IS NULL AND is_active = true
    `);

    // Get all GBP categories
    const gbpCategories = await getDirectPool().query(`
      SELECT id, name, display_name 
      FROM gbp_categories_list 
      WHERE is_active = true
    `);

    const mappings: Array<{
      platformCategoryId: string;
      platformCategoryName: string;
      gcid: string;
      gbpCategoryName: string;
      confidence: string;
    }> = [];

    for (const pc of unmapped.rows) {
      const pcNameLower = pc.name.toLowerCase();
      const pcSlugLower = pc.slug.toLowerCase().replace(/-/g, ' ');

      // Try to find exact match first
      let match = gbpCategories.rows.find((gc: any) =>
        gc.display_name.toLowerCase() === pcNameLower ||
        gc.name.toLowerCase() === pcNameLower
      );

      let confidence = 'exact';

      // Try partial match if no exact match
      if (!match) {
        match = gbpCategories.rows.find((gc: any) =>
          gc.display_name.toLowerCase().includes(pcNameLower) ||
          pcNameLower.includes(gc.display_name.toLowerCase()) ||
          gc.name.toLowerCase().includes(pcSlugLower)
        );
        confidence = 'partial';
      }

      if (match) {
        mappings.push({
          platformCategoryId: pc.id,
          platformCategoryName: pc.name,
          gcid: match.id,
          gbpCategoryName: match.display_name,
          confidence,
        });
      }
    }

    if (dryRun) {
      return res.json({
        success: true,
        message: 'Dry run - mappings detected but not applied',
        data: {
          mappings,
          wouldMap: mappings.length,
          unmappedRemaining: unmapped.rows.length - mappings.length,
        },
      });
    }

    // Apply mappings
    let applied = 0;
    for (const mapping of mappings) {
      try {
        await getDirectPool().query(
          'UPDATE platform_categories SET gcid = $1, updated_at = NOW() WHERE id = $2',
          [mapping.gcid, mapping.platformCategoryId]
        );
        applied++;
      } catch (err) {
        console.error(`Failed to map ${mapping.platformCategoryId}:`, err);
      }
    }

    return res.json({
      success: true,
      message: `Auto-mapped ${applied} categories`,
      data: {
        mappings,
        applied,
        unmappedRemaining: unmapped.rows.length - applied,
      },
    });
  } catch (error) {
    console.error('[GBP Categories Sync] Auto-map error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to auto-map categories',
    });
  }
});

export default router;
