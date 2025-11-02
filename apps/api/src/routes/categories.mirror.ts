import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { Flags } from '../config';
import { queueGbpCategoryMirrorJob } from '../jobs/gbpCategorySync';

const router = Router();

// POST /api/categories/mirror
// Body: { strategy: 'platform_to_gbp' | 'gbp_to_platform', tenantId?: string }
router.post('/api/categories/mirror', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  if (!Flags.CATEGORY_MIRRORING) {
    return res.status(409).json({ success: false, error: 'feature_disabled', flag: 'FF_CATEGORY_MIRRORING' });
  }

  const strategy = String(req.body?.strategy || '').trim();
  const tenantId = req.body?.tenantId ? String(req.body.tenantId) : undefined;

  if (!strategy || (strategy !== 'platform_to_gbp' && strategy !== 'gbp_to_platform')) {
    return res.status(400).json({ success: false, error: 'invalid_strategy' });
  }

  // Enqueue a background job (skeleton worker with retry/backoff)
  const { jobId } = queueGbpCategoryMirrorJob({ strategy: strategy as any, tenantId: tenantId ?? null, requestedBy: (req.user as any)?.userId ?? null });
  return res.status(202).json({ success: true, accepted: true, jobId, strategy, tenantId: tenantId ?? null });
});

export default router;
