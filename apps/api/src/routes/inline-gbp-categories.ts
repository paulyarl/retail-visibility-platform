import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

const router = Router();

router.get('/api/gbp/categories/popular', async (req, res) => {
  try {
    const pool = getDirectPool();

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
      ORDER BY store_count DESC, pc.name ASC
      LIMIT 20
    `;

    const result = await pool.query(popularQuery);

    const popularCategories = result.rows.map((row: any) => ({
      id: row.google_category_id || `gcid:${row.slug}`,
      name: row.name,
      path: ['Shopping', row.level === 1 ? 'General' : row.level === 2 ? 'Specialty' : 'Niche'],
      storeCount: parseInt(row.store_count || '0'),
    }));

    return res.json({ items: popularCategories });
  } catch (error) {
    logger.error('[GET /api/gbp/categories/popular] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_popular_categories' });
  }
});

router.get('/api/gbp/categories', async (req, res) => {
  try {
    const { query, limit = '20' } = req.query;
    const pool = getDirectPool();

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const searchQuery = `
      SELECT 
        pc.id,
        pc.name,
        pc.slug,
        pc.google_category_id,
        pc.icon_emoji,
        pc.level,
        pc.parent_id
      FROM platform_categories pc
      WHERE pc.is_active = true 
        AND (
          pc.name ILIKE $1 
          OR pc.slug ILIKE $1
          OR pc.description ILIKE $1
        )
      ORDER BY 
        CASE WHEN pc.name ILIKE $1 THEN 1 ELSE 2 END,
        pc.sort_order ASC,
        pc.name ASC
      LIMIT $2
    `;

    const result = await pool.query(searchQuery, [`%${query}%`, parseInt(limit as string, 10)]);

    const results = result.rows.map((cat: any) => ({
      id: cat.google_category_id || `gcid:${cat.slug}`,
      name: cat.name,
      path: ['Shopping', cat.level === 1 ? 'General' : cat.level === 2 ? 'Specialty' : 'Niche'],
      icon: cat.icon_emoji,
      level: cat.level,
      parentId: cat.parent_id,
    }));

    return res.json({ items: results, source: 'platform_categories' });
  } catch (error) {
    logger.error('[GET /api/gbp/categories] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_search_categories' });
  }
});

export default router;
