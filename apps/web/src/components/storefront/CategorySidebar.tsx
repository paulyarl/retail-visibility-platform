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

interface CategorySidebarProps {
  tenantId: string;
  categories: Category[];
  totalProducts: number;
}

export default function CategorySidebar({ tenantId, categories, totalProducts }: CategorySidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category');

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
        Categories
      </h2>
      
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

        {/* Category List */}
        {categories.map((category) => (
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
          No categories yet
        </p>
      )}
    </div>
  );
}
