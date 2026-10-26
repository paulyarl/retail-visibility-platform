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
import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import DirectoryHero from '../DirectoryHero';
import DirectoryContextBar from '../DirectoryContextBar';
import DirectoryFilterRail from '../DirectoryFilterRail';
import StoreResults from '../StoreResults';
import { Pagination } from '@/components/ui';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { MarketIntelBanner } from '@/components/place/MarketIntelBanner';
import DirectoryCategoryBrowser from '@/components/directory/DirectoryCategoryBrowser';
import DirectoryMerchantCtaBand from '@/components/directory/DirectoryMerchantCtaBand';
import DirectoryStoreTypeBrowser from '@/components/directory/DirectoryStoreTypeBrowser';
import RandomFeaturedProducts from '@/components/directory/RandomFeaturedProducts';
import { ActiveFeaturedSection } from '../ActiveFeaturedSection';
import FeaturedStoresList from '@/components/directory/FeaturedStoresList';
import PromotedStoresCarousel from '@/components/directory/PromotedStoresCarousel';
import LastViewed from '@/components/directory/LastViewed';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import { StoreSingletonProvider } from '@/providers/data/StoreSingleton';
import { usePlatformUrl } from '@/components/storefront/StorefrontUrlContext';
import type { DirectoryLayoutProps } from '../types';

export default function DirectoryDiscoveryLayout({ data }: DirectoryLayoutProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const platformUrl = usePlatformUrl();

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
            locations={data.locations}
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
              shelfRef="directory/home"
            />

            {/* Square banner slot (300x250) — in-feed, after the results grid. */}
            {totalItems > 0 && (
              <div className="mt-10 flex justify-center">
                <MarketIntelBanner variant="square" surfaceType="directory" />
              </div>
            )}

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

            {/* Active featured products */}
            <ActiveFeaturedSection activeFeatured={data.activeFeatured} />

            {/* Promoted stores carousel */}
            <PromotedStoresCarousel />

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
                    href={platformUrl('/directory/stores')}
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

        {/* Tall banner slot (300x600) — in-flow, before the CTA band. No
            teaser on the home surface → house creative fallback. */}
        {!data.loading && (
          <div className="mt-12 flex justify-center">
            <MarketIntelBanner variant="tall" surfaceType="directory" />
          </div>
        )}

        {/* CTAs */}
        {!data.loading && <DirectoryMerchantCtaBand source="/directory" />}
      </div>

      <PoweredByFooter />
    </div>
  );
}
