"use client";

import { UnifiedStoreCard, DirectoryListing } from './UnifiedStoreCard';
import { Skeleton } from '@/components/ui';

interface DirectoryListProps {
  listings: DirectoryListing[];
  loading?: boolean;
  contextCategory?: string; // Override category display (e.g., for product category pages)
  showLogo?: boolean; // Whether to display store logos
}

export default function DirectoryList({ listings, loading, contextCategory, showLogo = true }: DirectoryListProps) {
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
      {listings.map((listing, index) => (
        <UnifiedStoreCard
          key={listing.id}
          listing={listing}
          viewMode="list"
          linkType="directory"
          contextCategory={contextCategory}
          showLogo={showLogo}
        />
      ))}
    </div>
  );
}

export { DirectoryList };
