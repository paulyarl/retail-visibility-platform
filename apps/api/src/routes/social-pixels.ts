/**
 * Social Pixels Routes
 * Phase 2C: Social Pixels & Conversion Tracking
 *
 * - GET  /api/social-pixels/public/:tenantId  — public pixel IDs (for storefront injection)
 * - GET  /api/social-pixels/:tenantId         — full config (merchant/admin)
 * - PUT  /api/social-pixels/:tenantId         — update pixel config
 */

import { Router } from 'express';
import { socialPixelService } from '../services/SocialPixelService';
import { logger } from '../logger';

const router = Router();

/**
 * Get public pixel config (no tokens — safe for storefront)
 * GET /api/social-pixels/public/:tenantId
 */
router.get('/social-pixels/public/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const config = await socialPixelService.getPublicPixelConfig(tenantId);
    res.json({
      success: true,
      data: config || { metaPixelId: null, tiktokPixelId: null },
    });
  } catch (error) {
    logger.error('SocialPixels: Error getting public config', undefined, { tenantId: req.params.tenantId, error: String(error) });
    res.status(500).json({ success: false, error: 'get_public_failed' });
  }
});

/**
 * Get full pixel config (includes tokens — merchant/admin only)
 * GET /api/social-pixels/:tenantId
 */
router.get('/social-pixels/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const config = await socialPixelService.getPixelConfig(tenantId);
    res.json({
      success: true,
      data: config || {
        metaPixelId: null,
        metaAccessToken: null,
        tiktokPixelId: null,
        tiktokAccessToken: null,
      },
    });
  } catch (error) {
    logger.error('SocialPixels: Error getting config', undefined, { tenantId: req.params.tenantId, error: String(error) });
    res.status(500).json({ success: false, error: 'get_failed' });
  }
});

/**
 * Update pixel config
 * PUT /api/social-pixels/:tenantId
 */
router.put('/social-pixels/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { metaPixelId, metaAccessToken, tiktokPixelId, tiktokAccessToken } = req.body;

    const config = await socialPixelService.upsertPixelConfig(tenantId, {
      metaPixelId: metaPixelId !== undefined ? metaPixelId : undefined,
      metaAccessToken: metaAccessToken !== undefined ? metaAccessToken : undefined,
      tiktokPixelId: tiktokPixelId !== undefined ? tiktokPixelId : undefined,
      tiktokAccessToken: tiktokAccessToken !== undefined ? tiktokAccessToken : undefined,
    });

    res.json({
      success: true,
      data: config,
      message: 'Pixel configuration saved successfully',
    });
  } catch (error) {
    logger.error('SocialPixels: Error updating config', undefined, { tenantId: req.params.tenantId, error: String(error) });
    res.status(500).json({ success: false, error: 'update_failed' });
  }
});

export default router;
