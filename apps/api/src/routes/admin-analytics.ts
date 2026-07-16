/**
 * Admin Analytics API Routes
 * Provides comprehensive analytics data for the admin dashboard
 */

import express from 'express';
import { AnalyticsService } from '../services/analytics/AnalyticsService';
import { logger } from '../logger';
//import { AnalyticsService } from '../services/analytics/AnalyticsService';

const router = express.Router();
const analyticsService = AnalyticsService.getInstance();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

/**
 * GET /api/admin/analytics/overview
 * Returns key performance indicators and metrics overview
 */
router.get('/overview', async (req, res) => {
  try {
    const {
      period = 'week',
      startDate,
      endDate,
      pageType,
      entityType,
      region
    } = req.query;

    const filters = {
      period: period as string,
      startDate: startDate as string,
      endDate: endDate as string,
      pageType: pageType as string,
      entityType: entityType as string,
      region: region as string
    };

    const overview = await analyticsService.getOverviewMetrics(filters);
    res.json(overview);
  } catch (error) {
    logger.error('[Analytics API] Overview error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch overview metrics' });
  }
});

/**
 * GET /api/admin/analytics/page-traffic
 * Returns page traffic analytics by type and top performing pages
 */
router.get('/page-traffic', async (req, res) => {
  try {
    const filters = req.query as any;
    const pageTraffic = await analyticsService.getPageTrafficAnalytics(filters);
    res.json(pageTraffic);
  } catch (error) {
    logger.error('[Analytics API] Page traffic error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch page traffic analytics' });
  }
});

/**
 * GET /api/admin/analytics/user-behavior
 * Returns user behavior analytics including journey funnel and engagement patterns
 */
router.get('/user-behavior', async (req, res) => {
  try {
    const filters = req.query as any;
    const userBehavior = await analyticsService.getUserBehaviorAnalytics(filters);
    res.json(userBehavior);
  } catch (error) {
    logger.error('[Analytics API] User behavior error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch user behavior analytics' });
  }
});

/**
 * GET /api/admin/analytics/time-series
 * Returns time series data for trends and historical analysis
 */
router.get('/time-series', async (req, res) => {
  try {
    const filters = req.query as any;
    const timeSeries = await analyticsService.getTimeSeriesAnalytics(filters);
    res.json(timeSeries);
  } catch (error) {
    logger.error('[Analytics API] Time series error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch time series analytics' });
  }
});

/**
 * GET /api/admin/analytics/popular-content
 * Returns analytics for most popular content (stores, products, categories)
 */
router.get('/popular-content', async (req, res) => {
  try {
    const filters = req.query as any;
    const popularContent = await analyticsService.getPopularContentAnalytics(filters);
    res.json(popularContent);
  } catch (error) {
    logger.error('[Analytics API] Popular content error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch popular content analytics' });
  }
});

/**
 * GET /api/admin/analytics/geographic
 * Returns geographic distribution and location-based analytics
 */
router.get('/geographic', async (req, res) => {
  try {
    const filters = req.query as any;
    const geographic = await analyticsService.getGeographicAnalytics(filters);
    res.json(geographic);
  } catch (error) {
    logger.error('[Analytics API] Geographic error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch geographic analytics' });
  }
});

export default router;
