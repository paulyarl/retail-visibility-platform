/**
 * Product Queue Routes
 * Express.js routes for queue management with Universal Singleton integration
 */

import { Router } from 'express';
import { productQueueService } from '../lib/services/ProductQueueService';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/queue/:tenantId/stats
 * Get queue statistics for a tenant
 */
router.get('/:tenantId/stats', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const queueStats = await productQueueService.getQueueStats(tenantId);
    return res.json({ success: true, data: queueStats });
  } catch (error) {
    logger.error('Queue stats GET error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json(
      { success: false, error: 'Failed to fetch queue stats' }
    );
  }
});

/**
 * GET /api/queue/:tenantId
 * Get queue items for a tenant
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { includeCompleted, status, limit, priority } = req.query;

    // Set tenant context for RLS
    // process.env.POSTGRES_OPTIONS = `-c app.current_tenant_id=${tenantId}`;

    if (status) {
      // Return items by status
      const items = await productQueueService.getItemsByStatus(tenantId, status as any);
      return res.json({ success: true, data: items });
    }

    if (priority) {
      // Return items by priority
      const queue = await productQueueService.getTenantQueue(tenantId, includeCompleted === 'true');
      const items = queue.filter((item: any) => item.priority === priority);
      return res.json({ success: true, data: items });
    }

    // Return full queue
    const queue = await productQueueService.getTenantQueue(tenantId, includeCompleted === 'true');
    
    let items = queue;
    if (limit) {
      items = queue.slice(0, parseInt(limit as string));
    }

    return res.json({ 
      success: true, 
      data: items,
      total: queue.length,
      hasMore: limit ? queue.length > parseInt(limit as string) : false
    });

  } catch (error) {
    logger.error('Queue GET error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json(
      { success: false, error: 'Failed to fetch queue data' }
    );
  }
});

/**
 * POST /api/queue/:tenantId
 * Add item to queue
 */
router.post('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body as {
      productData: any;
      priority?: 'normal' | 'high' | 'urgent';
      sessionId?: string;
      userAgent?: string;
      source?: 'wizard' | 'import' | 'bulk';
    };

    const { 
      productData, 
      priority = 'normal' as 'normal' | 'high' | 'urgent',
      sessionId,
      userAgent,
      source = 'wizard' as 'wizard' | 'import' | 'bulk'
    } = body;

    if (!productData) {
      return res.status(400).json(
        { success: false, error: 'Product data is required' }
      );
    }

    // Set tenant context for RLS
    // process.env.POSTGRES_OPTIONS = `-c app.current_tenant_id=${tenantId}`;

    const result = await productQueueService.addToQueue(tenantId, {
      productData,
      priority,
      sessionId,
      userAgent,
      source
    });

    return res.json({ success: true, data: result });

  } catch (error) {
    logger.error('Queue POST error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json(
      { success: false, error: 'Failed to add item to queue' }
    );
  }
});

/**
 * DELETE /api/queue/:tenantId
 * Clear queue for a tenant
 */
router.delete('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Set tenant context for RLS
    // process.env.POSTGRES_OPTIONS = `-c app.current_tenant_id=${tenantId}`;

    const result = await productQueueService.clearQueue(tenantId);

    return res.json({ success: true, data: result });

  } catch (error) {
    logger.error('Queue DELETE error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json(
      { success: false, error: 'Failed to clear queue' }
    );
  }
});

export default router;
