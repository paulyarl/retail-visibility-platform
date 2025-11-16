import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { categoryService } from '../services/CategoryService';

const router = Router();

router.get('/api/platform/categories', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: [] });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

router.post('/api/platform/categories', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    const slug = String(req.body?.slug || '').trim();
    if (!name || !slug) return res.status(400).json({ success: false, error: 'invalid_payload' });
    const created = await categoryService.createTenantCategory('platform', { name, slug });
    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    // Check for unique constraint violation on slug
    if (e?.message?.includes('Unique constraint failed') && e?.message?.includes('slug')) {
      return res.status(409).json({ success: false, error: 'duplicate_slug', message: `A category with slug "${req.body?.slug}" already exists` });
    }
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

export default router;
