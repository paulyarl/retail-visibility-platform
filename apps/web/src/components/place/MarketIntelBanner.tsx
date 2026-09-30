'use client';

import { useEffect, useState } from 'react';
import { BannerSlot, type BannerVariant } from './BannerSlot';
import { generateQrDataUrl, type PersistedQrStyle, type QrEngineOptions } from '@/lib/qr-engine';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import seedReportPreviewService, { seedReportPromotable } from '@/services/SeedReportPreviewService';
import type { CategoryMarketIntelTeaser, CityMarketIntelTeaser } from '@/services/MarketIntelSurfaceService';
import type { MarketIntelTeaserSummary } from '@/services/MarketIntelPublicService';

export type MarketIntelSurfaceType = 'city' | 'category' | 'seed' | 'directory';
type BannerTeaser =
  | CategoryMarketIntelTeaser
  | CityMarketIntelTeaser
  | MarketIntelTeaserSummary;

/**
 * Card definitions for the MARKET surfaces — §12.3. The house creative leads
 * with the surface's own report card (the offer) and names the remaining cards
 * as what's inside, so the banner stays a promotion rather than a second copy
 * of the sidebar's card list.
 */
const SURFACE_PROMO: Record<
  Exclude<MarketIntelSurfaceType, 'seed'>,
  { reportTitle: string; fallbackTeaser: string; alsoInside: string[] }
> = {
  city: {
    reportTitle: 'Full City Report',
    fallbackTeaser: 'Complete market analysis with recommendations',
    alsoInside: ['Market Gaps', 'Metro Dynamics', 'Market Summary'],
  },
  category: {
    reportTitle: 'Full Category Report',
    fallbackTeaser: 'Complete market analysis with recommendations',
    alsoInside: ['Category Signals', 'Category Profile', 'Market Density'],
  },
  // Aggregate browse surfaces (index / store-type / home) have no per-surface
  // report — the promo stays generic and the CTA renders "Coming soon".
  directory: {
    reportTitle: 'Free market report',
    fallbackTeaser:
      'See what public data says about local businesses in this directory.',
    alsoInside: ['Category Signals', 'Market Gaps', 'Market Density'],
  },
};

/**
 * Seed surface promotes the FREE report (viewable at /seed-report/{seedId}),
 * not the paid market-intel unlock. Copy follows the report spec §15.1.
 */
const SEED_PROMO = {
  reportTitle: 'Your free business report',
  fallbackTeaser:
    'We found this business across public directories and local sources, and documented the work in a free report.',
};

/** Tracked redirect for a banner-served report link/QR. Records a
 *  `report_banner` scan (its own surface — never a delivery channel), then
 *  redirects to /seed-report/{seedId}. Prefers the claim-token short code
 *  (/rb/{code} — same resolve+track+redirect pattern as /r/, /rt/ & co.);
 *  falls back to the seed-id API path when no claim token is active. */
export function bannerReportTrackedPath(seedId: string, shortCode?: string | null): string {
  return shortCode
    ? `/rb/${shortCode}`
    : `/api/public/r/seed/${seedId}/banner`;
}

/**
 * Map the operator-authored banner design (the seed tenant's
 * tenant_storefront_qr_settings row) onto qr-engine options. Same resolution
 * rules as StyledTenantQR / the storefront-QR preview pane: persisted style
 * fields win, colors only apply when custom colors are enabled, and the
 * persisted row is concrete — no template merge once a design exists.
 */
