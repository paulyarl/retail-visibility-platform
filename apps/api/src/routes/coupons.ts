/**
 * Coupon Routes — Tenant CRUD + Settings + QR
 *
 * Tenant endpoints (auth required):
 *   GET    /api/tenants/:tenantId/coupons              — list coupons
 *   POST   /api/tenants/:tenantId/coupons              — create coupon
 *   GET    /api/tenants/:tenantId/coupons/:id          — get single coupon
 *   PUT    /api/tenants/:tenantId/coupons/:id          — update coupon
 *   DELETE /api/tenants/:tenantId/coupons/:id          — deactivate coupon
 *   GET    /api/tenants/:tenantId/coupons/:id/qr       — get QR metadata
 *   GET    /api/tenants/:tenantId/coupons/settings     — get coupon settings
 *   PUT    /api/tenants/:tenantId/coupons/settings     — update coupon settings
 */

import express from 'express';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { logger } from '../logger';
import { CouponService } from '../services/CouponService';
import { prisma } from '../prisma';
import BotKnowledgeEmbeddingService from '../services/BotKnowledgeEmbeddingService';

const router = express.Router();

/**
 * GET /api/tenants/:tenantId/coupons
 * List coupons for the tenant.
 * Query: isActive (bool), limit (default 50), offset (default 0)
 */
router.get('/tenants/:tenantId/coupons', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await CouponService.getInstance().listCoupons(tenantId, { isActive, limit, offset });
    res.json({ success: true, data: result.coupons, total: result.total });
  } catch (error) {
    logger.error('[coupons] Failed to list coupons:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to list coupons' });
  }
});

/**
 * POST /api/tenants/:tenantId/coupons
 * Create a new coupon.
 */
router.post('/tenants/:tenantId/coupons', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const actor = (req.user as any)?.id;
    const coupon = await CouponService.getInstance().createCoupon(tenantId, req.body, actor);
    BotKnowledgeEmbeddingService.getInstance().refreshCouponEmbeddings(tenantId).catch(() => {});
    res.status(201).json({ success: true, data: coupon });
  } catch (error: any) {
    const message = error?.message || 'Failed to create coupon';
    const status = message.startsWith('coupon_options_not_available') || message.startsWith('discount_type_not_allowed') || message.startsWith('targeting_not_allowed') || message.startsWith('limits_not_allowed') || message.startsWith('coupon_create_not_allowed')
      ? 403
      : message === 'coupon_code_exists' || message.startsWith('invalid_')
        ? 400
        : 500;
    logger.error('[coupons] Failed to create coupon:', undefined, { error: { name: error?.name || 'Error', message, stack: error?.stack } });
    res.status(status).json({ success: false, error: message });
  }
});

/**
 * GET /api/tenants/:tenantId/coupons/:id
 * Get a single coupon by ID.
 */
/**
 * GET /api/tenants/:tenantId/coupons/settings
 * Get coupon settings (spotlight toggle, featured coupon).
 */
router.get('/tenants/:tenantId/coupons/settings', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const settings = await CouponService.getInstance().getSettings(tenantId);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('[coupons] Failed to get settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to get coupon settings' });
  }
});

router.get('/tenants/:tenantId/coupons/:id', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const coupon = await CouponService.getInstance().getCoupon(tenantId, id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'coupon_not_found' });
    }
    res.json({ success: true, data: coupon });
  } catch (error) {
    logger.error('[coupons] Failed to get coupon:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to get coupon' });
  }
});

/**
 * PUT /api/tenants/:tenantId/coupons/settings
 * Update coupon settings (spotlight toggle, featured coupon).
 */
router.put('/tenants/:tenantId/coupons/settings', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const actor = (req.user as any)?.id;
    await CouponService.getInstance().updateSettings(tenantId, req.body, actor);
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    logger.error('[coupons] Failed to update settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to update coupon settings' });
  }
});

/**
 * PUT /api/tenants/:tenantId/coupons/:id
 * Update a coupon.
 */
router.put('/tenants/:tenantId/coupons/:id', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const actor = (req.user as any)?.id;
    const coupon = await CouponService.getInstance().updateCoupon(tenantId, id, req.body, actor);
    BotKnowledgeEmbeddingService.getInstance().refreshCouponEmbeddings(tenantId).catch(() => {});
    res.json({ success: true, data: coupon });
  } catch (error: any) {
    const message = error?.message || 'Failed to update coupon';
    const status = message === 'coupon_not_found' ? 404
      : message === 'coupon_code_exists' || message.startsWith('invalid_') || message.startsWith('discount_type_not_allowed')
        ? 400
        : 500;
    logger.error('[coupons] Failed to update coupon:', undefined, { error: { name: error?.name || 'Error', message, stack: error?.stack } });
    res.status(status).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/tenants/:tenantId/coupons/:id
 * Deactivate a coupon (soft delete — sets is_active=false).
 */
router.delete('/tenants/:tenantId/coupons/:id', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const actor = (req.user as any)?.id;
    await CouponService.getInstance().deactivateCoupon(tenantId, id, actor);
    BotKnowledgeEmbeddingService.getInstance().refreshCouponEmbeddings(tenantId).catch(() => {});
    res.json({ success: true, message: 'Coupon deactivated' });
  } catch (error: any) {
    const message = error?.message || 'Failed to deactivate coupon';
    const status = message === 'coupon_not_found' ? 404 : 500;
    logger.error('[coupons] Failed to deactivate coupon:', undefined, { error: { name: error?.name || 'Error', message, stack: error?.stack } });
    res.status(status).json({ success: false, error: message });
  }
});

/**
 * GET /api/tenants/:tenantId/coupons/:id/qr
 * Returns QR metadata for a coupon (short-code URL, full URL, discount type icon).
 */
router.get('/tenants/:tenantId/coupons/:id/qr', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const coupon = await CouponService.getInstance().getCoupon(tenantId, id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Coupon not found' });
    }

    // Resolve tenant autoId from metadata for short-code URL
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const autoId = (tenant?.metadata as any)?.autoId || `FRSH-${tenantId.slice(-6)}`;

    res.json({
      success: true,
      data: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        shortCodeUrl: `/s/${autoId}?c=${encodeURIComponent(coupon.code)}`,
        fullUrl: `/tenant/${tenantId}?coupon=${encodeURIComponent(coupon.code)}`,
        autoId,
      },
    });
  } catch (error) {
    logger.error('[coupons] Failed to get QR metadata:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch QR metadata' });
  }
});

export default router;
