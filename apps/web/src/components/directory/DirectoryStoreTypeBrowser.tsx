'use client';

import { useRouter } from 'next/navigation';
import { Store, ChevronRight } from 'lucide-react';

interface StoreType {
  name: string;
  slug: string;
  storeCount: number;
}

interface DirectoryStoreTypeBrowserProps {
  storeTypes: StoreType[];
  currentType?: string;
  className?: string;
}

export default function DirectoryStoreTypeBrowser({
  storeTypes,
  currentType,
  className = '',
}: DirectoryStoreTypeBrowserProps) {
  const router = useRouter();

  // Show top store types (most stores)
  const topTypes = [...storeTypes]
    .sort((a, b) => b.storeCount - a.storeCount)
    .slice(0, 12);

  const handleTypeClick = (slug: string) => {
    router.push(`/directory/stores/${slug}`);
  };

  if (storeTypes.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏪</span>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Browse by Store Type
          </h2>
        </div>
        <button
          onClick={() => router.push('/directory/stores')}
          className="text-sm text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {topTypes.map((type) => (
          <button
            key={type.slug}
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
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Store className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-medium text-neutral-900 dark:text-white text-sm truncate">
                {type.name}
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                {type.storeCount} {type.storeCount === 1 ? 'store' : 'stores'}
              </p>
            </div>
          </button>
        ))}
      </div>

      {storeTypes.length > 12 && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => router.push('/directory/stores')}
            className="w-full py-2 text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
          >
            Browse all {storeTypes.length} store types →
          </button>
        </div>
      )}
    </div>
  );
}
