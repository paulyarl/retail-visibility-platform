'use client';

/**
 * DirectoryImmersiveLayout — Variant C
 *
 * Map-led exploration, conversion-focused.
 * Split view: left = scrollable results column (~40%), right = sticky full-height
 * DirectoryMapGoogle (~60%). Slim merged search/context bar.
 * On mobile: map collapses to a "View map" toggle; results list below.
 *
 * Does NOT fetch — consumes data from useDirectoryData() via props.
 */

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Map as MapIcon, List as ListIcon, SlidersHorizontal } from 'lucide-react';
import { Drawer } from '@mantine/core';
import dynamic from 'next/dynamic';
import DirectorySearchBar from '../DirectorySearchBar';
import DirectoryFilterRail from '../DirectoryFilterRail';
import StoreResults from '../StoreResults';
import { Pagination } from '@/components/ui';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import RandomFeaturedProducts from '@/components/directory/RandomFeaturedProducts';
import { ActiveFeaturedSection } from '../ActiveFeaturedSection';
import PromotedStoresCarousel from '@/components/directory/PromotedStoresCarousel';
import LastViewed from '@/components/directory/LastViewed';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import type { DirectoryLayoutProps } from '../types';

const DirectoryMapGoogle = dynamic(
  () => import('@/components/directory/DirectoryMapGoogle'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-400">
        Loading map...
      </div>
    ),
  },
);

export default function DirectoryImmersiveLayout({ data }: DirectoryLayoutProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const searchParams = useSearchParams();

  const currentPage = data.pagination?.page ?? 1;
  const totalPages = data.pagination?.totalPages ?? 1;
  const totalItems = data.pagination?.totalItems ?? 0;

  const mapFilters = {
    category: searchParams.get('category') || undefined,
    city: searchParams.get('city') || undefined,
    q: searchParams.get('q') || undefined,
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col">
      {/* Slim merged search/context bar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/80 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search bar — compact */}
            <div className="flex-1 min-w-[200px]">
              <DirectorySearchBar appearance="immersive" />
            </div>

            {/* Filter button */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>

            {/* Result count */}
            {totalItems > 0 && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400 hidden md:inline">
                {totalItems.toLocaleString()} stores
              </span>
            )}

            {/* Mobile map toggle */}
            <button
              onClick={() => setShowMapMobile(!showMapMobile)}
              className="lg:hidden inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {showMapMobile ? (
                <>
                  <ListIcon className="w-4 h-4" />
                  List
                </>
              ) : (
                <>
                  <MapIcon className="w-4 h-4" />
                  Map
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {data.error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-red-800 dark:text-red-200">{data.error}</p>
          </div>
        </div>
      )}

      {/* Split view — desktop */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 gap-4">
        {/* Left: results column (~40%) */}
        <div
          className={`${
            showMapMobile ? 'hidden lg:flex' : 'flex'
          } flex-col lg:w-[40%] xl:w-[38%] shrink-0`}
        >
          <div className="flex-1 overflow-y-auto lg:max-h-[calc(100vh-140px)] space-y-3 pr-1">
            <StoreResults
              stores={data.stores}
              loading={data.loading}
              viewMode="grid"
              appearance="immersive"
            />
          </div>

          {/* Pagination */}
          {!data.loading && totalItems > 0 && totalPages > 1 && (
            <div className="mt-4 flex justify-center">
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

        {/* Right: map (~60%) — sticky on desktop, toggle on mobile */}
        <div
          className={`${
            showMapMobile ? 'flex' : 'hidden lg:flex'
          } flex-1 lg:sticky lg:top-[80px] lg:h-[calc(100vh-140px)]`}
        >
          <div className="w-full h-[400px] lg:h-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
            <DirectoryMapGoogle
              listings={data.stores as any[]}
              useMapEndpoint={true}
              filters={mapFilters}
            />
          </div>
        </div>
      </div>

      {/* Random featured products — merchant visibility */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8 space-y-12">
        <ActiveFeaturedSection activeFeatured={data.activeFeatured} />
        <PromotedStoresCarousel />
        <ProductSingletonProvider>
          <RandomFeaturedProducts />
        </ProductSingletonProvider>

        {/* Recently viewed — conversion re-engagement */}
        <LastViewed />
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
