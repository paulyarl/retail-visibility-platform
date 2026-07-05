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
import { audit } from '../audit';

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
  };
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

  // 2. Check if the feature is in any of the tenant's tier features
  const tierFeature = await prisma.tier_features_list.findFirst({
    where: {
      tier_id: { in: tierIds },
      feature_key: featureKey,
      is_enabled: true,
    },
    include: { capability_type_list: { select: { key: true } } },
  });

  if (!tierFeature) return { inTier: false, merchantGateOn: null, capabilityKey: null };

  const capabilityKey = tierFeature.capability_type_list?.key || null;

  // 3. Check merchant gate for the capability domain
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
    const catalogEntries = await prisma.bsaas_catalog.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    const featureKeys = catalogEntries.map(e => e.feature_key);
    const features = await prisma.features_list.findMany({
      where: { key: { in: featureKeys }, is_active: true },
      select: { key: true, name: true, description: true, category: true },
    });
    const featureMap = new Map(features.map(f => [f.key, f]));

    const catalog = catalogEntries
      .filter(entry => featureMap.has(entry.feature_key))
      .map(entry => {
        const f = featureMap.get(entry.feature_key)!;
        return {
          key: entry.feature_key,
          name: entry.marketing_name || f.name,
          description: entry.description || f.description || '',
          category: f.category,
          priceCents: entry.price_cents,
          billingCycle: entry.billing_cycle as 'one_time' | 'monthly' | 'annual',
          trialDays: entry.trial_days,
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
    console.error('[BSaaS] Error fetching feature catalog:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feature catalog' });
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
    console.error('[BSaaS] Error listing purchases:', error);
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

    // 3. Trial branch: if trial_days > 0, create trial purchase without charging
    if (trialDays > 0 && billingCycle !== 'one_time') {
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
        billingCycle: billingCycle as 'monthly' | 'annual',
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

    if (promotionCode) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return res.status(503).json({ success: false, error: 'stripe_not_configured', message: 'Promo codes require Stripe' });
        }
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

        const promoCodes = await stripe.promotionCodes.list({ code: promotionCode, active: true, limit: 1 });
        if (promoCodes.data.length === 0) {
          return res.status(400).json({ success: false, error: 'invalid_promo_code', message: 'Invalid or expired promotion code' });
        }

        const promo = promoCodes.data[0];
        if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
          return res.status(400).json({ success: false, error: 'promo_expired', message: 'This promotion code has reached its usage limit' });
        }
        if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
          return res.status(400).json({ success: false, error: 'promo_expired', message: 'This promotion code has expired' });
        }

        promotionCodeId = promo.id;
        const coupon = await stripe.coupons.retrieve((promo as any).coupon);
        couponId = coupon.id;

        if (coupon.percent_off) {
          discountCents = Math.round(priceCents * coupon.percent_off / 100);
        } else if (coupon.amount_off) {
          discountCents = Math.min(coupon.amount_off, priceCents);
        }
        chargedAmount = Math.max(0, priceCents - discountCents);
      } catch (err: any) {
        return res.status(400).json({ success: false, error: 'invalid_promo_code', message: 'Failed to validate promotion code' });
      }
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
    const expiresAt = billingCycle === 'monthly'
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
      billingCycle: billingCycle as 'monthly' | 'annual',
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
    console.error('[BSaaS] Error purchasing feature:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to purchase feature' });
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
      action: 'feature_purchase.cancel',
      payload: {
        id,
        entity_type: 'other',
        feature_key: purchase.feature_key,
        previous_status: purchase.status,
      },
    });

    // Send cancellation notification (email + CRM alert + CRM task)
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'bsaas_purchase_cancelled',
      metadata: { featureKey: purchase.feature_key },
    }).catch(err => console.error('[BSaaS] Failed to send cancel notification:', err));

    res.json({
      success: true,
      data: {
        purchase_id: id,
        feature_key: purchase.feature_key,
        status: 'cancelled',
      },
    });
  } catch (error: any) {
    console.error('[BSaaS] Error cancelling purchase:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to cancel purchase' });
  }
});

export default router;
