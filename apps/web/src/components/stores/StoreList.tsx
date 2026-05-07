'use client';

import { useState, useEffect, useMemo } from 'react';
import { StoreCard, StoreData, StoreStats, ViewMode, LinkType } from './StoreCard';
import { fetchMultipleStoreStats } from '@/utils/storeStatsCalculator';

// ==================== TYPES ====================

export interface StoreListProps {
  stores: StoreData[];
  viewMode: ViewMode;
  linkType?: LinkType;
  showLogo?: boolean;
  showCategories?: boolean;
  maxCategories?: number;
  loading?: boolean;
  className?: string;
  gridClassName?: string;
}

// ==================== SKELETON COMPONENTS ====================

function GridSkeleton() {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-pulse">
      <div className="h-32 bg-neutral-200 dark:bg-neutral-700" />
      <div className="p-6">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2" />
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-4" />
        <div className="h-20 bg-neutral-200 dark:bg-neutral-700 rounded mb-4" />
        <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
      <div className="flex items-start space-x-4">
        <div className="w-16 h-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-4 min-w-[280px] animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
        </div>
      </div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-3" />
      <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded" />
    </div>
  );
}

// ==================== EMPTY STATE ====================

function EmptyState() {
  return (
    <div className="text-center py-16">
      <svg 
        className="mx-auto h-16 w-16 text-neutral-400 dark:text-neutral-600 mb-4" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.5} 
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
        />
      </svg>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        No stores found
      </h3>
      <p className="text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
        Try adjusting your search or filters to find what you&apos;re looking for.
      </p>
    </div>
  );
}

// ==================== STORE LIST COMPONENT ====================

export function StoreList({
  stores,
  viewMode,
  linkType = LinkType.Directory,
  showLogo = true,
  showCategories = true,
  maxCategories = 3,
  loading = false,
  className = '',
  gridClassName = ''
}: StoreListProps) {
  const [storeStats, setStoreStats] = useState<Record<string, StoreStats>>({});
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});

  // Fetch store stats for all stores
  useEffect(() => {
    if (stores.length > 0 && !loading) {
      // console.log(`StoreList: ${stores.length} stores`, stores);
      const fetchAllStats = async () => {
        // Set loading state for all stores
        const loadingState: Record<string, boolean> = {};
        stores.forEach(store => {
          loadingState[store.tenantId] = true;
        });
        setStatsLoading(loadingState);

        // Fetch stats in batch
        const tenantIds = [...new Set(stores.map(store => store.tenantId))];
        const allStats = await fetchMultipleStoreStats(tenantIds);

        setStoreStats(allStats);

        // Clear loading state
        const finalLoadingState: Record<string, boolean> = {};
        tenantIds.forEach(tenantId => {
          finalLoadingState[tenantId] = false;
        });
        setStatsLoading(finalLoadingState);
      };

      fetchAllStats();
    }
  }, [stores, loading]);

  // Loading state
  if (loading) {
    if (viewMode === 'grid') {
      return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${gridClassName}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <GridSkeleton key={i} />
          ))}
        </div>
      );
    }
    if (viewMode === 'list') {
      return (
        <div className={`space-y-4 ${className}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <ListSkeleton key={i} />
          ))}
        </div>
      );
    }
    if (viewMode === 'map') {
      return (
        <div className={`space-y-4 ${className}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <MapSkeleton key={i} />
          ))}
        </div>
      );
    }
  }

  // Empty state
  if (stores.length === 0) {
    return <EmptyState />;
  }

  // Grid view
  if (viewMode === 'grid') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${gridClassName}`}>
        {stores.map((store) => (
          <StoreCard
            key={store.tenantId}
            store={store}
            viewMode="grid"
            linkType={linkType}
            showLogo={showLogo}
            showCategories={showCategories}
            maxCategories={maxCategories}
            stats={storeStats[store.tenantId] || null}
            statsLoading={statsLoading[store.tenantId]}
          />
        ))}
      </div>
    );
  }

  // List view
  if (viewMode === 'list') {
    return (
      <div className={`space-y-4 ${className}`}>
        {stores.map((store) => (
          <StoreCard
            key={store.tenantId}
            store={store}
            viewMode="list"
            linkType={linkType}
            showLogo={showLogo}
            showCategories={showCategories}
            maxCategories={maxCategories}
            stats={storeStats[store.tenantId] || null}
            statsLoading={statsLoading[store.tenantId]}
          />
        ))}
      </div>
    );
  }

  // Map view - just render cards, map container handles positioning
  if (viewMode === 'map') {
    return (
      <div className={className}>
        {stores.map((store) => (
          <StoreCard
            key={store.tenantId}
            store={store}
            viewMode="map"
            linkType={linkType}
            showLogo={showLogo}
            showCategories={showCategories}
            maxCategories={maxCategories}
            stats={storeStats[store.tenantId] || null}
            statsLoading={statsLoading[store.tenantId]}
          />
        ))}
      </div>
    );
  }

  return null;
}

export default StoreList;
