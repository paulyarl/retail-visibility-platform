/**
 * Featured Products Page
 * 
 * Displays featured products from multiple shops in buckets
 * Supports filtering by category, location, trending, rating, etc.
 * Tier-based visibility system for merchants
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, TrendingUp, Star, MapPin, ChevronDown, X, ArrowLeft, Store, Grid, Sparkles } from 'lucide-react';
import { Button, Select, TextInput, Badge, Card, Group, Text, Stack } from '@mantine/core';
import FeaturedBucketSimple from '@/components/storefront/FeaturedBucketSimple';
import { directorySingletonService } from '@/services/DirectorySingletonService';
import { shopsService } from '@/services/ShopsService';
import { FEATURED_TYPES } from '@/types/product-display';
import { PoweredByFooter } from '@/components/PoweredByFooter';

interface FilterState {
  category: string;
  location: string;
  rating: string;
  priceRange: string;
  trending: boolean;
  inStock: boolean;
}

interface FeaturedProductsData {
  totalCount: number;
  buckets: Record<string, any[]>;
  bucketCounts: Record<string, number>;
  shops: Array<{
    id: string;
    name: string;
    slug: string;
    logo?: string;
    tier: string;
  }>;
}

const FEATURED_BUCKETS = [
  {
    type: 'store_selection',
    title: 'Staff Selections',
    description: 'Hand-picked by our team',
    icon: '⭐',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    type: 'new_arrival',
    title: 'New Arrivals',
    description: 'Fresh products in the marketplace',
    icon: '✨',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    type: 'seasonal',
    title: 'Seasonal Picks',
    description: 'Perfect for the current season',
    icon: '🍂',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    type: 'sale',
    title: 'Sale Items',
    description: 'Great deals and discounts',
    icon: '🏷️',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    type: 'featured',
    title: 'Featured Products',
    description: 'Top-rated and popular',
    icon: '🔥',
    gradient: 'from-yellow-500 to-orange-500'
  }
];

export default function FeaturedProductsPage() {
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    location: '',
    rating: '',
    priceRange: '',
    trending: false,
    inStock: true
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('trending');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FeaturedProductsData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Array<{name: string, count: number}>>([]);
  const [locations, setLocations] = useState<Array<{name: string, count: number}>>([]);

  // Fetch featured products
  const fetchFeaturedProducts = async () => {
    setLoading(true);
    try {
      // Use the proper service method
      const data = await directorySingletonService.getAllFeaturedProducts({
        category: filters.category,
        location: filters.location,
        rating: filters.rating,
        priceRange: filters.priceRange,
        trending: filters.trending,
        inStock: filters.inStock,
        sortBy: sortBy === 'trending' ? 'trending' : sortBy,
        limit: 20 // Default limit
      });
      
      // If there's a search query, filter the results locally
      // (since the API doesn't support search yet)
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        Object.keys(data.buckets).forEach(bucketType => {
          data.buckets[bucketType] = data.buckets[bucketType].filter((product: any) => 
            product.name?.toLowerCase().includes(searchLower) ||
            product.title?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower) ||
            product.brand?.toLowerCase().includes(searchLower) ||
            product.tenantName?.toLowerCase().includes(searchLower)
          );
        });
      }

      console.log('[FeaturedProductsPage] Data received:', {
        totalCount: data.totalCount,
        bucketKeys: Object.keys(data.buckets),
        shopsCount: data.shops.length
      });
      
      setData(data);
      
      // Extract categories and locations from the data
      const allProducts = Object.values(data.buckets || {}).flat();
      const categoryCounts = allProducts.reduce((acc: any, product: any) => {
        if (product.categoryName) {
          acc[product.categoryName] = (acc[product.categoryName] || 0) + 1;
        }
        return acc;
      }, {});
      
      const locationCounts = allProducts.reduce((acc: any, product: any) => {
        if (product.tenantCity) {
          acc[product.tenantCity] = (acc[product.tenantCity] || 0) + 1;
        }
        return acc;
      }, {});

      setCategories(
        Object.entries(categoryCounts as any).map(([name, count]) => ({ name, count: count as number }))
      );
      setLocations(
        Object.entries(locationCounts as any).map(([name, count]) => ({ name, count: count as number }))
      );
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeaturedProducts();
  }, [searchQuery, filters, sortBy]);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      location: '',
      rating: '',
      priceRange: '',
      trending: false,
      inStock: true
    });
    setSearchQuery('');
  };

  const hasActiveFilters = useMemo(() => {
    return searchQuery || 
           filters.category || 
           filters.location || 
           filters.rating || 
           filters.priceRange || 
           filters.trending;
  }, [searchQuery, filters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading featured products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Navigation Links */}
              <div className="flex items-center gap-2 mb-2">
                <Link 
                  href="/shops"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Store className="h-4 w-4" />
                  Shops
                </Link>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/directory"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Grid className="h-4 w-4" />
                  Directory
                </Link>
                <span className="text-gray-400">•</span>
                <span className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium">
                  <Sparkles className="h-4 w-4" />
                  Featured
                </span>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/trending"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <TrendingUp className="h-4 w-4" />
                  Trending
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Featured Products
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Discover hand-picked products from our marketplace
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {Object.values(filters).filter(v => v).length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <TextInput
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftSection={<Search className="h-4 w-4 text-gray-400" />}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2">
              <Select
                value={sortBy}
                onChange={(value) => setSortBy(value || 'trending')}
                data={[
                  { value: 'trending', label: 'Trending' },
                  { value: 'rating', label: 'Highest Rated' },
                  { value: 'newest', label: 'Newest' },
                  { value: 'price_low', label: 'Price: Low to High' },
                  { value: 'price_high', label: 'Price: High to Low' }
                ]}
              />
              
              <Button
                variant={filters.trending ? 'filled' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('trending', !filters.trending)}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Trending
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.category && (
                <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                  Category: {filters.category}
                  <button onClick={() => handleFilterChange('category', '')}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.location && (
                <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                  Location: {filters.location}
                  <button onClick={() => handleFilterChange('location', '')}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <Button variant="subtle" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Filters</h3>
                <Button variant="subtle" size="sm" onClick={() => setShowFilters(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <Select
                  value={filters.category}
                  onChange={(value) => handleFilterChange('category', value || '')}
                  data={[
                    { value: '', label: 'All Categories' },
                    ...categories.map(cat => ({
                      value: cat.name,
                      label: `${cat.name} (${cat.count})`
                    }))
                  ]}
                />
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <Select
                  value={filters.location}
                  onChange={(value) => handleFilterChange('location', value || '')}
                  data={[
                    { value: '', label: 'All Locations' },
                    ...locations.map(loc => ({
                      value: loc.name,
                      label: `${loc.name} (${loc.count})`
                    }))
                  ]}
                />
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Minimum Rating</label>
                <Select
                  value={filters.rating}
                  onChange={(value) => handleFilterChange('rating', value || '')}
                  data={[
                    { value: '', label: 'All Ratings' },
                    { value: '4.5', label: '4.5+ Stars' },
                    { value: '4', label: '4+ Stars' },
                    { value: '3.5', label: '3.5+ Stars' },
                    { value: '3', label: '3+ Stars' }
                  ]}
                />
              </div>

              {/* Price Range Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Price Range</label>
                <Select
                  value={filters.priceRange}
                  onChange={(value) => handleFilterChange('priceRange', value || '')}
                  data={[
                    { value: '', label: 'All Prices' },
                    { value: '0-25', label: 'Under $25' },
                    { value: '25-50', label: '$25 - $50' },
                    { value: '50-100', label: '$50 - $100' },
                    { value: '100-200', label: '$100 - $200' },
                    { value: '200-', label: '$200+' }
                  ]}
                />
              </div>

              {/* Stock Filter */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="inStock"
                  checked={filters.inStock}
                  onChange={(e) => handleFilterChange('inStock', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="inStock" className="text-sm font-medium">
                  In Stock Only
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.totalCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Products
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.shops?.length || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Featured Shops
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.keys(data.buckets || {}).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Active Buckets
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {filters.trending ? 'On' : 'Off'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Trending Filter
              </div>
            </div>
          </div>
        )}

        {/* Featured Buckets */}
        {data && data.buckets ? (
          FEATURED_BUCKETS.map((bucket) => {
            const products = data.buckets[bucket.type] || [];
            const count = data.bucketCounts?.[bucket.type] || 0;
            
            if (products.length === 0) return null;
            
            return (
              <div key={bucket.type} className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="text-2xl">{bucket.icon}</span>
                      {bucket.title}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {bucket.description} • {count} products
                    </p>
                  </div>
                  {count > products.length && (
                    <Button variant="outline">
                      View All ({count})
                    </Button>
                  )}
                </div>
                
                <FeaturedBucketSimple
                  title={bucket.title}
                  description={bucket.description}
                  products={products}
                  totalCount={count}
                  bucketType={bucket.type}
                  tenantId={products[0]?.tenantId || "marketplace"}
                  tenantName={products[0]?.tenantName}
                  tenantLogo={products[0]?.tenantLogo}
                />
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Loading featured products...
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we gather the latest products.
            </p>
          </div>
        )}

        {/* No Results */}
        {data && data.totalCount === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No featured products found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try adjusting your filters or search terms
            </p>
            <Button onClick={clearFilters} variant="light">
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <PoweredByFooter />
    </div>
  );
}
