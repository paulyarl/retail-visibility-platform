/**
 * Active Featured Routes
 *
 * Public endpoint: GET /api/active-featured?surface=:surface&limit=:limit — platform-level (cross-tenant)
 * Public tenant endpoint: GET /api/public/tenants/:tenantId/active-featured?surface=:surface&limit=:limit — tenant-scoped
 *
 * Used by visibility channels (storefront, directory, shops) to resolve
 * active featured products with fallback behavior.
 */

import express from 'express';
import {
  resolveActiveFeatured,
  getTenantActiveFeatured,
  getPlatformActiveFeatured,
  invalidateActiveFeaturedCache,
} from '../services/ActiveFeaturedResolver';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = express.Router();

/**
 * Public tenant-scoped router — mounted at /api/public/tenants/:tenantId
 * Uses mergeParams to receive :tenantId from the mount path.
 */
const publicTenantRouter = express.Router({ mergeParams: true });

/**
 * GET /api/public/tenants/:tenantId/active-featured?surface=:surface&limit=:limit
 * Tenant-scoped active featured products (public — no auth required).
 * Used by storefronts, product detail, directory entry.
 */
publicTenantRouter.get('/active-featured', async (req: express.Request<{ tenantId: string }>, res) => {
  try {
    const { tenantId } = req.params;
    const surface = req.query.surface as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (!surface) {
      return res.status(400).json({ error: 'surface parameter is required' });
    }

    const result = await getTenantActiveFeatured(tenantId, surface, limit);
    res.json(result);
  } catch (error) {
    logger.error('[active-featured] Failed to get tenant active featured:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch active featured products' });
  }
});

export { publicTenantRouter };

/**
 * GET /api/active-featured?surface=:surface&limit=:limit
 * Platform-level active featured products (cross-tenant).
 * Public — no auth required. Used by directory home, cross-tenant shops.
 */
router.get('/active-featured', async (req, res) => {
  try {
    const surface = req.query.surface as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (!surface) {
      return res.status(400).json({ error: 'surface parameter is required' });
    }

    const result = await getPlatformActiveFeatured(surface, limit);
    res.json(result);
  } catch (error) {
    logger.error('[active-featured] Failed to get platform active featured:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch active featured products' });
  }
});


/**
 * POST /api/admin/active-featured/invalidate-cache
 * Invalidates the in-memory cache. Call after featured product CRUD operations.
 * Admin auth required.
 */
router.post('/admin/active-featured/invalidate-cache', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.body?.tenantId as string | undefined;
    const surface = req.body?.surface as string | undefined;
    invalidateActiveFeaturedCache(tenantId, surface);
    res.json({ success: true, message: 'Active featured cache invalidated' });
  } catch (error) {
    logger.error('[active-featured] Failed to invalidate cache:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

export default router;
