import { Suspense } from 'react';
import type { Metadata } from 'next';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import PlacesIndexClient from './PlacesIndexClient';
import PlaceNationalPanel from './PlaceNationalPanel';

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
  const [national, roster] = await Promise.all([
    placesBrowsePublicService.getLocationEnrichment('__all__', '__all__'),
    placesBrowsePublicService.getNationalCategoryRoster(),
  ]);

  return (
    <>
      {national && <PlaceNationalPanel enrichment={national} />}
      <Suspense
        fallback={
          <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-neutral-600 dark:text-neutral-400">Loading places...</p>
            </div>
          </div>
        }
      >
        <PlacesIndexClient roster={roster} />
      </Suspense>
    </>
  );
}
