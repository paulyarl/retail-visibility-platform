import { Suspense } from 'react';
import type { Metadata } from 'next';
import CategoryViewClient from './CategoryViewClient';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    categorySlug: string;
  }>;
  searchParams: Promise<{
    lat?: string;
    lng?: string;
    radius?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params;

  // This is the national (city-agnostic) category view — consume the
  // '__all__' enrichment packet written by a national directory_enrichment
  // campaign. Falls back to a default title when no packet exists.
  const enrichment = await placesBrowsePublicService.getCategoryEnrichment(categorySlug, '__all__');
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

  const categoryName = decodeURIComponent(categorySlug)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return {
    title: `${categoryName} — Directory — VisibleShelf`,
    description: `Browse ${categoryName} businesses listed on VisibleShelf.`,
  };
}

export default async function CategoryViewPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">
              Loading category...
            </p>
          </div>
        </div>
      }
    >
      <CategoryViewClient
        categorySlug={resolvedParams.categorySlug}
        searchParams={resolvedSearchParams}
      />
    </Suspense>
  );
}
