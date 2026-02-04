/**
 * Shop Directory Page
 * Main page for browsing all shops with filtering and pagination
 */

'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useShopDirectory, useShopCategories, useTrendingShops } from '@/lib/shops/shop-hooks';
import { Shop, ShopCategory } from '@/types/shop';
import { SHOP_UI_CONFIG } from '@/constants/shop';
import { ShopCard } from '@/components/shops/ShopCard';
import { ShopFilters } from '@/components/shops/ShopFilters';
import { ShopPagination } from '@/components/shops/ShopPagination';
import { TrendingShops } from '@/components/shops/TrendingShops';
import { ShopSearch } from '@/components/shops/ShopSearch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@mantine/core';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Layout, LayoutList, Star, Grid3X3, Store, ShoppingBag, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { ShopViewTracker } from '@/components/tracking/ShopViewTracker';

interface ShopDirectoryPageProps {
  searchParams?: Promise<{
    search?: string;
    category?: string;
    region?: string;
    page?: string;
    limit?: string;
    sort?: string;
  }>;
}

export default function ShopDirectoryPage({ searchParams }: ShopDirectoryPageProps) {
  // Unwrap searchParams Promise using React.use()
  const unwrappedParams = searchParams ? use(searchParams) : {};
  
  // Parse search params
  const params = useMemo(() => ({
    search: unwrappedParams?.search || '',
    category: unwrappedParams?.category || '',
    region: unwrappedParams?.region || '',
    page: parseInt(unwrappedParams?.page || '1'),
    limit: parseInt(unwrappedParams?.limit || SHOP_UI_CONFIG.PAGINATION.DEFAULT_LIMIT.toString()),
    sort: unwrappedParams?.sort || 'name'
  }), [unwrappedParams]);

  // State for filters and pagination
  const [filters, setFilters] = useState({
    search: params.search,
    category: params.category,
    region: params.region,
    verified: false,
    active: true
  });

  const [pagination, setPagination] = useState({
    page: params.page,
    limit: params.limit,
    sortBy: params.sort as 'name' | 'rating' | 'productCount' | 'createdAt' | 'trendingScore'
  });

  const [cardVariant, setCardVariant] = useState<'default' | 'compact' | 'featured' | 'grid'>('default');

  // Fetch data
  const { shops, loading: shopsLoading, error: shopsError, refresh: refetchShops } = useShopDirectory({
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
    search: filters.search || undefined,
    category: filters.category || undefined,
    location: filters.region || undefined
  });

  const { data: trendingShops, loading: trendingLoading } = useTrendingShops({
    limit: 8,
    region: filters.region || undefined
  });

  const { data: categories, loading: categoriesLoading } = useShopCategories();

  // Derived state
  const hasFilters = useMemo(() => {
    return filters.search || filters.category || filters.region || filters.verified;
  }, [filters]);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    return categories.map(cat => ({
      ...cat,
      icon: '🏪' // Default icon for all categories
    }));
  }, [categories]);

  // Event handlers
  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handlePaginationChange = (newPagination: Partial<typeof pagination>) => {
    setPagination(prev => ({ ...prev, ...newPagination }));
  };

  const handleSearch = (query: string) => {
    handleFilterChange({ search: query });
  };

  const handleCategoryChange = (category: string) => {
    handleFilterChange({ category });
  };

  const handleRegionChange = (region: string) => {
    handleFilterChange({ region });
  };

  const handleSortChange = (sort: string) => {
    handlePaginationChange({ sortBy: sort as any });
  };

  const clearFilters = () => {
    handleFilterChange({
      search: '',
      category: '',
      region: '',
      verified: false,
      active: true
    });
  };

  // Loading state
  const isLoading = shopsLoading || trendingLoading || categoriesLoading;

  // Error state
  const hasError = shopsError;

  if (hasError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage
          title="Unable to load shops"
          message="We're having trouble loading the shop directory. Please try again later."
          onRetry={refetchShops}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Track directory page view */}
      <ShopViewTracker 
        tenantId="directory" 
        pageType="shop_directory"
        category={filters.category || null}
      />
      
      {/* Navigation Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Shop Directory</span>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/shops">
                  <Button variant="ghost" size="sm">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Shops Page
                  </Button>
                </Link>
                <Link href="/shops/trending">
                  <Button variant="ghost" size="sm">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Trending
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Shop Directory
        </h1>
        <p className="text-lg text-gray-600">
          Discover amazing shops from our marketplace
        </p>
      </div>

      {/* Trending Shops */}
      {!isLoading && trendingShops && trendingShops.length > 0 && (
        <div className="mb-8">
          <TrendingShops />
        </div>
      )}

      {/* Search and Filters */}
      <Card withBorder padding="lg" radius="md" className="mb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-blue-500"></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search & Filter Shops</h3>
            </div>
          </div>
          <div className="space-y-4">
            {/* Search Bar */}
            <ShopSearch
              onSearch={handleSearch}
              placeholder="Search shops by name or description..."
            />

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <Select
                  value={filters.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  options={[
                    { value: '', label: 'All Categories' },
                    ...filteredCategories.map((category) => ({
                      value: category.id,
                      label: `${category.icon} ${category.name} (${category.count})`
                    }))
                  ]}
                />
              </div>

              {/* Region Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Region
                </label>
                <Input
                  placeholder="Enter city or region"
                  value={filters.region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                />
              </div>

              {/* Sort Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <Select
                  value={pagination.sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  options={[
                    { value: 'name', label: 'Name' },
                    { value: 'rating', label: 'Rating' },
                    { value: 'productCount', label: 'Products' },
                    { value: 'createdAt', label: 'Newest' },
                    { value: 'trendingScore', label: 'Trending' }
                  ]}
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {filters.search && (
                  <Badge variant="default" className="flex items-center gap-1">
                    Search: "{filters.search}"
                    <button
                      onClick={() => handleFilterChange({ search: '' })}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filters.category && (
                  <Badge variant="default" className="flex items-center gap-1">
                    Category: {filteredCategories.find(c => c.id === filters.category)?.name}
                    <button
                      onClick={() => handleFilterChange({ category: '' })}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filters.region && (
                  <Badge variant="default" className="flex items-center gap-1">
                    Region: "{filters.region}"
                    <button
                      onClick={() => handleFilterChange({ region: '' })}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Results Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            {shops ? `${shops.length} Shops` : 'Loading...'}
          </h2>
          {hasFilters && (
            <p className="text-sm text-gray-600">
              Filtered results
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Card Variant Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Card Style:</label>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setCardVariant('default')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  cardVariant === 'default'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                Default
              </button>
              <button
                onClick={() => setCardVariant('compact')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  cardVariant === 'compact'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                Compact
              </button>
              <button
                onClick={() => setCardVariant('featured')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  cardVariant === 'featured'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                Featured
              </button>
              <button
                onClick={() => setCardVariant('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  cardVariant === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                Grid
              </button>
            </div>
          </div>
          
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {Math.ceil((shops?.length || 0) / pagination.limit)}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Shop Grid */}
      {!isLoading && shops && shops.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {shops.map((shop, index) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              variant={cardVariant}
              showUrls={true}
              trackingContext={{
                source: 'directory',
                position: index + 1,
                category: filters.category || undefined,
                searchQuery: filters.search || undefined
              }}
            />
          ))}
        </div>
      )}

      {!isLoading && shops && shops.length === 0 && (
        <Card withBorder padding="lg" radius="md">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No shops found
            </h3>
            <p className="text-gray-600 mb-4">
              {hasFilters
                ? 'Try adjusting your filters or search terms'
                : 'Check back later for new shops'}
            </p>
            {hasFilters && (
              <Button onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && shops && shops.length > 0 && (
        <ShopPagination
          currentPage={pagination.page}
          totalPages={Math.ceil((shops?.length || 0) / pagination.limit)}
          onPageChange={(page) => handlePaginationChange({ page })}
          limit={pagination.limit}
          onLimitChange={(limit) => handlePaginationChange({ limit, page: 1 })}
          limitOptions={SHOP_UI_CONFIG.PAGINATION.LIMIT_OPTIONS}
        />
      )}
    </div>
  );
}
