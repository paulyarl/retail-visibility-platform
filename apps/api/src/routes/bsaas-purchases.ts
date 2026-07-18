/**
 * BSaaS Feature Purchase Routes (tenant-facing)
 *
 * Self-service endpoints for tenants to browse and purchase à la carte
 * features (bot skills, external embed, CRM add-ons) using saved payment
 * methods. Reuses SubscriptionBillingService for payment processing.
 *
 * Mounted at: /api/subscription (via subscription-billing.ts)
 *
 * GET    /feature-catalog              — Browse purchasable features
 * GET    /feature-purchases            — List tenant's active purchases
 * POST   /feature-purchase             — Purchase a feature
 * POST   /feature-purchase/:id/cancel  — Cancel a purchase
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/role-validation';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { getBillingNotificationService } from '../services/subscription/BillingNotificationService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import BotKnowledgeEmbeddingService from '../services/BotKnowledgeEmbeddingService';
import CrmAlertService from '../services/CrmAlertService';
import CouponTargetService, { CouponTargets, CouponTargetContext } from '../services/CouponTargetService';
import { audit } from '../audit';
import { unifiedConfig } from '../config/unifiedConfig';
import { verifyGrantToken, isGrantTokenExpired } from '../services/GrantTokenService';
import { generateGrantClaimId } from '../lib/id-generator';

const router = Router();

router.use(authenticateToken);
router.use(requirePermission('CAN_MANAGE_TENANT_BILLING'));

/**
 * Fetch a single catalog entry from the bsaas_catalog table.
 * Returns null if the feature is not in the catalog or is inactive.
 */
async function getCatalogEntry(featureKey: string): Promise<{
  feature_key: string;
  marketing_name: string | null;
  description: string | null;
  price_cents: number;
  billing_cycle: string;
  trial_days: number;
  trial_eligible: boolean;
  demo_eligible: boolean;
} | null> {
  const entry = await prisma.bsaas_catalog.findFirst({
    where: { feature_key: featureKey, is_active: true },
  });
  if (!entry) return null;
  return {
    feature_key: entry.feature_key,
    marketing_name: entry.marketing_name,
    description: entry.description,
    price_cents: entry.price_cents,
    billing_cycle: entry.billing_cycle,
    trial_days: entry.trial_days,
    trial_eligible: entry.trial_eligible,
    demo_eligible: entry.demo_eligible,
  };
}

// ====================
// Promo Code Validation Helper
// ====================

interface PromoValidationResult {
  promotionCodeId: string;
  couponId: string;
  discountCents: number;
  chargedAmount: number;
  couponDuration: 'once' | 'repeating' | 'forever';
  couponDurationInMonths: number | null;
  couponPercentOff: number | null;
  couponAmountOff: number | null;
  targets: CouponTargets | null;
}

type PromoValidation = PromoValidationResult | { error: string; message: string };

/**
 * Validate a Stripe promotion code, calculate discount, and check coupon targeting rules.
 * Shared by individual feature purchase and bundle purchase handlers.
 * Returns coupon duration/percent_off/amount_off for Phase 2 renewal logic.
 * Returns targets for Phase 3 QR icon embedding.
 */
async function validatePromoCode(
  promotionCode: string,
  priceCents: number,
  context: CouponTargetContext
): Promise<PromoValidation> {
  try {
    const stripeKey = unifiedConfig.stripeSecretKey;
    if (!stripeKey) {
      return { error: 'stripe_not_configured', message: 'Promo codes require Stripe' };
    }
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

    const promoCodes = await stripe.promotionCodes.list({ code: promotionCode, active: true, limit: 1 });
    if (promoCodes.data.length === 0) {
      return { error: 'invalid_promo_code', message: 'Invalid or expired promotion code' };
    }

    const promo = promoCodes.data[0];
    if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
      return { error: 'promo_expired', message: 'This promotion code has reached its usage limit' };
    }
    if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
      return { error: 'promo_expired', message: 'This promotion code has expired' };
    }

    const promotionCodeId = promo.id;
    const coupon = await stripe.coupons.retrieve((promo as any).coupon);
    const couponId = coupon.id;

    let discountCents = 0;
    if (coupon.percent_off) {
      discountCents = Math.round(priceCents * coupon.percent_off / 100);
    } else if (coupon.amount_off) {
      discountCents = Math.min(coupon.amount_off, priceCents);
    }
    const chargedAmount = Math.max(0, priceCents - discountCents);

    // Validate coupon targets against the purchase context
    const targetResult = await CouponTargetService.getInstance().validateCouponTargets(couponId, context);
    if (!targetResult.valid) {
      return { error: targetResult.reason || 'coupon_target_mismatch', message: 'This promo code is not valid for this purchase context' };
    }

    // Fetch targets for the coupon (for Phase 3 QR icon embedding)
    const targets = await CouponTargetService.getInstance().getTargetsForCoupon(couponId);

    return {
      promotionCodeId,
      couponId,
      discountCents,
      chargedAmount,
      couponDuration: coupon.duration as 'once' | 'repeating' | 'forever',
      couponDurationInMonths: (coupon as any).duration_in_months ?? null,
      couponPercentOff: coupon.percent_off ?? null,
      couponAmountOff: coupon.amount_off ?? null,
      targets,
    };
  } catch (err: any) {
    return { error: 'invalid_promo_code', message: 'Failed to validate promotion code' };
  }
}

/**
 * Map capability_type key to the parent-gate feature key that controls the master "enabled" flag.
 * When a tenant purchases a sub-feature whose capability type has a parent gate,
 * we auto-create a zero-cost companion purchase for the parent gate so the resolver
 * sees it as enabled. Without this, purchasing e.g. chatbot_skill_crm_assistant on a
 * tier without chatbot_enabled would charge the tenant but produce no effective capability.
 */
const PARENT_GATE_FEATURES: Record<string, string> = {
  chatbot_options: 'chatbot_enabled',
  crm_options: 'crm_enabled',
  social_commerce_options: 'social_commerce_enabled',
  storefront_options: 'storefront_opt_enabled',
  quickstart_options: 'quickstart_enabled',
  fulfillment_options: 'fulfillment_enabled',
  payment_gateway_options: 'payment_gateway_enabled',
  featured_options: 'featured_enabled',
  faq_options: 'faq_enabled',
  barcode_scan_options: 'barcode_enabled',
  directory_entry: 'directory_entry_enabled',
  directory_promotion: 'directory_promotion_enabled',
  organization_options: 'org_enabled',
  integration_options: 'integration_enabled',
};

/**
 * Ensure the parent-gate feature for a capability type is active for the tenant.
 * If the tier already includes it, no companion is needed.
 * If not, creates a zero-cost companion purchase (source='companion', no expiry).
 */
async function ensureCompanionPurchase(
  tenantId: string,
  capabilityKey: string | null,
  purchasedFeatureKey: string
): Promise<void> {
  if (!capabilityKey) return;
  const parentFeatureKey = PARENT_GATE_FEATURES[capabilityKey];
  if (!parentFeatureKey) return;

  // Check if parent gate is already in tier
  const parentTierStatus = await checkTierFeatureStatus(tenantId, parentFeatureKey);
  if (parentTierStatus.inTier) return; // Tier already provides the gate — no companion needed

  // Check if there's already an active companion or real purchase for the parent gate
  const existing = await prisma.tenant_feature_purchases.findUnique({
    where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: parentFeatureKey } },
  });
  if (existing && ['active', 'past_due', 'trial'].includes(existing.status)) return;

  // Create zero-cost companion purchase
  await prisma.tenant_feature_purchases.upsert({
    where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: parentFeatureKey } },
    update: {
      source: 'companion',
      status: 'active',
      expires_at: null,
      metadata: {
        companion_for: purchasedFeatureKey,
        price_cents: 0,
        created_reason: 'auto_companion_parent_gate',
      },
      updated_at: new Date(),
    },
    create: {
      tenant_id: tenantId,
      feature_key: parentFeatureKey,
      source: 'companion',
      status: 'active',
      expires_at: null,
      metadata: {
        companion_for: purchasedFeatureKey,
        price_cents: 0,
        created_reason: 'auto_companion_parent_gate',
      },
    },
  });

  console.log(`[BSaaS] Created companion purchase for ${parentFeatureKey} (companion to ${purchasedFeatureKey}) for tenant ${tenantId}`);
}

