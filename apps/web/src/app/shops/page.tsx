import { Metadata } from 'next';
import { Suspense } from 'react';
import ShopsPageClient from './ShopsPageClient';
import { PageProps } from './types';

export default async function ShopsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading shops...</p>
        </div>
      </div>
    }>
      <ShopsPageClient id={id} searchParams={resolvedSearchParams} />
    </Suspense>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  // For now, return basic metadata since we can't easily access tenant data in server component
  // without making the client component do all the work
  return {
    title: 'Shops Directory',
    description: 'Browse shops and products in our directory',
  };
}
