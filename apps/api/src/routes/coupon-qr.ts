import { Request, Response } from 'express';
import { CouponService } from '../services/CouponService';

export default async function handler(req: Request, res: Response) {
  const { tenantId, id } = req.params;
  try {
    const couponService = CouponService.getInstance();
    const coupon = await couponService.getCoupon(tenantId as string, id as string);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Coupon not found' });
    }
    res.json({
      success: true,
      data: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        shortCodeUrl: `/s/FRSH?c=${encodeURIComponent(coupon.code)}`,
        fullUrl: `/tenant/${tenantId}?coupon=${encodeURIComponent(coupon.code)}`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
