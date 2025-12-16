'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { calculatePopularityScore, SCORING_PRESETS, type CategoryMetrics, useSortedCategories } from '@/utils/popularityScoring';
import { getStoreTypeUrl } from '@/utils/slug';

interface StoreType {
  name: string;
  slug: string;
  storeCount: number;
  primaryStoreCount?: number;
  secondaryStoreCount?: number;
}

interface DirectoryStoreTypeBrowserProps {
  storeTypes: StoreType[];
  currentType?: string;
  className?: string;
  defaultExpanded?: boolean;
}

export default function DirectoryStoreTypeBrowser({
  storeTypes,
  currentType,
  className = '',
  defaultExpanded = false,
}: DirectoryStoreTypeBrowserProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Filter out store types with zero stores
  const nonEmptyStoreTypes = storeTypes.filter(type => type.storeCount > 0);

  // Convert store types to CategoryMetrics format for scoring
  const convertedStoreTypes = nonEmptyStoreTypes.map(type => ({
    id: type.slug,
    slug: type.slug,
    name: type.name,
    icon: '🏪', // Default icon for store types
    storeCount: type.storeCount,
    productCount: 0, // Store types don't have product counts
  } as CategoryMetrics));

  // Use memoized hook for performance optimization
  // NEW: Use LOCATION_AWARE preset for proximity-based scoring
  const topStoreTypes = useSortedCategories(
    convertedStoreTypes, 
    12, 
    SCORING_PRESETS.LOCATION_AWARE
  );

  const handleTypeClick = (slug: string) => {
    router.push(getStoreTypeUrl(slug));
  };

  // Show collapsed header even when loading (storeTypes empty)
  // Content only shows when expanded AND has data

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 ${className}`}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🏪</span>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Browse by Store Type
          </h2>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {nonEmptyStoreTypes.length > 0 ? `(${nonEmptyStoreTypes.length})` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <span
              onClick={(e) => { e.stopPropagation(); router.push('/directory/stores'); }}
              className="text-sm text-green-600 dark:text-green-400 hover:underline"
            >
              View all
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-neutral-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-500" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-6 pb-6">
          {nonEmptyStoreTypes.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              <div className="animate-pulse">Loading store types...</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {topStoreTypes.map((type: any, index: number) => (
                  <button
                    key={`${type.slug}-${index}`}
                    onClick={() => handleTypeClick(type.slug)}
                    className={`
                      flex items-start gap-3 p-4 rounded-lg border transition-all
                      ${
                        currentType === type.slug
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-green-300 dark:hover:border-green-600 hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                      }
                    `}
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl">
                      <Store className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <h3 className="font-medium text-neutral-900 dark:text-white text-sm truncate">
                        {type.name}
                      </h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                        {type.storeCount} {type.storeCount === 1 ? 'store' : 'stores'}
                        {type.primaryStoreCount !== undefined && type.secondaryStoreCount !== undefined && (
                          <span className="ml-1 text-neutral-500">
                            ({type.primaryStoreCount > 0 && `${type.primaryStoreCount} primary`}
                            {type.primaryStoreCount > 0 && type.secondaryStoreCount > 0 && ', '}
                            {type.secondaryStoreCount > 0 && `${type.secondaryStoreCount} also`})
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {nonEmptyStoreTypes.length > 12 && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <button
                    onClick={() => router.push('/directory/stores')}
                    className="w-full py-2 text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
                  >
                    Browse all {nonEmptyStoreTypes.length} store types →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
