import { Suspense } from 'react';
import type { Metadata } from 'next';
import PlaceCategoryClient from './PlaceCategoryClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ city?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const categoryName = decodeURIComponent(categorySlug)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    title: `${categoryName} — Places Directory — VisibleShelf`,
    description: `Browse ${categoryName} businesses listed on VisibleShelf from public information. Find places near you and claim your listing.`,
    openGraph: {
      title: `${categoryName} — Places Directory — VisibleShelf`,
      description: `Browse ${categoryName} businesses listed on VisibleShelf.`,
      type: 'website',
    },
  };
}

export default async function PlaceCategoryPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

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
      <PlaceCategoryClient
        categorySlug={resolvedParams.categorySlug}
        city={resolvedSearchParams.city}
      />
    </Suspense>
  );
}