/**
 * When a real (non-companion) purchase is cancelled, check if any other active
 * real purchases remain for the same capability type. If none remain, cancel the
 * companion purchase for the parent gate too.
 */
async function maybeCancelCompanion(
  tenantId: string,
  cancelledFeatureKey: string
): Promise<void> {
  // Find the capability type for the cancelled feature
  const cancelledFeature = await prisma.features_list.findUnique({
    where: { key: cancelledFeatureKey },
    select: { id: true },
  });
  if (!cancelledFeature) return;

  const capLink = await prisma.capability_features_list.findFirst({
    where: { feature_id: cancelledFeature.id },
    include: { capability_type_list: { select: { key: true } } },
  });
  const capabilityKey = capLink?.capability_type_list?.key;
  if (!capabilityKey) return;

  const parentFeatureKey = PARENT_GATE_FEATURES[capabilityKey];
  if (!parentFeatureKey) return;

  // Check if any other active real (non-companion) purchases exist for features
  // in the same capability type
  const capFeatureLinks = await prisma.capability_features_list.findMany({
    where: { capability_type_id: capLink.capability_type_id },
    select: { feature_id: true },
  });
  const capFeatureIds = capFeatureLinks.map(l => l.feature_id);
  const capFeatures = await prisma.features_list.findMany({
    where: { id: { in: capFeatureIds } },
    select: { key: true },
  });
  const capFeatureKeys = capFeatures.map(f => f.key);

  // Exclude the cancelled feature and the parent gate itself from the check
  const otherFeatureKeys = capFeatureKeys.filter(k => k !== cancelledFeatureKey && k !== parentFeatureKey);
  if (otherFeatureKeys.length === 0) return;

  const activeRealPurchases = await prisma.tenant_feature_purchases.findMany({
    where: {
      tenant_id: tenantId,
      feature_key: { in: otherFeatureKeys },
      status: { in: ['active', 'past_due', 'trial'] },
      source: { not: 'companion' },
    },
  });

  if (activeRealPurchases.length === 0) {
    // No other real purchases — cancel the companion
    await prisma.tenant_feature_purchases.updateMany({
      where: {
        tenant_id: tenantId,
        feature_key: parentFeatureKey,
        source: 'companion',
        status: { in: ['active', 'past_due'] },
      },
      data: {
        status: 'cancelled',
        updated_at: new Date(),
      },
    });
    console.log(`[BSaaS] Cancelled companion purchase for ${parentFeatureKey} (no remaining real purchases) for tenant ${tenantId}`);
  }
}

/**
 * Check whether the tenant's tier already grants at least one feature within the same
 * capability type as the given feature key. This is the "active capability engagement" rule:
 * a merchant can purchase a feature à la carte only if their tier already engages them in
 * that capability domain (i.e., they have at least one other feature in the same type).
 *
 * Returns { eligible: true } if the tier has at least one feature in the capability type,
 * or { eligible: false, reason } if not (meaning the merchant needs a tier upgrade first).
 */
async function checkCapabilityEngagement(
  tenantId: string,
  featureKey: string
): Promise<{ eligible: boolean; reason: string | null; capabilityKey: string | null }> {
  // 1. Find the feature and its capability type
  const feature = await prisma.features_list.findUnique({
    where: { key: featureKey },
    select: { id: true },
  });
  if (!feature) {
    return { eligible: false, reason: 'Feature not found', capabilityKey: null };
  }

  const capLink = await prisma.capability_features_list.findFirst({
    where: { feature_id: feature.id },
    include: { capability_type_list: { select: { key: true, id: true } } },
  });
  if (!capLink?.capability_type_list) {
    // No capability type association — allow purchase (standalone feature)
    return { eligible: true, reason: null, capabilityKey: null };
  }

  const capabilityKey = capLink.capability_type_list.key;
  const capabilityTypeId = capLink.capability_type_list.id;

  // 2. Get tenant's tier(s)
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: {
      subscription_tier: true,
      organization_id: true,
      organizations_list: { select: { subscription_tier: true } },
    },
  });
  if (!tenant) {
    return { eligible: false, reason: 'Tenant not found', capabilityKey };
  }

  const tierKeys = [tenant.subscription_tier, tenant.organizations_list?.subscription_tier]
    .filter((k): k is string => !!k);
  if (tierKeys.length === 0) {
    return { eligible: false, reason: 'No subscription tier assigned', capabilityKey };
  }

  const tiers = await prisma.subscription_tiers_list.findMany({
    where: { tier_key: { in: tierKeys } },
    select: { id: true },
  });
  const tierIds = tiers.map(t => t.id);

  // 3. Check if the tenant's tier has ANY feature in the same capability type
  const tierFeaturesInCapType = await prisma.tier_features_list.findMany({
    where: {
      tier_id: { in: tierIds },
      capability_type_id: capabilityTypeId,
      is_enabled: true,
    },
    select: { feature_key: true },
  });

  if (tierFeaturesInCapType.length === 0) {
    return {
      eligible: false,
      reason: `Your current plan doesn't include any features in the ${capabilityKey.replace(/_options$/, '').replace(/_/g, ' ')} category. Upgrade your plan to unlock this feature.`,
      capabilityKey,
    };
  }

  // 4. Check if the capability type is explicitly disabled (all enabled features are _disabled keys)
  const hasNonDisabledFeature = tierFeaturesInCapType.some(
    tf => !tf.feature_key.endsWith('_disabled')
  );
  if (!hasNonDisabledFeature) {
    return {
      eligible: false,
      reason: `The ${capabilityKey.replace(/_options$/, '').replace(/_/g, ' ')} capability is explicitly disabled for your plan.`,
      capabilityKey,
    };
  }

  return { eligible: true, reason: null, capabilityKey };
}

/**
 * Check capability engagement for all features in a bundle.
 * Returns { eligible: true } if the tenant's tier has ≥1 feature in EVERY
 * capability type represented by the bundle's component features.
 */
async function checkBundleEngagement(
  tenantId: string,
  featureKeys: string[]
): Promise<{ eligible: boolean; failedDomains: Array<{ capabilityKey: string; reason: string }> }> {
  const results = await Promise.all(
    featureKeys.map(fk => checkCapabilityEngagement(tenantId, fk))
  );
  const failedDomains = results
    .filter(r => !r.eligible && r.capabilityKey)
    .map(r => ({ capabilityKey: r.capabilityKey!, reason: r.reason! }));
  return { eligible: failedDomains.length === 0, failedDomains };
}

/**
 * Helper to get tenant ID from request
 */
function getTenantId(req: Request): string | null {
  return (
    req.query.tenantId as string ||
    req.params.tenantId ||
    req.body?.tenantId ||
    req.headers['x-tenant-id'] as string ||
    (req as any).user?.tenantId ||
    null
  );
}

/**
 * Map capability_type key to the merchant settings table + master toggle column.
 * Used to check if the tenant has disabled a capability domain via merchant gate.
 */
const MERCHANT_GATE_MAP: Record<string, { table: string; toggleColumn: string }> = {
  chatbot_options: { table: 'tenant_chatbot_options_settings', toggleColumn: 'chatbot_enabled' },
  crm_options: { table: 'tenant_crm_options_settings', toggleColumn: 'crm_enabled' },
  social_commerce_options: { table: 'tenant_social_commerce_options_settings', toggleColumn: 'social_commerce_enabled' },
};

/**
 * Check whether a feature is already enabled by the tenant's tier,
 * and if so, whether the merchant gate for its capability domain is on or off.
 * Returns guidance so the frontend can show "Included in your plan" or
 * "Enabled by tier but turned off in settings" instead of a purchase button.
 */
