/**
 * Shop Directory Page
 * Main page for browsing all shops with filtering and pagination
 */

'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useShopDirectory, useStoreTypes, useTrendingShops } from '@/lib/shops/shop-hooks';

import { LinkType } from '@/components/stores/StoreCard';
import { Shop, ShopCategory } from '@/types/shop';
import { SHOP_UI_CONFIG } from '@/constants/shop';
import { ShopCard } from '@/components/shops/ShopCard';
import { ShopFilters } from '@/components/shops/ShopFilters';
import { ShopPagination } from '@/components/shops/ShopPagination';
import { TrendingShops } from '@/components/shops/TrendingShops';
import { ShopSearch } from '@/components/shops/ShopSearch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Button, Badge, Card, Group, Text, Stack, Tabs, TabsList, TabsTab, TabsPanel, TextInput, Select } from '@mantine/core';
import { Layout, LayoutList, Star, Grid3X3, Grid, Store, ShoppingBag, TrendingUp, Sparkles, X, Layers } from 'lucide-react';
import Link from 'next/link';
import { ShopViewTracker } from '@/components/tracking/ShopViewTracker';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { StoreList, StoreData } from '@/components/stores';
import { usePublicBranding } from '@/hooks/usePublicBranding';
import LastViewed from '@/components/directory/LastViewed';

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
  
  // Get platform branding
  const { branding: platformBranding } = usePublicBranding();
  
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
  const [advancedViewMode, setAdvancedViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch data
  const { shops, loading, error, hasMore, loadMore, refresh } = useShopDirectory({
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
    search: filters.search || undefined,
    category: filters.category || undefined,
    location: filters.region || undefined
  });

  const { data: storeTypes, loading: categoriesLoading } = useStoreTypes();

  const { data: trendingShops, loading: trendingLoading } = useTrendingShops({
    limit: 8,
    region: filters.region || undefined
  });


  // Derived state
  const hasFilters = useMemo(() => {
    return filters.search || filters.category || filters.region || filters.verified;
  }, [filters]);

  const filteredCategories = useMemo(() => {
    if (!storeTypes) return [];
    return storeTypes.map((cat: any) => ({
      ...cat,
      count: cat.count || 0
    }));
  }, [storeTypes]);

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
  const isLoading = loading || trendingLoading || categoriesLoading;

  // Error state
  const hasError = error;

  if (hasError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage
          title="Unable to load shops"
          message="We're having trouble loading the shop directory. Please try again later."
          onRetry={refresh}
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
          {/* Mobile: Stacked layout, Desktop: Side by side */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Navigation Links */}
              <div className="flex items-center gap-2">
                <Link 
                  href="/shops"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Store className="h-4 w-4" />
                  Shops
                </Link>
                <span className="text-gray-400">•</span>
                <span className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium">
                  <Grid className="h-4 w-4" />
                  Directory
                </span>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/featured"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Featured
                </Link>
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
        </div>
      </div>
      
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-xl p-8 mb-8 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {/* Column 1: Platform Branding */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg overflow-hidden">
              {platformBranding?.logoUrl ? (
                <img 
                  src={platformBranding.logoUrl} 
                  alt={platformBranding.platformName || 'Platform'} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <Store className="w-7 h-7" />
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
          <div className="text-right">
            <h1 className="text-2xl text-center sm:text-right font-bold text-gray-900 dark:text-white">
              Shops Directory
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Discover amazing shops from our marketplace
            </p>
          </div>
        </div>
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
                  onChange={(value) => handleCategoryChange(value || '')}
                  data={[
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
                <TextInput
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
                  onChange={(value) => handleSortChange(value || 'name')}
                  data={[
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
                  <Badge variant="light" className="flex items-center gap-1">
                    Search: "{filters.search}"
                    <Button
                      variant="subtle"
                      onClick={() => handleFilterChange({ search: '' })}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                {filters.category && (
                  <Badge variant="light" className="flex items-center gap-1">
                    Category: {filteredCategories.find(c => c.id === filters.category)?.name}
                    <Button
                      variant="subtle"
                      onClick={() => handleFilterChange({ category: '' })}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                {filters.region && (
                  <Badge variant="light" className="flex items-center gap-1">
                    Region: "{filters.region}"
                    <Button
                      variant="subtle"
                      onClick={() => handleFilterChange({ region: '' })}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Results Header */}
      <div className="relative mb-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                All Shops
                <span className="ml-2 text-lg font-normal text-gray-500 dark:text-gray-400">
                  ({shops?.length || 0})
                </span>
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {hasFilters ? 'Filtered results' : 'Browse all stores in our marketplace'}
              </p>
            </div>
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
        {/* Gradient border line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-transparent" />
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
          {shops.map((shop: any, index: number) => (
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
              <Button onClick={clearFilters} variant="light">
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

      {/* Advanced View Section */}
      {!isLoading && shops && shops.length > 0 && (
        <div className="mt-16 pt-8 border-t border-gray-200">
          {/* Styled Section Header */}
          <div className="relative mb-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced View</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Detailed store information with product stats, categories, and ratings</p>
                </div>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setAdvancedViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    advancedViewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  Grid
                </button>
                <button
                  onClick={() => setAdvancedViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    advancedViewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  List
                </button>
              </div>
            </div>
            {/* Gradient border line */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-transparent" />
          </div>

          {/* Transform shops to StoreData format */}
          <StoreList
            stores={shops.map((shop: any) => ({
              id: shop.id,
              tenantId: shop.tenantId || shop.id,
              name: shop.businessName || shop.name,
              slug: shop.slug,
              address: shop.address,
              city: shop.city,
              state: shop.state,
              zipCode: shop.zip_code || shop.zipCode,
              latitude: shop.latitude,
              longitude: shop.longitude,
              logoUrl: shop.imageUrl || shop.logoUrl || shop.logo_url,
              bannerUrl: shop.bannerUrl || shop.banner_url,
              primaryCategory: shop.primaryCategory || shop.primary_category || shop.category,
              phone: shop.phone,
              website: shop.website,
              ratingAvg: shop.ratingAvg || shop.rating,
              ratingCount: shop.ratingCount || shop.rating_count || shop.reviewCount,
              productCount: shop.productCount || shop.product_count,
              isFeatured: shop.isFeatured,
              subscriptionTier: shop.subscriptionTier,
              businessHours: shop.hours || shop.businessHours,
            }))}
            viewMode={advancedViewMode}
            linkType={LinkType.Storefront}
            showLogo={true}
            showCategories={true}
            maxCategories={3}
            loading={false}
          />
        </div>
      )}

      {/* Recently Viewed */}
      <LastViewed />

      {/* Platform Branding Footer */}
      <PoweredByFooter />
    </div>
  );
}
