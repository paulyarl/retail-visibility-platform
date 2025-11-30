'use client';

import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  category_type?: string;
  is_primary?: boolean;
}

interface GBPCategoriesNavProps {
  tenantId: string;
  categories: Category[];
}

export default function GBPCategoriesNav({ tenantId, categories }: GBPCategoriesNavProps) {
  // Sort categories: primary first, then secondary alphabetically
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1; // a comes first
    if (!a.is_primary && b.is_primary) return 1;  // b comes first
    return a.name.localeCompare(b.name); // both secondary, sort alphabetically
  });

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Browse Store Types
        </h2>
        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
          Store Categories
        </span>
      </div>
      
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Store Types:</strong> Click to browse all stores of this type in our directory.
        </p>
      </div>
      
      <nav className="space-y-1">
        {sortedCategories.map((category) => (
          <Link
            key={category.id}
            href={`/directory?store_type=${encodeURIComponent(category.slug)}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-primary-600 dark:hover:text-primary-400`}
          >
            <div className="flex items-center gap-2">
              <span>{category.name}</span>
              {category.is_primary && (
                <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  Primary
                </span>
              )}
            </div>
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        ))}
      </nav>

      {/* Empty State */}
      {categories.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
          No store categories available
        </p>
      )}
    </div>
  );
}
