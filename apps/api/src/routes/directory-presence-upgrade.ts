/**
 * Directory Presence Upgrade Routes
 *
 *   GET  /api/tenant/:tenantId/upgrade/options — tier comparison for upgrade
 *   POST /api/tenant/:tenantId/upgrade         — initiate upgrade (free or Stripe)
 *
 * These routes let a claimed directory_presence tenant upgrade to a paid tier.
 * Free-tier upgrades are instant; paid-tier upgrades go through Stripe via
 * SubscriptionBillingService.subscribe.
 *
 * V3.1: When the current tier is `directory_presence` (the free gateway), the
 * GET handler returns the Entry Presence triad — `presence`, `discovery`,
 * `storefront` — as peer visibility modes with mode labels, instead of a flat
 * sort_order ladder. Presence (display: "Starter") is the primary CTA.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { authenticateToken } from '../middleware/auth';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';

const router = Router();

/**
 * V3.1 Entry Presence mode metadata.
 * When the gateway tenant asks for upgrade options, these three peer modes
 * are returned with surface labels so the frontend can render a mode picker
 * instead of a linear tier ladder.
 */
const ENTRY_PRESENCE_MODES: Record<string, { mode: string; surface: string; tagline: string; primary: boolean }> = {
  presence:   { mode: 'directory', surface: 'Platform in-house directory',     tagline: 'Own your directory listing',  primary: true  },
  discovery:  { mode: 'google',    surface: 'Third-party (Google)',            tagline: 'Get found on Google',        primary: false },
  storefront: { mode: 'platform',  surface: 'Platform in-house marketplace',   tagline: 'Open your platform store',   primary: false },
};

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

    // V3.1: Gateway special-case — when current tier is directory_presence,
    // return the Entry Presence triad (presence, discovery, storefront) as
    // peer visibility modes with mode labels, not a flat sort_order ladder.
    const isGateway = currentTierKey === 'directory_presence';

    // Load upgrade-eligible tiers
    let upgradeTiers;
    if (isGateway) {
      // Gateway: return exactly the three Entry Presence modes
      upgradeTiers = await prisma.subscription_tiers_list.findMany({
        where: {
          is_active: true,
          tier_key: { in: ['presence', 'discovery', 'storefront'] },
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
          billing_type: true,
        },
      });
    } else {
      // Non-gateway: return tiers with sort_order > current (flat ladder)
      upgradeTiers = await prisma.subscription_tiers_list.findMany({
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
          billing_type: true,
        },
      });
    }

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

        const modeMeta = isGateway ? ENTRY_PRESENCE_MODES[t.tier_key] : undefined;

        return {
          tierKey: t.tier_key,
          name: t.name,
          displayName: t.display_name,
          description: t.description,
          priceMonthly: Number(t.price_monthly),
          priceAnnual: Number(t.price_monthly) * 12,
          sortOrder: t.sort_order,
          billingType: t.billing_type,
          // V3.1 mode metadata (only present for gateway upgrades)
          mode: modeMeta?.mode,
          surface: modeMeta?.surface,
          tagline: modeMeta?.tagline,
          isPrimary: modeMeta?.primary ?? false,
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
      // V3.1: flag so frontend knows to render a mode picker vs a ladder
      isGatewayUpgrade: isGateway,
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
 * V3.1 rules:
 * - From directory_presence (gateway), only presence/discovery/storefront are valid targets.
 * - Paid tiers require a paymentMethodId — no free short-circuit to paid.
 * - Free tiers (billing_type = 'none') upgrade instantly via updateTenantTier.
 * - Paid tiers go through Stripe via SubscriptionBillingService.subscribe.
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

    // V3.1: Load current tenant tier to enforce gateway rules
    const currentTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_tier: true },
    });
    const currentTierKey = currentTenant?.subscription_tier;
    const isGatewayUpgrade = currentTierKey === 'directory_presence';

    // V3.1: From the gateway, only the three Entry Presence modes are valid
    // upgrade targets. This prevents flipping to arbitrary tiers bypassing
    // the mode picker.
    if (isGatewayUpgrade && !['presence', 'discovery', 'storefront'].includes(targetTier)) {
      return res.status(400).json({ error: 'invalid_gateway_upgrade_target' });
    }

    const billingService = getSubscriptionBillingService();
    const priceMonthly = Number(targetTierRow.price_monthly);

    // V3.1: directory_presence is a free gateway (billing_type = 'none').
    // It cannot self-serve flip into a paid tier without a payment method.
    // Free-tier upgrade (price === 0) is only allowed for tiers with
    // billing_type = 'none' (e.g., directory_presence itself).
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
