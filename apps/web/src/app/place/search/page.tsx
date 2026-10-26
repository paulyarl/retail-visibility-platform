import { Suspense } from 'react';
import PlacesSearchClient from './PlacesSearchClient';
import PlacesSearchHero from './PlacesSearchHero';
import AddBusinessCta from '@/components/directory/AddBusinessCta';
import SuggestBusinessCta from '@/components/directory/SuggestBusinessCta';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Places — Directory',
  description: 'Search for businesses across all cities and categories.',
};

export default function PlacesSearchPage() {
  return (
    <>
      {/* Hero leads the page — the search form renders under it, so the title
          and the browse copy are crawler-visible without hydration. */}
      <PlacesSearchHero />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
        <PlacesSearchClient />
      </Suspense>

      {/* Footer CTAs — same pair the city and category shelves close with,
          directly above the platform footer. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <AddBusinessCta source="/place/search" />
        <SuggestBusinessCta source="/place/search" />
      </div>

      <PoweredByFooter />
    </>
  );
}
