/**
 * Market Intel — public routes for category + city surfaces (§12.4).
 *
 * Mounted at:
 *   /api/public/directory/category  → category teaser
 *   /api/public/directory/city      → city teaser
 *
 * No auth. 5-minute cache headers (same as the place teaser).
 */
import { Router, Request, Response } from 'express';
import { MarketIntelService } from '../services/MarketIntelService';
import { logger } from '../logger';

const router = Router();
const service = MarketIntelService.getInstance();

/**
 * GET /api/public/directory/category/:categorySlug/market-intel/summary
 * Query: city (required — "__all__" for national), state (required when city !== "__all__")
 */
router.get('/category/:categorySlug/market-intel/summary', async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const city = (req.query.city as string) || '__all__';
    const state = (req.query.state as string) || null;

    if (!categorySlug) return res.status(400).json({ success: false, error: 'category_slug_required' });

    const teaser = await service.getCategoryTeaserSummary(categorySlug, city, state);

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: teaser });
  } catch (error) {
    logger.error('[GET /api/public/directory/category/:categorySlug/market-intel/summary] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * GET /api/public/directory/city/:citySlug/market-intel/summary
 * The citySlug is the "{city}-{state}" slug from the URL; we parse it
 * back to city + state for the enrichment lookup.
 */
router.get('/city/:citySlug/market-intel/summary', async (req: Request, res: Response) => {
  try {
    const { citySlug } = req.params;
    if (!citySlug) return res.status(400).json({ success: false, error: 'city_slug_required' });

    // Parse "kansas-city-mo" → city="Kansas City", state="MO".
    // The slug format is "{city-words}-{state-code}". We split from the
    // right to handle multi-word city names (e.g. "Kansas City-MO").
    const parts = decodeURIComponent(citySlug).split('-');
    if (parts.length < 2) {
      return res.status(400).json({ success: false, error: 'invalid_city_slug' });
    }
    const state = parts.pop()!.toUpperCase();
    const city = parts.join(' ');

    const teaser = await service.getCityTeaserSummary(city, state);

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: teaser });
  } catch (error) {
    logger.error('[GET /api/public/directory/city/:citySlug/market-intel/summary] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
