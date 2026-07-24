import { Suspense } from 'react';
import type { Metadata } from 'next';
import AllCategoriesClient from './AllCategoriesClient';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Categories - VisibleShelf Directory',
  description:
    'Browse local businesses by category on VisibleShelf. Find stores, services, restaurants, and more in your community.',
  openGraph: {
    title: 'Categories - VisibleShelf Directory',
    description: 'Browse local businesses by category on VisibleShelf.',
    type: 'website',
    images: [{ url: '/favicon.ico' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Categories - VisibleShelf Directory',
    description: 'Browse local businesses by category on VisibleShelf.',
    images: [{ url: '/favicon.ico' }],
  },
};

export default function AllCategoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">
              Loading categories...
            </p>
          </div>
        </div>
      }
    >
      <AllCategoriesClient />

            {/* Platform Branding Footer */}
            <PoweredByFooter />
    </Suspense>
  );
}
