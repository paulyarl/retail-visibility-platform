/**
 * Google Product Taxonomy Routes
 * Provides endpoints for searching Google's product category taxonomy
 * and managing platform category → Google category mappings.
 */

import { Router, Request, Response } from 'express';
import { getGoogleProductTaxonomy, searchGoogleProductTaxonomy } from '../../services/GoogleProductTaxonomyService';
import { getDirectPool } from '../../utils/db-pool';
import { logger } from '../../logger';

const router = Router();

// Auth: authenticateToken applied at mount level in admin.routes.ts

/**
 * GET /api/admin/google-product-taxonomy
 * Search Google's product category taxonomy.
 * Query params: q (search term), limit (max results, default 50)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    const results = await searchGoogleProductTaxonomy(
      (q as string) || '',
      limit ? Math.min(Number(limit), 200) : 50
    );

    return res.json({
      success: true,
      data: {
        categories: results,
        count: results.length,
      },
    });
  } catch (error) {
    logger.error('[Google Product Taxonomy] Search error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ success: false, error: 'Failed to search Google product taxonomy' });
  }
});

/**
 * GET /api/admin/google-product-taxonomy/all
 * Get the full Google product taxonomy (cached, ~5500 categories).
 */
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const taxonomy = await getGoogleProductTaxonomy();
    return res.json({
      success: true,
      data: {
        categories: taxonomy,
        count: taxonomy.length,
      },
    });
  } catch (error) {
    logger.error('[Google Product Taxonomy] Fetch all error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ success: false, error: 'Failed to fetch Google product taxonomy' });
  }
});

/**
 * GET /api/admin/google-product-taxonomy/coverage
 * Get mapping coverage: how many platform categories have Google category IDs set.
 */
router.get('/coverage', async (_req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE google_category_id IS NOT NULL AND google_category_id != '') as mapped,
        COUNT(*) as total
      FROM platform_categories
      WHERE is_active = true
    `);

    const row = result.rows[0];
    const mapped = Number(row.mapped) || 0;
    const total = Number(row.total) || 0;

    return res.json({
      success: true,
      data: {
        mapped,
        total,
        unmapped: total - mapped,
        coveragePercent: total > 0 ? Math.round((mapped / total) * 100) : 0,
      },
    });
  } catch (error) {
    logger.error('[Google Product Taxonomy] Coverage error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ success: false, error: 'Failed to get mapping coverage' });
  }
});

/**
 * POST /api/admin/google-product-taxonomy/batch-map
 * Batch update Google category mappings for platform categories.
 * Body: { mappings: [{ platformCategoryId, googleCategoryId }] }
 */
router.post('/batch-map', async (req: Request, res: Response) => {
  try {
    const { mappings } = req.body;

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ success: false, error: 'mappings array is required' });
    }

    const pool = getDirectPool();
    let updated = 0;

    for (const mapping of mappings) {
      if (!mapping.platformCategoryId || !mapping.googleCategoryId) continue;

      await pool.query(
        `UPDATE platform_categories SET google_category_id = $1, updated_at = NOW() WHERE id = $2`,
        [mapping.googleCategoryId, mapping.platformCategoryId]
      );
      updated++;
    }

    return res.json({
      success: true,
      data: { updated, total: mappings.length },
      message: `Updated ${updated} category mappings`,
    });
  } catch (error) {
    logger.error('[Google Product Taxonomy] Batch map error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ success: false, error: 'Failed to batch update mappings' });
  }
});

export default router;