async function checkTierFeatureStatus(
  tenantId: string,
  featureKey: string
): Promise<{ inTier: boolean; merchantGateOn: boolean | null; capabilityKey: string | null }> {
  // 1. Get tenant's tier(s)
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: {
      subscription_tier: true,
      organization_id: true,
      organizations_list: { select: { subscription_tier: true } },
    },
  });
  if (!tenant) return { inTier: false, merchantGateOn: null, capabilityKey: null };

  const tierKeys = [tenant.subscription_tier, tenant.organizations_list?.subscription_tier]
    .filter((k): k is string => !!k);
  if (tierKeys.length === 0) return { inTier: false, merchantGateOn: null, capabilityKey: null };

  const tiers = await prisma.subscription_tiers_list.findMany({
    where: { tier_key: { in: tierKeys } },
    select: { id: true },
  });
  const tierIds = tiers.map(t => t.id);

  // 2. Check if the feature is explicitly in any of the tenant's tier features
  const tierFeature = await prisma.tier_features_list.findFirst({
    where: {
      tier_id: { in: tierIds },
      feature_key: featureKey,
      is_enabled: true,
    },
    include: { capability_type_list: { select: { key: true } } },
  });

  let capabilityKey: string | null = tierFeature?.capability_type_list?.key || null;

  // 3. If not an explicit tier feature, check type gate precedence and flexible expansion from all sources:
  //    Type gate precedence (R17 in capability-data-flow-rules.md):
  //      1. {capability_key}_disabled → OFF (highest priority)
  //      2. {capability_key}_enabled → ON (explicit enable)
  //      3. {capability_key}_flexible → ON (flexible expansion)
  //      4. Individual features → ON (implicit enable)
  //      5. Else → OFF (default disabled)
  //    Flexible expansion sources:
  //      - Tier-bundled: {capability_key}_flexible in tier_features_list
  //      - Purchased: {capability_key}_flexible in tenant_feature_purchases
  //      - Admin grant: {capability_key}_flexible in tenant_feature_overrides_list
  //    This mirrors the MV's flexible_tier_features, flexible_purchase_features,
  //    and flexible_override_features CTEs.
  //    IMPORTANT: Look up the actual flexible and type gate keys from capability_features_list
  //    instead of guessing the naming convention (e.g., chatbot_flexible vs chatbot_options_flexible).
  //    Note: Group gate keys now use _on/_off, eliminating naming ambiguity with type gates.
  if (!tierFeature) {
    // Resolve the feature's capability type
    const feature = await prisma.features_list.findUnique({
      where: { key: featureKey },
      select: { id: true },
    });
    if (!feature) return { inTier: false, merchantGateOn: null, capabilityKey: null };

    const capLink = await prisma.capability_features_list.findFirst({
      where: { feature_id: feature.id },
      include: { capability_type_list: { select: { key: true, id: true } } },
    });
    if (!capLink?.capability_type_list) {
      return { inTier: false, merchantGateOn: null, capabilityKey: null };
    }

    capabilityKey = capLink.capability_type_list.key;
    const capabilityTypeId = capLink.capability_type_list.id;

    // Look up type gate keys (_disabled, _enabled) for this capability type
    const typeGateFeatures = await prisma.capability_features_list.findMany({
      where: {
        capability_type_id: capabilityTypeId,
        is_active: true,
        features_list: { is_active: true },
      },
      include: {
        features_list: {
          select: { key: true },
        },
      },
    });

    const disabledKey = typeGateFeatures
      .find(f => f.features_list?.key === `${capabilityKey}_disabled`)
      ?.features_list?.key;
    const enabledKey = typeGateFeatures
      .find(f => f.features_list?.key === `${capabilityKey}_enabled`)
      ?.features_list?.key;

    // Check type gate precedence: _disabled > _enabled
    const disabledTierFeature = disabledKey ? await prisma.tier_features_list.findFirst({
      where: {
        tier_id: { in: tierIds },
        feature_key: disabledKey,
        is_enabled: true,
      },
    }) : null;

    if (disabledTierFeature) {
      // Capability is disabled at type level — feature is not in-tier
      return { inTier: false, merchantGateOn: null, capabilityKey };
    }

    const enabledTierFeature = enabledKey ? await prisma.tier_features_list.findFirst({
      where: {
        tier_id: { in: tierIds },
        feature_key: enabledKey,
        is_enabled: true,
      },
    }) : null;

    // If _enabled is present, proceed with feature-level checks (no special handling needed)
    // If neither _disabled nor _enabled, proceed to flexible expansion check

    // Look up the actual flexible feature key for this capability type
    const flexibleFeature = await prisma.capability_features_list.findFirst({
      where: {
        capability_type_id: capabilityTypeId,
        is_active: true,
        features_list: {
          is_active: true,
          key: { endsWith: '_flexible' },
        },
      },
      include: {
        features_list: {
          select: { key: true },
        },
      },
    });

    const flexibleKey = flexibleFeature?.features_list?.key;
    if (!flexibleKey) {
      return { inTier: false, merchantGateOn: null, capabilityKey: null };
    }

    // Check tier-bundled flexible
    const flexibleTierFeature = await prisma.tier_features_list.findFirst({
      where: {
        tier_id: { in: tierIds },
        feature_key: flexibleKey,
        is_enabled: true,
      },
    });

    // Check purchased flexible
    const flexiblePurchase = await prisma.tenant_feature_purchases.findFirst({
      where: {
        tenant_id: tenantId,
        feature_key: flexibleKey,
        status: { in: ['active', 'past_due', 'trial'] },
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
    });

    // Check admin-granted flexible
    const flexibleOverride = await prisma.tenant_feature_overrides_list.findFirst({
      where: {
        tenant_id: tenantId,
        feature: flexibleKey,
        granted: true,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
    });

    if (!flexibleTierFeature && !flexiblePurchase && !flexibleOverride) {
      return { inTier: false, merchantGateOn: null, capabilityKey: null };
    }
    // Feature is in-tier via flexible expansion (from any source)
  }

  // 4. Check merchant gate for the capability domain
  let merchantGateOn: boolean | null = null;
  if (capabilityKey && MERCHANT_GATE_MAP[capabilityKey]) {
    const gateInfo = MERCHANT_GATE_MAP[capabilityKey];
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT ${gateInfo.toggleColumn} as enabled FROM ${gateInfo.table} WHERE tenant_id = $1`,
        tenantId
      ) as any[];
      merchantGateOn = rows.length > 0 ? rows[0].enabled === true : true;
    } catch {
      merchantGateOn = null; // table may not exist — assume no gate
    }
  }

  return { inTier: true, merchantGateOn, capabilityKey };
}

// ====================
// Feature Catalog
// ====================

// GET /api/subscription/feature-catalog
router.get('/feature-catalog', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    // Build catalog from bsaas_catalog table + features_list for display names
    // Private features are not visible to merchants in the Feature Store
    const catalogEntries = await prisma.bsaas_catalog.findMany({
      where: { is_active: true, is_private: false },
      orderBy: { sort_order: 'asc' },
    });

    const featureKeys = catalogEntries.map(e => e.feature_key);
    const features = await prisma.features_list.findMany({
      where: { key: { in: featureKeys }, is_active: true },
      select: { id: true, key: true, name: true, description: true, category: true },
    });
    const featureMap = new Map(features.map(f => [f.key, f]));

    // Fetch capability type for each feature via capability_features_list
    const capLinks = await prisma.capability_features_list.findMany({
      where: { feature_id: { in: features.map(f => f.id || '') }, is_active: true },
      include: { capability_type_list: { select: { key: true } } },
    });
    const featureIdToCapKey = new Map<string, string>();
    for (const link of capLinks) {
      if (link.capability_type_list?.key) {
        featureIdToCapKey.set(link.feature_id, link.capability_type_list.key);
      }
    }
    // Also build a feature-key → capability-key map for convenience
    const featureKeyToCapKey = new Map<string, string>();
    for (const f of features) {
      const capKey = featureIdToCapKey.get(f.id || '');
      if (capKey) featureKeyToCapKey.set(f.key, capKey);
    }

    const catalog = catalogEntries
      .filter(entry => featureMap.has(entry.feature_key))
      .filter(entry => !entry.feature_key.endsWith('_enabled') && !entry.feature_key.endsWith('_disabled'))
      .map(entry => {
        const f = featureMap.get(entry.feature_key)!;
        return {
          key: entry.feature_key,
          name: entry.marketing_name || f.name,
          description: entry.description || f.description || '',
          category: f.category,
          capabilityType: featureKeyToCapKey.get(entry.feature_key) || null,
          priceCents: entry.price_cents,
          billingCycle: entry.billing_cycle as 'one_time' | 'weekly' | 'monthly' | 'annual',
          trialDays: entry.trial_days,
          trialEligible: entry.trial_eligible,
          demoEligible: entry.demo_eligible,
        };
      });

    // Fetch tenant's current purchases to show status
    const purchases = await prisma.tenant_feature_purchases.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['active', 'past_due', 'trial', 'suspended'] },
      },
      select: {
        id: true,
        feature_key: true,
        status: true,
        expires_at: true,
        source: true,
      },
    });

    const purchaseMap = new Map(purchases.map(p => [p.feature_key, p]));

    // Check tier status for each catalog item (batch)
    const tierStatusPromises = catalog.map(item => checkTierFeatureStatus(tenantId, item.key));
    const tierStatuses = await Promise.all(tierStatusPromises);

    // Check capability engagement eligibility for each catalog item (batch)
    const engagementPromises = catalog.map(item => checkCapabilityEngagement(tenantId, item.key));
    const engagementResults = await Promise.all(engagementPromises);

    const catalogWithStatus = catalog.map((item, i) => {
      const tierStatus = tierStatuses[i];
      const engagement = engagementResults[i];
      let tierAvailability: 'not_in_tier' | 'in_tier_active' | 'in_tier_gate_off' = 'not_in_tier';
      if (tierStatus.inTier) {
        tierAvailability = tierStatus.merchantGateOn === false ? 'in_tier_gate_off' : 'in_tier_active';
      }
      return {
        ...item,
        purchase: purchaseMap.get(item.key) || null,
        tierAvailability,
        tierCapabilityKey: tierStatus.capabilityKey,
        tierEligible: engagement.eligible,
        ineligibleReason: engagement.reason,
      };
    });

    res.json({ success: true, data: catalogWithStatus });
  } catch (error: any) {
    logger.error('[BSaaS] Error fetching feature catalog:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch feature catalog' });
  }
});

// ====================
// Bundle Catalog
// ====================

// GET /api/subscription/bundle-catalog
router.get('/bundle-catalog', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const bundles = await prisma.bsaas_bundles.findMany({
      where: { is_active: true, is_private: false },
      orderBy: { sort_order: 'asc' },
      include: { bsaas_bundle_items: { orderBy: { sort_order: 'asc' } } },
    });

    // Fetch tenant's current purchases
    const purchases = await prisma.tenant_feature_purchases.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['active', 'past_due', 'trial', 'suspended'] },
      },
      select: { feature_key: true, status: true, source: true },
    });
    const purchaseKeys = new Set(purchases.map(p => p.feature_key));

    const bundleData = await Promise.all(
      bundles.map(async (bundle) => {
        const featureKeys = bundle.bsaas_bundle_items.map(i => i.feature_key);
        const engagement = await checkBundleEngagement(tenantId, featureKeys);

        // Check if all components are already active
        const allActive = featureKeys.every(fk => purchaseKeys.has(fk));

        // Check tier status for each component
        const tierStatuses = await Promise.all(
          featureKeys.map(fk => checkTierFeatureStatus(tenantId, fk))
        );
        const allInTier = tierStatuses.every(ts => ts.inTier);

        return {
          bundleKey: bundle.bundle_key,
          name: bundle.marketing_name,
          description: bundle.description || '',
          priceCents: bundle.price_cents,
          billingCycle: bundle.billing_cycle as 'one_time' | 'weekly' | 'monthly' | 'annual',
          trialDays: bundle.trial_days,
          trialEligible: bundle.trial_eligible,
          demoEligible: bundle.demo_eligible,
          items: featureKeys.map((fk, i) => ({
            featureKey: fk,
            name: bundle.bsaas_bundle_items[i]?.feature_key || fk,
            inTier: tierStatuses[i].inTier,
            alreadyPurchased: purchaseKeys.has(fk),
          })),
          tierEligible: engagement.eligible,
          ineligibleReason: engagement.eligible
            ? null
            : engagement.failedDomains.map(d => d.reason).join(' '),
          ineligibleDomains: engagement.failedDomains.map(d => d.capabilityKey),
          allActive,
          allInTier,
        };
      })
    );

    res.json({ success: true, data: bundleData });
  } catch (error: any) {
    logger.error('[BSaaS] Error fetching bundle catalog:', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch bundle catalog' });
  }
});

// ====================
// List Tenant Purchases
// ====================

// GET /api/subscription/feature-purchases
router.get('/feature-purchases', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const purchases = await prisma.tenant_feature_purchases.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        feature_key: true,
        status: true,
        source: true,
        expires_at: true,
        metadata: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json({ success: true, data: purchases });
  } catch (error: any) {
    logger.error('[BSaaS] Error listing purchases:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to list purchases' });
  }
});

// ====================
// Purchase a Feature
// ====================

const purchaseSchema = z.object({
  featureKey: z.string().min(1),
  paymentMethodId: z.string().optional(),
  promotionCode: z.string().optional(),
  tenantId: z.string().optional(),
});

// POST /api/subscription/feature-purchase
router.post('/feature-purchase', async (req: Request, res: Response) => {
  try {
    const validation = purchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const tenantId = validation.data.tenantId || (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const { featureKey, paymentMethodId, promotionCode } = validation.data;

    // 1. Verify feature exists and is in the BSaaS catalog
    const feature = await prisma.features_list.findUnique({
      where: { key: featureKey },
    });
    if (!feature || !feature.is_active) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Feature not found' });
    }

    const catalogEntry = await getCatalogEntry(featureKey);
    if (!catalogEntry) {
      return res.status(400).json({ success: false, error: 'not_purchasable', message: 'This feature is not available for self-service purchase' });
    }

    const priceCents = catalogEntry.price_cents;
    const billingCycle = catalogEntry.billing_cycle;
    const trialDays = catalogEntry.trial_days || 0;
    const trialEligible = catalogEntry.trial_eligible;
    const demoEligible = catalogEntry.demo_eligible;

    // 1b. Check if tenant is a demo tenant and this item is not demo-eligible
    if (!demoEligible) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { is_demo: true },
      });
      if (tenant?.is_demo) {
        return res.status(403).json({
          success: false,
          error: 'demo_tenant_blocked',
          message: 'This feature is not available for demo tenants.',
        });
      }
    }

    // 2. Check for existing active purchase
    const existing = await prisma.tenant_feature_purchases.findUnique({
      where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
    });
    if (existing && ['active', 'past_due', 'trial'].includes(existing.status)) {
      if (existing.status === 'trial') {
        return res.status(409).json({ success: false, error: 'trial_active', message: 'This feature is currently in a trial period for your tenant' });
      }
      return res.status(409).json({ success: false, error: 'already_active', message: 'This feature is already active for your tenant' });
    }

    // 2b. Check if feature is already enabled by the tenant's tier
    const tierStatus = await checkTierFeatureStatus(tenantId, featureKey);
    if (tierStatus.inTier) {
      if (tierStatus.merchantGateOn === false) {
        return res.status(409).json({
          success: false,
          error: 'in_tier_gate_off',
          message: `This feature is included in your subscription tier but appears to be disabled in your settings. Enable it in your Settings page instead of purchasing it again.`,
          capabilityKey: tierStatus.capabilityKey,
        });
      }
      return res.status(409).json({
        success: false,
        error: 'in_tier_already',
        message: 'This feature is already included in your subscription tier — no purchase needed.',
        capabilityKey: tierStatus.capabilityKey,
      });
    }

    // 2c. Check capability engagement — tenant's tier must already have at least one
    // feature in the same capability type to purchase à la carte within that domain
    const engagement = await checkCapabilityEngagement(tenantId, featureKey);
    if (!engagement.eligible) {
      return res.status(403).json({
        success: false,
        error: 'upgrade_required',
        message: engagement.reason || 'Your current plan does not support purchasing this feature. Please upgrade your plan.',
        capabilityKey: engagement.capabilityKey,
      });
    }

    // 2d. For trial branch, also ensure companion purchase
    // (handled after trial creation below)

    // 3. Trial branch: if trial_eligible AND trial_days > 0, create trial purchase without charging
    if (trialEligible && trialDays > 0 && billingCycle !== 'one_time') {
      const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      const purchase = await prisma.tenant_feature_purchases.upsert({
        where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
        update: {
          source: 'bsaas',
          status: 'trial',
          expires_at: trialExpiresAt,
          metadata: {
            price_cents: priceCents,
            billing_cycle: billingCycle,
            trial_days: trialDays,
            trial_started_at: new Date().toISOString(),
            payment_method_id: paymentMethodId || null,
          },
          updated_at: new Date(),
        },
        create: {
          tenant_id: tenantId,
          feature_key: featureKey,
          source: 'bsaas',
          status: 'trial',
          expires_at: trialExpiresAt,
          metadata: {
            price_cents: priceCents,
            billing_cycle: billingCycle,
            trial_days: trialDays,
            trial_started_at: new Date().toISOString(),
            payment_method_id: paymentMethodId || null,
          },
        },
      });

      // Ensure parent-gate companion purchase exists for trial purchases too
      await ensureCompanionPurchase(tenantId, tierStatus.capabilityKey, featureKey);

      invalidateEffectiveCapabilities(tenantId);

      // Refresh bot knowledge embeddings with feature purchase info — fire-and-forget
      (async () => {
        try {
          await BotKnowledgeEmbeddingService.getInstance().refreshFeaturePurchaseEmbeddings(tenantId);
        } catch (err) {
          logger.warn('[BSaaS] Failed to refresh feature purchase embeddings', undefined, { error: (err as Error).message });
        }
      })();

      // CRM alert for App Store trial start — fire-and-forget
      (async () => {
        try {
          await CrmAlertService.getInstance().createAppStoreAlert({
            tenantId,
            featureKey,
            featureName: catalogEntry.marketing_name || featureKey,
            alertType: 'app_store_trial',
            priceCents,
            billingCycle,
            trialDays,
          });
        } catch (err) {
          logger.warn('[BSaaS] Failed to create App Store CRM alert', undefined, { error: (err as Error).message });
        }
      })();

      await audit({
        tenantId,
        actor: (req as any).user?.id || null,
        action: 'feature_purchase.trial_start',
        payload: {
          id: purchase.id,
          entity_type: 'other',
          feature_key: featureKey,
          trial_days: trialDays,
          expires_at: trialExpiresAt.toISOString(),
        },
      });

      const notificationService = getBillingNotificationService();
      notificationService.sendNotification({
        tenantId,
        type: 'bsaas_trial_started',
        amount: priceCents,
        billingCycle: billingCycle as 'weekly' | 'monthly' | 'annual',
        metadata: { featureKey, featureName: feature.name, trialDays },
      }).catch(err => console.error('[BSaaS] Failed to send trial notification:', err));

      return res.json({
        success: true,
        data: {
          purchase_id: purchase.id,
          feature_key: featureKey,
          status: 'trial',
          price_cents: priceCents,
          billing_cycle: billingCycle,
          trial_days: trialDays,
          expires_at: trialExpiresAt,
        },
      });
    }

    // 4. Normal purchase: charge via Stripe using existing billing service
    if (!paymentMethodId) {
      return res.status(400).json({ success: false, error: 'payment_required', message: 'Payment method is required for non-trial purchases' });
    }

    // 4a. Validate promotion code and calculate discount
    let chargedAmount = priceCents;
    let promotionCodeId: string | null = null;
    let discountCents = 0;
    let couponId: string | null = null;
    let couponDuration: 'once' | 'repeating' | 'forever' | null = null;
    let couponDurationInMonths: number | null = null;
    let couponPercentOff: number | null = null;
    let couponAmountOff: number | null = null;

    if (promotionCode) {
      const promoResult = await validatePromoCode(promotionCode, priceCents, { featureKey, tenantId });
      if ('error' in promoResult) {
        const statusCode = promoResult.error === 'stripe_not_configured' ? 503 : 400;
        return res.status(statusCode).json({ success: false, error: promoResult.error, message: promoResult.message });
      }
      promotionCodeId = promoResult.promotionCodeId;
      couponId = promoResult.couponId;
      discountCents = promoResult.discountCents;
      chargedAmount = promoResult.chargedAmount;
      couponDuration = promoResult.couponDuration;
      couponDurationInMonths = promoResult.couponDurationInMonths;
      couponPercentOff = promoResult.couponPercentOff;
      couponAmountOff = promoResult.couponAmountOff;
    }

    const billingService = getSubscriptionBillingService();
    const chargeResult = await billingService.chargePaymentMethod(
      tenantId,
      paymentMethodId,
      chargedAmount,
      `BSaaS: ${feature.name}${promotionCode ? ` (promo: ${promotionCode})` : ''}`
    );

    if (!chargeResult.success) {
      return res.status(402).json({ success: false, error: 'payment_failed', message: chargeResult.error || 'Payment failed' });
    }

    // 4. Create the purchase record
    const expiresAt = billingCycle === 'weekly'
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : billingCycle === 'monthly'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : billingCycle === 'annual'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : null;

    const purchase = await prisma.tenant_feature_purchases.upsert({
      where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
      update: {
        source: 'bsaas',
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          price_cents: priceCents,
          billing_cycle: billingCycle,
          transaction_id: chargeResult.transactionId,
          payment_method_id: paymentMethodId,
          purchased_at: new Date().toISOString(),
          ...(promotionCodeId && {
            promotion_code: promotionCode,
            promotion_code_id: promotionCodeId,
            coupon_id: couponId,
            discount_cents: discountCents,
            charged_amount: chargedAmount,
            coupon_duration: couponDuration,
            coupon_duration_in_months: couponDurationInMonths,
            coupon_percent_off: couponPercentOff,
            coupon_amount_off: couponAmountOff,
            original_price_cents: priceCents,
            renewal_count: 0,
          }),
        },
        updated_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        feature_key: featureKey,
        source: 'bsaas',
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          price_cents: priceCents,
          billing_cycle: billingCycle,
          transaction_id: chargeResult.transactionId,
          payment_method_id: paymentMethodId,
          purchased_at: new Date().toISOString(),
          ...(promotionCodeId && {
            promotion_code: promotionCode,
            promotion_code_id: promotionCodeId,
            coupon_id: couponId,
            discount_cents: discountCents,
            charged_amount: chargedAmount,
            coupon_duration: couponDuration,
            coupon_duration_in_months: couponDurationInMonths,
            coupon_percent_off: couponPercentOff,
            coupon_amount_off: couponAmountOff,
            original_price_cents: priceCents,
            renewal_count: 0,
          }),
        },
      },
    });

    // 4b. Ensure parent-gate companion purchase exists (if capability type has a gate)
    await ensureCompanionPurchase(tenantId, tierStatus.capabilityKey, featureKey);

    // 5. Invalidate capability cache
    invalidateEffectiveCapabilities(tenantId);

    // 5b. Refresh bot knowledge embeddings with feature purchase info — fire-and-forget
    (async () => {
      try {
        await BotKnowledgeEmbeddingService.getInstance().refreshFeaturePurchaseEmbeddings(tenantId);
      } catch (err) {
        logger.warn('[BSaaS] Failed to refresh feature purchase embeddings', undefined, { error: (err as Error).message });
      }
    })();

    // 5c. CRM alert for App Store purchase — fire-and-forget
    (async () => {
      try {
        await CrmAlertService.getInstance().createAppStoreAlert({
          tenantId,
          featureKey,
          featureName: catalogEntry.marketing_name || featureKey,
          alertType: 'app_store_purchase',
          priceCents,
          billingCycle,
        });
      } catch (err) {
        logger.warn('[BSaaS] Failed to create App Store CRM alert', undefined, { error: (err as Error).message });
      }
    })();

    // 5d. If this is a platform service purchase, auto-create fulfillment workflow — fire-and-forget
    if (featureKey.startsWith('platform_service_')) {
      (async () => {
        try {
          const { PlatformServiceFulfillmentService } = await import('../services/PlatformServiceFulfillmentService');
          await PlatformServiceFulfillmentService.getInstance().createFulfillmentWorkflow({
            tenantId,
            featureKey,
            serviceName: catalogEntry.marketing_name || featureKey,
            purchaseId: purchase.id,
            priceCents,
          });
        } catch (err) {
          logger.warn('[BSaaS] Failed to create platform service fulfillment workflow', undefined, { error: (err as Error).message });
        }
      })();
    }

    // 5e. If this is a funnel_builder re-purchase, re-activate paused funnels — fire-and-forget
    if (featureKey === 'funnel_builder') {
      (async () => {
        try {
          const paused = await prisma.tenant_sales_funnels.findMany({
            where: { tenant_id: tenantId, is_active: false },
            select: { id: true },
          });
          if (paused.length > 0) {
            await prisma.tenant_sales_funnels.updateMany({
              where: { tenant_id: tenantId, is_active: false },
              data: { is_active: true, updated_at: new Date() },
            });
            logger.info('[BSaaS] Re-activated paused funnels after re-purchase', undefined, { tenantId, count: paused.length });
          }
        } catch (err) {
          logger.warn('[BSaaS] Failed to re-activate funnels after re-purchase', undefined, { error: (err as Error).message });
        }
      })();
    }

    // 6. Audit log
    await audit({
      tenantId,
      actor: (req as any).user?.id || null,
      action: 'feature_purchase.create',
      payload: {
        id: purchase.id,
        entity_type: 'other',
        feature_key: featureKey,
        price_cents: priceCents,
        billing_cycle: billingCycle,
        transaction_id: chargeResult.transactionId,
      },
    });

    // 7. Send notification (email + CRM alert + CRM task)
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'bsaas_purchase_success',
      amount: priceCents,
      billingCycle: billingCycle as 'weekly' | 'monthly' | 'annual',
      metadata: { featureKey, featureName: feature.name },
    }).catch(err => console.error('[BSaaS] Failed to send purchase notification:', err));

    res.json({
      success: true,
      data: {
        purchase_id: purchase.id,
        feature_key: featureKey,
        status: 'active',
        price_cents: priceCents,
        billing_cycle: billingCycle,
        transaction_id: chargeResult.transactionId,
        expires_at: expiresAt,
      },
    });
  } catch (error: any) {
    logger.error('[BSaaS] Error purchasing feature:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to purchase feature' });
  }
});

// ====================
// Purchase a Bundle
// ====================

const bundlePurchaseSchema = z.object({
  bundleKey: z.string().min(1),
  paymentMethodId: z.string().optional(),
  promotionCode: z.string().optional(),
  tenantId: z.string().optional(),
});

// POST /api/subscription/bundle-purchase
router.post('/bundle-purchase', async (req: Request, res: Response) => {
  try {
    const validation = bundlePurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const tenantId = validation.data.tenantId || (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const { bundleKey, paymentMethodId, promotionCode } = validation.data;

    // 1. Verify bundle exists and is active
    const bundle = await prisma.bsaas_bundles.findUnique({
      where: { bundle_key: bundleKey },
      include: { bsaas_bundle_items: { orderBy: { sort_order: 'asc' } } },
    });
    if (!bundle || !bundle.is_active) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Bundle not found' });
    }

    const featureKeys = bundle.bsaas_bundle_items.map(i => i.feature_key);
    const priceCents = bundle.price_cents;
    const billingCycle = bundle.billing_cycle;
    const trialDays = bundle.trial_days || 0;
    const trialEligible = bundle.trial_eligible;
    const demoEligible = bundle.demo_eligible;

    // 1b. Check if tenant is a demo tenant and this bundle is not demo-eligible
    if (!demoEligible) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { is_demo: true },
      });
      if (tenant?.is_demo) {
        return res.status(403).json({
          success: false,
          error: 'demo_tenant_blocked',
          message: 'This bundle is not available for demo tenants.',
        });
      }
    }

    // 2. Check for existing active purchases of ALL components
    const existingPurchases = await prisma.tenant_feature_purchases.findMany({
      where: {
        tenant_id: tenantId,
        feature_key: { in: featureKeys },
        status: { in: ['active', 'past_due', 'trial'] },
      },
    });
    if (existingPurchases.length === featureKeys.length) {
      return res.status(409).json({ success: false, error: 'already_active', message: 'All components of this bundle are already active for your tenant' });
    }

    // 3. Check capability engagement for ALL components
    const engagement = await checkBundleEngagement(tenantId, featureKeys);
    if (!engagement.eligible) {
      const reasons = engagement.failedDomains.map(d => d.reason).join(' ');
      return res.status(403).json({
        success: false,
        error: 'upgrade_required',
        message: reasons || 'Your current plan does not support purchasing this bundle. Please upgrade your plan.',
        failedDomains: engagement.failedDomains.map(d => d.capabilityKey),
      });
    }

    // 4. Trial branch
    if (trialEligible && trialDays > 0 && billingCycle !== 'one_time') {
      const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      // Create trial purchase for each component feature
      const purchases = await Promise.all(
        featureKeys.map(fk =>
          prisma.tenant_feature_purchases.upsert({
            where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: fk } },
            update: {
              source: 'bsaas_bundle',
              status: 'trial',
              expires_at: trialExpiresAt,
              metadata: {
                bundle_key: bundleKey,
                bundle_name: bundle.marketing_name,
                price_cents: priceCents,
                billing_cycle: billingCycle,
                trial_days: trialDays,
                trial_started_at: new Date().toISOString(),
                payment_method_id: paymentMethodId || null,
              } as any,
              updated_at: new Date(),
            },
            create: {
              tenant_id: tenantId,
              feature_key: fk,
              source: 'bsaas_bundle',
              status: 'trial',
              expires_at: trialExpiresAt,
              metadata: {
                bundle_key: bundleKey,
                bundle_name: bundle.marketing_name,
                price_cents: priceCents,
                billing_cycle: billingCycle,
                trial_days: trialDays,
                trial_started_at: new Date().toISOString(),
                payment_method_id: paymentMethodId || null,
              } as any,
            },
          })
        )
      );

      // Ensure companion purchases for each component's parent gate
      for (const fk of featureKeys) {
        const tierStatus = await checkTierFeatureStatus(tenantId, fk);
        await ensureCompanionPurchase(tenantId, tierStatus.capabilityKey, fk);
      }

      invalidateEffectiveCapabilities(tenantId);

      await audit({
        tenantId,
        actor: (req as any).user?.id || null,
        action: 'bundle_purchase.trial_start',
        payload: {
          entity_type: 'other',
          bundle_key: bundleKey,
          bundle_name: bundle.marketing_name,
          feature_keys: featureKeys,
          trial_days: trialDays,
          expires_at: trialExpiresAt.toISOString(),
        },
      });

      return res.json({
        success: true,
        data: {
          bundle_key: bundleKey,
          status: 'trial',
          price_cents: priceCents,
          billing_cycle: billingCycle,
          trial_days: trialDays,
          expires_at: trialExpiresAt,
          purchase_ids: purchases.map(p => p.id),
        },
      });
    }

    // 5. Normal purchase: charge via Stripe
    if (!paymentMethodId) {
      return res.status(400).json({ success: false, error: 'payment_required', message: 'Payment method is required for non-trial purchases' });
    }

    // 5a. Validate promotion code and calculate discount
    let chargedAmount = priceCents;
    let promotionCodeId: string | null = null;
    let discountCents = 0;
    let couponId: string | null = null;
    let couponDuration: 'once' | 'repeating' | 'forever' | null = null;
    let couponDurationInMonths: number | null = null;
    let couponPercentOff: number | null = null;
    let couponAmountOff: number | null = null;

    if (promotionCode) {
      const promoResult = await validatePromoCode(promotionCode, priceCents, {
        featureKey: featureKeys[0],
        featureKeys,
        tenantId,
        bundleKey,
      });
      if ('error' in promoResult) {
        const statusCode = promoResult.error === 'stripe_not_configured' ? 503 : 400;
        return res.status(statusCode).json({ success: false, error: promoResult.error, message: promoResult.message });
      }
      promotionCodeId = promoResult.promotionCodeId;
      couponId = promoResult.couponId;
      discountCents = promoResult.discountCents;
      chargedAmount = promoResult.chargedAmount;
      couponDuration = promoResult.couponDuration;
      couponDurationInMonths = promoResult.couponDurationInMonths;
      couponPercentOff = promoResult.couponPercentOff;
      couponAmountOff = promoResult.couponAmountOff;
    }

    const billingService = getSubscriptionBillingService();
    const chargeResult = await billingService.chargePaymentMethod(
      tenantId,
      paymentMethodId,
      chargedAmount,
      `BSaaS Bundle: ${bundle.marketing_name}${promotionCode ? ` (promo: ${promotionCode})` : ''}`
    );

    if (!chargeResult.success) {
      return res.status(402).json({ success: false, error: 'payment_failed', message: chargeResult.error || 'Payment failed' });
    }

    // 6. Create purchase records for each component
    const expiresAt = billingCycle === 'weekly'
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : billingCycle === 'monthly'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : billingCycle === 'annual'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : null;

    const purchases = await Promise.all(
      featureKeys.map(fk =>
        prisma.tenant_feature_purchases.upsert({
          where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: fk } },
          update: {
            source: 'bsaas_bundle',
            status: 'active',
            expires_at: expiresAt,
            metadata: {
              bundle_key: bundleKey,
              bundle_name: bundle.marketing_name,
              price_cents: priceCents,
              charged_cents: chargedAmount,
              discount_cents: discountCents || undefined,
              promotion_code: promotionCode || undefined,
              promotion_code_id: promotionCodeId || undefined,
              coupon_id: couponId || undefined,
              coupon_duration: couponDuration || undefined,
              coupon_duration_in_months: couponDurationInMonths || undefined,
              coupon_percent_off: couponPercentOff || undefined,
              coupon_amount_off: couponAmountOff || undefined,
              original_price_cents: priceCents,
              renewal_count: 0,
              billing_cycle: billingCycle,
              transaction_id: chargeResult.transactionId,
              payment_method_id: paymentMethodId,
              purchased_at: new Date().toISOString(),
            } as any,
            updated_at: new Date(),
          },
          create: {
            tenant_id: tenantId,
            feature_key: fk,
            source: 'bsaas_bundle',
            status: 'active',
            expires_at: expiresAt,
            metadata: {
              bundle_key: bundleKey,
              bundle_name: bundle.marketing_name,
              price_cents: priceCents,
              charged_cents: chargedAmount,
              discount_cents: discountCents || undefined,
              promotion_code: promotionCode || undefined,
              promotion_code_id: promotionCodeId || undefined,
              coupon_id: couponId || undefined,
              coupon_duration: couponDuration || undefined,
              coupon_duration_in_months: couponDurationInMonths || undefined,
              coupon_percent_off: couponPercentOff || undefined,
              coupon_amount_off: couponAmountOff || undefined,
              original_price_cents: priceCents,
              renewal_count: 0,
              billing_cycle: billingCycle,
              transaction_id: chargeResult.transactionId,
              payment_method_id: paymentMethodId,
              purchased_at: new Date().toISOString(),
            } as any,
          },
        })
      )
    );

    // 7. Ensure companion purchases for each component's parent gate
    for (const fk of featureKeys) {
      const tierStatus = await checkTierFeatureStatus(tenantId, fk);
      await ensureCompanionPurchase(tenantId, tierStatus.capabilityKey, fk);
    }

    // 8. Invalidate capability cache
    invalidateEffectiveCapabilities(tenantId);

    // 9. Audit log
    await audit({
      tenantId,
      actor: (req as any).user?.id || null,
      action: 'bundle_purchase.create',
      payload: {
        entity_type: 'other',
        bundle_key: bundleKey,
        bundle_name: bundle.marketing_name,
        feature_keys: featureKeys,
        price_cents: priceCents,
        charged_cents: chargedAmount,
        discount_cents: discountCents || undefined,
        promotion_code: promotionCode || undefined,
        coupon_id: couponId || undefined,
        coupon_duration: couponDuration || undefined,
        coupon_duration_in_months: couponDurationInMonths || undefined,
        coupon_percent_off: couponPercentOff || undefined,
        coupon_amount_off: couponAmountOff || undefined,
        billing_cycle: billingCycle,
        transaction_id: chargeResult.transactionId,
        purchase_ids: purchases.map(p => p.id),
      },
    });

    // 10. Send notification
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'bsaas_purchase_success',
      amount: chargedAmount,
      billingCycle: billingCycle as 'weekly' | 'monthly' | 'annual',
      metadata: { bundleKey, bundleName: bundle.marketing_name, featureKeys },
    }).catch(err => console.error('[BSaaS] Failed to send bundle notification:', err));

    // 10b. If bundle includes funnel_builder, re-activate paused funnels — fire-and-forget
    if (featureKeys.includes('funnel_builder')) {
      (async () => {
        try {
          const paused = await prisma.tenant_sales_funnels.findMany({
            where: { tenant_id: tenantId, is_active: false },
            select: { id: true },
          });
          if (paused.length > 0) {
            await prisma.tenant_sales_funnels.updateMany({
              where: { tenant_id: tenantId, is_active: false },
              data: { is_active: true, updated_at: new Date() },
            });
            logger.info('[BSaaS] Re-activated paused funnels after bundle re-purchase', undefined, { tenantId, count: paused.length });
          }
        } catch (err) {
          logger.warn('[BSaaS] Failed to re-activate funnels after bundle re-purchase', undefined, { error: (err as Error).message });
        }
      })();
    }

    res.json({
      success: true,
      data: {
        bundle_key: bundleKey,
        status: 'active',
        price_cents: priceCents,
        charged_cents: chargedAmount,
        discount_cents: discountCents || undefined,
        promotion_code: promotionCode || undefined,
        billing_cycle: billingCycle,
        transaction_id: chargeResult.transactionId,
        expires_at: expiresAt,
        purchase_ids: purchases.map(p => p.id),
      },
    });
  } catch (error: any) {
    logger.error('[BSaaS] Error purchasing bundle:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to purchase bundle' });
  }
});

// ====================
// Validate Promo Code (preview discount without purchasing)
// ====================

const validatePromoSchema = z.object({
  promotionCode: z.string().min(1),
  featureKey: z.string().optional(),
  bundleKey: z.string().optional(),
  priceCents: z.number().int().min(0),
  tenantId: z.string().optional(),
});

// POST /api/subscription/validate-promo
router.post('/validate-promo', async (req: Request, res: Response) => {
  try {
    const validation = validatePromoSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const tenantId = validation.data.tenantId || (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const { promotionCode, featureKey, bundleKey, priceCents } = validation.data;

    const context: CouponTargetContext = {
      featureKey: featureKey || '',
      tenantId,
      ...(bundleKey ? { bundleKey } : {}),
    };

    // If bundle, fetch feature keys for target validation
    if (bundleKey) {
      const bundle = await prisma.bsaas_bundles.findUnique({
        where: { bundle_key: bundleKey },
        include: { bsaas_bundle_items: { select: { feature_key: true } } },
      });
      if (bundle) {
        context.featureKeys = bundle.bsaas_bundle_items.map(i => i.feature_key);
        context.featureKey = context.featureKeys[0] || '';
      }
    }

    const promoResult = await validatePromoCode(promotionCode, priceCents, context);
    if ('error' in promoResult) {
      const statusCode = promoResult.error === 'stripe_not_configured' ? 503 : 400;
      return res.status(statusCode).json({ success: false, error: promoResult.error, message: promoResult.message });
    }

    return res.json({
      success: true,
      data: {
        promotion_code: promotionCode,
        discount_cents: promoResult.discountCents,
        charged_amount: promoResult.chargedAmount,
        original_price_cents: priceCents,
        coupon_id: promoResult.couponId,
        coupon_duration: promoResult.couponDuration,
        coupon_percent_off: promoResult.couponPercentOff,
        coupon_amount_off: promoResult.couponAmountOff,
      },
    });
  } catch (error: any) {
    logger.error('[BSaaS] Error validating promo code:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to validate promo code' });
  }
});

// ====================
// Cancel a Purchase
// ====================

// POST /api/subscription/feature-purchase/:id/cancel
router.post('/feature-purchase/:id/cancel', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const { id } = req.params;

    const purchase = await prisma.tenant_feature_purchases.findUnique({
      where: { id },
    });

    if (!purchase) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Purchase not found' });
    }

    if (purchase.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'This purchase does not belong to your tenant' });
    }

    if (purchase.status === 'cancelled' || purchase.status === 'expired') {
      return res.status(400).json({ success: false, error: 'already_cancelled', message: 'This purchase is already cancelled or expired' });
    }

    // Check if this is a bundle-sourced purchase — if so, cascade cancel all components
    const purchaseMetadata = (purchase.metadata as any) || {};
    const bundleKey = purchaseMetadata.bundle_key;
    let cancelledIds: string[] = [id];
    let cancelledFeatureKeys: string[] = [purchase.feature_key];

    if (bundleKey && purchase.source === 'bsaas_bundle') {
      // Find all other purchases with the same bundle_key for this tenant
      const siblingPurchases = await prisma.tenant_feature_purchases.findMany({
        where: {
          tenant_id: tenantId,
          feature_key: { not: purchase.feature_key },
          status: { in: ['active', 'past_due', 'trial', 'suspended'] },
        },
      });

      const bundleSiblings = siblingPurchases.filter(p => {
        const meta = (p.metadata as any) || {};
        return meta.bundle_key === bundleKey;
      });

      // Cancel all sibling bundle components
      for (const sibling of bundleSiblings) {
        await prisma.tenant_feature_purchases.update({
          where: { id: sibling.id },
          data: {
            status: 'cancelled',
            updated_at: new Date(),
          },
        });
        cancelledIds.push(sibling.id);
        cancelledFeatureKeys.push(sibling.feature_key);

        // Maybe cancel companion for each sibling
        if (sibling.source !== 'companion') {
          await maybeCancelCompanion(tenantId, sibling.feature_key);
        }
      }
    }

    await prisma.tenant_feature_purchases.update({
      where: { id },
      data: {
        status: 'cancelled',
        updated_at: new Date(),
      },
    });

    // 2. If this was a real (non-companion) purchase, maybe cancel the companion
    if (purchase.source !== 'companion') {
      await maybeCancelCompanion(tenantId, purchase.feature_key);
    }

    invalidateEffectiveCapabilities(tenantId);

    // Refresh bot knowledge embeddings to clear stale feature purchase info — fire-and-forget
    (async () => {
      try {
        await BotKnowledgeEmbeddingService.getInstance().refreshFeaturePurchaseEmbeddings(tenantId);
      } catch (err) {
        logger.warn('[BSaaS] Failed to refresh feature purchase embeddings on cancel', undefined, { error: (err as Error).message });
      }
    })();

    // CRM alert for App Store cancellation — fire-and-forget
    (async () => {
      try {
        await CrmAlertService.getInstance().createAppStoreAlert({
          tenantId,
          featureKey: purchase.feature_key,
          featureName: purchase.feature_key,
          alertType: 'app_store_cancel',
        });
      } catch (err) {
        logger.warn('[BSaaS] Failed to create App Store CRM alert on cancel', undefined, { error: (err as Error).message });
      }
    })();

    await audit({
      tenantId,
      actor: (req as any).user?.id || null,
      action: bundleKey ? 'bundle_purchase.cancel' : 'feature_purchase.cancel',
      payload: {
        id,
        entity_type: 'other',
        feature_key: purchase.feature_key,
        previous_status: purchase.status,
        ...(bundleKey ? { bundle_key: bundleKey, cancelled_feature_keys: cancelledFeatureKeys, cancelled_ids: cancelledIds } : {}),
      },
    });

    // Send cancellation notification (email + CRM alert + CRM task)
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'bsaas_purchase_cancelled',
      metadata: bundleKey
        ? { bundleKey, featureKeys: cancelledFeatureKeys }
        : { featureKey: purchase.feature_key },
    }).catch(err => console.error('[BSaaS] Failed to send cancel notification:', err));

    res.json({
      success: true,
      data: {
        purchase_id: id,
        feature_key: purchase.feature_key,
        status: 'cancelled',
        ...(bundleKey ? { bundle_key: bundleKey, cancelled_purchase_ids: cancelledIds } : {}),
      },
    });
  } catch (error: any) {
    logger.error('[BSaaS] Error cancelling purchase:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to cancel purchase' });
  }
});

export { validatePromoCode, type PromoValidationResult, type PromoValidation };

// ====================
// Phase 4: Grant Token Redemption
// ====================

const redeemGrantSchema = z.object({
  grant_token: z.string().min(1),
});

// POST /api/subscription/redeem-grant
router.post('/redeem-grant', async (req: Request, res: Response) => {
  try {
    const validation = redeemGrantSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const { grant_token } = validation.data;
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    // Verify token signature
    const decoded = verifyGrantToken(grant_token);
    if (!decoded) {
      return res.status(400).json({ success: false, error: 'invalid_token', message: 'Invalid or malformed grant token' });
    }

    // Check QR expiry
    if (isGrantTokenExpired(decoded)) {
      return res.status(410).json({ success: false, error: 'token_expired', message: 'This grant QR code has expired' });
    }

    // Check tenant binding
    if (decoded.tenant_id && decoded.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, error: 'wrong_tenant', message: 'This grant is not for your tenant' });
    }

    // Fetch the grant token record from DB
    const grantRecord = await prisma.bsaas_grant_tokens.findUnique({
      where: { id: decoded.grant_token_id },
    });
    if (!grantRecord) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Grant token record not found' });
    }

    // Check if the grant has been revoked by an admin
    if (grantRecord.is_revoked) {
      return res.status(403).json({ success: false, error: 'grant_revoked', message: 'This grant has been revoked' });
    }

    // Check max_claims
    if (grantRecord.claims_count >= grantRecord.max_claims) {
      return res.status(410).json({ success: false, error: 'max_claims_reached', message: 'This grant has reached its maximum number of redemptions' });
    }

    // Check for existing claim by this tenant (prevent double-claim)
    const existingClaim = await prisma.bsaas_grant_token_claims.findUnique({
      where: {
        grant_token_id_tenant_id: {
          grant_token_id: decoded.grant_token_id,
          tenant_id: tenantId,
        },
      },
    });
    if (existingClaim) {
      return res.status(409).json({ success: false, error: 'already_claimed', message: 'Your tenant has already redeemed this grant' });
    }

    // Verify the feature still exists
    const feature = await prisma.features_list.findUnique({ where: { key: decoded.feature_key } });
    if (!feature) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Feature no longer exists' });
    }

    // Calculate expiry
    const expiresAt = decoded.duration_days
      ? new Date(Date.now() + decoded.duration_days * 24 * 60 * 60 * 1000)
      : null;

    // Create or update the feature purchase with source='admin_grant'
    const purchase = await prisma.tenant_feature_purchases.upsert({
      where: {
        tenant_id_feature_key: { tenant_id: tenantId, feature_key: decoded.feature_key },
      },
      update: {
        source: 'admin_grant',
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          grant_token_id: decoded.grant_token_id,
          granted_by: grantRecord.granted_by,
          grant_redeemed_at: new Date().toISOString(),
          complimentary: true,
        },
        updated_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        feature_key: decoded.feature_key,
        source: 'admin_grant',
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          grant_token_id: decoded.grant_token_id,
          granted_by: grantRecord.granted_by,
          grant_redeemed_at: new Date().toISOString(),
          complimentary: true,
        },
      },
    });

    // Create claim record (atomic — unique constraint prevents double-claim race)
    const claimId = generateGrantClaimId(tenantId);
    await prisma.bsaas_grant_token_claims.create({
      data: {
        id: claimId,
        grant_token_id: decoded.grant_token_id,
        tenant_id: tenantId,
      },
    }).catch(() => {
      // Unique constraint violation — another request claimed first
    });

    // Increment claims_count atomically
    await prisma.bsaas_grant_tokens.update({
      where: { id: decoded.grant_token_id },
      data: {
        claims_count: { increment: 1 },
        updated_at: new Date(),
      },
    });

    // Invalidate capability cache
    invalidateEffectiveCapabilities(tenantId);

    // Send notification
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'bsaas_purchase_success',
      metadata: { featureKey: decoded.feature_key, featureName: feature.name, grantRedeemed: true },
    }).catch(err => console.error('[BSaaS] Failed to send grant redemption notification:', err));

    // Audit
    await audit({
      tenantId,
      actor: (req as any).user?.id || null,
      action: 'feature_purchase.grant_redeemed',
      payload: {
        id: purchase.id,
        entity_type: 'other',
        feature_key: decoded.feature_key,
        grant_token_id: decoded.grant_token_id,
      },
    });

    logger.info('[BSaaS] Grant token redeemed', undefined, {
      tenantId,
      featureKey: decoded.feature_key,
      grantTokenId: decoded.grant_token_id,
    });

    res.json({
      success: true,
      data: {
        purchase_id: purchase.id,
        feature_key: decoded.feature_key,
        feature_name: feature.marketing_name || feature.name,
        status: 'active',
        expires_at: expiresAt,
      },
    });
  } catch (error: any) {
    logger.error('[BSaaS] Error redeeming grant token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to redeem grant token' });
  }
});

export default router;
