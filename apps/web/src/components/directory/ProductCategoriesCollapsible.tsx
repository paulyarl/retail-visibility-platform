"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import StoreDirectoryCategories from "./StoreDirectoryCategories";

interface ProductCategoriesCollapsibleProps {
  categories: any[];
  tenantId: string;
  uncategorizedCount: number;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ProductCategoriesCollapsible({
  categories,
  tenantId,
  uncategorizedCount,
}: ProductCategoriesCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalProducts = categories.reduce((sum: number, cat: any) => sum + (cat.count || 0), 0) + uncategorizedCount;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">
            Product Categories
          </h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {totalProducts} products
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4 mt-4">
            Browse products by category
          </p>
          {/* Enclosed Style Container */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <nav className="space-y-1">
              {/* All Products */}
              <Link
                href={`/tenant/${tenantId}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-700 font-medium">
                    All Products
                  </span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {totalProducts} products
                </span>
              </Link>

              {/* Individual Categories - with collapsing */}
              <StoreDirectoryCategories
                categories={categories}
                tenantId={tenantId}
                uncategorizedCount={uncategorizedCount}
              />
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
