import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { Flags } from '../config';

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

  // For now, just acknowledge and return 202 while worker handles execution
  // Future: enqueue a job for the worker with retry/backoff
  return res.status(202).json({ success: true, accepted: true, strategy, tenantId: tenantId ?? null });
});

export default router;
