import { BannerSlot, type BannerVariant } from './BannerSlot';
import type { CategoryMarketIntelTeaser, CityMarketIntelTeaser } from '@/services/MarketIntelSurfaceService';
import type { MarketIntelTeaserSummary } from '@/services/MarketIntelPublicService';

export type MarketIntelSurfaceType = 'city' | 'category' | 'seed';
type BannerTeaser =
  | CategoryMarketIntelTeaser
  | CityMarketIntelTeaser
  | MarketIntelTeaserSummary;

/**
 * Card definitions per surface — §12.3 for the market surfaces, §3 for the
 * seed. The house creative leads with the surface's own report card — the
 * offer — and names the remaining cards as what's inside, so the banner stays a
 * promotion rather than a second copy of the sidebar's card list.
 */
const SURFACE_PROMO: Record<
  MarketIntelSurfaceType,
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
  seed: {
    reportTitle: 'Full Audit Report',
    fallbackTeaser: 'The complete audit behind this business, with recommendations',
    alsoInside: ['Growth Opportunities', 'How It Stacks Up'],
  },
};

export interface MarketIntelBannerProps {
  variant: BannerVariant;
  surfaceType: MarketIntelSurfaceType;
  /** The surface's market-intel teaser — supplies the report teaser + availability. */
  teaser?: BannerTeaser | null;
  className?: string;
}

/**
 * MarketIntelBanner — the house creative that fills a banner slot with the
 * surface's market-intel report offer. Sized by BannerSlot; renders without a
 * teaser (fallback copy) so the reserved box is never empty.
 */
export function MarketIntelBanner({
  variant,
  surfaceType,
  teaser = null,
  className = '',
}: MarketIntelBannerProps) {
  const promo = SURFACE_PROMO[surfaceType];
  const report = teaser?.cards?.fullReport ?? null;
  const teaserText = report?.teaser?.trim() || promo.fallbackTeaser;
  const available = report?.available ?? false;

  return (
    <BannerSlot variant={variant} className={className}>
      <div className="flex h-full w-full flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg" aria-hidden>📋</span>
          <h3 className="text-sm font-semibold text-neutral-900">{promo.reportTitle}</h3>
        </div>

        <p className="text-sm text-neutral-600">{teaserText}</p>

        {variant === 'tall' && (
          <ul className="mt-4 space-y-1.5 text-xs text-neutral-500">
            <li className="font-medium text-neutral-600">Also inside</li>
            {promo.alsoInside.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-3">
          {available ? (
            <span className="inline-flex items-center text-sm font-medium text-blue-600">
              Unlock →
            </span>
          ) : (
            <span className="inline-flex items-center text-sm text-neutral-400">
              Unlock → <span className="ml-1 italic">(Coming soon)</span>
            </span>
          )}
        </div>
      </div>
    </BannerSlot>
  );
}
