/**
 * Tier Capabilities API Routes
 * Manages capability type assignments to tiers via tier_features_list
 */
import { Router } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';

const router = Router();
router.use(authenticateToken);

const requirePlatformStaff = (req: any, res: any, next: any) => {
  if (!['PLATFORM_ADMIN','PLATFORM_SUPPORT','PLATFORM_VIEWER'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

const requirePlatformAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'PLATFORM_ADMIN') return res.status(403).json({ error: 'forbidden' });
  next();
};

/** GET /api/admin/tier-capabilities/by-capability?capabilityTypeKey=... — list tiers with a given capability */
router.get('/by-capability', requirePlatformStaff, async (req, res) => {
  try {
    const { capabilityTypeKey } = req.query;
    if (!capabilityTypeKey || typeof capabilityTypeKey !== 'string') {
      return res.status(400).json({ error: 'capabilityTypeKey required' });
    }

    const capType = await prisma.capability_type_list.findUnique({ where: { key: capabilityTypeKey } });
    if (!capType) return res.status(404).json({ error: 'capability_type_not_found' });

    // Find all tier_features_list rows for this capability type that are enabled
    const tierFeatures = await prisma.tier_features_list.findMany({
      where: { capability_type_id: capType.id, is_enabled: true },
      include: {
        subscription_tiers_list: { select: { tier_key: true, name: true, description: true } },
      },
      orderBy: { tier_id: 'asc' },
    });

    // Group by tier
    const tierMap = new Map<string, {
      tier_key: string;
      tier_name: string;
      tier_description: string;
      capability_type_key: string;
      capability_type_name: string;
      capability_enabled: boolean;
      features: { feature_key: string; feature_name: string; is_enabled: boolean }[];
    }>();

    for (const tf of tierFeatures) {
      const tierKey = tf.subscription_tiers_list?.tier_key;
      if (!tierKey) continue;

      if (!tierMap.has(tierKey)) {
        tierMap.set(tierKey, {
          tier_key: tierKey,
          tier_name: tf.subscription_tiers_list?.name || tierKey,
          tier_description: tf.subscription_tiers_list?.description || '',
          capability_type_key: capType.key,
          capability_type_name: capType.name,
          capability_enabled: true,
          features: [],
        });
      }
      tierMap.get(tierKey)!.features.push({
        feature_key: tf.feature_key,
        feature_name: tf.feature_name,
        is_enabled: tf.is_enabled,
      });
    }

    res.json(Array.from(tierMap.values()));
  } catch (error) {
    console.error('[GET /api/admin/tier-capabilities/by-capability] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tiers_by_capability' });
  }
});

/** GET /api/admin/tier-capabilities?tierKey=... */
router.get('/', requirePlatformStaff, async (req, res) => {
  try {
    const { tierKey } = req.query;
    if (!tierKey || typeof tierKey !== 'string') return res.status(400).json({ error: 'tierKey required' });

    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey } });
    if (!tier) return res.status(404).json({ error: 'tier_not_found' });

    const tierFeatures = await prisma.tier_features_list.findMany({
      where: { tier_id: tier.id, is_enabled: true },
      include: {
        capability_type_list: { select: { key: true, name: true, category: true } },
      },
      orderBy: { capability_type_id: 'asc' },
    });

    // Group by capability type
    const capMap = new Map<string, any>();
    for (const tf of tierFeatures) {
      const capKey = tf.capability_type_list?.key || '_uncategorized';
      if (!capMap.has(capKey)) {
        capMap.set(capKey, {
          tier_key: tierKey,
          tier_name: tier.name,
          capability_type_key: tf.capability_type_list?.key || '',
          capability_type_name: tf.capability_type_list?.name || 'Uncategorized',
          capability_enabled: true,
          is_highlighted: tf.is_highlighted ?? false,
          highlight_order: tf.highlight_order ?? 0,
          marketing_name: tf.marketing_name || '',
          features: [],
          capability_category: tf.capability_type_list?.category || '',
        });
      }
      capMap.get(capKey).features.push({
        feature_key: tf.feature_key,
        feature_name: tf.feature_name,
        is_enabled: tf.is_enabled,
      });
    }

    res.json(Array.from(capMap.values()));
  } catch (error) {
    console.error('[GET /api/admin/tier-capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tier_capabilities' });
  }
});

