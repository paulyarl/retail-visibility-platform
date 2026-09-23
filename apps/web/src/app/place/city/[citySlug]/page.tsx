import { Suspense } from 'react';
import PlaceCityClient from './PlaceCityClient';
import PlaceCityEnrichmentContent from './PlaceCityEnrichmentContent';
import { Metadata } from 'next';
import marketIntelSurfaceService from '@/services/MarketIntelSurfaceService';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import AddBusinessCta from '@/components/directory/AddBusinessCta';
import SuggestBusinessCta from '@/components/directory/SuggestBusinessCta';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }): Promise<Metadata> {
  const { citySlug } = await params;
  const cityName = decodeURIComponent(citySlug).replace(/-/g, ' ');

  // Packet-driven metadata — the location enrichment row carries metaTitle /
  // description / keywords (mirrors /directory/location/[location]/page.tsx).
  const summary = await placesBrowsePublicService.getCityShelfSummary(citySlug);
  const effective = summary?.enrichment?.effective;

  const title = effective?.metaTitle || `Places in ${cityName} — Directory`;
  const description = effective?.description
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

  // DB-spelled city wins over the slug-derived lowercase form so the CTA copy
  // never renders a lowercase city name.
  const cityName = summary?.city || decodeURIComponent(citySlug).replace(/-/g, ' ');
  const state = summary?.state ?? undefined;

  return (
    <>
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
