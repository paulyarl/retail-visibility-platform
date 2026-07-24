import { Suspense } from 'react';
import type { Metadata } from 'next';
import AllStoreTypesClient from './AllStoreTypesClient';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Store Types - VisibleShelf Directory',
  description:
    'Browse local stores by type on VisibleShelf. Find retail shops, services, restaurants, and more near you.',
  openGraph: {
    title: 'Store Types - VisibleShelf Directory',
    description: 'Browse local stores by type on VisibleShelf.',
    type: 'website',
    images: [{ url: '/favicon.ico' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Store Types - VisibleShelf Directory',
    description: 'Browse local stores by type on VisibleShelf.',
    images: [{ url: '/favicon.ico' }],
  },
};

export default function AllStoreTypesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">
              Loading store types...
            </p>
          </div>
        </div>
      }
    >
      <AllStoreTypesClient />

            {/* Platform Branding Footer */}
            <PoweredByFooter />
    </Suspense>
  );
}
