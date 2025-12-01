import { Router, Request, Response } from 'express';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

// GET /api/tenant/:tenantId/categories
router.get('/api/tenant/:tenantId/categories', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    // Minimal placeholder implementation to keep API contract stable
    const rows = await prisma.directoryCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true, googleCategoryId: true },
    });
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

export default router;
