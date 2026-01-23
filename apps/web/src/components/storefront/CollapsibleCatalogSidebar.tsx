'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductSearch from '@/components/storefront/ProductSearch';
import ProductCategoriesCollapsible from '@/components/storefront/ProductCategoriesCollapsible';

interface CollapsibleCatalogSidebarProps {
  tenantId: string;
  categories: any[];
  totalProducts: number;
  productsLength: number;
  totalPages: number;
  currentPage: number;
  search?: string;
  currentCategory?: any;
  featured?: string;
  view?: string;
  featuredCounts?: {
    staffPick: number;
    seasonal: number;
    sale: number;
    newArrival: number;
    storeSelection: number;
  };
}

export default function CollapsibleCatalogSidebar({
  tenantId,
  categories,
  totalProducts,
  productsLength,
  totalPages,
  currentPage,
  search,
  currentCategory,
  featured,
  view,
  featuredCounts
}: CollapsibleCatalogSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle view mode change with anchoring
  const handleViewModeChange = (newView: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    
    // Navigate to the same page with new view parameter and anchor
    const newUrl = `/tenant/${tenantId}?${params.toString()}#catalog-banner`;
    router.push(newUrl);
  };

  // Handle quick actions with anchoring
  const handleQuickAction = (action: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    switch (action) {
      case 'clear-search':
        params.delete('search');
        break;
      case 'clear-category':
        params.delete('category');
        break;
      case 'clear-featured':
        params.delete('featured');
        break;
    }
    
    const newUrl = `/tenant/${tenantId}?${params.toString()}#catalog-banner`;
    router.push(newUrl);
  };

  // Handle featured type navigation - scroll to section on same page
  const handleFeaturedNavigation = (featuredType: string) => {
    // Remove any existing featured filter and just scroll to the section
    const params = new URLSearchParams(searchParams.toString());
    params.delete('featured');
    
    const newUrl = `/tenant/${tenantId}?${params.toString()}`;
    router.push(newUrl);
    
    // Scroll to the featured section after navigation
    setTimeout(() => {
      const element = document.getElementById(`${featuredType}-section`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <>
      {/* Toggle Button - Positioned in middle of screen */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        <svg
          className={`w-5 h-5 text-neutral-600 dark:text-neutral-400 transition-transform duration-200 ${
            isCollapsed ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8-14l-7 7 7 7" />
        </svg>
        <span className="absolute left-full ml-2 px-2 py-1 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
          {isCollapsed ? 'Show Filters' : 'Hide Filters'}
        </span>
      </button>

      {/* Sidebar - Fixed position with floating effect */}
      <div className={`fixed left-0 top-32 bottom-8 w-80 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 shadow-xl transition-all duration-300 z-40 overflow-hidden rounded-r-lg ${
        isCollapsed ? '-translate-x-full' : 'translate-x-0'
      }`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Catalog Controls</h3>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            title="Collapse Sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 h-full">
          {/* Search Box */}
          <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">Search Products</h4>
            <ProductSearch tenantId={tenantId} />
          </div>

          {/* Product Categories */}
          {categories.length > 0 && (
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">Categories</h4>
              <ProductCategoriesCollapsible
                tenantId={tenantId}
                categories={categories}
                totalProducts={totalProducts}
              />
            </div>
          )}

          {/* View Mode Controls */}
          <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">Display Options</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-2">View Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleViewModeChange('grid')}
                    className={`p-2 border rounded text-xs transition-colors ${
                      (!view || view === 'grid')
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                    title="Grid View"
                  >
                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('list')}
                    className={`p-2 border rounded text-xs transition-colors ${
                      view === 'list'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                    title="List View"
                  >
                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('gallery')}
                    className={`p-2 border rounded text-xs transition-colors ${
                      view === 'gallery'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                    title="Gallery View"
                  >
                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">Results</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Showing:</span>
                  <span className="font-medium text-neutral-900 dark:text-white">{productsLength} products</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Total:</span>
                  <span className="font-medium text-neutral-900 dark:text-white">{totalProducts} products</span>
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Page:</span>
                    <span className="font-medium text-neutral-900 dark:text-white">{currentPage} of {totalPages}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">Quick Actions</h4>
              <div className="space-y-2">
                {search && (
                  <button
                    onClick={() => handleQuickAction('clear-search')}
                    className="w-full text-xs px-3 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                  >
                    Clear Search
                  </button>
                )}
                {currentCategory && (
                  <button
                    onClick={() => handleQuickAction('clear-category')}
                    className="w-full text-xs px-3 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                  >
                    Clear Category
                  </button>
                )}
                {featured && (
                  <button
                    onClick={() => handleQuickAction('clear-featured')}
                    className="w-full text-xs px-3 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {/* Featured Navigation */}
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">Featured Collections</h4>
              <div className="grid grid-cols-2 gap-2">
                {/* Staff Picks - Only show if has products */}
                {featuredCounts?.staffPick && featuredCounts.staffPick > 0 && (
                  <button
                    onClick={() => handleFeaturedNavigation('staff_pick')}
                    className="flex flex-col items-center justify-center p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
                    title="Staff Picks"
                  >
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Staff Picks</span>
                  </button>
                )}
                
                {/* New Arrivals - Only show if has products */}
                {featuredCounts?.newArrival && featuredCounts.newArrival > 0 && (
                  <button
                    onClick={() => handleFeaturedNavigation('new_arrival')}
                    className="flex flex-col items-center justify-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
                    title="New Arrivals"
                  >
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs text-green-700 dark:text-green-300 font-medium">New</span>
                  </button>
                )}
                
                {/* Sale Items - Only show if has products */}
                {featuredCounts?.sale && featuredCounts.sale > 0 && (
                  <button
                    onClick={() => handleFeaturedNavigation('sale')}
                    className="flex flex-col items-center justify-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group"
                    title="Sale Items"
                  >
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2-3-.895-3-2 1.343-2 3-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 4v16H5V4h14z" />
                    </svg>
                    <span className="text-xs text-red-700 dark:text-red-300 font-medium">Sale</span>
                  </button>
                )}
                
                {/* Seasonal Specials - Only show if has products */}
                {featuredCounts?.seasonal && featuredCounts.seasonal > 0 && (
                  <button
                    onClick={() => handleFeaturedNavigation('seasonal')}
                    className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
                    title="Seasonal Specials"
                  >
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Seasonal</span>
                  </button>
                )}
                
                {/* Store Selection - Only show if has products */}
                {featuredCounts?.storeSelection && featuredCounts.storeSelection > 0 && (
                  <button
                    onClick={() => handleFeaturedNavigation('store_selection')}
                    className="flex flex-col items-center justify-center p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
                    title="Store Selection"
                  >
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">Store Pick</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
