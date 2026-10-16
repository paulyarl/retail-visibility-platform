/**
 * Short-code redirect targets — the contract the surface-class table implies.
 *
 * Every short-code destination is a `public` (platform-host) surface except the
 * coupon, whose destination is the tenant's `storefront`. So each redirector
 * must emit an ABSOLUTE url:
 *   - public destinations → the platform origin (never host-relative: a
 *     host-relative target renders the platform under a tenant's custom domain,
 *     and 404s outright where the allowlist refuses the path — /recovery);
 *   - the coupon → the tenant's canonical ladder via the URL delegate.
 *
 * A regression here is invisible in a browser on the platform apex and only
 * shows up on a tenant host, which is exactly why it is pinned.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { platformOrigin } from '@/lib/storefront-routing';

// next/navigation stubs — redirect/notFound throw sentinel errors.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const mocks = vi.hoisted(() => ({
  claimScan: vi.fn(),
  reportScan: vi.fn(),
  intakeScan: vi.fn(),
  claimCode: vi.fn(),
  galleryCode: vi.fn(),
  resolveTenantId: vi.fn(),
  getStorefrontCanonical: vi.fn(),
  trackCouponEvent: vi.fn(),
}));

vi.mock('@/services/ClaimQrScanService', () => ({
  claimQrScanService: { resolveAndTrack: mocks.claimScan },
}));
vi.mock('@/services/ReportQrScanService', () => ({
  reportQrScanService: { resolveAndTrack: mocks.reportScan },
}));
vi.mock('@/services/IntakeShortCodeService', () => ({
  intakeShortCodeService: { resolveAndTrack: mocks.intakeScan },
}));
vi.mock('@/services/ClaimShortCodeService', () => ({
  claimShortCodeService: { resolveShortCode: mocks.claimCode },
}));
vi.mock('@/services/GalleryShortCodeService', () => ({
  galleryShortCodeService: { resolveShortCode: mocks.galleryCode },
}));
vi.mock('@/services/ShortCodeService', () => ({
  shortCodeService: { resolveTenantId: mocks.resolveTenantId },
}));
vi.mock('@/services/TenantPublicService', () => ({
  tenantPublicService: { getStorefrontCanonical: mocks.getStorefrontCanonical },
}));
vi.mock('@/services/PublicCouponService', () => ({
  PublicCouponService: { getInstance: () => ({ trackEvent: mocks.trackCouponEvent }) },
}));

import { resolveClaimQrAndRedirect } from '@/lib/claim-qr-redirect';
import { resolveReportQrAndRedirect } from '@/lib/report-qr-redirect';
import { resolveIntakeAndRedirect } from '@/lib/intake-scan-redirect';
import ClaimShortCodePage from './c/[shortCode]/page';
import GalleryShortCodePage from './g/[shortCode]/page';
import CouponShortCodePage from './s/[autoId]/page';

const PLATFORM = platformOrigin();

describe('short-code targets resolve on the platform origin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claim QR → platform /place/claim/{token}', async () => {
    mocks.claimScan.mockResolvedValue('tok-1');
    await expect(resolveClaimQrAndRedirect('AB12CD', 'mail')).rejects.toThrow(
      `NEXT_REDIRECT:${PLATFORM}/place/claim/tok-1`,
    );
  });

  it('claim short code → platform /place/claim/{token}', async () => {
    mocks.claimCode.mockResolvedValue('tok-9');
    await expect(
      ClaimShortCodePage({ params: Promise.resolve({ shortCode: 'AB12CD' }) }),
    ).rejects.toThrow(`NEXT_REDIRECT:${PLATFORM}/place/claim/tok-9`);
  });

  it('gallery short code → platform /preview/{token}', async () => {
    mocks.galleryCode.mockResolvedValue({
      token: 'tok-2',
      tokenType: 'diagnostic_gallery',
      isMultiGallery: false,
    });
    await expect(
      GalleryShortCodePage({ params: Promise.resolve({ shortCode: 'AB12CD' }) }),
    ).rejects.toThrow(`NEXT_REDIRECT:${PLATFORM}/preview/tok-2`);
  });

  it('multi-gallery short code → platform /preview/{token}?prospect=true', async () => {
    mocks.galleryCode.mockResolvedValue({
      token: 'tok-3',
      tokenType: 'diagnostic_gallery',
      isMultiGallery: true,
    });
    await expect(
      GalleryShortCodePage({ params: Promise.resolve({ shortCode: 'AB12CD' }) }),
    ).rejects.toThrow(`NEXT_REDIRECT:${PLATFORM}/preview/tok-3?prospect=true`);
  });

  it('report QR → platform /seed-report/{seedId}', async () => {
    mocks.reportScan.mockResolvedValue('seed-1');
    await expect(resolveReportQrAndRedirect('AB12CD', 'in_person')).rejects.toThrow(
      `NEXT_REDIRECT:${PLATFORM}/seed-report/seed-1`,
    );
  });

  // The reported bug: a host-relative /recovery/intake 404s on a tenant host
  // (the proxy deliberately refuses /recovery). Absolute keeps the B1 boundary.
  it('intake link → platform /recovery/intake?token=…', async () => {
    mocks.intakeScan.mockResolvedValue({ token: 'tok-4' });
    await expect(resolveIntakeAndRedirect('AB12CD', 'sms')).rejects.toThrow(
      `NEXT_REDIRECT:${PLATFORM}/recovery/intake?token=tok-4`,
    );
  });

  it('unresolved intake link → platform /recovery/intake', async () => {
    mocks.intakeScan.mockResolvedValue(null);
    await expect(resolveIntakeAndRedirect('AB12CD', 'sms')).rejects.toThrow(
      `NEXT_REDIRECT:${PLATFORM}/recovery/intake`,
    );
  });
});

describe('coupon short code resolves the tenant canonical surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.trackCouponEvent.mockResolvedValue(undefined);
  });

  const call = (couponCode?: string) =>
    CouponShortCodePage({
      params: Promise.resolve({ autoId: 'ULCW' }),
      searchParams: Promise.resolve(couponCode ? { c: couponCode } : {}),
    });

  it('an active custom domain wins', async () => {
    mocks.resolveTenantId.mockResolvedValue('tid-1');
    mocks.getStorefrontCanonical.mockResolvedValue({ kind: 'custom', host: 'mybrand.com' });
    await expect(call('SAVE10')).rejects.toThrow('NEXT_REDIRECT:https://mybrand.com/?coupon=SAVE10');
  });

  it('falls back to the platform subdomain', async () => {
    mocks.resolveTenantId.mockResolvedValue('tid-1');
    mocks.getStorefrontCanonical.mockResolvedValue({ kind: 'subdomain', host: 'baraka' });
    await expect(call('SAVE10')).rejects.toThrow(/NEXT_REDIRECT:https:\/\/baraka\.[^/]+\/\?coupon=SAVE10/);
  });

  it('falls back to the platform path when the canonical lookup fails', async () => {
    mocks.resolveTenantId.mockResolvedValue('tid-1');
    mocks.getStorefrontCanonical.mockRejectedValue(new Error('offline'));
    await expect(call('SAVE10')).rejects.toThrow(
      `NEXT_REDIRECT:${PLATFORM}/tenant/tid-1?coupon=SAVE10`,
    );
  });

  it('404s an unknown autoId', async () => {
    mocks.resolveTenantId.mockResolvedValue(null);
    await expect(call()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
