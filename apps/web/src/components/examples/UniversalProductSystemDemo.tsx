"use client";

import { useState } from 'react';
import { useUniversalProducts, UniversalProductCard } from '@/hooks/useUniversalProducts';

/**
 * Universal Product System Demo
 * 
 * This component demonstrates the power of the new singleton system
 * by creating universal product props that combine data from both
 * ProductSingleton and FeaturedProductsSingleton.
 */
export default function UniversalProductSystemDemo({ tenantId }: { tenantId: string }) {
  const [showMetrics, setShowMetrics] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'featured' | 'non-featured' | 'bucket'>('all');
  const [selectedBucket, setSelectedBucket] = useState<string>('staff_pick');

  const {
    products,
    loading,
    error,
    metrics,
    refresh,
    getProductsByBucket,
    getFeaturedProducts,
    getNonFeaturedProducts,
    demo
  } = useUniversalProducts(tenantId, {
    includeFeatured: true,
    enhanceWithSingleton: true,
    limit: 20
  });

  // Get filtered products based on mode
  const getFilteredProducts = () => {
    switch (filterMode) {
      case 'featured':
        return getFeaturedProducts();
      case 'non-featured':
        return getNonFeaturedProducts();
      case 'bucket':
        return getProductsByBucket(selectedBucket);
      default:
        return products;
    }
  };

  const filteredProducts = getFilteredProducts();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-neutral-600 dark:text-neutral-400">Loading universal products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="universal-product-demo p-6 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Demo Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          🚀 Universal Product System Demo
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Demonstrating the power of combining ProductSingleton and FeaturedProductsSingleton
        </p>
        
        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {demo.totalProducts}
            </div>
            <div className="text-sm text-primary-700 dark:text-primary-300">Total Products</div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {demo.featuredCount}
            </div>
            <div className="text-sm text-purple-700 dark:text-purple-300">Featured Products</div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {Math.round(demo.cacheEfficiency * 100)}%
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">Cache Hit Rate</div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {demo.singletonIntegration.dataCombined ? '✅' : '❌'}
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">Singletons Combined</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Filter Mode */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Filter:</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            >
              <option value="all">All Products ({demo.totalProducts})</option>
              <option value="featured">Featured Only ({demo.featuredCount})</option>
              <option value="non-featured">Non-Featured ({demo.totalProducts - demo.featuredCount})</option>
              <option value="bucket">By Bucket</option>
            </select>
          </div>

          {/* Bucket Selector */}
          {filterMode === 'bucket' && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Bucket:</label>
              <select
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="px-3 py-1 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              >
                <option value="staff_pick">Staff Pick ({demo.bucketCounts.staff_pick})</option>
                <option value="seasonal">Seasonal ({demo.bucketCounts.seasonal})</option>
                <option value="sale">Sale ({demo.bucketCounts.sale})</option>
                <option value="new_arrival">New Arrival ({demo.bucketCounts.new_arrival})</option>
                <option value="store_selection">Store Selection ({demo.bucketCounts.store_selection})</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            {showMetrics ? 'Hide' : 'Show'} Metrics
          </button>
          
          <button
            onClick={refresh}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Panel */}
      {showMetrics && metrics && (
        <div className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            📊 Singleton System Metrics
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Singleton Metrics */}
            <div>
              <h4 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">Product Singleton</h4>
              <div className="space-y-1 text-sm">
                <div>Cache Hits: {metrics.products.cacheHits}</div>
                <div>Cache Misses: {metrics.products.cacheMisses}</div>
                <div>API Calls: {metrics.products.apiCalls}</div>
                <div>Cache Hit Rate: {Math.round(metrics.products.cacheHitRate * 100)}%</div>
                <div>Cached Products: {metrics.products.totalCachedProducts}</div>
              </div>
            </div>

            {/* Featured Products Singleton Metrics */}
            <div>
              <h4 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">Featured Products Singleton</h4>
              <div className="space-y-1 text-sm">
                <div>Cache Hits: {metrics.featured.cacheHits}</div>
                <div>Cache Misses: {metrics.featured.cacheMisses}</div>
                <div>API Calls: {metrics.featured.apiCalls}</div>
                <div>Cache Hit Rate: {Math.round(metrics.featured.cacheHitRate * 100)}%</div>
                <div>Cached Products: {metrics.featured.totalCachedProducts}</div>
              </div>
            </div>
          </div>

          {/* Combined Metrics */}
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <h4 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">Combined System</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>Total Cache Hits: {metrics.combined.totalCacheHits}</div>
              <div>Total Cache Misses: {metrics.combined.totalCacheMisses}</div>
              <div>Total API Calls: {metrics.combined.totalApiCalls}</div>
              <div>Overall Hit Rate: {Math.round(metrics.combined.overallCacheHitRate * 100)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Info */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Showing:</span>
          <span>
            {filterMode === 'all' && `All ${filteredProducts.length} products`}
            {filterMode === 'featured' && `${filteredProducts.length} featured products`}
            {filterMode === 'non-featured' && `${filteredProducts.length} non-featured products`}
            {filterMode === 'bucket' && `${filteredProducts.length} products in ${selectedBucket.replace('_', ' ')}`}
          </span>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <UniversalProductCard
            key={product.id}
            product={product}
            tenantId={tenantId}
            showFeaturedBadge={true}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-600 dark:text-neutral-400">
            No products found for the current filter.
          </p>
        </div>
      )}

      {/* Demo Footer */}
      <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          <p className="mb-2">
            <strong>Universal Product System Features:</strong>
          </p>
          <ul className="space-y-1">
            <li>• Combines data from ProductSingleton and FeaturedProductsSingleton</li>
            <li>• Universal product props with featured type information</li>
            <li>• Intelligent caching with universal cache manager</li>
            <li>• Featured badges and context on product cards</li>
            <li>• Real-time metrics and performance tracking</li>
            <li>• Flexible filtering and bucket organization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
