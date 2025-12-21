'use client';

import { useState } from 'react';
import Link from 'next/link';

interface StoreDirectoryCategoriesProps {
  categories: any[];
  tenantId: string;
  uncategorizedCount: number;
}

export default function StoreDirectoryCategories({
  categories,
  tenantId,
  uncategorizedCount
}: StoreDirectoryCategoriesProps) {
  // Individual Categories - with collapsing
  return (() => {
    const collapseThreshold = 10;
    const shouldCollapse = categories.length > collapseThreshold;
    const [isExpanded, setIsExpanded] = useState(false);
    const visibleCategories = shouldCollapse && !isExpanded
      ? categories.slice(0, collapseThreshold)
      : categories;
    const hiddenCount = categories.length - collapseThreshold;

    return (
      <>
        {visibleCategories.map((category: any) => (
          <Link
            key={category.id}
            href={`/tenant/${tenantId}?category=${category.slug}`}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-700 font-medium truncate">
                {category.name}
              </span>
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
              {category.count} products
            </span>
          </Link>
        ))}

        {/* Show More/Less Button */}
        {shouldCollapse && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center w-full px-3 py-2 mt-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Show Less
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Show {hiddenCount} More
              </>
            )}
          </button>
        )}

        {/* Uncategorized */}
        {uncategorizedCount > 0 && (
          <Link
            href={`/tenant/${tenantId}`}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-700 font-medium">
                Other
              </span>
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {uncategorizedCount} products
            </span>
          </Link>
        )}
      </>
    );
  })();
}
