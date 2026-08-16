/**
 * Public Directory Claim Routes
 *
 *   GET  /api/public/directory/claim/:token        — token summary (no auth)
 *   POST /api/public/directory/claim/:token/accept — bind owner (requires auth)
 *
 * The GET is fully public so a business owner can see what listing they'd be
 * claiming before authenticating. The POST requires authentication (customer
 * or platform user) to bind the owner identity.
 */

import { Router, Request, Response } from 'express';
import DirectoryClaimService from '../services/DirectoryClaimService';
import { logger } from '../logger';

const router = Router();

/** GET /api/public/directory/claim/:token — public token summary */
router.get('/claim/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }

    const summary = await DirectoryClaimService.getTokenSummary(token);
    if (!summary) {
      return res.status(404).json({ error: 'token_not_found' });
    }

    // Don't expose tenant_id in the public summary
    res.json({
      success: true,
      summary: {
        seedId: summary.seedId,
        businessName: summary.businessName,
        category: summary.category,
        city: summary.city,
        state: summary.state,
        address: summary.address,
        phone: summary.phone,
        snapEbtReported: summary.snapEbtReported,
        isExpired: summary.isExpired,
        isConsumed: summary.isConsumed,
        expiresAt: summary.expiresAt,
        consumedAt: summary.consumedAt,
      },
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/claim/:token] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/public/directory/claim/:token/accept — bind owner (requires auth) */
router.post('/claim/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }

    // Auth: the caller must be authenticated. We accept both customer JWT
    // and platform user auth. The middleware that sets req.user or
    // req.customer should have run before this route.
    const userId =
      (req as any).user?.id ||
      (req as any).customer?.id ||
      null;

    if (!userId) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const result = await DirectoryClaimService.acceptClaim(token, userId, {
      actorType: 'customer',
      actorId: userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        invalid_token: 404,
        token_expired: 410,
        already_claimed: 409,
      };
      return res.status(statusMap[result.message] || 400).json({
        error: result.message,
      });
    }

    res.json({
      success: true,
      tenantId: result.tenantId,
      seedId: result.seedId,
      message: 'claimed',
    });
  } catch (error) {
    logger.error('[POST /api/public/directory/claim/:token/accept] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
