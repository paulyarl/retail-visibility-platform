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
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { BsaasAnalyticsService } from '../../services/BsaasAnalyticsService';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/bsaas-analytics
router.get('/', async (req: Request, res: Response) => {
  try {
    const analytics = await BsaasAnalyticsService.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('[BSaaS Analytics] Error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch analytics' });
  }
});

export default router;
