/**
 * Funnel Checkout Routes (Public)
 *
 * Customer-facing endpoints for resolving and interacting with sales funnels
 * during the checkout flow.
 *
 * Routes:
 *   GET  /api/public/funnels/:tenantId/checkout            — resolve active checkout funnel
 *   GET  /api/public/funnels/:tenantId/product/:productId — resolve enriched product-page funnel preview
 *   POST /api/public/funnels/:tenantId/preview-event      — track product-page preview click/buy-now events
 *   POST /api/public/funnels/:tenantId/order-bump         — accept/decline order bump
 *   POST /api/public/funnels/:tenantId/step/:stepId       — accept/decline upsell/downsell/OTO
 */

import express from 'express';
import FunnelEngine from '../services/FunnelEngine';
import FunnelAnalyticsService from '../services/FunnelAnalyticsService';
import { logger } from '../logger';

const router = express.Router();

/**
 * GET /api/public/funnels/:tenantId/checkout
 * Resolve the active funnel for a checkout context.
 * Query: triggerProductId, cartValueCents, sessionId, customerId
 */
router.get('/public/funnels/:tenantId/checkout', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const triggerProductId = req.query.triggerProductId as string | undefined;
    const cartValueCents = parseInt(req.query.cartValueCents as string, 10) || 0;
    const sessionId = req.query.sessionId as string | undefined;
    const customerId = req.query.customerId as string | undefined;

    const engine = FunnelEngine.getInstance();
    const funnel = await engine.getCheckoutFunnel(tenantId, triggerProductId, cartValueCents);

    if (!funnel) {
      return res.json({ success: true, funnel: null });
    }

    // Track view for each checkout-visible step
    const analytics = FunnelAnalyticsService.getInstance();
    await Promise.all(
      funnel.steps.map((step) =>
        analytics.trackFunnelEvent({
          tenantId,
          funnelId: funnel.funnel_id,
          stepId: step.id,
          eventType: 'viewed',
          sessionId,
          customerId,
        })
      )
    );

    res.json({ success: true, funnel });
  } catch (error) {
    logger.error('[funnel-checkout] Failed to resolve checkout funnel', undefined, { tenantId: req.params.tenantId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to resolve checkout funnel' });
  }
});

/**
 * POST /api/public/funnels/:tenantId/order-bump
 * Body: { funnelId, stepId, orderId, accepted, sessionId?, customerId? }
 */
router.post('/public/funnels/:tenantId/order-bump', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { funnelId, stepId, orderId, accepted, sessionId, customerId } = req.body;

    if (!funnelId || !stepId || !orderId || typeof accepted !== 'boolean') {
      return res.status(400).json({ error: 'funnelId, stepId, orderId, and accepted are required' });
    }

    const engine = FunnelEngine.getInstance();
    const result = await engine.processOrderBump(
      tenantId,
      funnelId,
      stepId,
      orderId,
      accepted,
      sessionId,
      customerId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[funnel-checkout] Failed to process order bump', undefined, { tenantId: req.params.tenantId, error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message || 'Failed to process order bump' });
  }
});

/**
 * POST /api/public/funnels/:tenantId/step/:stepId
 * Body: { funnelId, orderId, accepted, sessionId?, customerId? }
 */
router.post('/public/funnels/:tenantId/step/:stepId', async (req, res) => {
  try {
    const { tenantId, stepId } = req.params;
    const { funnelId, orderId, accepted, sessionId, customerId } = req.body;

    if (!funnelId || !orderId || typeof accepted !== 'boolean') {
      return res.status(400).json({ error: 'funnelId, orderId, and accepted are required' });
    }

    const engine = FunnelEngine.getInstance();
    const result = await engine.processUpsellStep(
      tenantId,
      funnelId,
      stepId,
      orderId,
      accepted,
      sessionId,
      customerId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[funnel-checkout] Failed to process funnel step', undefined, { tenantId: req.params.tenantId, stepId: req.params.stepId, error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message || 'Failed to process funnel step' });
  }
});

/**
 * GET /api/public/funnels/:tenantId/product/:productId
 * Resolve an enriched product-page funnel preview for a specific product.
 * Query: sessionId, customerId
 */
router.get('/public/funnels/:tenantId/product/:productId', async (req, res) => {
  try {
    const { tenantId, productId } = req.params;
    const sessionId = req.query.sessionId as string | undefined;
    const customerId = req.query.customerId as string | undefined;

    const engine = FunnelEngine.getInstance();
    const funnel = await engine.getProductFunnelPreview(tenantId, productId);

    if (!funnel) {
      return res.json({ success: true, funnel: null });
    }

    // Track a preview_viewed event for each step displayed
    const analytics = FunnelAnalyticsService.getInstance();
    await Promise.all(
      funnel.steps.map((step) =>
        analytics.trackFunnelEvent({
          tenantId,
          funnelId: funnel.funnel_id,
          stepId: step.id,
          eventType: 'preview_viewed',
          sessionId,
          customerId,
          productId,
        })
      )
    );

    res.json({ success: true, funnel });
  } catch (error) {
    logger.error('[funnel-checkout] Failed to resolve product funnel preview', undefined, { tenantId: req.params.tenantId, productId: req.params.productId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to resolve product funnel preview' });
  }
});

/**
 * POST /api/public/funnels/:tenantId/preview-event
 * Track product-page funnel preview interactions (step click / buy now).
 * Body: { funnelId, stepId, eventType, productId, sessionId?, customerId? }
 */
router.post('/public/funnels/:tenantId/preview-event', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { funnelId, stepId, eventType, productId, sessionId, customerId } = req.body;

    const allowedTypes = ['preview_step_clicked', 'preview_buy_now_clicked'];
    if (!funnelId || !eventType || !allowedTypes.includes(eventType)) {
      return res.status(400).json({ error: 'funnelId, eventType and a valid preview event type are required' });
    }

    const analytics = FunnelAnalyticsService.getInstance();
    await analytics.trackFunnelEvent({
      tenantId,
      funnelId,
      stepId,
      eventType,
      sessionId,
      customerId,
      productId,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[funnel-checkout] Failed to track preview event', undefined, { tenantId: req.params.tenantId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to track preview event' });
  }
});

export default router;
