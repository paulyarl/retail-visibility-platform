'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BannerSlot, type BannerVariant } from './BannerSlot';
import { generateQrDataUrl } from '@/lib/qr-engine';
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

/** Tracked redirect for a banner-served report QR. Records a `report_banner`
 *  scan (its own surface — never a delivery channel), then 302s to the report. */
export function bannerReportTrackedPath(seedId: string): string {
  return `/api/public/r/seed/${seedId}/banner`;
}

export interface MarketIntelBannerProps {
  variant: BannerVariant;
  surfaceType: MarketIntelSurfaceType;
  /** The surface's market-intel teaser — supplies the report teaser + availability. */
  teaser?: BannerTeaser | null;
  /** Seed surface only — the report this banner promotes. Without it the seed
   *  banner falls back to a non-linked offer rather than a dead link. */
  seedId?: string | null;
  className?: string;
}

/**
 * MarketIntelBanner — the house creative that fills a banner slot. Sized by
 * BannerSlot; renders fallback copy without a teaser so the reserved box is
 * never empty.
 *
 * On the seed surface the tall variant also carries the report QR. The QR and
 * the CTA both encode the tracked redirect — never the destination — so a
 * banner scan is attributable to its own channel.
 */
export function MarketIntelBanner({
  variant,
  surfaceType,
  teaser = null,
  seedId = null,
  className = '',
}: MarketIntelBannerProps) {
  const isSeed = surfaceType === 'seed';
  const trackedPath = isSeed && seedId ? bannerReportTrackedPath(seedId) : null;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Tall seed banner only: the square has no room for a legible QR.
  useEffect(() => {
    if (!trackedPath || variant !== 'tall' || typeof window === 'undefined') return;
    let cancelled = false;

    generateQrDataUrl({
      data: `${window.location.origin}${trackedPath}`,
      exportSize: 256,
      styled: true,
      template: 'default',
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // QR is additive — the CTA link still works.
      });

    return () => { cancelled = true; };
  }, [trackedPath, variant]);

  const promo = isSeed ? SEED_PROMO : SURFACE_PROMO[surfaceType];
  const alsoInside: string[] = isSeed ? [] : SURFACE_PROMO[surfaceType].alsoInside;
  const report = (teaser as any)?.cards?.fullReport ?? null;
  // The seed surface promotes the free report, so its copy is not the paid
  // report card's teaser.
  const teaserText = (isSeed ? null : report?.teaser?.trim()) || promo.fallbackTeaser;
  const available = isSeed ? !!trackedPath : (report?.available ?? false);
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
            <Link
              href={trackedPath}
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline"
            >
              {ctaLabel} →
            </Link>
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
