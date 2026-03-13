"use client";

import { useState, useEffect } from 'react';
import { UnifiedStoreCard, DirectoryListing } from './UnifiedStoreCard';
import { Skeleton } from '@/components/ui';
import { fetchMultipleStoreStats } from '@/utils/storeStatsCalculator';

interface DirectoryListProps {
  listings: DirectoryListing[];
  loading?: boolean;
  contextCategory?: string; // Override category display (e.g., for product category pages)
  showLogo?: boolean; // Whether to display store logos
}



export default function DirectoryList({ listings, loading, contextCategory, showLogo = true }: DirectoryListProps) {
  const [storeStats, setStoreStats] = useState<Record<string, any>>({});
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});

  // Fetch store stats for all listings
  useEffect(() => {
    if (listings.length > 0) {
      const fetchAllStats = async () => {
        const loading: Record<string, boolean> = {};
        listings.forEach(listing => {
          loading[listing.tenantId] = true;
        });
        setStatsLoading(loading);

        const tenantIds = [...new Set(listings.map(listing => listing.tenantId))];
        const allStats = await fetchMultipleStoreStats(tenantIds);

        setStoreStats(allStats);

        const finalLoading: Record<string, boolean> = {};
        tenantIds.forEach(tenantId => {
          finalLoading[tenantId] = false;
        });
        setStatsLoading(finalLoading);
      };

      fetchAllStats();
    }
  }, [listings]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
            <div className="flex gap-4">
              {showLogo && <div className="w-24 h-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg shrink-0" />}
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4" />
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (listings.length === 0) {
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
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {listings.map((listing, index) => {
        const stats = storeStats[listing.tenantId];
        
        return (
          <UnifiedStoreCard
            key={listing.id}
            listing={listing}
            viewMode="list"
            linkType="directory"
            contextCategory={contextCategory}
            showLogo={showLogo}
            enhancedStats={stats ? {
              totalProducts: stats.totalProducts || 0,
              categories: stats.categories || [],
              ratingAvg: stats.ratingAvg || 0,
              ratingCount: stats.ratingCount || 0,
              rating3Count: stats.rating3Count || 0,
              rating4Count: stats.rating4Count || 0,
              rating5Count: stats.rating5Count || 0,
              verifiedPurchaseCount: stats.verifiedPurchaseCount || 0,
              lastReviewAt: stats.lastReviewAt || null,
              isFeatured: listing.isFeatured || false,
            } : undefined}
          />
        );
      })}
    </div>
  );
}


export { DirectoryList };
