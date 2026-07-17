/**
 * Abandoned Cart Routes
 *
 * Merchant: GET  /api/tenants/:tenantId/abandoned-carts
 * Merchant: GET  /api/tenants/:tenantId/abandoned-carts/summary
 * Merchant: POST /api/tenants/:tenantId/abandoned-carts/:cartId/resend
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { abandonedCartService } from '../services/AbandonedCartService';

const router = Router();

router.get('/:tenantId/abandoned-carts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { converted, recoveryEmailSent, limit, offset } = req.query;

    const options: any = {};
    if (converted !== undefined) options.converted = converted === 'true';
    if (recoveryEmailSent !== undefined) options.recoveryEmailSent = recoveryEmailSent === 'true';
    if (limit) options.limit = parseInt(limit as string, 10);
    if (offset) options.offset = parseInt(offset as string, 10);

    const { carts, total } = await abandonedCartService.getAbandonedCarts(tenantId, options);
    res.json({ success: true, carts, total });
  } catch (error) {
    console.error('Error fetching abandoned carts:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch abandoned carts' });
  }
});

router.get('/:tenantId/abandoned-carts/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const summary = await abandonedCartService.getSummary(tenantId);
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error fetching abandoned cart summary:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch summary' });
  }
});

router.post('/:tenantId/abandoned-carts/:cartId/resend', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, cartId } = req.params;

    const { carts } = await abandonedCartService.getAbandonedCarts(tenantId, { limit: 1000 });
    const cart = carts.find(c => c.id === cartId);
    if (!cart) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Abandoned cart not found' });
    }

    await abandonedCartService.resetRecoveryEmailState(cartId);

    const sent = await abandonedCartService.sendRecoveryEmail(cartId);
    if (sent) {
      res.json({ success: true, message: 'Recovery email sent' });
    } else {
      res.status(400).json({ success: false, error: 'email_failed', message: 'Failed to send recovery email (cart may be converted, already sent, or no email on file)' });
    }
  } catch (error) {
    console.error('Error resending abandoned cart recovery email:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to send recovery email' });
  }
});

export default router;
