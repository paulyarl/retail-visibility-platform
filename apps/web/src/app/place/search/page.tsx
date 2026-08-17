import { Suspense } from 'react';
import PlacesSearchClient from './PlacesSearchClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Places — Directory',
  description: 'Search for businesses across all cities and categories.',
};

export default function PlacesSearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <PlacesSearchClient />
    </Suspense>
  );
}
