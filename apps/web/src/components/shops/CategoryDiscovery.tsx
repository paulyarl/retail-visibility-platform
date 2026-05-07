"use client";

import { useState } from 'react';
import { Search, Filter, TrendingUp, ShoppingBag, Store } from 'lucide-react';
import { useCategoryDiscovery } from '@/hooks/shops/useCategoryDiscovery';
import { BucketSection, ProductBucket, ShopBucket } from './BucketSection';

/**
 * Category Discovery Component
 * 
 * Demonstrates the category scope discovery system
 * Supports both product categories and shop categories (GBP-based)
 * Allows users to discover products and shops by category
 */
export default function CategoryDiscovery() {
  const [productName, setProductName] = useState('');
  const [shopCategoryName, setShopCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<'product' | 'shop' | 'both'>('product');
  const [bucketType, setBucketType] = useState<'random' | 'trending' | 'new' | 'sale' | 'seasonal' | 'staff' | 'selection'>('trending');
  const [searchInput, setSearchInput] = useState('');

  const { products, shops, loading, error, refetch, metrics } = useCategoryDiscovery({
    productName: categoryType === 'product' || categoryType === 'both' ? (productName || undefined) : undefined,
    shopCategoryName: categoryType === 'shop' || categoryType === 'both' ? (shopCategoryName || undefined) : undefined,
    categoryType,
    bucketType,
    limit: 12,
    enabled: !!(productName || shopCategoryName)
  });

  const handleSearch = () => {
    if (searchInput.trim()) {
      if (categoryType === 'product') {
        setProductName(searchInput.trim());
        setShopCategoryName('');
      } else if (categoryType === 'shop') {
        setShopCategoryName(searchInput.trim());
        setProductName('');
      } else {
        // both - set both to same value for demo
        setProductName(searchInput.trim());
        setShopCategoryName(searchInput.trim());
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getCategoryName = () => {
    if (categoryType === 'product') return productName;
    if (categoryType === 'shop') return shopCategoryName;
    return productName || shopCategoryName;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Category Discovery</h1>
        <p className="text-gray-600">
          Discover products and shops by category using our smart scope-aware discovery system.
          Supports both product categories and shop categories (GBP-based).
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCategoryType('product');
                  setShopCategoryName('');
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  categoryType === 'product'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📦 Product Category
              </button>
              <button
                onClick={() => {
                  setCategoryType('shop');
                  setProductName('');
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  categoryType === 'shop'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🏪 Shop Category (GBP)
              </button>
              <button
                onClick={() => setCategoryType('both')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  categoryType === 'both'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🔄 Both
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bucket Type
            </label>
            <select
              value={bucketType}
              onChange={(e) => setBucketType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="trending">🔥 Trending</option>
              <option value="new">✨ New</option>
              <option value="sale">🏷️ Sale</option>
              <option value="seasonal">🍂 Seasonal</option>
              <option value="staff">⭐ Staff Picks</option>
              <option value="random">🎲 Random</option>
              <option value="selection">🏪 Selection</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={
                  categoryType === 'product' 
                    ? 'Enter product category (e.g., Electronics, Clothing...)'
                    : categoryType === 'shop'
                    ? 'Enter shop category (e.g., Restaurant, Retail...)'
                    : 'Enter category name (e.g., Electronics, Restaurant...)'
                }
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <button
            onClick={handleSearch}
            disabled={!searchInput.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </div>

        {/* Example Categories */}
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">
            Try these {categoryType === 'product' ? 'product' : categoryType === 'shop' ? 'shop' : ''} categories:
          </p>
          <div className="flex flex-wrap gap-2">
            {(categoryType === 'product' || categoryType === 'both') && [
              'Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Beauty', 'Toys', 'Food'
            ].map((cat) => (
              <button
                key={`product-${cat}`}
                onClick={() => {
                  setSearchInput(cat);
                  if (categoryType === 'product') {
                    setProductName(cat);
                    setShopCategoryName('');
                  } else {
                    setProductName(cat);
                    setShopCategoryName(cat);
                  }
                }}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors text-sm"
              >
                📦 {cat}
              </button>
            ))}
            
            {(categoryType === 'shop' || categoryType === 'both') && [
              'Restaurant', 'Retail', 'Electronics Store', 'Clothing Store', 'Bookstore', 'Grocery', 'Pharmacy', 'Hardware'
            ].map((cat) => (
              <button
                key={`shop-${cat}`}
                onClick={() => {
                  setSearchInput(cat);
                  if (categoryType === 'shop') {
                    setShopCategoryName(cat);
                    setProductName('');
                  } else {
                    setProductName(cat);
                    setShopCategoryName(cat);
                  }
                }}
                className="px-3 py-1 bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors text-sm"
              >
                🏪 {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {metrics && getCategoryName() && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Category Type:</span>
              <span className="text-blue-900 capitalize">{categoryType}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Category:</span>
              <span className="text-blue-900">{getCategoryName()}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Products:</span>
              <span className="text-blue-900">{metrics.productCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Shops:</span>
              <span className="text-blue-900">{metrics.shopCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Response Time:</span>
              <span className="text-blue-900">{metrics.responseTime}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <div className="text-red-800">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={refetch}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {getCategoryName() && !loading && !error && (
        <div className="space-y-12">
          {/* Products */}
          <ProductBucket
            products={products}
            loading={loading}
            error={error}
            title={`🔥 ${bucketType.charAt(0).toUpperCase() + bucketType.slice(1)} ${getCategoryName()} Products`}
            subtitle={`Discover ${bucketType} products in the ${getCategoryName()} ${categoryType === 'shop' ? 'shop category' : 'product category'}`}
          />

          {/* Shops */}
          {shops.length > 0 && (
            <ShopBucket
              shops={shops}
              loading={loading}
              error={error}
              title={`🏪 Trending ${getCategoryName()} Shops`}
              subtitle={`Top shops in the ${getCategoryName()} ${categoryType === 'product' ? 'product category' : 'shop category'}`}
            />
          )}
        </div>
      )}

      {/* Empty State */}
      {getCategoryName() && !loading && !error && products.length === 0 && shops.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600 mb-4">
            No products or shops found in the "{getCategoryName()}" {categoryType === 'shop' ? 'shop category' : 'product category'}.
          </p>
          <p className="text-sm text-gray-500">
            Try a different category name, category type, or check your spelling.
          </p>
        </div>
      )}

      {/* Initial State */}
      {!getCategoryName() && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Filter className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Category Discovery</h3>
          <p className="text-gray-600 mb-4">
            Select a category type and enter a category name to discover products and shops
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>📦 <strong>Product Categories:</strong> Electronics, Clothing, Books, etc.</p>
            <p>🏪 <strong>Shop Categories (GBP):</strong> Restaurant, Retail, Electronics Store, etc.</p>
            <p>🔄 <strong>Both:</strong> Find matches in both product and shop categories</p>
          </div>
        </div>
      )}
    </div>
  );
}