export function bannerQrOptions(
  absoluteTrackedUrl: string,
  qrStyle?: PersistedQrStyle | null,
  resolvedLogo?: string | null,
): QrEngineOptions {
  return {
    data: absoluteTrackedUrl,
    exportSize: 256,
    styled: true,
    template: qrStyle ? undefined : 'default',
    dotType: qrStyle?.dotType,
    cornerType: qrStyle?.cornerType,
    cornerDotType: qrStyle?.cornerDotType,
    dotColor: qrStyle?.customColorsEnabled ? qrStyle.dotColor : undefined,
    cornerColor: qrStyle?.customColorsEnabled ? qrStyle.cornerColor : undefined,
    cornerDotColor: qrStyle?.customColorsEnabled ? qrStyle.cornerDotColor : undefined,
    bgColor: qrStyle?.customColorsEnabled ? qrStyle.bgColor : undefined,
    gradientEnabled: qrStyle?.gradientEnabled,
    gradientStart: qrStyle?.gradientStart,
    gradientEnd: qrStyle?.gradientEnd,
    gradientOnDots: qrStyle?.gradientOnDots,
    gradientOnCorners: qrStyle?.gradientOnCorners,
    gradientOnCornerDots: qrStyle?.gradientOnCornerDots,
    logoUrl: qrStyle?.logo ? (resolvedLogo ?? null) : null,
    logoShape: qrStyle?.logoShape,
  };
}

export interface MarketIntelBannerProps {
  variant: BannerVariant;
  surfaceType: MarketIntelSurfaceType;
  /** The surface's market-intel teaser — supplies the report teaser + availability. */
  teaser?: BannerTeaser | null;
  /** Seed surface only — the report this banner promotes. Without it the
   *  banner can't resolve a promotable report and renders nothing. */
  seedId?: string | null;
  /** Seed surface only — whether a promotable published report exists for
   *  the seed (full audit lane: a real business_analysis audit backs the
   *  seed's campaign chain). Omit to let the banner resolve it itself via
   *  the cached preview service; pass it when the caller already checked
   *  (MarketIntelSidebar's own preview fetch). */
  seedReportReady?: boolean;
  /** Seed surface only — the seed's active claim-token short code. When present
   *  the CTA/QR use the /rb/{code} short path instead of the seed-id API path. */
  reportShortCode?: string | null;
  /** Seed surface only — the operator-authored QR design persisted on the
   *  seed's tenant (tenant_storefront_qr_settings). Null = default template. */
  qrStyle?: PersistedQrStyle | null;
  /** Seed surface only — the business logo used when qrStyle.logo is set
   *  (the listing's logoUrl). */
  logoUrl?: string | null;
  className?: string;
}

/**
 * MarketIntelBanner — the house creative that fills a banner slot. Sized by
 * BannerSlot; renders fallback copy without a teaser so the reserved box is
 * never empty.
 *
 * On the seed surface the banner exists only to promote the free report,
 * and report promotion is reserved for the full audit lane — a partial-lane
 * seed (discovery signals / cat-id only, no real business_analysis audit)
 * renders nothing, and so does an unresolved one. The tall variant also
 * carries the report QR. The QR and the CTA both encode the tracked
 * redirect — never the destination — so a banner scan is attributable to
 * its own channel.
 */
