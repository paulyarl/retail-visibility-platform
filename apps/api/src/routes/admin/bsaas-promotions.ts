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
import { audit } from '../../audit';
import CouponTargetService from '../../services/CouponTargetService';
import { prisma } from '../../prisma';
import { unifiedConfig } from '../../config/unifiedConfig';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

function getStripe(): Stripe | null {
  const key = unifiedConfig.stripeSecretKey;
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
  target_features: z.array(z.string()).nullable().optional(),
  target_tiers: z.array(z.string()).nullable().optional(),
  target_capability_types: z.array(z.string()).nullable().optional(),
  target_tier_types: z.array(z.string()).nullable().optional(),
  target_demo_status: z.array(z.string()).nullable().optional(),
  target_subscription_statuses: z.array(z.string()).nullable().optional(),
}).refine(data => data.percent_off || data.amount_off, {
  message: 'Either percent_off or amount_off is required',
});

const updateTargetsSchema = z.object({
  target_features: z.array(z.string()).nullable().optional(),
  target_tiers: z.array(z.string()).nullable().optional(),
  target_capability_types: z.array(z.string()).nullable().optional(),
  target_tier_types: z.array(z.string()).nullable().optional(),
  target_demo_status: z.array(z.string()).nullable().optional(),
  target_subscription_statuses: z.array(z.string()).nullable().optional(),
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

    // Fetch all target rules in one query
    const targetRules = await prisma.coupon_target_rules.findMany();
    const targetMap = new Map(targetRules.map(r => [r.coupon_id, r]));

    res.json({
      success: true,
      data: {
        coupons: coupons.data.map(c => {
          const rules = targetMap.get(c.id);
          return {
            id: c.id,
            name: c.name,
            percent_off: c.percent_off,
            amount_off: c.amount_off,
            duration: c.duration,
            duration_in_months: c.duration_in_months,
            valid: c.valid,
            created: c.created,
            targets: rules ? {
              target_features: rules.target_features as string[] | null,
              target_tiers: rules.target_tiers as string[] | null,
              target_capability_types: rules.target_capability_types as string[] | null,
              target_tier_types: rules.target_tier_types as string[] | null,
              target_demo_status: rules.target_demo_status as string[] | null,
              target_subscription_statuses: rules.target_subscription_statuses as string[] | null,
            } : null,
          };
        }),
        promotionCodes: promotionCodes.data.map(p => {
          const rules = targetMap.get((p as any).coupon);
          return {
            id: p.id,
            code: p.code,
            coupon_id: (p as any).coupon,
            max_redemptions: p.max_redemptions,
            times_redeemed: p.times_redeemed,
            active: p.active,
            expires_at: p.expires_at,
            created: p.created,
            targets: rules ? {
              target_features: rules.target_features as string[] | null,
              target_tiers: rules.target_tiers as string[] | null,
              target_capability_types: rules.target_capability_types as string[] | null,
              target_tier_types: rules.target_tier_types as string[] | null,
              target_demo_status: rules.target_demo_status as string[] | null,
              target_subscription_statuses: rules.target_subscription_statuses as string[] | null,
            } : null,
          };
        }),
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

    const { percent_off, amount_off, duration, duration_in_months, name,
            target_features, target_tiers, target_capability_types,
            target_tier_types, target_demo_status, target_subscription_statuses } = validation.data;

    const coupon = await stripe.coupons.create({
      name,
      percent_off: percent_off as any,
      amount_off: amount_off as any,
      currency: amount_off ? 'usd' : undefined,
      duration: duration as any,
      duration_in_months: duration === 'repeating' ? duration_in_months : undefined,
    });

    // Store target rules if any were provided
    const hasTargets = target_features || target_tiers || target_capability_types ||
                       target_tier_types || target_demo_status || target_subscription_statuses;
    if (hasTargets) {
      try {
        await CouponTargetService.getInstance().setCouponTargets(coupon.id, {
          target_features: target_features ?? null,
          target_tiers: target_tiers ?? null,
          target_capability_types: target_capability_types ?? null,
          target_tier_types: target_tier_types ?? null,
          target_demo_status: target_demo_status ?? null,
          target_subscription_statuses: target_subscription_statuses ?? null,
        });
      } catch (targetErr: any) {
        console.error('[BSaaS Promotions] Failed to store coupon targets:', targetErr);
      }
    }

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_coupon.create',
      payload: { id: coupon.id, entity_type: 'other', name, percent_off, amount_off, duration, hasTargets },
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

// PUT /api/admin/bsaas-promotions/coupon/:id/targets
router.put('/coupon/:id/targets', async (req: Request, res: Response) => {
  try {
    const validation = updateTargetsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid target rules', details: validation.error.issues });
    }

    const { id } = req.params;
    const targets = validation.data;

    await CouponTargetService.getInstance().setCouponTargets(id, {
      target_features: targets.target_features ?? null,
      target_tiers: targets.target_tiers ?? null,
      target_capability_types: targets.target_capability_types ?? null,
      target_tier_types: targets.target_tier_types ?? null,
      target_demo_status: targets.target_demo_status ?? null,
      target_subscription_statuses: targets.target_subscription_statuses ?? null,
    });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_coupon.update_targets',
      payload: { id, entity_type: 'other', targets },
    });

    res.json({ success: true, message: 'Coupon targets updated' });
  } catch (error: any) {
    console.error('[BSaaS Promotions] Error updating coupon targets:', error);
    res.status(500).json({ error: 'internal_error', message: error.message || 'Failed to update coupon targets' });
  }
});

// GET /api/admin/bsaas-promotions/promotion/:id/qr
// Returns QR code data: deep-link URL, promotion code, coupon targets, and resolved target icon
router.get('/promotion/:id/qr', async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'stripe_not_configured', message: 'Stripe is not configured' });
    }

    const { id } = req.params;

    // Fetch the promotion code from Stripe
    const promoCodes = await stripe.promotionCodes.list({ limit: 100 });
    const promo = promoCodes.data.find(p => p.id === id);
    if (!promo) {
      return res.status(404).json({ error: 'not_found', message: 'Promotion code not found' });
    }

    const couponId = (promo as any).coupon as string;
    const coupon = await stripe.coupons.retrieve(couponId);

    // Fetch coupon target rules
    const targets = await CouponTargetService.getInstance().getTargetsForCoupon(couponId);

    // Resolve target icon
    let targetIcon: { type: string; feature_key: string | null; icon_name: string | null; marketing_name: string } | null = null;

    if (targets?.target_features && targets.target_features.length === 1) {
      const featureKey = targets.target_features[0];
      const feature = await prisma.features_list.findUnique({
        where: { key: featureKey },
        select: { icon_name: true, marketing_name: true, name: true },
      });
      if (feature) {
        targetIcon = {
          type: 'feature',
          feature_key: featureKey,
          icon_name: feature.icon_name || null,
          marketing_name: feature.marketing_name || feature.name || featureKey,
        };
      }
    } else if (targets?.target_features && targets.target_features.length > 1) {
      targetIcon = { type: 'bundle', feature_key: null, icon_name: 'IconPackage', marketing_name: 'Multiple Features' };
    } else if (targets?.target_capability_types && targets.target_capability_types.length > 0) {
      const capType = targets.target_capability_types[0];
      const capIconMap: Record<string, string> = {
        chatbot: 'IconRobot',
        analytics: 'IconChartBar',
        crm: 'IconUsers',
        inventory: 'IconPackage',
        storefront: 'IconStore',
        marketing: 'IconMegaphone',
      };
      const iconName = capIconMap[capType] || 'IconCircle';
      targetIcon = { type: 'capability', feature_key: capType, icon_name: iconName, marketing_name: capType };
    } else if (targets?.target_tiers && targets.target_tiers.length > 0) {
      const tier = targets.target_tiers[0];
      const tierIconMap: Record<string, string> = {
        enterprise: 'IconCrown',
        professional: 'IconStar',
        chain_professional: 'IconStar',
        chain_starter: 'IconBuilding',
        organization: 'IconBuilding2',
        omnichannel: 'IconLayers',
        ecommerce: 'IconShoppingCart',
        commitment: 'IconHandshake',
        storefront: 'IconStore',
        discovery: 'IconCompass',
      };
      const iconName = tierIconMap[tier] || 'IconTag';
      targetIcon = { type: 'tier', feature_key: tier, icon_name: iconName, marketing_name: tier };
    }

    // Construct the deep-link URL
    const appDomain = unifiedConfig.webUrl || (req as any).headers?.origin || 'https://app.visibleshelf.com';
    const qrUrl = `${appDomain}/settings/feature-store?promo=${encodeURIComponent(promo.code)}`;

    res.json({
      success: true,
      data: {
        qr_url: qrUrl,
        promotion_code: promo.code,
        promotion_code_id: promo.id,
        coupon_id: couponId,
        coupon_name: coupon.name,
        percent_off: coupon.percent_off ?? null,
        amount_off: coupon.amount_off ?? null,
        duration: coupon.duration,
        duration_in_months: (coupon as any).duration_in_months ?? null,
        targets: targets ? {
          target_features: targets.target_features as string[] | null,
          target_tiers: targets.target_tiers as string[] | null,
          target_capability_types: targets.target_capability_types as string[] | null,
          target_tier_types: targets.target_tier_types as string[] | null,
          target_demo_status: targets.target_demo_status as string[] | null,
          target_subscription_statuses: targets.target_subscription_statuses as string[] | null,
        } : null,
        target_icon: targetIcon,
      },
    });
  } catch (error: any) {
    console.error('[BSaaS Promotions] Error generating QR data:', error);
    res.status(500).json({ error: 'internal_error', message: error.message || 'Failed to generate QR data' });
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
