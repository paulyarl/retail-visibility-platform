import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import PlaceCityClient from './PlaceCityClient';
import PlaceCityHero from './PlaceCityHero';
import PlaceCityEnrichmentContent from './PlaceCityEnrichmentContent';
import { Metadata } from 'next';
import marketIntelSurfaceService from '@/services/MarketIntelSurfaceService';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import AddBusinessCta from '@/components/directory/AddBusinessCta';
import SuggestBusinessCta from '@/components/directory/SuggestBusinessCta';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { stripStaleBusinessCount } from '@/lib/strip-stale-business-count';
import { parsePlaceCitySlug } from '@/utils/slug';
import { platformOrigin } from '@/lib/storefront-routing';

/** Slug-derived display name — the DB spelling wins whenever it's available.
 *  Strips the trailing state segment so 'indianapolis-in' reads 'Indianapolis'. */
function cityNameFromSlug(citySlug: string): string {
  return parsePlaceCitySlug(citySlug)
    .city.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }): Promise<Metadata> {
  const { citySlug } = await params;
  const cityName = cityNameFromSlug(citySlug);

  // Packet-driven metadata — the location enrichment row carries metaTitle /
  // description / keywords (mirrors /directory/location/[location]/page.tsx).
  const summary = await placesBrowsePublicService.getCityShelfSummary(citySlug);
  const effective = summary?.enrichment?.effective;
  const total = summary?.total ?? 0;

  // Legacy packets bake a listing count that goes stale ("0 Businesses in …")
  // — normalize so the SERP never carries a count that can't reflect actual.
  const title = stripStaleBusinessCount(effective?.metaTitle) || `Places in ${cityName} — Directory`;
  const description = stripStaleBusinessCount(effective?.description)
    || `Browse all businesses in ${cityName}. Find grocery stores, restaurants, and more.`;

  return {
    title,
    description,
    keywords: effective?.keywords?.join(', '),
    // Canonical uses the resolved slug so the legacy bare-city form (which
    // 308s below) never competes with the "{city}-{state}" URL.
    alternates: {
      canonical: `${platformOrigin()}/place/city/${summary?.canonicalSlug ?? citySlug}`,
    },
    // A city shelf with one or two listings is a thin page; keep it live for
    // shoppers but out of the index until the market fills out.
    robots: total >= 3 ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function PlaceCityPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;

  // Server-render the market intel teaser (§11.5) and the city shelf summary
  // (dominant state + location enrichment packet) for SEO — the packet copy
  // renders below the client-driven listings grid.
  const [marketIntelTeaser, summary, shelfIndex, initialCityData] = await Promise.all([
    marketIntelSurfaceService.getCityTeaser(citySlug).catch(() => null),
    placesBrowsePublicService.getCityShelfSummary(citySlug).catch(() => null),
    // Live shelf index — resolves packet top_categories / strong_categories
    // labels to hot shelf links (exact label + this market's count > 0).
    placesBrowsePublicService.getCategories().catch(() => null),
    // First page of the shelf, in the shape the client renders — this is what
    // turns the grid from client-only markup into real detail links in the
    // first HTML response (spec §4.4.1).
    placesBrowsePublicService.getCityPlaces(citySlug).catch(() => null),
  ]);

  // Legacy bare-city slugs (and full-name state tokens) 308 to the canonical
  // "{city}-{state}" URL so same-name cities across states never share a URL.
  if (
    summary?.canonicalSlug
    && summary.canonicalSlug !== decodeURIComponent(citySlug).toLowerCase()
  ) {
    permanentRedirect(`/place/city/${summary.canonicalSlug}`);
  }

  // An empty shelf (e.g. its only seed was suppressed) is a soft 404.
  if (summary && summary.total === 0) {
    notFound();
  }

  // DB-spelled city wins over the slug-derived form so the hero/CTA copy never
  // renders the slug's own casing.
  const cityName = summary?.city || cityNameFromSlug(citySlug);
  const state = summary?.state ?? undefined;

  return (
    <>
      {/* Hero is server-rendered so the packet narrative + top categories are
          crawler-visible ahead of the client-driven listings. */}
      <PlaceCityHero
        citySlug={citySlug}
        city={cityName}
        state={state ?? null}
        total={summary?.total ?? 0}
        enrichment={summary?.enrichment ?? null}
        shelfIndex={shelfIndex?.categories ?? []}
      />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
        <PlaceCityClient
          citySlug={citySlug}
          marketIntelTeaser={marketIntelTeaser}
          enrichment={summary?.enrichment ?? null}
          initialData={initialCityData}
        />
      </Suspense>
      {summary?.enrichment && (
        <PlaceCityEnrichmentContent
          enrichment={summary.enrichment}
          city={summary.city}
          state={summary.state}
          shelfIndex={shelfIndex?.categories ?? []}
        />
      )}

      {/* Footer CTAs — sit directly above the platform footer. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <AddBusinessCta city={cityName} state={state} source={`/place/city/${citySlug}`} />
        <SuggestBusinessCta city={cityName} state={state} source={`/place/city/${citySlug}`} />
      </div>

      <PoweredByFooter />
    </>
  );
}
