'use client';

import Link from 'next/link';
import { ChevronRight, Package, DollarSign, Image } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  inStockProducts?: number;
  avgPriceCents?: number;
  productsWithImages?: number;
  productsWithDescriptions?: number;
}

interface ProductCategoryContextProps {
  tenantId: string;
  currentCategory: Category;
  allCategories: Category[];
  totalProducts: number;
}

export default function ProductCategoryContext({ 
  tenantId, 
  currentCategory, 
  allCategories, 
  totalProducts 
}: ProductCategoryContextProps) {
  // Find related categories (same parent or similar price range)
  const relatedCategories = allCategories
    .filter(cat => cat.id !== currentCategory.id)
    .filter(cat => {
      // Similar price range (within 50%)
      if (currentCategory.avgPriceCents && cat.avgPriceCents) {
        const priceDiff = Math.abs(currentCategory.avgPriceCents - cat.avgPriceCents);
        return priceDiff <= (currentCategory.avgPriceCents * 0.5);
      }
      return false;
    })
    .slice(0, 5);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          Category Insights
        </h2>
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <Package className="w-4 h-4" />
          <span>
            Browsing <span className="font-medium text-neutral-900 dark:text-white">{currentCategory.name}</span>
          </span>
        </div>
      </div>

      {/* Current Category Stats */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
          {currentCategory.name} Category
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-blue-700 dark:text-blue-300 font-medium">
              {currentCategory.count}
            </div>
            <div className="text-blue-600 dark:text-blue-400">Total Products</div>
          </div>
          {currentCategory.inStockProducts !== undefined && (
            <div>
              <div className="text-green-700 dark:text-green-300 font-medium">
                {currentCategory.inStockProducts}
              </div>
              <div className="text-green-600 dark:text-green-400">In Stock</div>
            </div>
          )}
          {currentCategory.avgPriceCents && (
            <div>
              <div className="text-blue-700 dark:text-blue-300 font-medium">
                ${(currentCategory.avgPriceCents / 100).toFixed(2)}
              </div>
              <div className="text-blue-600 dark:text-blue-400">Avg Price</div>
            </div>
          )}
          {currentCategory.productsWithImages !== undefined && (
            <div>
              <div className="text-blue-700 dark:text-blue-300 font-medium">
                {currentCategory.productsWithImages}
              </div>
              <div className="text-blue-600 dark:text-blue-400">With Images</div>
            </div>
          )}
        </div>
      </div>

      {/* Related Categories */}
      {relatedCategories.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-neutral-900 dark:text-white mb-3">
            Related Categories
          </h3>
          <div className="space-y-2">
            {relatedCategories.map((category) => (
              <Link
                key={category.id}
                href={`/tenant/${tenantId}?category=${category.slug}`}
                className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    {category.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <span>{category.count} products</span>
                  {category.inStockProducts !== undefined && (
                    <span className="text-green-600 dark:text-green-400">
                      {category.inStockProducts} in stock
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Browse All Categories */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <Link
          href={`/tenant/${tenantId}`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Browse All Categories ({totalProducts} products)
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
