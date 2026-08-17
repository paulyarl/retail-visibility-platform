import { Suspense } from 'react';
import type { Metadata } from 'next';
import PlacesIndexClient from './PlacesIndexClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Places Directory — VisibleShelf',
  description:
    'Browse local businesses listed on VisibleShelf from public information. Find places by category and city. Claim your listing to take control.',
  openGraph: {
    title: 'Places Directory — VisibleShelf',
    description:
      'Browse local businesses listed on VisibleShelf from public information.',
    type: 'website',
  },
};

export default function PlacesIndexPage() {
  return (
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
      <PlacesIndexClient />
    </Suspense>
  );
}
