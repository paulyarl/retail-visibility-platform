import Link from 'next/link';
import { MapPin, Store } from 'lucide-react';
import type { LocationEnrichmentResponse } from '@/services/PlacesBrowsePublicService';
import { getPlaceCityShelfUrl } from '@/utils/slug';

/**
 * Server-rendered national coverage band for the /place home. Renders the
 * national location enrichment packet (city='__all__' row) — intro narrative,
 * measured coverage stats, and the top covered markets linking into the seed
 * city shelves. Renders nothing when no national packet exists.
 */
export interface NationalLiveCoverage {
  totalPlaces: number;
  totalCities: number;
  totalStates: number;
  /** Live listing counts per market — key `${city}|${state}`, lowercased. */
  cityCounts: Record<string, number>;
}

export default function PlaceNationalPanel({
  enrichment,
  liveCoverage,
}: {
  enrichment: LocationEnrichmentResponse;
  /** Live coverage computed from the shelf index — overrides the packet's
   *  baked-in stats (stale the moment a seed publishes). Falls back to the
   *  packet counts when absent. */
  liveCoverage?: NationalLiveCoverage | null;
}) {
  const coverage = enrichment.context?.national_coverage as
    | {
        totalStates?: number;
        totalCities?: number;
        totalListings?: number;
        topCities?: { city: string; state: string; listingCount: number }[];
      }
    | undefined;
  const intro = enrichment.bodyCopy || enrichment.effective?.description || null;

  // Live shelf-index counts win; the packet's baked counts are the fallback.
  // A market with no live count drops off the chip list entirely — an empty
  // shelf link is a dead end for a shopper.
  const liveCountFor = (c: { city: string; state: string; listingCount?: number }): number => {
    if (!liveCoverage) return c.listingCount ?? 0;
    return (
      liveCoverage.cityCounts[
        `${c.city.trim().toLowerCase()}|${(c.state ?? '').trim().toLowerCase()}`
      ] ?? 0
    );
  };
  const topCities = (coverage?.topCities ?? [])
    .map((c) => ({ ...c, count: liveCountFor(c) }))
    .filter((c) => (c.count ?? 0) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.city.localeCompare(b.city))
    .slice(0, 8);

  const totalListings = liveCoverage?.totalPlaces ?? coverage?.totalListings;
  const totalCities = liveCoverage?.totalCities ?? coverage?.totalCities;
  const totalStates = liveCoverage?.totalStates ?? coverage?.totalStates;

  if (!intro && topCities.length === 0) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-2">
          National coverage
        </p>
        {intro && (
          <p className="text-neutral-700 dark:text-neutral-300 max-w-3xl leading-relaxed">
            {intro}
          </p>
        )}

        {(totalListings || totalCities || totalStates) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400">
            {!!totalListings && (
              <span className="inline-flex items-center gap-1.5">
                <Store className="w-4 h-4" />
                {totalListings} places listed
              </span>
            )}
            {!!totalCities && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {totalCities} markets
              </span>
            )}
            {!!totalStates && (
              <span>{totalStates} states covered</span>
            )}
          </div>
        )}

        {topCities.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Top markets
            </p>
            <div className="flex flex-wrap gap-2">
              {topCities.map((c) => (
                <Link
                  key={`${c.city}-${c.state}`}
                  href={getPlaceCityShelfUrl(c.city, c.state)}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-900/40 dark:hover:text-violet-300 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {c.city}, {c.state}
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {c.count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
