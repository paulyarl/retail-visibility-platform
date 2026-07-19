import { redirect, notFound } from 'next/navigation';
import { shopsService } from '@/services/ShopsService';
import { PublicCouponService } from '@/services/PublicCouponService';

export default async function ShortCodePage({
  params,
  searchParams,
}: {
  params: { autoId: string };
  searchParams: { c?: string };
}) {
  const { autoId } = params;
  const couponCode = searchParams.c || '';

  // Resolve tenant via public shops API
  const tenantId = await shopsService.getShopTenantIdByIdentifier(autoId);

  if (!tenantId) {
    notFound();
  }

  // Track view event with surface 'qr_code' (fire-and-forget, non-blocking)
  const publicCouponService = PublicCouponService.getInstance();
  await publicCouponService.trackEvent(tenantId, {
    couponCode,
    eventType: 'view',
    surface: 'qr_code',
    source: 'short_code_redirect',
  });

  redirect(`/tenant/${tenantId}?coupon=${encodeURIComponent(couponCode)}`);
}
