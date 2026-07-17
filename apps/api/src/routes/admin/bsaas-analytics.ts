/**
 * BSaaS Analytics Admin Routes
 *
 * Read-only admin endpoints for BSaaS revenue and usage metrics.
 *
 * Mounted at: /api/admin/bsaas-analytics
 *
 * GET  /  — Get full analytics (summary + per-feature + recent purchases)
 */

import { Router, Request, Response } from 'express';
import { BsaasAnalyticsService } from '../../services/BsaasAnalyticsService';
import { logger } from '../../logger';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

// GET /api/admin/bsaas-analytics
router.get('/', async (req: Request, res: Response) => {
  try {
    const analytics = await BsaasAnalyticsService.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('[BSaaS Analytics] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch analytics' });
  }
});

export default router;
