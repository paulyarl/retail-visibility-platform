/**
 * Returns Portal Routes
 * Phase 4B: Customer Returns Portal
 *
 * - POST /api/public/returns                — customer creates return request
 * - GET  /api/public/returns/order/:orderId — customer views returns for an order
 * - GET  /api/tenants/:tenantId/returns     — merchant lists return requests
 * - GET  /api/tenants/:tenantId/returns/:id — merchant views a return request
 * - PUT  /api/tenants/:tenantId/returns/:id/approve — merchant approves
 * - PUT  /api/tenants/:tenantId/returns/:id/reject  — merchant rejects
 * - PUT  /api/tenants/:tenantId/returns/:id/complete — merchant completes
 * - GET  /api/tenants/:tenantId/returns/summary     — merchant summary
 */

import { Router } from 'express';
import { returnRequestService } from '../services/ReturnRequestService';
import { logger } from '../logger';

const router = Router();

/**
 * Customer creates a return request (public endpoint)
 */
router.post('/public/returns', async (req, res) => {
  try {
    const { tenantId, orderId, customerEmail, customerName, reason, reasonDetail, items, customerNotes } = req.body;

    if (!tenantId || !orderId || !customerEmail || !reason || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'tenantId, orderId, customerEmail, reason, and items are required',
      });
    }

    const returnRequest = await returnRequestService.createRequest({
      tenantId,
      orderId,
      customerEmail,
      customerName,
      reason,
      reasonDetail,
      items,
      customerNotes,
    });

    res.json({ success: true, data: returnRequest });
  } catch (error) {
    logger.error('Create return request error', undefined, { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ success: false, error: 'order_not_found', message: 'Order not found' });
    }
    res.status(500).json({ success: false, error: 'create_failed', message: 'Failed to create return request' });
  }
});

/**
 * Customer views returns for an order (public endpoint)
 */
router.get('/public/returns/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_tenantId', message: 'tenantId is required' });
    }

    const requests = await returnRequestService.getRequestsByOrder(tenantId, orderId);
    res.json({ success: true, data: requests });
  } catch (error) {
    logger.error('Get returns by order error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'fetch_failed', message: 'Failed to fetch returns' });
  }
});

/**
 * Merchant lists return requests
 */
router.get('/:tenantId/returns', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { status, limit, offset } = req.query;

    const result = await returnRequestService.getRequests(tenantId, {
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('List returns error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'fetch_failed', message: 'Failed to fetch returns' });
  }
});

/**
 * Merchant summary stats
 */
router.get('/:tenantId/returns/summary', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const summary = await returnRequestService.getSummary(tenantId);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Returns summary error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'summary_failed', message: 'Failed to get summary' });
  }
});

/**
 * Merchant views a single return request
 */
router.get('/:tenantId/returns/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const request = await returnRequestService.getRequest(tenantId, id);

    if (!request) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Return request not found' });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    logger.error('Get return error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'fetch_failed', message: 'Failed to fetch return' });
  }
});

/**
 * Merchant approves a return request
 */
router.put('/:tenantId/returns/:id/approve', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { adminNotes } = req.body;
    const approvedBy = (req as any).user?.sub || 'system';

    const result = await returnRequestService.approveRequest(tenantId, id, approvedBy, adminNotes);

    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Return request not found or already processed' });
    }

    res.json({ success: true, message: 'Return request approved' });
  } catch (error) {
    logger.error('Approve return error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'approve_failed', message: 'Failed to approve return' });
  }
});

/**
 * Merchant rejects a return request
 */
router.put('/:tenantId/returns/:id/reject', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { adminNotes } = req.body;

    const result = await returnRequestService.rejectRequest(tenantId, id, adminNotes);

    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Return request not found or already processed' });
    }

    res.json({ success: true, message: 'Return request rejected' });
  } catch (error) {
    logger.error('Reject return error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'reject_failed', message: 'Failed to reject return' });
  }
});

/**
 * Merchant completes a return (refund processed)
 */
router.put('/:tenantId/returns/:id/complete', async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const result = await returnRequestService.completeRequest(tenantId, id);

    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Return request not found or not approved' });
    }

    res.json({ success: true, message: 'Return completed' });
  } catch (error) {
    logger.error('Complete return error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'complete_failed', message: 'Failed to complete return' });
  }
});

export default router;
