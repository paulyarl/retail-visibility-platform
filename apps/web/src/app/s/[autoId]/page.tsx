import { redirect, notFound } from 'next/navigation';
import { canonicalStorefrontHome } from '@/lib/storefront-routing';
import { tenantPublicService } from '@/services/TenantPublicService';
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

  // A coupon lands on the tenant's STOREFRONT surface, so the destination is
  // the canonical ladder (active custom domain → platform subdomain → platform
  // path), emitted absolute. A host-relative /tenant/{id} would depend on the
  // proxy to canonicalize it (an extra 301) and would pin the coupon to
  // whatever host the QR was opened on. Best-effort: a failed lookup falls
  // through to the platform path, which the proxy still canonicalizes.
  const canon = await tenantPublicService.getStorefrontCanonical(tenantId).catch(() => null);
  redirect(`${canonicalStorefrontHome(canon, tenantId)}?coupon=${encodeURIComponent(couponCode)}`);
}
