import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

// GET /api/admin/mirror/last-run?tenantId=...&strategy=platform_to_gbp|gbp_to_platform
router.get('/api/admin/mirror/last-run', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId ? String(req.query.tenantId) : null) as string | null;
    const strategy = req.query.strategy ? String(req.query.strategy) : 'platform_to_gbp';

    const row = await prisma.category_mirror_runs.findFirst({
      where: { tenantId: tenantId ?? null, strategy },
      orderBy: { started_at: 'desc' },
    });

    return res.json({ success: true, data: row || null });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

export default router;
