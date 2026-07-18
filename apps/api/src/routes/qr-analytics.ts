/**
 * QR Analytics Routes
 *
 * Tenant endpoints (auth required):
 *   GET  /api/tenants/:tenantId/qr-analytics              — dashboard summary
 *   GET  /api/tenants/:tenantId/qr-analytics/timeseries   — per-surface time series
 *   POST /api/tenants/:tenantId/qr-analytics/aggregate    — manually trigger aggregation
 *
 * Public endpoint (no auth — storefront QR scan tracking):
 *   POST /api/public/qr-events                            — track a QR scan event
 *   POST /api/public/qr-events/batch                      — batch track QR scan events
 *
 * Admin endpoint (auth required):
 *   GET  /api/admin/qr-analytics                          — cross-tenant analytics
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';
import {
  trackQrScanEvent,
  trackQrScanEvents,
  getQrAnalyticsDashboard,
  getQrTimeSeries,
  aggregateQrAnalyticsForTenant,
  getAdminQrAnalytics,
  type PeriodType,
  type QrSurfaceType,
  type QrConsumerType,
  type QrScanEventInput,
} from '../services/QrAnalyticsService';

const router = express.Router();

// ====================
// TENANT ENDPOINTS (auth required)
// ====================

/**
 * GET /api/tenants/:tenantId/qr-analytics
 * Returns aggregated QR analytics dashboard for the tenant.
 * Query params: period (day|week|month, default: day), daysBack (default: 30)
 */
router.get('/tenants/:tenantId/qr-analytics', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as PeriodType) || 'day';
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const dashboard = await getQrAnalyticsDashboard(tenantId, period, daysBack);
    res.json(dashboard);
  } catch (error) {
    logger.error('[qr-analytics] Failed to get dashboard:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch QR analytics' });
  }
});

/**
 * GET /api/tenants/:tenantId/qr-analytics/timeseries
 * Returns time-series data for a specific QR surface.
 * Query params: surface (required), period (default: day), daysBack (default: 30)
 */
router.get('/tenants/:tenantId/qr-analytics/timeseries', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const surface = req.query.surface as QrSurfaceType;
    if (!surface) {
      return res.status(400).json({ error: 'surface is required' });
    }
    const period = (req.query.period as PeriodType) || 'day';
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const data = await getQrTimeSeries(tenantId, surface, period, daysBack);
    res.json({ surface, period, data });
  } catch (error) {
    logger.error('[qr-analytics] Failed to get timeseries:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch QR time series' });
  }
});

/**
 * POST /api/tenants/:tenantId/qr-analytics/aggregate
 * Manually trigger aggregation for the tenant.
 * Body: { period?: 'day' | 'week' | 'month' }
 */
router.post('/tenants/:tenantId/qr-analytics/aggregate', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.body.period as PeriodType) || 'day';

    const result = await aggregateQrAnalyticsForTenant(tenantId, period);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[qr-analytics] Failed to aggregate:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to trigger aggregation' });
  }
});

// ====================
// PUBLIC ENDPOINTS (no auth — QR scan tracking from storefront)
// ====================

/**
 * POST /api/public/qr-events
 * Track a single QR scan event.
 * Body: { tenantId, surface?, consumer?, productId?, sessionId?, source?, referrer?, userAgent?, geoCountry?, geoCity? }
 */
router.post('/public/qr-events', async (req, res) => {
  try {
    const { tenantId, surface, consumer, productId, sessionId, source, referrer, userAgent, geoCountry, geoCity } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const input: QrScanEventInput = {
      tenantId,
      surface,
      consumer,
      productId,
      sessionId,
      source,
      referrer,
      userAgent: userAgent || req.headers['user-agent'],
      geoCountry,
      geoCity,
    };

    await trackQrScanEvent(input);
    res.json({ success: true });
  } catch (error) {
    logger.error('[qr-analytics] Failed to track event:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to track QR event' });
  }
});

/**
 * POST /api/public/qr-events/batch
 * Batch track multiple QR scan events.
 * Body: { events: QrScanEventInput[] }
 */
router.post('/public/qr-events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const inputs: QrScanEventInput[] = events.map((e: any) => ({
      tenantId: e.tenantId,
      surface: e.surface,
      consumer: e.consumer,
      productId: e.productId,
      sessionId: e.sessionId,
      source: e.source,
      referrer: e.referrer,
      userAgent: e.userAgent || req.headers['user-agent'],
      geoCountry: e.geoCountry,
      geoCity: e.geoCity,
    }));

    await trackQrScanEvents(inputs);
    res.json({ success: true, count: inputs.length });
  } catch (error) {
    logger.error('[qr-analytics] Failed to batch track events:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to batch track QR events' });
  }
});

// ====================
// ADMIN ENDPOINT (auth required)
// ====================

/**
 * GET /api/admin/qr-analytics
 * Cross-tenant QR analytics for platform consumers.
 * Query params: consumer?, surface?, tenantId?, daysBack?
 */
router.get('/admin/qr-analytics', authenticateToken, async (req, res) => {
  try {
    const consumer = req.query.consumer as QrConsumerType | undefined;
    const surface = req.query.surface as QrSurfaceType | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const result = await getAdminQrAnalytics({ consumer, surface, tenantId, daysBack });
    res.json(result);
  } catch (error) {
    logger.error('[qr-analytics] Failed to get admin analytics:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch admin QR analytics' });
  }
});

export default router;
