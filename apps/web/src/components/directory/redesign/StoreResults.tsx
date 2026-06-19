'use client';

/**
 * StoreResults — renders grid, list, or map of stores.
 *
 * Grid: StoreCardV2 cards (3-up desktop, 2-up tablet, 1-up mobile).
 * List: reuses existing DirectoryList component.
 * Map: reuses existing DirectoryMapGoogle (dynamic import).
 *
 * Loading: 6-9 skeleton cards (not full-page spinner).
 * Empty: friendly message + "Clear filters" CTA.
 *
 * appearance prop passes through to StoreCardV2 and adjusts grid density.
 */

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { PackageSearch, X } from 'lucide-react';
import StoreCardV2 from './StoreCardV2';
import DirectoryList from '@/components/directory/DirectoryList';
import type { DirectoryStore } from '@/services/DirectorySingletonService';
import type { DirectoryLayoutKey, DirectoryViewMode } from './types';

const DirectoryMapGoogle = dynamic(
  () => import('@/components/directory/DirectoryMapGoogle'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-400">
        Loading map...
      </div>
    ),
  },
);

interface StoreResultsProps {
  stores: DirectoryStore[];
  loading: boolean;
  viewMode: DirectoryViewMode;
  appearance?: DirectoryLayoutKey;
  searchParams?: { category?: string; city?: string; q?: string };
}

export default function StoreResults({
  stores,
  loading,
  viewMode,
  appearance = 'discovery',
  searchParams: sp = {},
}: StoreResultsProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();

  // Loading skeletons
  if (loading) {
    const skeletonCount = appearance === 'immersive' ? 6 : 9;
    return (
      <div
        className={
          appearance === 'immersive'
            ? 'space-y-3'
            : `grid gap-6 ${
                appearance === 'editorial'
                  ? 'sm:grid-cols-2'
                  : 'sm:grid-cols-2 xl:grid-cols-3'
              }`
        }
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} immersive={appearance === 'immersive'} />
        ))}
      </div>
    );
  }

  // Empty state
  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <PackageSearch className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          No stores match your filters
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          Try adjusting your search or clearing some filters.
        </p>
        <button
          onClick={() => router.push('/directory')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Clear filters
        </button>
      </div>
    );
  }

  // Grid view
  if (viewMode === 'grid') {
    return (
      <div
        className={`grid gap-6 ${
          appearance === 'editorial'
            ? 'sm:grid-cols-2'
            : 'sm:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {stores.map((store) => (
          <StoreCardV2
            key={store.id || store.tenantId}
            store={store}
            appearance={appearance}
          />
        ))}
      </div>
    );
  }

  // List view — reuse existing DirectoryList
  if (viewMode === 'list') {
    return (
      <DirectoryList
        listings={stores as any[]}
        loading={false}
        showLogo={true}
        viewMode="list"
      />
    );
  }

  // Map view — reuse existing DirectoryMapGoogle
  return (
    <DirectoryMapGoogle
      listings={stores as any[]}
      useMapEndpoint={true}
      filters={{
        category: sp.category || urlSearchParams.get('category') || undefined,
        city: sp.city || urlSearchParams.get('city') || undefined,
        q: sp.q || urlSearchParams.get('q') || undefined,
      }}
    />
  );
}

function SkeletonCard({ immersive }: { immersive: boolean }) {
  if (immersive) {
    return (
      <div className="flex items-start gap-3 p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 animate-pulse">
        <div className="w-14 h-14 shrink-0 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
          <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
          <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-pulse">
      <div className="aspect-video bg-neutral-200 dark:bg-neutral-800" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full w-20" />
          <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full w-16" />
        </div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
      </div>
    </div>
  );
}
