'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { MarketIntelCard } from './MarketIntelCard';
import { MarketIntelBanner } from './MarketIntelBanner';
import marketIntelSurfaceService, {
  type CategoryMarketIntelTeaser,
  type CityMarketIntelTeaser,
} from '@/services/MarketIntelSurfaceService';

interface MarketIntelSurfaceSidebarProps {
  surfaceType: 'category' | 'city';
  /** Category: the category slug. City: the "{city}-{state}" slug. */
  surfaceKey: string;
  /** Category: city name ("__all__" for national). City: unused. */
  city?: string;
  /** Category: state code. City: unused. */
  state?: string | null;
  /** Server-rendered teaser for SEO (optional). */
  initialTeaser?: CategoryMarketIntelTeaser | CityMarketIntelTeaser | null;
  /** Render the tall banner slot at the top of the panel. Default true.
   *  Pass false when the surface already shows the tall slot in a right rail,
   *  so there is exactly one tall slot per surface. */
  showBanner?: boolean;
}

/**
 * MarketIntelSurfaceSidebar — collapsible sidebar for category + city pages.
 *
 * Mirrors the place sidebar pattern but renders category/city teaser cards
 * (§12.3). No claim card (no owner on market surfaces). The "Add Your
 * Business" card replaces the claim card and links to the existing lead-gen
 * flow.
 *
 * Spec: §12.3 (cards per surface), §12.4 (endpoints).
 */
export function MarketIntelSurfaceSidebar({
  surfaceType,
  surfaceKey,
  city = '__all__',
  state = null,
  initialTeaser = null,
  showBanner = true,
}: MarketIntelSurfaceSidebarProps) {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState<
    CategoryMarketIntelTeaser | CityMarketIntelTeaser | null
  >(initialTeaser);

  // Re-fetch client-side with ttl:0 (same as the place sidebar).
  useEffect(() => {
    if (!open) return;
    const fetchTeaser = async () => {
      if (surfaceType === 'category') {
        const data = await marketIntelSurfaceService.getCategoryTeaser(
          surfaceKey,
          city,
          state,
        );
        if (data) setTeaser(data);
      } else {
        const data = await marketIntelSurfaceService.getCityTeaser(surfaceKey);
        if (data) setTeaser(data);
      }
    };
    fetchTeaser();
  }, [open, surfaceType, surfaceKey, city, state]);

  if (!teaser) return null;

  const isCategory = teaser.surfaceType === 'category';

  return (
    <>
      {/* Toggle tab */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-blue-600 text-white rounded-l-lg px-2 py-4 shadow-lg hover:bg-blue-700 transition-colors"
        aria-label={open ? 'Close Market Intel' : 'Open Market Intel'}
      >
        {open ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      {/* Sidebar panel. w-[21rem]: the 300px banner slot plus panel padding —
          w-80 (320px) is 8px too narrow for a 300x600 creative. */}
      {open && (
        <aside className="fixed right-0 top-0 h-full w-[21rem] max-w-[85vw] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-30 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Market Intel
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Tall banner slot (300x600) — reserved ad inventory at the top
                  of the panel, filled with the surface's report offer. Skipped
                  when the surface already shows the slot in a right rail. */}
              {showBanner && (
                <MarketIntelBanner
                  variant="tall"
                  surfaceType={isCategory ? 'category' : 'city'}
                  teaser={teaser}
                  className="mb-1"
                />
              )}
              {isCategory ? (
                <CategoryCards teaser={teaser as CategoryMarketIntelTeaser} />
              ) : (
                <CityCards teaser={teaser as CityMarketIntelTeaser} />
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

// ─── Category cards (§12.3) ───────────────────────────────────────────────

function CategoryCards({ teaser }: { teaser: CategoryMarketIntelTeaser }) {
  return (
    <>
      <MarketIntelCard
        icon="📊"
        title="Category Signals"
        teaser={teaser.cards.categorySignals.teaser}
        available={teaser.cards.categorySignals.available}
      />
      <MarketIntelCard
        icon="🏢"
        title="Category Profile"
        teaser={teaser.cards.categoryProfile.teaser}
        available={teaser.cards.categoryProfile.available}
      />
      <MarketIntelCard
        icon="📈"
        title="Market Density"
        teaser={teaser.cards.marketDensity.teaser}
        available={teaser.cards.marketDensity.available}
      />
      <MarketIntelCard
        icon="📋"
        title="Full Category Report"
        teaser={teaser.cards.fullReport.teaser}
        available={teaser.cards.fullReport.available}
      />
      <MarketIntelCard
        icon="➕"
        title="Add Your Business"
        teaser={teaser.cards.addYourBusiness.teaser}
        available={teaser.cards.addYourBusiness.available}
        ctaLabel="Get listed →"
        ctaHref="/directory/add-business"
      />
    </>
  );
}

// ─── City cards (§12.3) ───────────────────────────────────────────────────

function CityCards({ teaser }: { teaser: CityMarketIntelTeaser }) {
  return (
    <>
      <MarketIntelCard
        icon="🔍"
        title="Market Gaps"
        teaser={teaser.cards.marketGaps.teaser}
        available={teaser.cards.marketGaps.available}
      />
      <MarketIntelCard
        icon="🌆"
        title="Metro Dynamics"
        teaser={teaser.cards.metroDynamics.teaser}
        available={teaser.cards.metroDynamics.available}
      />
      <MarketIntelCard
        icon="📝"
        title="Market Summary"
        teaser={teaser.cards.marketSummary.teaser}
        available={teaser.cards.marketSummary.available}
      />
      <MarketIntelCard
        icon="📋"
        title="Full City Report"
        teaser={teaser.cards.fullReport.teaser}
        available={teaser.cards.fullReport.available}
      />
      <MarketIntelCard
        icon="➕"
        title="Add Your Business"
        teaser={teaser.cards.addYourBusiness.teaser}
        available={teaser.cards.addYourBusiness.available}
        ctaLabel="Get listed →"
        ctaHref="/directory/add-business"
      />
    </>
  );
}
