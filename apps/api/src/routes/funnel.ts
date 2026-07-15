/**
 * Funnel Routes (Tenant)
 *
 * Authenticated CRUD for tenant sales funnels plus analytics summaries.
 *
 * Routes:
 *   GET  /api/tenants/:tenantId/funnels
 *   POST /api/tenants/:tenantId/funnels
 *   GET  /api/tenants/:tenantId/funnels/:funnelId
 *   PUT  /api/tenants/:tenantId/funnels/:funnelId
 *   DELETE /api/tenants/:tenantId/funnels/:funnelId
 *   GET  /api/tenants/:tenantId/funnels/:funnelId/analytics
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth';
import FunnelService from '../services/FunnelService';
import FunnelAnalyticsService from '../services/FunnelAnalyticsService';
import { logger } from '../logger';

const router = express.Router();

/**
 * GET /api/tenants/:tenantId/funnels
 */
router.get('/tenants/:tenantId/funnels', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const includeInactive = req.query.includeInactive === 'true';
    const service = FunnelService.getInstance();
    const funnels = await service.listFunnels(tenantId, includeInactive);
    res.json({ success: true, funnels });
  } catch (error) {
    logger.error('[funnel] Failed to list funnels', undefined, { tenantId: req.params.tenantId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to list funnels' });
  }
});

/**
 * POST /api/tenants/:tenantId/funnels
 */
router.post('/tenants/:tenantId/funnels', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const service = FunnelService.getInstance();
    const funnel = await service.createFunnel(tenantId, req.body);
    res.status(201).json({ success: true, funnel });
  } catch (error) {
    logger.error('[funnel] Failed to create funnel', undefined, { tenantId: req.params.tenantId, error: (error as Error).message });
    res.status(400).json({ error: (error as Error).message || 'Failed to create funnel' });
  }
});

/**
 * GET /api/tenants/:tenantId/funnels/:funnelId
 */
router.get('/tenants/:tenantId/funnels/:funnelId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, funnelId } = req.params;
    const service = FunnelService.getInstance();
    const funnel = await service.getFunnel(tenantId, funnelId);

    if (!funnel) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    res.json({ success: true, funnel });
  } catch (error) {
    logger.error('[funnel] Failed to get funnel', undefined, { tenantId: req.params.tenantId, funnelId: req.params.funnelId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to get funnel' });
  }
});

/**
 * PUT /api/tenants/:tenantId/funnels/:funnelId
 */
router.put('/tenants/:tenantId/funnels/:funnelId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, funnelId } = req.params;
    const service = FunnelService.getInstance();
    const funnel = await service.updateFunnel(tenantId, funnelId, req.body);
    res.json({ success: true, funnel });
  } catch (error) {
    logger.error('[funnel] Failed to update funnel', undefined, { tenantId: req.params.tenantId, funnelId: req.params.funnelId, error: (error as Error).message });
    res.status(400).json({ error: (error as Error).message || 'Failed to update funnel' });
  }
});

/**
 * DELETE /api/tenants/:tenantId/funnels/:funnelId
 */
router.delete('/tenants/:tenantId/funnels/:funnelId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, funnelId } = req.params;
    const service = FunnelService.getInstance();
    await service.deleteFunnel(tenantId, funnelId);
    res.json({ success: true });
  } catch (error) {
    logger.error('[funnel] Failed to delete funnel', undefined, { tenantId: req.params.tenantId, funnelId: req.params.funnelId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to delete funnel' });
  }
});

/**
 * GET /api/tenants/:tenantId/funnels/:funnelId/analytics
 */
router.get('/tenants/:tenantId/funnels/:funnelId/analytics', authenticateToken, async (req, res) => {
  try {
    const { tenantId, funnelId } = req.params;
    const analytics = FunnelAnalyticsService.getInstance();
    const [summary, steps, timeseries] = await Promise.all([
      analytics.getDashboard(tenantId, funnelId),
      analytics.getStepConversion(tenantId, funnelId),
      analytics.getTimeSeries(tenantId, funnelId, 30),
    ]);

    res.json({
      success: true,
      summary: summary[0] || null,
      steps,
      timeseries,
    });
  } catch (error) {
    logger.error('[funnel] Failed to get analytics', undefined, { tenantId: req.params.tenantId, funnelId: req.params.funnelId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to get funnel analytics' });
  }
});

export default router;