/** POST /api/admin/tier-capabilities — assign capability type to tier */
router.post('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { tier_key, capability_type_key, capability_enabled, is_highlighted, highlight_order, marketing_name, features } = req.body;
    if (!tier_key || !capability_type_key) return res.status(400).json({ error: 'tier_key and capability_type_key required' });

    // Validate at least one feature is enabled
    if (features && features.length > 0 && !features.some((f: any) => f.is_enabled)) {
      return res.status(400).json({ error: 'at_least_one_feature_must_be_enabled' });
    }

    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key } });
    if (!tier) return res.status(404).json({ error: 'tier_not_found' });

    const capType = await prisma.capability_type_list.findUnique({ where: { key: capability_type_key } });
    if (!capType) return res.status(404).json({ error: 'capability_type_not_found' });

    // Get features to link — either from request body or from capability type's allowed features
    let featureKeys = features?.map((f: any) => f.feature_key?.trim()).filter(Boolean) || [];
    if (featureKeys.length === 0) {
      const capFeatures = await prisma.capability_features_list.findMany({
        where: { capability_type_id: capType.id, is_active: true },
        include: { features_list: { select: { key: true } } },
      });
      featureKeys = capFeatures.map((cf: any) => cf.features_list.key);
    }

    const featureRecords = await prisma.features_list.findMany({
      where: { key: { in: featureKeys }, is_active: true },
      select: { id: true, key: true, name: true },
    });

    // Upsert tier_features_list entries (create or update if already exists)
    const created = [];
    for (const fr of featureRecords) {
      const isEnabled = features?.find((f: any) => f.feature_key?.trim() === fr.key)?.is_enabled ?? (capability_enabled ?? true);
      const tf = await prisma.tier_features_list.upsert({
        where: {
          tier_id_feature_key: { tier_id: tier.id, feature_key: fr.key },
        },
        update: {
          feature_name: fr.name,
          is_enabled: isEnabled,
          is_inherited: false,
          is_highlighted: is_highlighted ?? false,
          highlight_order: highlight_order ?? 0,
          marketing_name: marketing_name || null,
          capability_type_id: capType.id,
          updated_at: new Date(),
        },
        create: {
          id: `tf_${tier.id}_${fr.key}_${Date.now()}`,
          tier_id: tier.id,
          feature_key: fr.key,
          feature_name: fr.name,
          is_enabled: isEnabled,
          is_inherited: false,
          is_highlighted: is_highlighted ?? false,
          highlight_order: highlight_order ?? 0,
          marketing_name: marketing_name || null,
          capability_type_id: capType.id,
        },
      });
      created.push(tf);
    }

    res.status(201).json({
      tier_key, tier_name: tier.name,
      capability_type_key: capType.key, capability_type_name: capType.name,
      capability_enabled: capability_enabled ?? true,
      is_highlighted: is_highlighted ?? false,
      highlight_order: highlight_order ?? 0,
      marketing_name: marketing_name || '',
      features: created.map(tf => ({
        feature_key: tf.feature_key, feature_name: tf.feature_name, is_enabled: tf.is_enabled,
      })),
    });
  } catch (error) {
    console.error('[POST /api/admin/tier-capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_create_tier_capability' });
  }
});

/** PUT /api/admin/tier-capabilities?tierKey=... — update tier capabilities */
router.put('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierKey } = req.query;
    const updateData = req.body;
    if (!tierKey || typeof tierKey !== 'string') return res.status(400).json({ error: 'tierKey required' });

    // Validate at least one feature is enabled
    if (updateData.features && updateData.features.length > 0 && !updateData.features.some((f: any) => f.is_enabled)) {
      return res.status(400).json({ error: 'at_least_one_feature_must_be_enabled' });
    }

    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey } });
    if (!tier) return res.status(404).json({ error: 'tier_not_found' });

    const capType = await prisma.capability_type_list.findUnique({ where: { key: updateData.capability_type_key } });
    if (!capType) return res.status(404).json({ error: 'capability_type_not_found' });

    // Update features for this capability type on this tier
    if (updateData.features) {
      for (const f of updateData.features) {
        const cleanKey = f.feature_key?.trim();
        if (!cleanKey) continue;
        await prisma.tier_features_list.updateMany({
          where: { tier_id: tier.id, feature_key: cleanKey, capability_type_id: capType.id },
          data: {
            is_enabled: f.is_enabled,
            ...(f.effective_restrictions !== undefined && { tier_specific_restrictions: f.effective_restrictions }),
            updated_at: new Date(),
          },
        });
      }
    }

    // Update capability-level fields
    if (updateData.is_highlighted !== undefined || updateData.marketing_name !== undefined) {
      await prisma.tier_features_list.updateMany({
        where: { tier_id: tier.id, capability_type_id: capType.id },
        data: {
          ...(updateData.is_highlighted !== undefined && { is_highlighted: updateData.is_highlighted }),
          ...(updateData.highlight_order !== undefined && { highlight_order: updateData.highlight_order }),
          ...(updateData.marketing_name !== undefined && { marketing_name: updateData.marketing_name }),
          updated_at: new Date(),
        },
      });
    }

    // Return updated tier capabilities (all features, not just enabled)
    const tierFeatures = await prisma.tier_features_list.findMany({
      where: { tier_id: tier.id, capability_type_id: capType.id },
      orderBy: { feature_key: 'asc' },
    });

    res.json([{
      tier_key: tierKey, tier_name: tier.name,
      capability_type_key: capType.key, capability_type_name: capType.name,
      capability_enabled: updateData.capability_enabled ?? true,
      is_highlighted: updateData.is_highlighted ?? false,
      highlight_order: updateData.highlight_order ?? 0,
      marketing_name: updateData.marketing_name || '',
      features: tierFeatures.map(tf => ({
        feature_key: tf.feature_key, feature_name: tf.feature_name, is_enabled: tf.is_enabled,
      })),
    }]);
  } catch (error) {
    console.error('[PUT /api/admin/tier-capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_update_tier_capabilities' });
  }
});

/** DELETE /api/admin/tier-capabilities?tierKey=...&capabilityTypeKey=... */
router.delete('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierKey, capabilityTypeKey } = req.query;
    if (!tierKey || !capabilityTypeKey) return res.status(400).json({ error: 'tierKey and capabilityTypeKey required' });

    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey as string } });
    if (!tier) return res.status(404).json({ error: 'tier_not_found' });

    const capType = await prisma.capability_type_list.findUnique({ where: { key: capabilityTypeKey as string } });
    if (!capType) return res.status(404).json({ error: 'capability_type_not_found' });

    await prisma.tier_features_list.deleteMany({
      where: { tier_id: tier.id, capability_type_id: capType.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/tier-capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_delete_tier_capability' });
  }
});

export default router;
