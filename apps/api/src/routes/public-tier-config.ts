/**
 * Public Tier Configuration API Route
 * No authentication required — safe for public pages (e.g. /features).
 * Returns the same shape as /api/tier-config but without auth middleware.
 */
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

/** GET /api/public/tier-config — full tier-feature configuration (public) */
router.get('/', async (_req, res) => {
  try {
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { is_active: true },
      include: { tier_features_list: { where: { is_enabled: true } } },
      orderBy: { sort_order: 'asc' },
    });

    const features = await prisma.features_list.findMany({
      where: { is_active: true },
      orderBy: [{ category: 'asc' }, { sort_order: 'asc' }],
    });

    const tierData = tiers.map(t => ({
      tierKey: t.tier_key,
      name: t.name,
      displayName: t.display_name,
      description: t.description || '',
      priceMonthly: typeof t.price_monthly?.toNumber === 'function' ? t.price_monthly.toNumber() : Number(t.price_monthly),
      maxSkus: t.max_skus,
      maxLocations: t.max_locations,
      tierType: t.tier_type,
      sortOrder: t.sort_order,
      features: t.tier_features_list.map((tf: any) => tf.feature_key),
    }));

    const featureData = features.map(f => ({
      featureKey: f.key,
      featureName: f.name,
      displayName: f.marketing_name || f.name,
      description: f.description || '',
      category: f.category,
      iconName: f.icon_name || null,
      sortOrder: f.sort_order ?? 0,
    }));

    const hierarchy: Record<string, string[]> = {
      google_only: [],
      discovery: [],
      starter: ['google_only'],
      storefront: ['discovery', 'google_only'],
      commitment: ['storefront', 'discovery', 'google_only'],
      professional: ['starter', 'google_only'],
      enterprise: ['professional', 'commitment', 'starter', 'google_only'],
      organization: ['professional', 'commitment', 'starter', 'google_only'],
      chain_starter: ['starter', 'commitment', 'google_only'],
      chain_professional: ['professional', 'commitment', 'starter', 'google_only'],
      chain_enterprise: ['enterprise', 'commitment', 'professional', 'starter', 'google_only'],
    };

    const featureTierMap: Record<string, string> = {};
    for (const tier of tiers) {
      for (const tf of tier.tier_features_list) {
        const key = tf.feature_key;
        if (!featureTierMap[key]) {
          featureTierMap[key] = tier.tier_key;
        }
      }
    }

    const limits: Record<string, Record<string, any>> = {};
    for (const tier of tiers) {
      const tierLimits: Record<string, any> = {};
      for (const tf of tier.tier_features_list) {
        if (tf.tier_specific_restrictions) {
          tierLimits[tf.feature_key] = tf.tier_specific_restrictions;
        }
      }
      if (Object.keys(tierLimits).length > 0) {
        limits[tier.tier_key] = tierLimits;
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json({
      tiers: tierData,
      features: featureData,
      hierarchy,
      featureTierMap,
      limits,
    });
  } catch (error) {
    console.error('[GET /api/public/tier-config] Error:', error);
    res.status(500).json({ error: 'failed_to_load_tier_config' });
  }
});

export default router;
