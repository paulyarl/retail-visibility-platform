import { Suspense } from 'react';
import PlaceCityClient from './PlaceCityClient';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }): Promise<Metadata> {
  const { citySlug } = await params;
  const cityName = decodeURIComponent(citySlug).replace(/-/g, ' ');
  return {
    title: `Places in ${cityName} — Directory`,
    description: `Browse all businesses in ${cityName}. Find grocery stores, restaurants, and more.`,
  };
}

export default function PlaceCityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <PlaceCityClient />
    </Suspense>
  );
}
