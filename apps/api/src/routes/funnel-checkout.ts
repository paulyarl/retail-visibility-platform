/**
 * Funnel Checkout Routes (Public)
 *
 * Customer-facing endpoints for resolving and interacting with sales funnels
 * during the checkout flow.
 *
 * Routes:
 *   GET  /api/public/funnels/:tenantId/checkout        — resolve active checkout funnel
 *   POST /api/public/funnels/:tenantId/order-bump    — accept/decline order bump
 *   POST /api/public/funnels/:tenantId/step/:stepId  — accept/decline upsell/downsell/OTO
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

export default router;
