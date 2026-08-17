/**
 * Admin Growth Engine Analytics Routes
 *
 *   GET /api/admin/growth-engine/funnel         — funnel metrics
 *   GET /api/admin/growth-engine/by-niche       — per-niche breakdown
 *   GET /api/admin/growth-engine/by-city        — per-city breakdown
 *   GET /api/admin/growth-engine/time-series    — time series chart data
 *   GET /api/admin/growth-engine/recommendations — expansion recommendations
 *   POST /api/admin/growth-engine/aggregate     — trigger daily aggregation
 *
 * All routes require PLATFORM_ADMIN auth.
 */
import { Router, Request, Response } from 'express';
import GrowthEngineAnalyticsService from '../services/GrowthEngineAnalyticsService';
import { logger } from '../logger';

const router = Router();

const requirePlatformAdmin = (req: Request, res: Response, next: any) => {
  if ((req as any).user?.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

const parseDateRange = (req: Request) => {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  return { startDate, endDate };
};

/** GET /api/admin/growth-engine/funnel */
router.get('/funnel', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await GrowthEngineAnalyticsService.getFunnel(parseDateRange(req));
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[GET /api/admin/growth-engine/funnel] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/growth-engine/by-niche */
router.get('/by-niche', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await GrowthEngineAnalyticsService.getByNiche(parseDateRange(req));
    res.json({ success: true, niches: result });
  } catch (error: any) {
    logger.error('[GET /api/admin/growth-engine/by-niche] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/growth-engine/by-city */
router.get('/by-city', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await GrowthEngineAnalyticsService.getByCity(parseDateRange(req));
    res.json({ success: true, cities: result });
  } catch (error: any) {
    logger.error('[GET /api/admin/growth-engine/by-city] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/growth-engine/time-series */
router.get('/time-series', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const granularity = (req.query.granularity as 'week' | 'month') || 'week';
    const result = await GrowthEngineAnalyticsService.getTimeSeries(parseDateRange(req), granularity);
    res.json({ success: true, series: result });
  } catch (error: any) {
    logger.error('[GET /api/admin/growth-engine/time-series] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/growth-engine/recommendations */
router.get('/recommendations', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await GrowthEngineAnalyticsService.getRecommendations();
    res.json({ success: true, recommendations: result });
  } catch (error: any) {
    logger.error('[GET /api/admin/growth-engine/recommendations] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/growth-engine/aggregate — trigger daily aggregation manually */
router.post('/aggregate', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const dateStr = req.body?.date as string | undefined;
    const date = dateStr ? new Date(dateStr) : undefined;
    const result = await GrowthEngineAnalyticsService.runDailyAggregation(date);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[POST /api/admin/growth-engine/aggregate] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
