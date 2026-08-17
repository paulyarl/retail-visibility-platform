/**
 * Directory Presence Upgrade Routes
 *
 *   GET  /api/tenant/:tenantId/upgrade/options — tier comparison for upgrade
 *   POST /api/tenant/:tenantId/upgrade         — initiate upgrade (free or Stripe)
 *
 * These routes let a claimed directory_presence tenant upgrade to a paid tier.
 * Free-tier upgrades are instant; paid-tier upgrades go through Stripe via
 * SubscriptionBillingService.subscribe.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { authenticateToken } from '../middleware/auth';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';

const router = Router();

/**
 * GET /api/tenant/:tenantId/upgrade/options
 * Returns the current tier and all upgrade-eligible tiers with feature deltas.
 */
router.get('/:tenantId/upgrade/options', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    // Load the tenant
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        org_standing_mode: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Verify the user has access to this tenant
    const membership = await prisma.user_tenants.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
    });
    if (!membership) {
      return res.status(403).json({ error: 'no_tenant_access' });
    }

    const currentTierKey = tenant.subscription_tier;

    if (!currentTierKey) {
      return res.json({
        success: true,
        currentTier: null,
        upgradeOptions: [],
      });
    }

    // Load current tier details
    const currentTier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: currentTierKey },
      select: {
        id: true,
        tier_key: true,
        name: true,
        display_name: true,
        description: true,
        price_monthly: true,
        sort_order: true,
      },
    });

    if (!currentTier) {
      return res.json({
        success: true,
        currentTier: null,
        upgradeOptions: [],
      });
    }

    // Load current tier's feature keys
    const currentFeatures = await prisma.tier_features_list.findMany({
      where: { tier_id: currentTier.id, is_enabled: true },
      select: { feature_key: true, feature_name: true },
    });
    const currentFeatureKeys = new Set(currentFeatures.map((f) => f.feature_key));

    // Load upgrade-eligible tiers (sort_order > current, price > 0, active)
    const upgradeTiers = await prisma.subscription_tiers_list.findMany({
      where: {
        is_active: true,
        sort_order: { gt: currentTier.sort_order },
        price_monthly: { gt: 0 },
      },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        tier_key: true,
        name: true,
        display_name: true,
        description: true,
        price_monthly: true,
        sort_order: true,
      },
    });

    // Load features for each upgrade tier and compute deltas
    const upgradeOptions = await Promise.all(
      upgradeTiers.map(async (t) => {
        const tierFeatures = await prisma.tier_features_list.findMany({
          where: { tier_id: t.id, is_enabled: true },
          select: { feature_key: true, feature_name: true },
        });
        const newFeatures = tierFeatures
          .filter((f) => !currentFeatureKeys.has(f.feature_key))
          .map((f) => ({ featureKey: f.feature_key, featureName: f.feature_name }));

        return {
          tierKey: t.tier_key,
          name: t.name,
          displayName: t.display_name,
          description: t.description,
          priceMonthly: Number(t.price_monthly),
          priceAnnual: Number(t.price_monthly) * 12,
          sortOrder: t.sort_order,
          newFeatures,
        };
      }),
    );

    res.json({
      success: true,
      currentTier: {
        tierKey: currentTier.tier_key,
        name: currentTier.name,
        displayName: currentTier.display_name,
        description: currentTier.description,
        priceMonthly: Number(currentTier.price_monthly),
      },
      upgradeOptions,
    });
  } catch (error) {
    logger.error('[GET /api/tenant/:tenantId/upgrade/options] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /api/tenant/:tenantId/upgrade
 * Body: { targetTier: string, billingCycle?: 'monthly'|'annual', paymentMethodId?: string }
 *
 * - If target tier is free → instant upgrade via updateTenantTier
 * - If paid and paymentMethodId provided → Stripe checkout via subscribe
 */
router.post('/:tenantId/upgrade', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const { targetTier, billingCycle = 'monthly', paymentMethodId } = req.body || {};
    if (!targetTier || typeof targetTier !== 'string') {
      return res.status(400).json({ error: 'target_tier_required' });
    }

    // Verify the user is an OWNER of this tenant
    const membership = await prisma.user_tenants.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'owner_or_admin_required' });
    }

    // Load target tier
    const targetTierRow = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: targetTier },
    });
    if (!targetTierRow || !targetTierRow.is_active) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    const billingService = getSubscriptionBillingService();
    const priceMonthly = Number(targetTierRow.price_monthly);

    // Free-tier upgrade (price === 0)
    if (priceMonthly === 0) {
      await billingService.updateTenantTier(tenantId, targetTier, undefined, billingCycle);

      audit({
        actor: userId,
        actorType: 'user',
        action: 'directory_tier_upgrade',
        payload: { tenantId, targetTier, billingCycle, free: true },
      });

      return res.json({
        success: true,
        tier: targetTier,
        status: 'active',
        message: 'upgraded',
      });
    }

    // Paid-tier upgrade — requires a payment method
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'payment_method_required' });
    }

    const result = await billingService.subscribe(tenantId, targetTier, paymentMethodId, billingCycle);

    audit({
      actor: userId,
      actorType: 'user',
      action: 'directory_tier_upgrade',
      payload: { tenantId, targetTier, billingCycle, stripeSubscriptionId: result.stripeSubscriptionId },
    });

    res.json({
      success: result.success,
      tier: result.tier,
      status: result.status,
      activatedAt: result.activatedAt,
      stripeSubscriptionId: result.stripeSubscriptionId,
      requiresAction: result.requiresAction,
      clientSecret: result.clientSecret,
      error: result.error,
    });
  } catch (error) {
    logger.error('[POST /api/tenant/:tenantId/upgrade] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
