import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../prisma';
import { isPlatformAdmin } from '../utils/platform-admin';

const router = Router();

// Helper to check tenant access
function hasAccessToTenant(req: Request, tenantId: string): boolean {
  if (!req.user) return false;
  if (isPlatformAdmin(req.user as any)) return true;
  return (req.user as any).tenantIds?.includes(tenantId) || false;
}

// GET /scan/my-sessions - Get user's scan sessions for a tenant
router.get('/scan/my-sessions', authenticateToken, async (req: Request, res: Response) => {
  console.log('[GET /scan/my-sessions] Called with query:', (req as any).query);
  try {
    const { tenantId } = (req as any).query;
    const userId = ((req as any).user)?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'tenant_id_required' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Get user's sessions for this tenant, ordered by most recent first
    const sessions = await prisma.scanSession.findMany({
      where: {
        tenantId,
        userId,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 20, // Limit to 20 most recent
    });

    return res.json({ success: true, sessions });
  } catch (error: any) {
    console.error('[scan/my-sessions GET] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

export default router;
