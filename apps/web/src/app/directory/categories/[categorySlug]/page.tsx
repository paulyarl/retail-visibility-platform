import { Suspense } from 'react';
import CategoryViewClient from './CategoryViewClient';

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
