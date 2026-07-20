import { redirect, notFound } from 'next/navigation';
import { shortCodeService } from '@/services/ShortCodeService';
import { PublicCouponService } from '@/services/PublicCouponService';

export const dynamic = 'force-dynamic';

export default async function ShortCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ autoId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { autoId } = await params;
  const { c: couponCode = '' } = await searchParams;

  // Resolve tenant via dedicated short-code API
  const tenantId = await shortCodeService.resolveTenantId(autoId);

  if (!tenantId) {
    notFound();
  }

  // Track view event with surface 'qr_code' (fire-and-forget, non-blocking)
  const publicCouponService = PublicCouponService.getInstance();
  publicCouponService.trackEvent(tenantId, {
    couponCode,
    eventType: 'view',
    surface: 'qr_code',
    source: 'short_code_redirect',
  }).catch(() => {});

  redirect(`/tenant/${tenantId}?coupon=${encodeURIComponent(couponCode)}`);
}
