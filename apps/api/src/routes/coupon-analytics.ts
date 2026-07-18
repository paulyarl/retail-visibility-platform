/**
 * Coupon Analytics Routes
 *
 * Tenant endpoints (auth required):
 *   GET  /api/tenants/:tenantId/coupon-analytics              — dashboard summary
 *   GET  /api/tenants/:tenantId/coupon-analytics/timeseries   — time series data
 *   GET  /api/tenants/:tenantId/coupon-analytics/funnel       — funnel report
 *   GET  /api/tenants/:tenantId/coupon-analytics/roi          — ROI report
 *   POST /api/tenants/:tenantId/coupon-analytics/aggregate    — manually trigger aggregation
 *
 * Public endpoints (no auth — storefront event tracking):
 *   POST /api/public/coupon-events                            — track a coupon event
 *   POST /api/public/coupon-events/batch                      — batch track coupon events
 *
 * Admin endpoint (auth required):
 *   GET  /api/admin/coupon-analytics                          — cross-tenant analytics
 */

import express from 'express';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { logger } from '../logger';
import { CouponService } from '../services/CouponService';
import {
  trackCouponEvent,
  trackCouponEvents,
  aggregateCouponAnalyticsForTenant,
  getCouponAnalyticsDashboard,
  getCouponTimeSeries,
  getCouponFunnelReport,
  getCouponROIReport,
  getAdminCouponAnalytics,
  type PeriodType,
  type CouponEventType,
} from '../services/CouponAnalyticsService';

const router = express.Router();

const VALID_EVENT_TYPES = ['view', 'copy', 'click', 'validate', 'redeem', 'fail'];

// ====================
// TENANT ENDPOINTS (auth required)
// ====================

/**
 * GET /api/tenants/:tenantId/coupon-analytics
 * Returns aggregated coupon analytics dashboard for the tenant.
 * Query: period (day|week|month, default: day), daysBack (default: 30), couponId (optional)
 */
router.get('/tenants/:tenantId/coupon-analytics', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as PeriodType) || 'day';
    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const couponId = req.query.couponId as string | undefined;

    const dashboard = await getCouponAnalyticsDashboard(tenantId, { period, daysBack, couponId });
    res.json({ success: true, data: dashboard });
  } catch (error) {
    logger.error('[coupon-analytics] Failed to get dashboard:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch coupon analytics' });
  }
});

/**
 * GET /api/tenants/:tenantId/coupon-analytics/timeseries
 * Returns time-series data for coupon events.
 * Query: period (default: day), daysBack (default: 30), couponId (optional)
 */
router.get('/tenants/:tenantId/coupon-analytics/timeseries', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as PeriodType) || 'day';
    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const couponId = req.query.couponId as string | undefined;

    const timeseries = await getCouponTimeSeries(tenantId, { period, daysBack, couponId });
    res.json({ success: true, data: timeseries });
  } catch (error) {
    logger.error('[coupon-analytics] Failed to get timeseries:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch time series' });
  }
});

/**
 * GET /api/tenants/:tenantId/coupon-analytics/funnel
 * Returns funnel report (view → click → validate → redeem).
 * Query: daysBack (default: 30), couponId (optional)
 */
router.get('/tenants/:tenantId/coupon-analytics/funnel', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const couponId = req.query.couponId as string | undefined;

    const funnel = await getCouponFunnelReport(tenantId, { daysBack, couponId });
    res.json({ success: true, data: funnel });
  } catch (error) {
    logger.error('[coupon-analytics] Failed to get funnel report:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch funnel report' });
  }
});

/**
 * GET /api/tenants/:tenantId/coupon-analytics/roi
 * Returns ROI report (discount given vs revenue influenced).
 * Query: daysBack (default: 30)
 */
router.get('/tenants/:tenantId/coupon-analytics/roi', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const roi = await getCouponROIReport(tenantId, { daysBack });
    res.json({ success: true, data: roi });
  } catch (error) {
    logger.error('[coupon-analytics] Failed to get ROI report:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch ROI report' });
  }
});

