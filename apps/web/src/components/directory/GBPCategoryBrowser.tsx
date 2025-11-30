'use client';

import Link from 'next/link';
import { calculatePopularityScore, SCORING_PRESETS, type CategoryMetrics, useSortedCategories } from '@/utils/popularityScoring';

interface GBPCategory {
  categorySlug: string;
  categoryName: string;
  categoryIcon: string;
  totalStores: string;
  totalProducts: string;
  isPrimary: number;
}

interface GBPCategoryBrowserProps {
  gbpCategories: GBPCategory[];
  className?: string;
}

export default function GBPCategoryBrowser({ gbpCategories, className = '' }: GBPCategoryBrowserProps) {
  // Convert GBP categories to CategoryMetrics format
  const convertedCategories = gbpCategories.map(cat => ({
    id: cat.categorySlug,
    slug: cat.categorySlug,
    name: cat.categoryName,
    icon: cat.categoryIcon,
    storeCount: parseInt(cat.totalStores || '0'),
    productCount: parseInt(cat.totalProducts || '0'),
    isPrimary: cat.isPrimary === 1,
    categorySlug: cat.categorySlug,
    categoryName: cat.categoryName,
  } as CategoryMetrics));

  // Use memoized hook for performance optimization
  // NEW: Use LOCATION_AWARE preset for proximity-based scoring
  const topCategories = useSortedCategories(
    convertedCategories, 
    12, 
    SCORING_PRESETS.LOCATION_AWARE
  );

  if (!gbpCategories || gbpCategories.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Business Categories
        </h2>
        <Link
          href="/directory/categories"
          className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
        >
          Browse all →
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {topCategories.map((category) => {
          // Find original GBP category for display data
          const originalCategory = gbpCategories.find(
            cat => cat.categorySlug === category.categorySlug
          );
          
          if (!originalCategory) return null;
          
          return (
            <Link
              key={category.categorySlug}
              href={`/directory/categories/${category.categorySlug}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-purple-200 dark:border-purple-700/50 bg-linear-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 flex-1">
                <span className="text-lg">
                  {originalCategory.categoryIcon || '🏢'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
                      {originalCategory.categoryName}
                    </span>
                    {originalCategory.isPrimary === 1 && (
                      <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-full whitespace-nowrap">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {originalCategory.totalStores} stores
                    </span>
                    {originalCategory.totalProducts && originalCategory.totalProducts !== '0' && (
                      <span>
                        {originalCategory.totalProducts} products
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      
      {gbpCategories.length > 12 && (
        <div className="mt-4 text-center">
          <Link
            href="/directory/categories"
            className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
          >
            View all {gbpCategories.length} categories →
          </Link>
        </div>
      )}
    </div>
  );
}
