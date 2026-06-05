/**
 * Capabilities Overview API Routes
 * Provides aggregated capability data from capability_type_list + tier_features_list
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

/** GET /api/admin/capabilities — aggregated overview */
router.get('/', requirePlatformStaff, async (req, res) => {
  try {
    const capTypes = await prisma.capability_type_list.findMany({
      where: { is_active: true },
      include: {
        capability_features_list: { where: { is_active: true }, include: { features_list: { select: { key: true, name: true } } } },
        subscription_tiers_list: { select: { tier_key: true, name: true, sort_order: true } },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });

    const result = capTypes.map(ct => ({
      capability_type_key: ct.key,
      capability_type_name: ct.name,
      category: ct.category || '',
      tier_key: ct.subscription_tiers_list?.tier_key || '',
      tier_name: ct.subscription_tiers_list?.name || '',
      description: ct.description || '',
      feature_count: ct.capability_features_list.length,
      features_in_capability: ct.capability_features_list
        .map((cf: any) => cf.features_list?.key || cf.feature_id).join(', '),
      capability_sort_order: ct.sort_order ?? 0,
      tier_sort_order: ct.subscription_tiers_list?.sort_order ?? 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('[GET /api/admin/capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_list_capabilities' });
  }
});

export default router;
