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
  title?: string;
}

export default function GBPCategoriesNav({ tenantId, categories, title = "Browse Store Types" }: GBPCategoriesNavProps) {
  // Sort categories: primary first, then secondary alphabetically
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1; // a comes first
    if (!a.is_primary && b.is_primary) return 1;  // b comes first
    return a.name.localeCompare(b.name); // both secondary, sort alphabetically
  });

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          {title}
        </h2>
        <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
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
            href={`/directory/stores/${category.slug}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-primary-600 dark:hover:text-primary-400`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate">{category.name}</span>
              {category.is_primary && (
                <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full whitespace-nowrap">
                  Primary
                </span>
              )}
            </div>
            <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-2">
              {category.count}
            </span>
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
