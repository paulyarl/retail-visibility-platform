import { Suspense } from 'react';
import { permanentRedirect } from 'next/navigation';
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

  // Legacy packets bake a listing count that goes stale ("0 Businesses in …")
  // — normalize so the SERP never carries a count that can't reflect actual.
  const title = stripStaleBusinessCount(effective?.metaTitle) || `Places in ${cityName} — Directory`;
  const description = stripStaleBusinessCount(effective?.description)
    || `Browse all businesses in ${cityName}. Find grocery stores, restaurants, and more.`;

  return {
    title,
    description,
    keywords: effective?.keywords?.join(', '),
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
  const [marketIntelTeaser, summary] = await Promise.all([
    marketIntelSurfaceService.getCityTeaser(citySlug).catch(() => null),
    placesBrowsePublicService.getCityShelfSummary(citySlug).catch(() => null),
  ]);

  // Legacy bare-city slugs (and full-name state tokens) 308 to the canonical
  // "{city}-{state}" URL so same-name cities across states never share a URL.
  if (
    summary?.canonicalSlug
    && summary.canonicalSlug !== decodeURIComponent(citySlug).toLowerCase()
  ) {
    permanentRedirect(`/place/city/${summary.canonicalSlug}`);
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
      />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
        <PlaceCityClient
          citySlug={citySlug}
          marketIntelTeaser={marketIntelTeaser}
          enrichment={summary?.enrichment ?? null}
        />
      </Suspense>
      {summary?.enrichment && (
        <PlaceCityEnrichmentContent enrichment={summary.enrichment} city={summary.city} state={summary.state} />
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
