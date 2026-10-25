import { Suspense } from 'react';
import type { Metadata } from 'next';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import PlacesIndexClient from './PlacesIndexClient';
import PlacesIndexHero from './PlacesIndexHero';
import PlaceNationalPanel from './PlaceNationalPanel';
import PlacesIndexDirectory, { type PlacesIndexCityLink } from './PlacesIndexDirectory';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { getPlaceCityShelfUrl } from '@/utils/slug';

export const dynamic = 'force-dynamic';

const FALLBACK_TITLE = 'Places Directory — VisibleShelf';
const FALLBACK_DESCRIPTION =
  'Browse local businesses listed on VisibleShelf from public information. Find places by category and city. Claim your listing to take control.';

export async function generateMetadata(): Promise<Metadata> {
  // National location packet (city='__all__' row) drives the home meta when it
  // exists; falls back to the static copy otherwise.
  const national = await placesBrowsePublicService.getLocationEnrichment(
    '__all__',
    '__all__',
  );
  const title = national?.effective?.metaTitle || FALLBACK_TITLE;
  const description = national?.effective?.description || FALLBACK_DESCRIPTION;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

export default async function PlacesIndexPage() {
  // National narratives: the location packet (coverage story) plus the roster
  // of national category packets (per-category framing for the cards below).
  // The category shelf is read here too — the header carries its counts and the
  // grid renders from it without waiting on a client fetch.
  const [national, roster, categories, allPlaces] = await Promise.all([
    placesBrowsePublicService.getLocationEnrichment('__all__', '__all__'),
    placesBrowsePublicService.getNationalCategoryRoster(),
    placesBrowsePublicService.getCategories(),
    // Server-rendered A–Z crawl index (§4.4.2). [] on failure — the page
    // degrades to the category grid rather than erroring.
    placesBrowsePublicService.getAllPlaces(),
  ]);

  // One link per market, deduped by href (a city appears under every shelf it
  // has listings on). getPlaceCityShelfUrl normalizes full state names to
  // postal codes so these match the canonical shelf slug — no redirects.
  const cityLinks: PlacesIndexCityLink[] = [];
  {
    const seen = new Set<string>();
    for (const category of categories?.categories ?? []) {
      for (const city of category.cities ?? []) {
        const href = getPlaceCityShelfUrl(city.city, city.state);
        if (seen.has(href)) continue;
        seen.add(href);
        cityLinks.push({ label: `${city.city}, ${city.state}`, href });
      }
    }
    cityLinks.sort((a, b) => a.label.localeCompare(b.label));
  }

  return (
    <>
      {/* Header leads the page — the national coverage band below reads as page
          copy under the title, not as a band above it. */}
      <PlacesIndexHero
        totalPlaces={categories?.totalPlaces ?? 0}
        categoryCount={categories?.categories.length ?? 0}
      />
      {national && <PlaceNationalPanel enrichment={national} />}
      <Suspense
        fallback={
          <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-neutral-600 dark:text-neutral-400">Loading places...</p>
            </div>
          </div>
        }
      >
        <PlacesIndexClient
          roster={roster}
          initialCategories={categories?.categories ?? null}
        />
      </Suspense>
      {/* Crawl index — server-rendered so every listing and city has an
          inbound link in the first HTML response. */}
      <PlacesIndexDirectory cities={cityLinks} places={allPlaces} />
      {/* Footer closes the page — it lives here, not inside PlacesIndexClient,
          because the client renders above the crawl index (a footer inside it
          would land mid-page). */}
      <PoweredByFooter />
    </>
  );
}
