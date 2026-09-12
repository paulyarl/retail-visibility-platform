import { Suspense } from 'react';
import type { Metadata } from 'next';
import PlaceCategoryClient from './PlaceCategoryClient';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ city?: string; state?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const resolvedSearchParams = await searchParams;
  const city = resolvedSearchParams.city;
  const state = resolvedSearchParams.state;

  const categoryName = decodeURIComponent(categorySlug)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // With no city the page shows the national category view — fetch the
  // '__all__' (national) enrichment packet written by a national-scope
  // directory_enrichment campaign. Falls back to boilerplate when none exists.
  const enrichment = city
    ? await placesBrowsePublicService.getCategoryEnrichment(categorySlug, city, state)
    : await placesBrowsePublicService.getCategoryEnrichment(categorySlug, '__all__');

  if (enrichment?.market) {
    return {
      title: enrichment.effective.metaTitle,
      description: enrichment.effective.description,
      keywords: enrichment.effective.keywords,
      openGraph: {
        title: enrichment.effective.metaTitle,
        description: enrichment.effective.description,
        type: 'website',
      },
    };
  }

  const cityClause = city ? ` in ${city}` : '';
  const fallbackDescription = `Browse ${categoryName} businesses${cityClause} listed on VisibleShelf from public information. Find places near you and claim your listing.`;

  return {
    title: `${categoryName} — Places Directory — VisibleShelf`,
    description: fallbackDescription,
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
        state={resolvedSearchParams.state}
      />
    </Suspense>
  );
}
