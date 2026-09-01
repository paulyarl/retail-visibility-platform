import { Suspense } from 'react';
import type { Metadata } from 'next';
import SuggestBusinessClient from './SuggestBusinessClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Suggest a Business — VisibleShelf Directory',
  description:
    'Suggest a local business to add to the VisibleShelf directory. Our team reviews every submission.',
  openGraph: {
    title: 'Suggest a Business — VisibleShelf Directory',
    description: 'Suggest a local business to add to the VisibleShelf directory.',
    type: 'website',
  },
};

interface PageProps {
  searchParams: Promise<{
    category?: string;
    city?: string;
    state?: string;
    source?: string;
  }>;
}

export default async function SuggestBusinessPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Loading form...</p>
          </div>
        </div>
      }
    >
      <SuggestBusinessClient
        defaultCategory={params.category}
        defaultCity={params.city}
        defaultState={params.state}
      />
    </Suspense>
  );
}
