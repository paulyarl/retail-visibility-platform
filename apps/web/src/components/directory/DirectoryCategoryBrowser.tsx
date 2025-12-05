'use client';

import { useRouter } from 'next/navigation';
import { Package, ChevronRight } from 'lucide-react';
import { calculatePopularityScore, SCORING_PRESETS, type CategoryMetrics, useSortedCategories } from '@/utils/popularityScoring';

interface Category {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  icon?: string | null;
  storeCount: number;
  primaryStoreCount?: number;
  secondaryStoreCount?: number;
  productCount: number;
}

interface DirectoryCategoryBrowserProps {
  categories: Category[];
  currentCategory?: string;
  className?: string;
}

export default function DirectoryCategoryBrowser({
  categories,
  currentCategory,
  className = '',
}: DirectoryCategoryBrowserProps) {
  const router = useRouter();

  // Use memoized hook for performance optimization
  // NEW: Use LOCATION_AWARE preset for proximity-based scoring
  const topCategories = useSortedCategories(
    categories as CategoryMetrics[], 
    12, 
    SCORING_PRESETS.LOCATION_AWARE
  );

  const handleCategoryClick = (slug: string) => {
    router.push(`/directory/categories/${slug}`);
  };

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏷️</span>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Browse by Business Categories
          </h2>
        </div>
        <button
          onClick={() => router.push('/directory/categories')}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {topCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.slug)}
            className={`
              flex items-start gap-3 p-4 rounded-lg border transition-all
              ${
                currentCategory === category.slug
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
              }
            `}
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
              {category.icon || <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-medium text-neutral-900 dark:text-white text-sm truncate">
                {category.name}
              </h3>
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                {/* For directory listing categories (store types), just show store count */}
                {category.storeCount} {category.storeCount === 1 ? 'store' : 'stores'}
              </div>
            </div>
          </button>
        ))}
      </div>

      {categories.length > 12 && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => router.push('/directory/categories')}
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Browse all {categories.length} categories →
          </button>
        </div>
      )}
    </div>
  );
}
