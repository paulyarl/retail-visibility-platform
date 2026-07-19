/**
 * Customer Coupon Wallet Routes
 *
 * Authenticated customer endpoints for the coupon wallet.
 * Public tenant-scoped endpoint for listing saveable coupons.
 */

import { Router, Request, Response } from 'express';
import { CustomerCouponWalletService } from '../services/CustomerCouponWalletService';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { CouponService } from '../services/CouponService';
import { logger } from '../logger';

const router = Router();
const walletService = CustomerCouponWalletService.getInstance();
const customerTokenService = CustomerTokenService.getInstance();
const couponService = CouponService.getInstance();

const getCustomerId = (req: Request): string | null => {
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) {
      return payload.customerId;
    }
  }
  return req.cookies?.customer_session_id || null;
};

const requireCustomerAuth = (req: Request, res: Response, next: Function) => {
  const customerId = getCustomerId(req);
  if (!customerId) {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Authentication required',
    });
  }
  (req as any).customerId = customerId;
  next();
};

// POST /api/customer-coupons/save
router.post('/save', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId, couponId, surface } = req.body;

    if (!tenantId || !couponId) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'tenantId and couponId are required',
      });
    }

    const saved = await walletService.saveCoupon(customerId, tenantId, couponId, surface);
    return res.status(201).json({ success: true, savedCoupon: saved });
  } catch (error: any) {
    logger.error('[Customer Coupons] Save failed', undefined, {
      error: error.message,
    });

    if (['coupon_not_found', 'coupon_inactive', 'coupon_expired', 'coupon_exhausted', 'save_failed'].includes(error.message)) {
      return res.status(400).json({
        success: false,
        error: error.message,
        message: error.message.replace(/_/g, ' '),
      });
    }

    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to save coupon',
    });
  }
});

// POST /api/customer-coupons/save-by-code
router.post('/save-by-code', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId, couponCode, surface } = req.body;

    if (!tenantId || !couponCode) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'tenantId and couponCode are required',
      });
    }

    const saved = await walletService.saveCouponByCode(customerId, tenantId, couponCode, surface);
    return res.status(201).json({ success: true, savedCoupon: saved });
  } catch (error: any) {
    logger.error('[Customer Coupons] Save-by-code failed', undefined, {
      error: error.message,
    });

    if (['coupon_not_found', 'coupon_inactive', 'coupon_expired', 'coupon_exhausted', 'save_failed'].includes(error.message)) {
      return res.status(400).json({
        success: false,
        error: error.message,
        message: error.message.replace(/_/g, ' '),
      });
    }

    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to save coupon',
    });
  }
});

// DELETE /api/customer-coupons/:savedCouponId
router.delete('/:savedCouponId', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { savedCouponId } = req.params;

    await walletService.unsaveCoupon(customerId, savedCouponId);
    return res.json({ success: true, message: 'Coupon removed from wallet' });
  } catch (error: any) {
    logger.error('[Customer Coupons] Unsave failed', undefined, {
      error: error.message,
    });

    if (error.message === 'saved_coupon_not_found') {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Saved coupon not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to remove coupon',
    });
  }
});

// GET /api/customer-coupons/wallet
router.get('/wallet', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { status, tenantId, limit, offset } = req.query as any;

    const saved = await walletService.listWallet(customerId, {
      status,
      tenantId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return res.json({ success: true, savedCoupons: saved });
  } catch (error: any) {
    logger.error('[Customer Coupons] List wallet failed', undefined, {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to list wallet',
    });
  }
});

// GET /api/customer-coupons/wallet/by-tenant/:tenantId
router.get('/wallet/by-tenant/:tenantId', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId } = req.params;
    const { status } = req.query as any;

    const saved = await walletService.listWalletByTenant(customerId, tenantId, status);
    return res.json({ success: true, savedCoupons: saved });
  } catch (error: any) {
    logger.error('[Customer Coupons] List by tenant failed', undefined, {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to list wallet by tenant',
    });
  }
});

// GET /api/customer-coupons/stats
router.get('/stats', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const stats = await walletService.getWalletStats(customerId);
    return res.json({ success: true, stats });
  } catch (error: any) {
    logger.error('[Customer Coupons] Stats failed', undefined, {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to retrieve wallet stats',
    });
  }
});

// GET /api/customer-coupons/expiring
router.get('/expiring', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const daysThreshold = parseInt(req.query.daysThreshold as string, 10) || 7;
    const saved = await walletService.getExpiringSoon(customerId, daysThreshold);
    return res.json({ success: true, savedCoupons: saved });
  } catch (error: any) {
    logger.error('[Customer Coupons] Expiring failed', undefined, {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to list expiring coupons',
    });
  }
});

// Public tenant router for saveable coupons
export const publicTenantRouter = Router({ mergeParams: true });

// GET /api/public/tenants/:tenantId/coupons/saveable
publicTenantRouter.get('/coupons/saveable', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const result = await couponService.listCoupons(tenantId, { isActive: true, limit: 100 });
    return res.json({ success: true, coupons: result.coupons });
  } catch (error: any) {
    logger.error('[Customer Coupons] Saveable list failed', undefined, {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to list coupons',
    });
  }
});

export default router;
