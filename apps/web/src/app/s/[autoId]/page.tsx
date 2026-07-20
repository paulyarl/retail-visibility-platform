import { redirect, notFound } from 'next/navigation';
import { shortCodeService } from '@/services/ShortCodeService';
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

  // Resolve tenant via dedicated short-code API
  const tenantId = await shortCodeService.resolveTenantId(autoId);

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
