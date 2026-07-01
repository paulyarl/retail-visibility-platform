'use client';

/**
 * DirectoryEditorialLayout — Variant B
 *
 * Magazine-style curation. Full-bleed hero, curated rows above the grid,
 * 2-up large cards, filters as top chip row instead of left rail.
 *
 * Does NOT fetch — consumes data from useDirectoryData() via props.
 */

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal, X, Sparkles, Store as StoreIcon } from 'lucide-react';
import Link from 'next/link';
import { Drawer } from '@mantine/core';
import DirectoryHero from '../DirectoryHero';
import DirectoryContextBar from '../DirectoryContextBar';
import DirectoryFilterRail from '../DirectoryFilterRail';
import StoreResults from '../StoreResults';
import { Pagination } from '@/components/ui';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import DirectoryCategoryBrowser from '@/components/directory/DirectoryCategoryBrowser';
import RandomFeaturedProducts from '@/components/directory/RandomFeaturedProducts';
import { ActiveFeaturedSection } from '../ActiveFeaturedSection';
import FeaturedStoresList from '@/components/directory/FeaturedStoresList';
import LastViewed from '@/components/directory/LastViewed';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import { StoreSingletonProvider } from '@/providers/data/StoreSingleton';
import type { DirectoryLayoutProps } from '../types';

export default function DirectoryEditorialLayout({ data }: DirectoryLayoutProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentPage = data.pagination?.page ?? 1;
  const totalPages = data.pagination?.totalPages ?? 1;
  const totalItems = data.pagination?.totalItems ?? 0;

  const showDiscoverySections = !data.hasActiveQuery;

  // Active filter chips for the top chip row
  const activeChips: { label: string; param: string }[] = [];
  if (data.searchQuery) activeChips.push({ label: `"${data.searchQuery}"`, param: 'q' });
  if (data.activeCategory) activeChips.push({ label: data.activeCategory, param: 'category' });
  const storeType = searchParams.get('storeType');
  if (storeType) activeChips.push({ label: storeType, param: 'storeType' });

  const removeChip = (param: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(param);
    params.delete('page');
    router.push(`/directory?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Full-bleed hero */}
      <DirectoryHero
        totalStores={data.counts.totalStores}
        totalCategories={data.counts.totalCategories}
        openNowCount={data.counts.openNowCount}
        appearance="editorial"
      />

      {/* Context bar */}
      <DirectoryContextBar
        viewMode={data.viewMode}
        onViewModeChange={data.setViewMode}
        currentPage={currentPage}
        pageSize={data.pageSize}
        totalItems={totalItems}
        userLocationLabel={
          data.userLocation
            ? `${data.userLocation.city}, ${data.userLocation.state}`
            : null
        }
      />

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error state */}
        {data.error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-red-800 dark:text-red-200">{data.error}</p>
          </div>
        )}

        {/* Filter chip row + mobile filter button */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

          {activeChips.map((chip) => (
            <span
              key={chip.param}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium"
            >
              {chip.label}
              <button
                onClick={() => removeChip(chip.param)}
                className="hover:text-blue-900 dark:hover:text-blue-100"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Curated rows — only when no active query */}
        {showDiscoverySections && (
          <div className="mb-12 space-y-12">
            {/* Featured stores — horizontal scroll */}
            <StoreSingletonProvider>
              <section>
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-6">
                  Featured Near You
                </h2>
                <FeaturedStoresList
                  limit={6}
                  showLocation={true}
                  showRating={true}
                  showProductCount={true}
                  viewMode="grid"
                  userLocation={
                    data.userLocation
                      ? {
                          lat: data.userLocation.latitude,
                          lng: data.userLocation.longitude,
                        }
                      : undefined
                  }
                />
              </section>
            </StoreSingletonProvider>

            {/* Trending categories — large tiles */}
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-6">
                Browse Categories
              </h2>
              <DirectoryCategoryBrowser
                categories={data.categories}
                className=""
              />
            </section>
          </div>
        )}

        {/* Results grid — 2-up large cards */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-6">
            {data.hasActiveQuery ? 'Results' : 'All Stores'}
          </h2>
          <StoreResults
            stores={data.stores}
            loading={data.loading}
            viewMode={data.viewMode}
            appearance="editorial"
          />

          {/* Pagination */}
          {!data.loading && totalItems > 0 && totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={data.pageSize}
                onPageChange={data.handlePageChange}
                onPageSizeChange={data.setPageSize}
                pageSizeOptions={[12, 24, 48, 96]}
              />
            </div>
          )}
        </section>

        {/* More discovery sections */}
        {showDiscoverySections && (
          <div className="mt-12 space-y-12">
            <ActiveFeaturedSection activeFeatured={data.activeFeatured} />
            <ProductSingletonProvider>
              <RandomFeaturedProducts />
            </ProductSingletonProvider>

            <LastViewed />
          </div>
        )}

        {/* CTAs */}
        {!data.loading && (
          <div className="mt-16 grid md:grid-cols-2 gap-6">
            <div className="p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
              <div className="text-center">
                <StoreIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
                  Are you a merchant?
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  Get your store listed in our directory and reach more customers.
                </p>
                <a
                  href="/register"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Get Started →
                </a>
              </div>
            </div>

            <div className="p-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 mb-3">
                  <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    How does this work?
                  </h2>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  Discover the zero-effort magic behind this directory.
                </p>
                <Link
                  href="/directory/about"
                  className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
                >
                  See the Magic →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      <Drawer
        opened={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Filters"
        position="right"
        size="sm"
        classNames={{ content: 'bg-white dark:bg-neutral-900' }}
      >
        <DirectoryFilterRail
          categories={data.categories}
          storeTypes={data.storeTypes}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
        />
      </Drawer>

      <PoweredByFooter />
    </div>
  );
}
