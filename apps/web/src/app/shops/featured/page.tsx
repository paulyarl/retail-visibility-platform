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
import { Search, Filter, TrendingUp, Star, MapPin, ChevronDown, X, ArrowLeft, Store, Grid, Sparkles, LayoutGrid, List, Image as ImageIcon } from 'lucide-react';
import { Button, Select, TextInput, Badge, Card, Group, Text, Stack } from '@mantine/core';
import FeaturedBucketSimple from '@/components/storefront/FeaturedBucketSimple';
import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
import { directorySingletonService } from '@/services/DirectorySingletonService';
import { shopsService } from '@/services/ShopsService';
import { FEATURED_TYPES } from '@/types/product-display';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { usePublicBranding } from '@/hooks/usePublicBranding';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import LastViewed from '@/components/directory/LastViewed';

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

/**
 * Shuffle products within each bucket to prevent consecutive products from same tenant
 */
const randomizeBuckets = (data: FeaturedProductsData): FeaturedProductsData => {
  if (!data.buckets) return data;
  
  const newBuckets: Record<string, any[]> = {};
  const newBucketCounts: Record<string, number> = {};
  
  // Process each bucket individually
  Object.entries(data.buckets).forEach(([bucketType, products]) => {
    if (products.length === 0) {
      newBuckets[bucketType] = [];
      newBucketCounts[bucketType] = 0;
      return;
    }
    
    // Shuffle products within this bucket
    const shuffledProducts = [...products].sort(() => Math.random() - 0.5);
    
    // Further shuffle to avoid consecutive products from same tenant
    const antiConsecutiveShuffle = (products: any[]): any[] => {
      if (products.length <= 1) return products;
      
      const result: any[] = [];
      const remaining = [...products];
      
      while (remaining.length > 0) {
        // Try to find a product from a different tenant than the last one
        let bestIndex = 0;
        let bestScore = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
          let score = 0;
          
          // Penalize if same tenant as last product
          if (result.length > 0 && remaining[i].tenantId === result[result.length - 1].tenantId) {
            score += 1000; // Heavy penalty
          }
          
          // Add small random factor to break ties
          score += Math.random() * 10;
          
          if (score < bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
        
        result.push(remaining[bestIndex]);
        remaining.splice(bestIndex, 1);
      }
      
      return result;
    };
    
    // Apply anti-consecutive shuffle
    const finalProducts = antiConsecutiveShuffle(shuffledProducts);
    
    newBuckets[bucketType] = finalProducts;
    newBucketCounts[bucketType] = finalProducts.length;
  });
  
  return {
    ...data,
    buckets: newBuckets,
    bucketCounts: newBucketCounts,
  };
};

const FEATURED_BUCKETS = [
  {
    type: 'bestseller',
    title: 'Bestsellers',
    description: 'Top-selling products across all shops',
    icon: '🏆',
    gradient: 'from-yellow-500 to-amber-500'
  },
  {
    type: 'clearance',
    title: 'Clearance',
    description: 'Final markdowns and closeout deals',
    icon: '💨',
    gradient: 'from-gray-500 to-slate-500'
  },
  {
    type: 'featured',
    title: 'Featured',
    description: 'Highlighted products from our marketplace',
    icon: '⭐',
    gradient: 'from-blue-500 to-indigo-500'
  },
  {
    type: 'new_arrival',
    title: 'New Arrivals',
    description: 'Fresh products in the marketplace',
    icon: '✨',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    type: 'recommended',
    title: 'Recommended',
    description: 'Curated picks just for you',
    icon: '👍',
    gradient: 'from-teal-500 to-cyan-500'
  },
  {
    type: 'sale',
    title: 'Sale Items',
    description: 'Great deals and discounts',
    icon: '🏷️',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    type: 'seasonal',
    title: 'Seasonal Picks',
    description: 'Perfect for the current season',
    icon: '🍂',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    type: 'staff_pick',
    title: 'Staff Picks',
    description: 'Editor\'s choice favorites',
    icon: '🔥',
    gradient: 'from-yellow-500 to-orange-500'
  },
  {
    type: 'store_selection',
    title: 'Staff Selections',
    description: 'Hand-picked by our team',
    icon: '🎯',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    type: 'trending',
    title: 'Trending Now',
    description: 'What\'s hot and popular right now',
    icon: '📈',
    gradient: 'from-rose-500 to-pink-500'
  }
];

export default function FeaturedProductsPage() {
  const { branding: platformBranding } = usePublicBranding();
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    location: '',
    rating: '',
    priceRange: '',
    trending: false,
    inStock: true
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // Default to newest for recent featured products
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FeaturedProductsData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Array<{name: string, count: number}>>([]);
  const [locations, setLocations] = useState<Array<{name: string, count: number}>>([]);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);

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
        limit: 100 // Fetch 100 products (20 per bucket across 5 buckets)
      });
      console.log(`fetchFeaturedProducts data: ${JSON.stringify(data)}`);
      // Randomize buckets for better store diversity
      const randomizedData = randomizeBuckets(data);
      setData(randomizedData);
      
      // Extract categories and locations from the data
      const allProducts = Object.values(randomizedData.buckets || {}).flat();
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
    
    // Track featured shops page view
    trackBehaviorClient({
      entityType: 'store',
      entityId: 'featured_shops',
      entityName: 'Featured Shops',
      pageType: 'shop_directory'
    });
  }, [filters, sortBy]);

  // Re-fetch when search query changes (for server-side search in future)
  useEffect(() => {
    if (data) {
      // For now, filter locally. In future, this could trigger a new API call
      const searchLower = searchQuery.toLowerCase();
      if (searchQuery && data.buckets) {
        const filteredBuckets = { ...data.buckets };
        Object.keys(filteredBuckets).forEach(bucketType => {
          filteredBuckets[bucketType] = filteredBuckets[bucketType].filter((product: any) => 
            product.name?.toLowerCase().includes(searchLower) ||
            product.title?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower) ||
            product.brand?.toLowerCase().includes(searchLower) ||
            product.tenantName?.toLowerCase().includes(searchLower)
          );
        });
        setData({ ...data, buckets: filteredBuckets });
      } else if (!searchQuery && data) {
        // Reset to original data when search is cleared
        fetchFeaturedProducts();
      }
    }
  }, [searchQuery]);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      location: '',
      rating: '',
      priceRange: '',
      trending: false, // Keep trending off by default
      inStock: true
    });
    setSortBy('newest'); // Reset to newest
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
      {/* Page Header with horizontal gradient background */}
      <div className="bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Mobile: Stacked layout, Desktop: Side by side */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* Column 1: Platform Branding */}
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg overflow-hidden">
                {platformBranding?.logoUrl ? (
                  <img 
                    src={platformBranding.logoUrl} 
                    alt={platformBranding.platformName || 'Platform'} 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Sparkles className="w-7 h-7" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  {platformBranding?.platformName || 'Visible Shelf'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Retail visibility platform
                </p>
              </div>
            </div>
            
            {/* Column 2: Page Name */}
            <div className="text-center sm:text-right">
              <h1 className="text-2xl text-center sm:text-right font-bold text-gray-900 dark:text-white">
                Featured Products
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Discover hand-picked products from our marketplace
              </p>
            </div>
          </div>
          
          {/* Navigation Links */}
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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
            <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 font-medium">
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
                onChange={(value) => setSortBy(value || 'newest')}
                data={[
                  { value: 'newest', label: 'Newest (Recent)' },
                  { value: 'trending', label: 'Trending' },
                  { value: 'rating', label: 'Highest Rated' },
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

      {/* Quick Jump Navigation - Featured Types */}
      {data && data.bucketCounts && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">Quick Jump:</span>
                
                {/* Bestsellers */}
                {(data.bucketCounts?.bestseller || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('bestseller-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-600 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>🏆</span>
                    <span>Bestsellers ({data.bucketCounts.bestseller})</span>
                  </button>
                )}

                {/* Clearance */}
                {(data.bucketCounts?.clearance || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('clearance-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>💨</span>
                    <span>Clearance ({data.bucketCounts.clearance})</span>
                  </button>
                )}

                {/* Featured */}
                {(data.bucketCounts?.featured || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('featured-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>⭐</span>
                    <span>Featured ({data.bucketCounts.featured})</span>
                  </button>
                )}

                {/* New Arrivals */}
                {(data.bucketCounts?.new_arrival || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('new_arrival-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>✨</span>
                    <span>New Arrivals ({data.bucketCounts.new_arrival})</span>
                  </button>
                )}

                {/* Recommended */}
                {(data.bucketCounts?.recommended || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('recommended-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-600 hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>👍</span>
                    <span>Recommended ({data.bucketCounts.recommended})</span>
                  </button>
                )}

                {/* Sale */}
                {(data.bucketCounts?.sale || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('sale-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>🏷️</span>
                    <span>Sale Items ({data.bucketCounts.sale})</span>
                  </button>
                )}

                {/* Seasonal */}
                {(data.bucketCounts?.seasonal || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('seasonal-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-600 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>🍂</span>
                    <span>Seasonal ({data.bucketCounts.seasonal})</span>
                  </button>
                )}

                {/* Staff Picks */}
                {(data.bucketCounts?.staff_pick || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('staff_pick-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>🔥</span>
                    <span>Staff Picks ({data.bucketCounts.staff_pick})</span>
                  </button>
                )}

                {/* Store Selection */}
                {(data.bucketCounts?.store_selection || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('store_selection-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-600 hover:bg-cyan-200 dark:hover:bg-cyan-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>🎯</span>
                    <span>Staff Selections ({data.bucketCounts.store_selection})</span>
                  </button>
                )}

                {/* Trending */}
                {(data.bucketCounts?.trending || 0) > 0 && (
                  <button
                    onClick={() => {
                      const element = document.getElementById('trending-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-600 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors whitespace-nowrap"
                  >
                    <span>📈</span>
                    <span>Trending ({data.bucketCounts.trending})</span>
                  </button>
                )}
              </div>

              {/* View Mode Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLayoutSelector(!showLayoutSelector)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded transition-colors ${
                    showLayoutSelector
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  title="Toggle Layout Selector"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Layout Options</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        {/* Category Navigation with Stats */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Category Sidebar */}
          <div className="hidden lg:block lg:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Product Categories
                </h2>
                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                  Marketplace
                </span>
              </div>
              
              {/* Active Filter Indicator */}
              {filters.category && (
                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Filtered: <strong>{filters.category}</strong>
                  </span>
                  <button
                    onClick={() => handleFilterChange('category', '')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
              
              <nav className="space-y-1">
                {/* All Products / Reset */}
                <button
                  onClick={() => handleFilterChange('category', '')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    !filters.category
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>All Products</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {data?.totalCount || 0}
                  </span>
                </button>

                {/* Category List */}
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => handleFilterChange('category', cat.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      filters.category === cat.name
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {cat.count}
                    </span>
                  </button>
                ))}
              </nav>

              {categories.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No categories available
                </p>
              )}
            </div>
          </div>

          {/* Mobile Category Dropdown */}
          <div className="lg:hidden">
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
              placeholder="Select category"
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
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
              console.log(`data.buckets: ${JSON.stringify(data.buckets)}`), 
              FEATURED_BUCKETS.map((bucket) => {
                const products = data.buckets[bucket.type] || [];
                const count = data.bucketCounts?.[bucket.type] || 0;
              
                
                if (products.length === 0) return null;
                
                return (
                  <div key={bucket.type} id={`${bucket.type}-section`} className="mb-12 scroll-mt-20">
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
                  shops={data.shops}
                  showLayoutSelector={showLayoutSelector}
                  initialLimit={8} // Show 8 products per bucket initially
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
        </div>
      </div>

      {/* Recently Viewed */}
      <LastViewed />

      {/* Footer */}
      <PoweredByFooter />
    </div>
  );
}
