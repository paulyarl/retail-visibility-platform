'use client';

/**
 * DirectoryDiscoveryLayout — Variant A (default)
 *
 * Location-first marketplace discovery surface.
 * Compose: Hero → ContextBar → 2-col (FilterRail + StoreResults) →
 * discovery sections (only when no active query/filter) → CTAs → Footer.
 *
 * Does NOT fetch — consumes data from useDirectoryData() via props.
 */

import { useState } from 'react';
import { SlidersHorizontal, Sparkles, Store as StoreIcon } from 'lucide-react';
import Link from 'next/link';
import DirectoryHero from '../DirectoryHero';
import DirectoryContextBar from '../DirectoryContextBar';
import DirectoryFilterRail from '../DirectoryFilterRail';
import StoreResults from '../StoreResults';
import { Pagination } from '@/components/ui';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import DirectoryCategoryBrowser from '@/components/directory/DirectoryCategoryBrowser';
import DirectoryStoreTypeBrowser from '@/components/directory/DirectoryStoreTypeBrowser';
import RandomFeaturedProducts from '@/components/directory/RandomFeaturedProducts';
import FeaturedStoresList from '@/components/directory/FeaturedStoresList';
import LastViewed from '@/components/directory/LastViewed';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import { StoreSingletonProvider } from '@/providers/data/StoreSingleton';
import type { DirectoryLayoutProps } from '../types';

export default function DirectoryDiscoveryLayout({ data }: DirectoryLayoutProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const currentPage = data.pagination?.page ?? 1;
  const totalPages = data.pagination?.totalPages ?? 1;
  const totalItems = data.pagination?.totalItems ?? 0;

  const showDiscoverySections = !data.hasActiveQuery;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Hero */}
      <DirectoryHero
        totalStores={data.counts.totalStores}
        totalCategories={data.counts.totalCategories}
        openNowCount={data.counts.openNowCount}
        appearance="discovery"
      />

      {/* Context Bar */}
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

        {/* Mobile filter button */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {data.activeCategory && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-blue-600 text-white">
                1
              </span>
            )}
          </button>
        </div>

        {/* 2-column layout: filter rail + results */}
        <div className="flex gap-6">
          <DirectoryFilterRail
            categories={data.categories}
            storeTypes={data.storeTypes}
            mobileOpen={mobileFiltersOpen}
            onMobileClose={() => setMobileFiltersOpen(false)}
          />

          <div className="flex-1 min-w-0">
            {/* Results */}
            <StoreResults
              stores={data.stores}
              loading={data.loading}
              viewMode={data.viewMode}
              appearance="discovery"
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
          </div>
        </div>

        {/* Discovery sections — only when no active query/filter */}
        {showDiscoverySections && (
          <div className="mt-12 space-y-12">
            {/* Category browser */}
            <DirectoryCategoryBrowser
              categories={data.categories}
              className=""
            />

            {/* Store type browser */}
            <DirectoryStoreTypeBrowser
              storeTypes={data.storeTypes}
              className=""
            />

            {/* Random featured products */}
            <ProductSingletonProvider>
              <RandomFeaturedProducts />
            </ProductSingletonProvider>

            {/* Featured stores */}
            <StoreSingletonProvider>
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    Featured Stores
                  </h2>
                  <Link
                    href="/directory/stores"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    View all stores →
                  </Link>
                </div>
                <FeaturedStoresList
                  limit={8}
                  showLocation={true}
                  showRating={true}
                  showProductCount={true}
                  userLocation={
                    data.userLocation
                      ? {
                          lat: data.userLocation.latitude,
                          lng: data.userLocation.longitude,
                        }
                      : undefined
                  }
                />
              </div>
            </StoreSingletonProvider>

            {/* Last viewed */}
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
                  It's free and takes just a few minutes to set up.
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
                  No manual curation, just pure automation.
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

      <PoweredByFooter />
    </div>
  );
}
