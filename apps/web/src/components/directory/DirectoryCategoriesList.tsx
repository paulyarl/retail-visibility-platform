/**
 * Directory Categories List Component
 * 
 * Displays categories using the CategorySingleton hook
 * with loading states, error handling, and performance metrics.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useDirectoryCategories } from '@/hooks/useDirectoryCategories';
import { Grid3x3, List, Package, AlertCircle, RefreshCw } from 'lucide-react';

interface DirectoryCategoriesListProps {
  viewMode?: 'grid' | 'list';
  showProductCount?: boolean;
  showHierarchy?: boolean;
  maxCategories?: number;
  className?: string;
}

export default function DirectoryCategoriesList({
  viewMode = 'grid',
  showProductCount = true,
  showHierarchy = false,
  maxCategories,
  className = '',
}: DirectoryCategoriesListProps) {
  const [currentViewMode, setCurrentViewMode] = React.useState<'grid' | 'list'>(viewMode);
  const [showMetrics, setShowMetrics] = React.useState(false);

  const {
    categories,
    loading,
    error,
    refetch,
    getCategoryTree,
    metrics,
  } = useDirectoryCategories({
    includeChildren: showHierarchy,
    includeProductCount: showProductCount,
  });

  // Limit categories if specified
  const displayCategories = maxCategories 
    ? categories.slice(0, maxCategories)
    : categories;

  // Get hierarchical tree if needed
  const categoryTree = showHierarchy ? getCategoryTree() : displayCategories;

  const renderCategoryCard = (category: any) => (
    <Link
      key={category.id}
      href={`/directory/categories/${category.slug}`}
      className="group block bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              {category.imageUrl && (
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
            
            {showProductCount && (
              <div className="mt-3 flex items-center text-sm text-gray-500">
                <Package className="w-4 h-4 mr-1" />
                {category.productCount || 0} products
              </div>
            )}
          </div>
        </div>

        {showHierarchy && category.children && category.children.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Subcategories:</p>
            <div className="flex flex-wrap gap-2">
              {category.children.slice(0, 3).map((child: any) => (
                <Link
                  key={child.id}
                  href={`/directory/categories/${child.slug}`}
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {child.name}
                </Link>
              ))}
              {category.children.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{category.children.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );

  const renderListView = (categories: any[]) => (
    <div className="space-y-3">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/directory/categories/${category.slug}`}
          className="group flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            {category.imageUrl && (
              <img
                src={category.imageUrl}
                alt={category.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                  {category.description}
                </p>
              )}
            </div>
          </div>
          
          {showProductCount && (
            <div className="flex items-center text-sm text-gray-500">
              <Package className="w-4 h-4 mr-1" />
              {category.productCount || 0}
            </div>
          )}
        </Link>
      ))}
    </div>
  );

  const renderGridView = (categories: any[]) => (
    <div className={`grid gap-6 ${
      currentViewMode === 'grid' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
        : 'grid-cols-1'
    }`}>
      {categories.map((category) => renderCategoryCard(category))}
    </div>
  );

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error loading categories</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="mt-4 flex items-center space-x-2 text-sm text-red-600 hover:text-red-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Categories
            {showProductCount && (
              <span className="ml-2 text-sm text-gray-500">
                ({categories.length} total)
              </span>
            )}
          </h2>
          {showHierarchy && (
            <p className="text-sm text-gray-600 mt-1">
              Browse categories and subcategories
            </p>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentViewMode('grid')}
              className={`p-2 rounded ${currentViewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentViewMode('list')}
              className={`p-2 rounded ${currentViewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Metrics Toggle */}
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showMetrics ? 'Hide' : 'Show'} Metrics
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      {showMetrics && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Cache Hits:</span>
              <span className="ml-2 font-medium">{metrics.cacheHits}</span>
            </div>
            <div>
              <span className="text-blue-600">Cache Misses:</span>
              <span className="ml-2 font-medium">{metrics.cacheMisses}</span>
            </div>
            <div>
              <span className="text-blue-600">Hit Rate:</span>
              <span className="ml-2 font-medium">
                {metrics.totalRequests > 0 
                  ? `${((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)}%`
                  : '0%'
                }
              </span>
            </div>
            <div>
              <span className="text-blue-600">Avg Response:</span>
              <span className="ml-2 font-medium">{metrics.averageResponseTime.toFixed(0)}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Categories Display */}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
          <p className="text-gray-600">Check back later for new categories.</p>
        </div>
      ) : (
        <>
          {currentViewMode === 'grid' ? renderGridView(categoryTree) : renderListView(categoryTree)}
          
          {maxCategories && categories.length > maxCategories && (
            <div className="text-center mt-8">
              <Link
                href="/directory/categories"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View all {categories.length} categories
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
