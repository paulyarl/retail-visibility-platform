/**
 * Gallery Short Code Resolution API
 * Dedicated endpoint for resolving a 6-char gallery short code to the
 * underlying preview token + token type. Used by the /g/[shortCode]
 * short URL redirect page (mirrors the /s/[autoId] coupon pattern).
 *
 * Public endpoint — no auth required. The short code is an opaque,
 * high-entropy lookup key (32^6 ≈ 1B space, curated alphabet with no
 * ambiguous chars).
 */

import { Router } from 'express';
import { MarketingDeliverableService } from '../services/MarketingDeliverableService';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/gallery-code/:shortCode
 * Resolve a 6-char gallery short code to { token, tokenType }.
 *
 * tokenType drives the redirect target:
 *   - 'diagnostic_gallery'        → /preview/{token}
 *   - 'multi_diagnostic_gallery'  → /preview/{token}?prospect=true
 *
 * Expired tokens return 404 (do not leak existence vs. expiry).
 */
router.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    if (!shortCode || !/^[A-Za-z0-9]{4,8}$/.test(shortCode)) {
      return res.status(404).json({ success: false, error: 'Gallery link not found' });
    }

    const resolved = await MarketingDeliverableService.getInstance().resolveShortCode(shortCode);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Gallery link not found' });
    }

    return res.json({
      success: true,
      data: {
        token: resolved.token,
        tokenType: resolved.tokenType,
        isMultiGallery: resolved.tokenType === 'multi_diagnostic_gallery',
      },
    });
  } catch (error) {
    logger.error('[GALLERY CODE] Failed to resolve short code:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ success: false, error: 'Failed to resolve gallery link' });
  }
});

export default router;
