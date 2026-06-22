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
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/role-validation';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
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
        status: { in: ['active', 'suspended'] },
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

    const catalogWithStatus = catalog.map((item, i) => {
      const tierStatus = tierStatuses[i];
      let tierAvailability: 'not_in_tier' | 'in_tier_active' | 'in_tier_gate_off' = 'not_in_tier';
      if (tierStatus.inTier) {
        tierAvailability = tierStatus.merchantGateOn === false ? 'in_tier_gate_off' : 'in_tier_active';
      }
      return {
        ...item,
        purchase: purchaseMap.get(item.key) || null,
        tierAvailability,
        tierCapabilityKey: tierStatus.capabilityKey,
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
  paymentMethodId: z.string().min(1),
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

    const { featureKey, paymentMethodId } = validation.data;

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

    // 2. Check for existing active purchase
    const existing = await prisma.tenant_feature_purchases.findUnique({
      where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
    });
    if (existing && existing.status === 'active') {
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

    // 3. Charge via Stripe using existing billing service
    const billingService = getSubscriptionBillingService();
    const chargeResult = await billingService.chargePaymentMethod(
      tenantId,
      paymentMethodId,
      priceCents,
      `BSaaS: ${feature.name}`
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
          purchased_at: new Date().toISOString(),
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
          purchased_at: new Date().toISOString(),
        },
      },
    });

    // 5. Invalidate capability cache
    invalidateEffectiveCapabilities(tenantId);

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

    invalidateEffectiveCapabilities(tenantId);

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
