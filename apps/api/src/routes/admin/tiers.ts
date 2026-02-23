/**
 * Admin Tiers API Routes
 * 
 * Provides endpoints for managing platform tiers
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requirePlatformAdmin } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/admin/tiers/list
 * List all available tiers for ticker targeting
 * Permission: Platform admin only
 */
router.get('/list', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN TIERS LIST] Request received from platform admin');

    // Return the available tiers in the system
    // These should match the subscription tiers in your database
    const tiers = [
      'FREE',
      'BASIC', 
      'PROFESSIONAL',
      'ENTERPRISE',
      'CUSTOM'
    ];

    res.json(tiers);
  } catch (error: any) {
    console.error('[ADMIN TIERS LIST] Error fetching tier list:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch tier list',
    });
  }
});

export default router;
