/**
 * Tier Configuration API Route
 * Public-ish endpoint returning tier-feature configuration from the database.
 * Used by tenant-facing pages (TierGate, useTierAccess, etc.) to resolve
 * feature access without hardcoded data.
 */
import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

/** GET /api/tier-config — full tier-feature configuration */
router.get('/', async (req, res) => {
  try {
    // Fetch all active tiers
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { is_active: true },
      include: { tier_features_list: { where: { is_enabled: true } } },
      orderBy: { sort_order: 'asc' },
    });

    // Fetch all active features
    const features = await prisma.features_list.findMany({
      where: { is_active: true },
      orderBy: [{ category: 'asc' }, { sort_order: 'asc' }],
    });

    // Build tier data with feature keys
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

    // Build feature data with display info
    const featureData = features.map(f => ({
      featureKey: f.key,
      featureName: f.name,
      displayName: f.marketing_name || f.name,
      description: f.description || '',
      category: f.category,
      iconName: f.icon_name || null,
      sortOrder: f.sort_order ?? 0,
    }));

    // Build hierarchy from tier sort_order + tier_type grouping
    // Individual tiers: google_only < starter < professional < enterprise
    // Chain tiers: chain_starter < chain_professional < chain_enterprise
    // Organization is parallel to enterprise
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

    // Build feature → minimum tier map from tier_features_list
    const featureTierMap: Record<string, string> = {};
    for (const tier of tiers) {
      for (const tf of tier.tier_features_list) {
        const key = tf.feature_key;
        // Only set if not already assigned to a lower tier
        if (!featureTierMap[key]) {
          featureTierMap[key] = tier.tier_key;
        }
      }
    }

    // Build feature limits from tier_specific_restrictions JSON
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

    res.json({
      tiers: tierData,
      features: featureData,
      hierarchy,
      featureTierMap,
      limits,
    });
  } catch (error) {
    console.error('[GET /api/tier-config] Error:', error);
    res.status(500).json({ error: 'failed_to_load_tier_config' });
  }
});

export default router;
