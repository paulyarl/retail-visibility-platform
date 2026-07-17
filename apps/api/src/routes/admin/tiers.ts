/**
 * Admin Tiers API Routes
 * 
 * Provides endpoints for managing platform tiers
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { logger } from '../../logger';

const router = Router();

/**
 * GET /api/admin/tiers/list
 * List all available tiers for ticker targeting
 * Permission: Platform admin only
 */
router.get('/list', authenticateToken, async (req: Request, res: Response) => {
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
    logger.error('[ADMIN TIERS LIST] Error fetching tier list:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch tier list',
    });
  }
});

export default router;
