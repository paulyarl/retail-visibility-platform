'use client';

import { useState, useEffect } from 'react';
import { crossTenantProductService, TrendingProduct, BrandAnalytics, CategoryAnalytics, PlatformProductAnalytics } from '@/services/CrossTenantProductService';
import Link from 'next/link';
import Image from 'next/image';

export default function CrossTenantProductsPage() {
  const [activeTab, setActiveTab] = useState<'trending' | 'brands' | 'categories' | 'search'>('trending');
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [brandAnalytics, setBrandAnalytics] = useState<BrandAnalytics[]>([]);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalytics[]>([]);
  const [searchResults, setSearchResults] = useState<PlatformProductAnalytics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          console.log('Location access denied:', err);
          setLocationError('Location access denied. Some features may be limited.');
        }
      );
    }
  }, []);

  // Fetch trending products
  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendingProducts();
    }
  }, [activeTab, userLocation]);

  // Fetch brand analytics
  useEffect(() => {
    if (activeTab === 'brands') {
      fetchBrandAnalytics();
    }
  }, [activeTab]);

  // Fetch category analytics
  useEffect(() => {
    if (activeTab === 'categories') {
      fetchCategoryAnalytics();
    }
  }, [activeTab]);

  const fetchTrendingProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crossTenantProductService.getTrendingProducts({
        limit: 20
      });
      setTrendingProducts(result || []);
    } catch (err) {
      console.error('Failed to fetch trending products:', err);
      setError('Failed to load trending products');
    } finally {
      setLoading(false);
    }
  };

  const fetchBrandAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crossTenantProductService.getBrandAnalytics({ limit: 20 });
      setBrandAnalytics(result || []);
    } catch (err) {
      console.error('Failed to fetch brand analytics:', err);
      setError('Failed to load brand analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crossTenantProductService.getCategoryAnalytics({ limit: 20 });
      setCategoryAnalytics(result || []);
    } catch (err) {
      console.error('Failed to fetch category analytics:', err);
      setError('Failed to load category analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const result = await crossTenantProductService.searchProducts({
        q: searchQuery,
        limit: 20
      });
      setSearchResults(result || []);
    } catch (err) {
      console.error('Failed to search products:', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDistance = (km: number | null) => {
    if (km === null) return '';
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Cross-Tenant Product Discovery</h1>
          <p className="mt-2 text-gray-600">
            Discover products across all stores on the platform
          </p>
          {locationError && (
            <p className="mt-2 text-sm text-amber-600">{locationError}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'trending', label: 'Trending Nearby' },
              { id: 'brands', label: 'Top Brands' },
              { id: 'categories', label: 'Categories' },
              { id: 'search', label: 'Search' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="mb-6">
            <form onSubmit={handleSearch} className="flex gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products across all stores..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Trending Products Grid */}
            {activeTab === 'trending' && trendingProducts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {trendingProducts.map((product) => (
                  <div key={product.product_slug} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <div className="aspect-square relative">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.product_name}
                          fill
                          className="object-cover rounded-t-lg"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-t-lg flex items-center justify-center">
                          <span className="text-gray-400">No image</span>
                        </div>
                      )}
                      {product.tenant_adoption_count > 1 && (
                        <span className="absolute top-2 left-2 bg-indigo-500 text-white text-xs px-2 py-1 rounded">
                          {product.tenant_adoption_count} stores
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {product.product_name}
                      </h3>
                      {product.brand_normalized && (
                        <p className="text-sm text-gray-500 capitalize">{product.brand_normalized}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPrice(product.current_price_cents)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-gray-500 capitalize">
                          {product.category_normalized}
                        </span>
                        <span className="text-indigo-600 font-medium">
                          Score: {product.platform_trending_score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Brand Analytics */}
            {activeTab === 'brands' && brandAnalytics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {brandAnalytics.map((brand) => (
                  <div key={brand.brand} className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold text-gray-900 capitalize">
                      {brand.brand}
                    </h3>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Products</span>
                        <span className="font-semibold">{brand.product_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Stores</span>
                        <span className="font-semibold">{brand.tenant_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg Price</span>
                        <span className="font-semibold">{formatPrice(brand.avg_price_cents)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Stock</span>
                        <span className="font-semibold">{brand.total_stock}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        brand.brand_tier === 'hot' ? 'bg-red-100 text-red-700' :
                        brand.brand_tier === 'trending' ? 'bg-orange-100 text-orange-700' :
                        brand.brand_tier === 'popular' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {brand.brand_tier}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Category Analytics */}
            {activeTab === 'categories' && categoryAnalytics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryAnalytics.map((category) => (
                  <div key={category.category} className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold text-gray-900 capitalize">
                      {category.category}
                    </h3>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Products</span>
                        <span className="font-semibold">{category.product_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Stores</span>
                        <span className="font-semibold">{category.tenant_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg Price</span>
                        <span className="font-semibold">{formatPrice(category.avg_price_cents)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Stock</span>
                        <span className="font-semibold">{category.total_stock}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        category.category_tier === 'hot' ? 'bg-red-100 text-red-700' :
                        category.category_tier === 'trending' ? 'bg-orange-100 text-orange-700' :
                        category.category_tier === 'popular' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {category.category_tier}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search Results */}
            {activeTab === 'search' && searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {searchResults.map((product) => (
                  <div key={product.product_slug} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {product.product_name}
                      </h3>
                      {product.brand_normalized && (
                        <p className="text-sm text-gray-500 capitalize">{product.brand_normalized}</p>
                      )}
                      <div className="mt-2">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPrice(product.avg_platform_price_cents)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-gray-500 capitalize">
                          {product.category_normalized}
                        </span>
                        <span className="text-indigo-600 font-medium">
                          {product.tenant_adoption_count} stores
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && (
              <>
                {(activeTab === 'trending' && trendingProducts.length === 0) ||
                 (activeTab === 'brands' && brandAnalytics.length === 0) ||
                 (activeTab === 'categories' && categoryAnalytics.length === 0) ||
                 (activeTab === 'search' && searchResults.length === 0) ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No results found</p>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
