'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  category_type?: string;
  is_primary?: boolean;
}

interface StoreCategorySidebarProps {
  tenantId: string;
  categories: Category[];
  totalProducts: number;
}

export default function StoreCategorySidebar({ tenantId, categories, totalProducts }: StoreCategorySidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category');

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
          Browse by Store Type
        </h2>
        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
          Store Categories
        </span>
      </div>
      
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Note:</strong> Store categories include all {totalProducts} products in this store.
        </p>
      </div>
      
      <nav className="space-y-1">
        {/* All Products */}
        <Link
          href={`/tenant/${tenantId}`}
          className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
            !currentCategory
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
        >
          <span>All Products</span>
          <span className={`text-sm ${
            !currentCategory
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-neutral-500 dark:text-neutral-400'
          }`}>
            {totalProducts}
          </span>
        </Link>

        {/* Store Category List */}
        {sortedCategories.map((category) => (
          <Link
            key={category.id}
            href={`/tenant/${tenantId}?category=${category.slug}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
              currentCategory === category.slug
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{category.name}</span>
              {category.is_primary && (
                <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  Primary
                </span>
              )}
            </div>
            <span className={`text-sm ${
              currentCategory === category.slug
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              {category.count}
            </span>
          </Link>
        ))}
      </nav>

      {/* Empty State */}
      {categories.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
          No store categories yet
        </p>
      )}
    </div>
  );
}
