/**
 * Shipping Rates Routes
 * Phase 4A: Real-Time Shipping Rates (EasyPost)
 *
 * - POST /api/shipping/rates  — get real-time shipping rates
 * - GET  /api/shipping/flat-rate/:tenantId — get tenant flat rate
 */

import { Router } from 'express';
import { shippingRateService } from '../services/ShippingRateService';
import { logger } from '../logger';

const router = Router();

/**
 * Get real-time shipping rates from EasyPost
 */
router.post('/shipping/rates', async (req, res) => {
  try {
    const { tenantId, toAddress, fromAddress, parcel } = req.body;

    if (!tenantId || !toAddress || !parcel) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'tenantId, toAddress, and parcel are required',
      });
    }

    const rates = await shippingRateService.getRates({
      tenantId,
      toAddress,
      fromAddress,
      parcel,
    });

    res.json({ success: true, data: { rates } });
  } catch (error) {
    logger.error('Shipping rates error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'rates_failed', message: 'Failed to get shipping rates' });
  }
});

/**
 * Get tenant-configured flat rate
 */
router.get('/shipping/flat-rate/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const flatRate = await shippingRateService.getFlatRate(tenantId);

    res.json({ success: true, data: flatRate });
  } catch (error) {
    logger.error('Flat rate error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'flat_rate_failed', message: 'Failed to get flat rate' });
  }
});

export default router;
