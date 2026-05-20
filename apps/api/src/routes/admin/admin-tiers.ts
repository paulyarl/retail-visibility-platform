/**
 * Tiers API Routes (AdminCapabilityService compatibility)
 * Lightweight tier listing backed by subscription_tiers_list
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

/** GET /api/admin/tiers */
router.get('/', requirePlatformStaff, async (req, res) => {
  try {
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { is_active: true },
      include: {
        tier_features_list: { where: { is_enabled: true } },
      },
      orderBy: { sort_order: 'asc' },
    });

    const result = await Promise.all(tiers.map(async t => {
      const capLinks = await prisma.tier_features_list.findMany({
        where: { tier_id: t.id, is_enabled: true, capability_type_id: { not: null } },
        select: { capability_type_id: true },
        distinct: ['capability_type_id'],
      });

      const capabilityTypeKeys: string[] = [];
      for (const cl of capLinks) {
        const ct = await prisma.capability_type_list.findUnique({
          where: { id: cl.capability_type_id! },
          select: { key: true },
        });
        if (ct) capabilityTypeKeys.push(ct.key);
      }

      return {
        tier_key: t.tier_key,
        tier_name: t.name,
        description: t.description || '',
        features: t.tier_features_list.map((tf: any) => tf.feature_key),
        capabilities: capabilityTypeKeys,
        created_at: t.created_at?.toISOString(),
        updated_at: t.updated_at?.toISOString(),
      };
    }));

    res.json(result);
  } catch (error) {
    console.error('[GET /api/admin/tiers] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tiers' });
  }
});

/** PUT /api/admin/tiers — partial update */
router.put('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { tier_key, tier_name, description, features, capabilities } = req.body;
    if (!tier_key) return res.status(400).json({ error: 'tier_key required' });

    const existing = await prisma.subscription_tiers_list.findUnique({ where: { tier_key } });
    if (!existing) return res.status(404).json({ error: 'tier_not_found' });

    const data: any = { updated_at: new Date() };
    if (tier_name !== undefined) data.name = tier_name;
    if (description !== undefined) data.description = description || null;

    await prisma.subscription_tiers_list.update({ where: { tier_key }, data });

    // If features array provided, sync tier_features_list
    if (features !== undefined) {
      await prisma.tier_features_list.deleteMany({ where: { tier_id: existing.id } });
      if (features.length > 0) {
        const featureRecords = await prisma.features_list.findMany({
          where: { key: { in: features }, is_active: true },
          select: { id: true, key: true, name: true },
        });
        await prisma.tier_features_list.createMany({
          data: featureRecords.map(fr => ({
            id: `tf_${existing.id}_${fr.key}`,
            tier_id: existing.id,
            feature_key: fr.key,
            feature_name: fr.name,
            is_enabled: true,
            is_inherited: false,
          })),
        });
      }
    }

    // Return updated tier
    const updated = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key },
      include: { tier_features_list: { where: { is_enabled: true } } },
    });

    res.json({
      tier_key: updated!.tier_key,
      tier_name: updated!.name,
      description: updated!.description || '',
      features: updated!.tier_features_list.map((tf: any) => tf.feature_key),
      capabilities: capabilities || [],
      created_at: updated!.created_at?.toISOString(),
      updated_at: updated!.updated_at?.toISOString(),
    });
  } catch (error) {
    console.error('[PUT /api/admin/tiers] Error:', error);
    res.status(500).json({ error: 'failed_to_update_tier' });
  }
});

export default router;
