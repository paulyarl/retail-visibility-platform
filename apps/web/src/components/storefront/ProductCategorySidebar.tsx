'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  category_type?: string;
  is_primary?: boolean;
}

interface ProductCategorySidebarProps {
  tenantId: string;
  categories: Category[];
  totalProducts: number;
  collapseThreshold?: number; // Number of categories before collapsing into dropdown
}

const DEFAULT_COLLAPSE_THRESHOLD = 10;

export default function ProductCategorySidebar({ 
  tenantId, 
  categories, 
  totalProducts,
  collapseThreshold = DEFAULT_COLLAPSE_THRESHOLD 
}: ProductCategorySidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const shouldCollapse = categories.length > collapseThreshold;
  const visibleCategories = shouldCollapse && !isExpanded 
    ? categories.slice(0, collapseThreshold) 
    : categories;
  const hiddenCount = categories.length - collapseThreshold;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          Product Categories
        </h2>
        <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
          Store Product Categories
        </span>
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

        {/* Product Category List */}
        {visibleCategories.map((category) => (
          <Link
            key={category.id}
            href={`/tenant/${tenantId}?category=${category.slug}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
              currentCategory === category.slug
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
          >
            <span className="truncate">{category.name}</span>
            <span className={`text-sm flex-shrink-0 ml-2 ${
              currentCategory === category.slug
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              {category.count}
            </span>
          </Link>
        ))}

        {/* Show More/Less Button */}
        {shouldCollapse && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center w-full px-3 py-2 mt-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Show {hiddenCount} More
              </>
            )}
          </button>
        )}
      </nav>

      {/* Empty State */}
      {categories.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
          No product categories yet
        </p>
      )}
    </div>
  );
}