export function MarketIntelBanner({
  variant,
  surfaceType,
  teaser = null,
  seedId = null,
  seedReportReady,
  reportShortCode = null,
  qrStyle = null,
  logoUrl = null,
  className = '',
}: MarketIntelBannerProps) {
  const isSeed = surfaceType === 'seed';
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selfCheckedReady, setSelfCheckedReady] = useState<boolean | null>(null);
  // Undefined prop → the banner resolves the lane itself via the cached
  // preview; a boolean means the caller already resolved it.
  const seedReady = isSeed ? (seedReportReady ?? selfCheckedReady) : null;
  const trackedPath = isSeed && seedId && seedReady === true
    ? bannerReportTrackedPath(seedId, reportShortCode)
    : null;

  // Seed surface only — resolve the report lane when the caller didn't.
  // Fails closed: a 404/error/unparseable payload leaves the banner hidden.
  useEffect(() => {
    if (!isSeed || !seedId || seedReportReady !== undefined) return;
    let cancelled = false;
    seedReportPreviewService
      .getReportPreview(seedId)
      .then((data) => {
        if (!cancelled) setSelfCheckedReady(seedReportPromotable(data));
      })
      .catch(() => {
        if (!cancelled) setSelfCheckedReady(false);
      });
    return () => { cancelled = true; };
  }, [isSeed, seedId, seedReportReady]);

  // Tall seed banner only: the square has no room for a legible QR.
  useEffect(() => {
    if (!trackedPath || variant !== 'tall' || typeof window === 'undefined') return;
    let cancelled = false;

    // Logo mirrors the storefront pattern — the tenant's own logo (the
    // listing's business logo), falling back to the platform logo when the
    // listing has none.
    const resolveLogo = async (): Promise<string | null> => {
      if (!qrStyle?.logo) return null;
      if (logoUrl) return logoUrl;
      try {
        const s = await platformSettingsService.getPlatformSettings();
        return s?.logoUrl ?? null;
      } catch {
        return null;
      }
    };

    resolveLogo()
      .then((resolved) =>
        cancelled ? null : generateQrDataUrl(
          bannerQrOptions(`${window.location.origin}${trackedPath}`, qrStyle, resolved),
        ),
      )
      .then((url) => {
        if (url && !cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // QR is additive — the CTA link still works.
      });

    return () => { cancelled = true; };
  }, [trackedPath, variant, qrStyle, logoUrl]);

  const promo = isSeed ? SEED_PROMO : SURFACE_PROMO[surfaceType];
  const alsoInside: string[] = isSeed ? [] : SURFACE_PROMO[surfaceType].alsoInside;
  const report = (teaser as any)?.cards?.fullReport ?? null;
  // The seed surface promotes the free report, so its copy is not the paid
  // report card's teaser.
  const teaserText = (isSeed ? null : report?.teaser?.trim()) || promo.fallbackTeaser;
  const available = isSeed ? seedReady === true : (report?.available ?? false);

  // Partial-lane seeds never display the free-report promo — the banner is
  // downstream of the same boundary that reserves report generation for the
  // full BA lane. An unresolved check or a missing seed id renders nothing
  // rather than a CTA that could point at a report the lane hasn't earned.
  if (isSeed && (!seedId || seedReady !== true)) return null;
  // The free report isn't an unlock — keep the verb honest per surface.
  const ctaLabel = isSeed
    ? 'See the report'
    : surfaceType === 'directory'
      ? 'Get the report'
      : 'Unlock';

  return (
    <BannerSlot variant={variant} className={className}>
      <div className="flex h-full w-full flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg" aria-hidden>📋</span>
          <h3 className="text-sm font-semibold text-neutral-900">{promo.reportTitle}</h3>
        </div>

        <p className="text-sm text-neutral-600">{teaserText}</p>

        {isSeed && variant === 'tall' && qrDataUrl && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <img src={qrDataUrl} alt="Report QR code" className="h-40 w-40 rounded" />
            <span className="text-xs text-neutral-500">Scan to open the report</span>
          </div>
        )}

        {!isSeed && variant === 'tall' && (
          <ul className="mt-4 space-y-1.5 text-xs text-neutral-500">
            <li className="font-medium text-neutral-600">Also inside</li>
            {alsoInside.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-3">
          {available && trackedPath ? (
            // Plain anchor, not next/link — trackedPath is an API redirect
            // endpoint, not an app route. Link would issue an RSC prefetch/navigation
            // request (?_rsc) that misses the route and 404s, and prefetches could
            // record phantom report_banner scans.
            <a
              href={trackedPath}
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline"
            >
              {ctaLabel} →
            </a>
          ) : available ? (
            <span className="inline-flex items-center text-sm font-medium text-blue-600">
              {ctaLabel} →
            </span>
          ) : (
            <span className="inline-flex items-center text-sm text-neutral-400">
              {ctaLabel} → <span className="ml-1 italic">(Coming soon)</span>
            </span>
          )}
        </div>
      </div>
    </BannerSlot>
  );
}
