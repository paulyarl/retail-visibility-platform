/**
 * Tier Inheritance API Routes
 *
 * The tier graph — which tiers consume which others. Seeded from
 * shared/tier-contract.json `inheritance.edges` (migration 361) and editable
 * here so structure can be inspected and corrected without a deploy.
 *
 * Auth: authenticateToken + requireAdmin applied at mount level.
 */
import { Router } from 'express';
import { listInheritance, setTierParents, TierInheritanceError } from '../../services/TierInheritanceService';
import { logger } from '../../logger';

const router = Router();

const requirePlatformStaff = (req: any, res: any, next: any) => {
  if (!['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

const requirePlatformAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'PLATFORM_ADMIN') return res.status(403).json({ error: 'forbidden' });
  next();
};

/** GET /api/admin/tier-inheritance — every edge, grouped by child tier. */
router.get('/', requirePlatformStaff, async (_req, res) => {
  try {
    const tiers = await listInheritance();
    res.json({ tiers });
  } catch (error) {
    logger.error('[GET /admin/tier-inheritance] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: String((error as any)?.message || error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** PUT /api/admin/tier-inheritance/:tierKey — replace a tier's inherited set. */
router.put('/:tierKey', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierKey } = req.params;
    const { parents } = req.body ?? {};

    if (!Array.isArray(parents) || parents.some((p: unknown) => typeof p !== 'string')) {
      return res.status(400).json({ error: 'parents must be a string[]' });
    }

    const tiers = await setTierParents(tierKey, parents);
    res.json({ tiers });
  } catch (error) {
    if (error instanceof TierInheritanceError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    logger.error('[PUT /admin/tier-inheritance] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: String((error as any)?.message || error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
