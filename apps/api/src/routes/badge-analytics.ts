/**
 * Badge Analytics Routes
 *
 * Phase 4: Badge Analytics
 *
 * Tenant endpoints (auth required):
 *   GET  /api/tenants/:tenantId/badge-analytics              — dashboard summary
 *   GET  /api/tenants/:tenantId/badge-analytics/timeseries   — per-badge time series
 *   GET  /api/tenants/:tenantId/badge-analytics/roi          — ROI comparison report
 *   POST /api/tenants/:tenantId/badge-analytics/aggregate    — manually trigger aggregation
 *
 * Public endpoint (no auth — storefront event tracking):
 *   POST /api/public/badge-events                            — track a badge event
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';
import {
  trackBadgeEvent,
  trackBadgeEvents,
  getBadgeAnalyticsDashboard,
  getBadgeTimeSeries,
  getBadgeROIReport,
  aggregateBadgeAnalyticsForTenant,
  type PeriodType,
} from '../services/BadgeAnalyticsService';

const router = express.Router();

/**
 * GET /api/tenants/:tenantId/badge-analytics
 * Returns aggregated badge analytics dashboard for the tenant.
 * Query params: period (day|week|month, default: day), daysBack (default: 30)
 */
router.get('/tenants/:tenantId/badge-analytics', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as PeriodType) || 'day';
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const dashboard = await getBadgeAnalyticsDashboard(tenantId, period, daysBack);
    res.json(dashboard);
  } catch (error) {
    logger.error('[badge-analytics] Failed to get dashboard:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch badge analytics' });
  }
});

/**
 * GET /api/tenants/:tenantId/badge-analytics/timeseries
 * Returns time-series data for a specific badge.
 * Query params: badgeKey (required), period (default: day), daysBack (default: 30)
 */
router.get('/tenants/:tenantId/badge-analytics/timeseries', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const badgeKey = req.query.badgeKey as string;
    if (!badgeKey) {
      return res.status(400).json({ error: 'badgeKey is required' });
    }
    const period = (req.query.period as PeriodType) || 'day';
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const timeseries = await getBadgeTimeSeries(tenantId, badgeKey, period, daysBack);
    res.json({ badgeKey, period, data: timeseries });
  } catch (error) {
    logger.error('[badge-analytics] Failed to get timeseries:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch time series' });
  }
});

/**
 * GET /api/tenants/:tenantId/badge-analytics/roi
 * Returns badge ROI comparison report.
 * Query params: period (default: day), daysBack (default: 30)
 */
router.get('/tenants/:tenantId/badge-analytics/roi', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as PeriodType) || 'day';
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const roi = await getBadgeROIReport(tenantId, period, daysBack);
    res.json({ badges: roi });
  } catch (error) {
    logger.error('[badge-analytics] Failed to get ROI report:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch ROI report' });
  }
});

/**
 * POST /api/tenants/:tenantId/badge-analytics/aggregate
 * Manually trigger badge analytics aggregation for the tenant.
 */
router.post('/tenants/:tenantId/badge-analytics/aggregate', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as PeriodType) || 'day';

    const result = await aggregateBadgeAnalyticsForTenant(tenantId, period);
    res.json({
      success: true,
      rowsComputed: result.rowsComputed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('[badge-analytics] Failed to aggregate:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to aggregate badge analytics' });
  }
});

/**
 * POST /api/public/badge-events
 * Track a badge event from the storefront (no auth — public endpoint).
 * Body: { tenantId, badgeKey, inventoryItemId, eventType, sessionId?, orderId?, revenueCents? }
 */
router.post('/public/badge-events', async (req, res) => {
  try {
    const { tenantId, badgeKey, inventoryItemId, eventType, sessionId, orderId, revenueCents } = req.body;

    if (!tenantId || !badgeKey || !inventoryItemId || !eventType) {
      return res.status(400).json({ error: 'tenantId, badgeKey, inventoryItemId, and eventType are required' });
    }

    const validTypes = ['view', 'click', 'add_to_cart', 'order'];
    if (!validTypes.includes(eventType)) {
      return res.status(400).json({ error: `eventType must be one of: ${validTypes.join(', ')}` });
    }

    await trackBadgeEvent({
      tenantId,
      badgeKey,
      inventoryItemId,
      eventType,
      sessionId,
      orderId,
      revenueCents,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('[badge-events] Failed to track event:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to track badge event' });
  }
});

/**
 * POST /api/public/badge-events/batch
 * Batch track multiple badge events from the storefront.
 * Body: { events: [{ tenantId, badgeKey, inventoryItemId, eventType, ... }] }
 */
router.post('/public/badge-events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const validTypes = ['view', 'click', 'add_to_cart', 'order'];
    const sanitized = events.filter(
      (e: any) => e.tenantId && e.badgeKey && e.inventoryItemId && e.eventType && validTypes.includes(e.eventType)
    );

    if (sanitized.length === 0) {
      return res.status(400).json({ error: 'No valid events in batch' });
    }

    await trackBadgeEvents(sanitized);
    res.status(201).json({ success: true, tracked: sanitized.length });
  } catch (error) {
    logger.error('[badge-events] Failed to batch track events:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to track badge events' });
  }
});

export default router;
