import { Request, Response } from 'express';
import { CouponService } from '../services/CouponService';
import { prisma } from '../prisma';
import { generateTenantAutoId } from '../middleware/tenantAutoId';

export default async function handler(req: Request, res: Response) {
  const { tenantId, id } = req.params;
  try {
    const couponService = CouponService.getInstance();
    const coupon = await couponService.getCoupon(tenantId as string, id as string);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Coupon not found' });
    }

    // Resolve tenant autoId — use stored auto_id column, generate and persist if missing
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId as string },
      select: { auto_id: true },
    });
    let autoId = tenant?.auto_id;
    if (!autoId) {
      autoId = generateTenantAutoId(tenantId as string);
      await prisma.tenants.update({
        where: { id: tenantId as string },
        data: { auto_id: autoId },
      });
    }

    res.json({
      success: true,
      data: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        shortCodeUrl: `/s/${autoId}?c=${encodeURIComponent(coupon.code)}`,
        fullUrl: `/tenant/${tenantId}?coupon=${encodeURIComponent(coupon.code)}`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