/**
 * POST /api/tenants/:tenantId/coupon-analytics/aggregate
 * Manually trigger coupon analytics aggregation for the tenant.
 * Query: period (day|week|month, default: day)
 */
router.post('/tenants/:tenantId/coupon-analytics/aggregate', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as PeriodType) || 'day';

    const result = await aggregateCouponAnalyticsForTenant(tenantId, period);
    res.json({
      success: true,
      rowsComputed: result.rowsComputed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('[coupon-analytics] Failed to aggregate:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to aggregate coupon analytics' });
  }
});

// ====================
// PUBLIC ENDPOINTS (no auth — storefront event tracking)
// ====================

/**
 * POST /api/public/coupon-events
 * Track a coupon event from the storefront.
 * Body: { tenantId, couponId?, couponCode?, eventType, surface?, sessionId?, ... }
 */
router.post('/public/coupon-events', async (req, res) => {
  try {
    const { tenantId, couponId, couponCode, eventType, surface, sessionId, orderId, discountCents, source, referrer, userAgent, geoCountry, geoCity, deviceType } = req.body;

    if (!tenantId || !eventType) {
      return res.status(400).json({ error: 'tenantId and eventType are required' });
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ error: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
    }

    await trackCouponEvent({
      tenantId,
      couponId,
      couponCode,
      eventType: eventType as CouponEventType,
      surface,
      sessionId,
      orderId,
      discountCents,
      source,
      referrer,
      userAgent,
      geoCountry,
      geoCity,
      deviceType,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('[coupon-events] Failed to track event:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to track coupon event' });
  }
});

/**
 * POST /api/public/coupon-events/batch
 * Batch track multiple coupon events from the storefront.
 * Body: { events: [{ tenantId, couponId?, couponCode?, eventType, ... }] }
 */
router.post('/public/coupon-events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const sanitized = events.filter(
      (e: any) => e.tenantId && e.eventType && VALID_EVENT_TYPES.includes(e.eventType)
    );

    if (sanitized.length === 0) {
      return res.status(400).json({ error: 'No valid events in batch' });
    }

    await trackCouponEvents(sanitized);
    res.status(201).json({ success: true, tracked: sanitized.length });
  } catch (error) {
    logger.error('[coupon-events] Failed to batch track events:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to track coupon events' });
  }
});

// ====================
// PUBLIC ENDPOINTS (no auth — checkout validation + spotlight)
// ====================

/**
 * POST /api/public/tenants/:tenantId/coupons/validate
 * Validate a coupon code for checkout (public — called from storefront).
 * Body: { code, cartData: { subtotalCents, items: [{ productId, categoryId?, collectionId? }] } }
 */
router.post('/public/tenants/:tenantId/coupons/validate', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { code, cartData } = req.body;

    if (!code || !cartData || typeof cartData.subtotalCents !== 'number') {
      return res.status(400).json({ success: false, error: 'code and cartData.subtotalCents are required' });
    }

    const result = await CouponService.getInstance().validateCoupon(tenantId, code, cartData);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[coupons] Failed to validate coupon:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to validate coupon' });
  }
});

/**
 * GET /api/public/tenants/:tenantId/coupons/spotlight
 * Get the featured/spotlight coupon for public surfaces (storefront, directory).
 */
router.get('/public/tenants/:tenantId/coupons/spotlight', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const coupon = await CouponService.getInstance().getSpotlightCoupon(tenantId);
    if (!coupon) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: coupon });
  } catch (error) {
    logger.error('[coupons] Failed to get spotlight coupon:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to get spotlight coupon' });
  }
});

// ====================
// ADMIN ENDPOINT (auth required)
// ====================

/**
 * GET /api/admin/coupon-analytics
 * Cross-tenant coupon analytics for platform admin dashboard.
 */
router.get('/admin/coupon-analytics', authenticateToken, async (req, res) => {
  try {
    const data = await getAdminCouponAnalytics();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('[coupon-analytics] Failed to get admin analytics:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch admin analytics' });
  }
});

export default router;
