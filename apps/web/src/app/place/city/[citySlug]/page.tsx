import { Suspense } from 'react';
import PlaceCityClient from './PlaceCityClient';
import { Metadata } from 'next';
import marketIntelSurfaceService from '@/services/MarketIntelSurfaceService';

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }): Promise<Metadata> {
  const { citySlug } = await params;
  const cityName = decodeURIComponent(citySlug).replace(/-/g, ' ');
  return {
    title: `Places in ${cityName} — Directory`,
    description: `Browse all businesses in ${cityName}. Find grocery stores, restaurants, and more.`,
  };
}

export default async function PlaceCityPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;

  // Server-render the market intel teaser for SEO (§11.5).
  let marketIntelTeaser = null;
  try {
    marketIntelTeaser = await marketIntelSurfaceService.getCityTeaser(citySlug);
  } catch {
    // Degrade gracefully — sidebar just won't render.
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <PlaceCityClient citySlug={citySlug} marketIntelTeaser={marketIntelTeaser} />
    </Suspense>
  );
}
