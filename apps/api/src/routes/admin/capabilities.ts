/**
 * Capabilities Overview API Routes
 * Provides aggregated capability data from capability_type_list + tier_features_list
 */
import { Router } from 'express';
import { prisma } from '../../prisma';

const router = Router();
// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

const requirePlatformStaff = (req: any, res: any, next: any) => {
  if (!['PLATFORM_ADMIN','PLATFORM_SUPPORT','PLATFORM_VIEWER'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

/** GET /api/admin/capabilities — aggregated overview, one row per (tier, capability_type) assignment */
router.get('/', requirePlatformStaff, async (req, res) => {
  try {
    // Query tier_features_list to get actual tier-capability type assignments (including disabled)
    const tierFeatures = await prisma.tier_features_list.findMany({
      where: {
        capability_type_id: { not: null },
      },
      include: {
        capability_type_list: { select: { key: true, name: true, category: true, description: true, sort_order: true, is_active: true } },
        subscription_tiers_list: { select: { tier_key: true, name: true, sort_order: true, is_active: true } },
      },
    });

    // Group by (tier_key, capability_type_key) and aggregate feature counts
    const assignmentMap = new Map<string, {
      capability_type_key: string;
      capability_type_name: string;
      category: string;
      tier_key: string;
      tier_name: string;
      description: string;
      feature_count: number;
      enabled_feature_count: number;
      disabled_feature_count: number;
      is_paused: boolean;
      is_flexible: boolean;
      is_org_scoped: boolean;
      features_in_capability: string[];
      capability_sort_order: number;
      tier_sort_order: number;
    }>();

    for (const tf of tierFeatures) {
      const capKey = tf.capability_type_list?.key;
      const tierKey = tf.subscription_tiers_list?.tier_key;
      if (!capKey || !tierKey) continue;
      // Skip inactive tiers (matching admin-tiers.ts which queries is_active: true on tiers)
      if (tf.subscription_tiers_list?.is_active === false) continue;

      const mapKey = `${tierKey}:${capKey}`;
      if (!assignmentMap.has(mapKey)) {
        assignmentMap.set(mapKey, {
          capability_type_key: capKey,
          capability_type_name: tf.capability_type_list?.name || capKey,
          category: tf.capability_type_list?.category || '',
          tier_key: tierKey,
          tier_name: tf.subscription_tiers_list?.name || tierKey,
          description: tf.capability_type_list?.description || '',
          feature_count: 0,
          enabled_feature_count: 0,
          disabled_feature_count: 0,
          is_paused: false,
          is_flexible: false,
          is_org_scoped: false,
          features_in_capability: [],
          capability_sort_order: tf.capability_type_list?.sort_order ?? 0,
          tier_sort_order: tf.subscription_tiers_list?.sort_order ?? 0,
        });
      }
      const entry = assignmentMap.get(mapKey)!;
      entry.feature_count++;
      if (tf.is_enabled) {
        entry.enabled_feature_count++;
      } else {
        entry.disabled_feature_count++;
      }
      // Check for explicit disengagement key: any feature ending in _disabled that is enabled
      if (tf.feature_key?.endsWith('_disabled') && tf.is_enabled) {
        entry.is_paused = true;
      }
      // Check for flexible key: any feature ending in _flexible that is enabled
      if (tf.feature_key?.endsWith('_flexible') && tf.is_enabled) {
        entry.is_flexible = true;
      }
      // Mark org-scoped capability types (all features start with org_)
      if (tf.feature_key?.startsWith('org_')) {
        entry.is_org_scoped = true;
      }
      entry.features_in_capability.push(tf.feature_key);
    }

    const result = Array.from(assignmentMap.values())
      .sort((a, b) => {
        if (a.tier_sort_order !== b.tier_sort_order) return a.tier_sort_order - b.tier_sort_order;
        return a.capability_sort_order - b.capability_sort_order;
      })
      .map(entry => ({
        ...entry,
        is_fully_enabled: !entry.is_paused,
        has_disabled: entry.is_paused,
        has_flexible: entry.is_flexible,
        is_org_scoped: entry.is_org_scoped,
        features_in_capability: entry.features_in_capability.join(', '),
      }));

    res.json(result);
  } catch (error) {
    console.error('[GET /api/admin/capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_list_capabilities' });
  }
});

export default router;
