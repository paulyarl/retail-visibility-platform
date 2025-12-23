"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface ProductCategoriesCollapsibleProps {
  categories: Category[];
  tenantId: string;
  totalProducts: number;
}

export default function ProductCategoriesCollapsible({
  categories,
  tenantId,
  totalProducts,
}: ProductCategoriesCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-6">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Product Categories
          </h2>
          <span className="text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-3 py-1 rounded-full">
            {totalProducts} products
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {/* All Products */}
            <Link
              href={`/tenant/${tenantId}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors group"
            >
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                All Products
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded-full">
                {totalProducts}
              </span>
            </Link>

            {/* Individual Categories */}
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/tenant/${tenantId}?category=${category.slug}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors group"
              >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {category.name}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded-full">
                  {category.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
