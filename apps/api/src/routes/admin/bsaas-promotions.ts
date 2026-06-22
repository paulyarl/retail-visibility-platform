/**
 * BSaaS Promotions Admin Routes
 *
 * Admin endpoints for creating and managing Stripe Coupons + Promotion Codes
 * that can be applied at BSaaS checkout.
 *
 * Mounted at: /api/admin/bsaas-promotions
 *
 * GET    /              — List all coupons + promotion codes
 * POST   /coupon        — Create a Stripe coupon
 * POST   /promotion     — Create a Stripe promotion code for an existing coupon
 * DELETE /promotion/:id — Deactivate a promotion code
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { audit } from '../../audit';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2023-10-16' as any });
}

// ====================
// Validation Schemas
// ====================

const createCouponSchema = z.object({
  percent_off: z.number().min(1).max(100).optional(),
  amount_off: z.number().int().positive().optional(),
  duration: z.enum(['once', 'repeating', 'forever']).default('once'),
  duration_in_months: z.number().int().min(1).optional(),
  name: z.string().min(1).max(100),
}).refine(data => data.percent_off || data.amount_off, {
  message: 'Either percent_off or amount_off is required',
});

const createPromotionCodeSchema = z.object({
  coupon_id: z.string().min(1),
  code: z.string().min(1).max(100).optional(),
  max_redemptions: z.number().int().min(1).optional(),
  expires_at: z.string().datetime().optional(),
});

// ====================
// Routes
// ====================

// GET /api/admin/bsaas-promotions
router.get('/', async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'stripe_not_configured', message: 'Stripe is not configured' });
    }

    const [coupons, promotionCodes] = await Promise.all([
      stripe.coupons.list({ limit: 100 }),
      stripe.promotionCodes.list({ limit: 100 }),
    ]);

    res.json({
      success: true,
      data: {
        coupons: coupons.data.map(c => ({
          id: c.id,
          name: c.name,
          percent_off: c.percent_off,
          amount_off: c.amount_off,
          duration: c.duration,
          duration_in_months: c.duration_in_months,
          valid: c.valid,
          created: c.created,
        })),
        promotionCodes: promotionCodes.data.map(p => ({
          id: p.id,
          code: p.code,
          coupon_id: (p as any).coupon,
          max_redemptions: p.max_redemptions,
          times_redeemed: p.times_redeemed,
          active: p.active,
          expires_at: p.expires_at,
          created: p.created,
        })),
      },
    });
  } catch (error: any) {
    console.error('[BSaaS Promotions] Error listing:', error);
    res.status(500).json({ error: 'internal_error', message: error.message || 'Failed to list promotions' });
  }
});

// POST /api/admin/bsaas-promotions/coupon
router.post('/coupon', async (req: Request, res: Response) => {
  try {
    const validation = createCouponSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid coupon', details: validation.error.issues });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'stripe_not_configured', message: 'Stripe is not configured' });
    }

    const { percent_off, amount_off, duration, duration_in_months, name } = validation.data;

    const coupon = await stripe.coupons.create({
      name,
      percent_off: percent_off as any,
      amount_off: amount_off as any,
      currency: amount_off ? 'usd' : undefined,
      duration: duration as any,
      duration_in_months: duration === 'repeating' ? duration_in_months : undefined,
    });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_coupon.create',
      payload: { id: coupon.id, entity_type: 'other', name, percent_off, amount_off, duration },
    });

    res.status(201).json({ success: true, data: coupon });
  } catch (error: any) {
    console.error('[BSaaS Promotions] Error creating coupon:', error);
    res.status(500).json({ error: 'internal_error', message: error.message || 'Failed to create coupon' });
  }
});

// POST /api/admin/bsaas-promotions/promotion
router.post('/promotion', async (req: Request, res: Response) => {
  try {
    const validation = createPromotionCodeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid promotion code', details: validation.error.issues });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'stripe_not_configured', message: 'Stripe is not configured' });
    }

    const { coupon_id, code, max_redemptions, expires_at } = validation.data;

    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon_id as any,
      code: code || undefined,
      max_redemptions: max_redemptions || undefined,
      expires_at: expires_at ? Math.floor(new Date(expires_at).getTime() / 1000) : undefined,
    } as any);

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_promotion.create',
      payload: { id: promotionCode.id, entity_type: 'other', coupon_id, code: promotionCode.code },
    });

    res.status(201).json({ success: true, data: promotionCode });
  } catch (error: any) {
    console.error('[BSaaS Promotions] Error creating promotion code:', error);
    res.status(500).json({ error: 'internal_error', message: error.message || 'Failed to create promotion code' });
  }
});

// DELETE /api/admin/bsaas-promotions/promotion/:id
router.delete('/promotion/:id', async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'stripe_not_configured', message: 'Stripe is not configured' });
    }

    const { id } = req.params;
    const promotionCode = await stripe.promotionCodes.update(id, { active: false });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_promotion.deactivate',
      payload: { id, entity_type: 'other', code: promotionCode.code },
    });

    res.json({ success: true, message: 'Promotion code deactivated' });
  } catch (error: any) {
    console.error('[BSaaS Promotions] Error deactivating promotion code:', error);
    res.status(500).json({ error: 'internal_error', message: error.message || 'Failed to deactivate promotion code' });
  }
});

export default router;
