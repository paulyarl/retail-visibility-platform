/**
 * Deposit Forfeiture API Routes
 * 
 * Handles deposit forfeiture processing for Tier 3 commitment orders:
 * - Scheduled job endpoint for processing forfeitures
 * - Pickup deadline status checks
 * - Forfeiture statistics
 */

import { Router, Request, Response } from 'express';
import { depositForfeitureService } from '../services/DepositForfeitureService';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

/**
 * POST /api/deposit-forfeiture/process
 * Process all eligible deposit forfeitures
 * 
 * This endpoint should be called by a scheduled job (cron)
 * Protected by admin authentication
 */
router.post('/process', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[DepositForfeitureAPI] Processing forfeitures...');
    
    const result = await depositForfeitureService.processForfeitures();
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[DepositForfeitureAPI] Error processing forfeitures:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'forfeiture_processing_failed',
      message: 'Failed to process deposit forfeitures',
    });
  }
});

/**
 * GET /api/deposit-forfeiture/order/:orderId/status
 * Get pickup deadline status for an order
 */
router.get('/order/:orderId/status', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    const status = await depositForfeitureService.getPickupDeadlineStatus(orderId);
    
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    logger.error('[DepositForfeitureAPI] Error getting deadline status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'status_check_failed',
      message: 'Failed to get pickup deadline status',
    });
  }
});

/**
 * GET /api/deposit-forfeiture/tenant/:tenantId/stats
 * Get forfeiture statistics for a tenant
 * Protected by tenant authentication
 */
router.get('/tenant/:tenantId/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Validate tenant access
    const user = (req as any).user;
    if (user.tenant_id !== tenantId && user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: 'You do not have access to this tenant\'s statistics',
      });
    }
    
    const stats = await depositForfeitureService.getForfeitureStats(
      tenantId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    logger.error('[DepositForfeitureAPI] Error getting forfeiture stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'stats_retrieval_failed',
      message: 'Failed to get forfeiture statistics',
    });
  }
});

/**
 * POST /api/deposit-forfeiture/order/:orderId/process
 * Manually process forfeiture for a specific order
 * Protected by admin authentication
 */
router.post('/order/:orderId/process', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    const result = await depositForfeitureService.processForfeiture(orderId);
    
    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'not_eligible',
        message: 'Order is not eligible for forfeiture processing',
      });
    }
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[DepositForfeitureAPI] Error processing forfeiture:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'forfeiture_processing_failed',
      message: 'Failed to process deposit forfeiture',
    });
  }
});

export default router;
