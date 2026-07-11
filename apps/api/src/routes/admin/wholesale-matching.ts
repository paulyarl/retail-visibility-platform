/**
 * Admin Wholesale Matching Routes
 *
 * Mounted at /api/admin/wholesale via admin.routes.ts
 * Auth: authenticateToken + requireAdmin at mount level
 */

import { Router } from 'express';
import wholesaleMatchingService from '../../services/WholesaleMatchingService';

const router = Router();

// GET /suppliers — admin supplier dashboard
router.get('/suppliers', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const result = await wholesaleMatchingService.getAllSuppliers(
      limit ? parseInt(limit as string, 10) : 50,
      offset ? parseInt(offset as string, 10) : 0
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list suppliers',
    });
  }
});

// GET /affiliate/analytics — affiliate click analytics
router.get('/affiliate/analytics', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const analytics = await wholesaleMatchingService.getAffiliateAnalytics(
      tenantId ? String(tenantId) : undefined
    );
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analytics',
    });
  }
});

export default router;
