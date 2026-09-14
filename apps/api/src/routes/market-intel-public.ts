/**
 * Market Intel Public Routes (Phase 1)
 *
 * Public, no-auth teaser endpoint for the seed page sidebar.
 *
 * Routes (mounted at /api/public/place):
 *   GET /:slug/market-intel/summary  — teaser data for the sidebar cards
 *
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§4.1)
 */
import { Router, Request, Response } from 'express';
import { MarketIntelService } from '../services/MarketIntelService';
import { logger } from '../logger';

const router = Router();
const service = MarketIntelService.getInstance();

/**
 * GET /api/public/place/:slug/market-intel/summary
 * Returns teaser data for the sidebar. No auth required.
 */
router.get('/:slug/market-intel/summary', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: 'slug_required' });

    const summary = await service.getTeaserSummary(slug);

    // Cache-Control: public, max-age=300 — sit on MarketContextLoader's
    // 5-min TTL (§11.4). Teasers are crawlable DOM content (§11.5).
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('[GET /api/public/place/:slug/market-intel/summary] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
