"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Star, Phone, Globe, Clock, Filter, Grid, List, ChevronDown, Store, ShoppingBag, TrendingUp, Sparkles, Tag, Users, Calendar, ArrowLeft, X } from 'lucide-react';
import StorefrontActions from '@/components/storefront/StorefrontActions';
import { useShopsFeaturedBuckets } from '@/hooks/shops/useShopsFeaturedBuckets';
import { BucketSection, ProductBucket, ShopBucket } from '@/components/shops/BucketSection';
import ScopeFilterBar from '@/components/shops/ScopeFilterBar';
import { useScopeUrlState } from '@/hooks/shops/useScopeUrlState';
import { ScopeParams } from '@/types/scope';
import TroubleshootingToggle from '@/components/debug/TroubleshootingToggle';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import { ShopViewTracker } from '@/components/tracking/ShopViewTracker';

interface Shop {
  id: string;
  name: string;
  slug: string;
  business_name: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  website?: string;
  rating_avg?: number;
  rating_count?: number;
  business_description?: string;
  business_hours?: any;
  is_published: boolean;
  primary_category?: string;
  description?: string;
  product_count: number;
}

interface ShopProduct {
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  imageUrl?: string;
  categoryName?: string;
  categorySlug?: string;
  condition?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  ratingAvg?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  hasVariants?: boolean;
  price?: number;
  salePrice?: number;
  currency?: string;
}

function ShopsPageContent() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'products' | 'newest'>('name');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<{name: string, count: number}[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState<string | null>(null);

  // Scope state management
  const { currentScope, updateUrl, clearScope } = useScopeUrlState();
  const [scopeParams, setScopeParams] = useState<ScopeParams>(currentScope);

  // Update scope params when URL changes
  useEffect(() => {
    setScopeParams(currentScope);
  }, [currentScope]);

  // Handle scope changes from filter bar
  const handleScopeChange = (newScope: ScopeParams) => {
    setScopeParams(newScope);
    updateUrl(newScope);
  };

  // Multi-bucket data using Universal Singleton System with scope support
  const { buckets, loading, error, refetch, metrics } = useShopsFeaturedBuckets({
    tenantId: 'global',
    shopScope: 'global',
    enabled: true,
    scope: scopeParams // NEW: Pass scope params
  });

  const handleProductClick = (product: any) => {
    const itemId = product.inventoryItemId || product.inventory_item_id || product.id;
    if (itemId) {
      window.location.href = `/products/${itemId}`;
    } else {
      console.error('Product missing ID:', product);
    }
  };

  const handleShopClick = (shop: any) => {
    window.location.href = `/shops/${shop.id}`;
  };

  const handleShopCardClick = (shop: Shop, position?: number, bucketType?: string) => {
    // Track shop card click
    trackBehaviorClient({
      entityType: 'store',
      entityId: shop.id,
      context: {
        source: 'featured',
        shop_name: shop.name,
        category: shop.primary_category,
        position: position,
        bucket_type: bucketType,
        rating: shop.rating_avg,
        review_count: shop.rating_count,
        product_count: shop.product_count
      },
      pageType: 'directory_home'
    });
    
    router.push(`/shops/${shop.id}`);
  };

  // Extract categories from all products
  useEffect(() => {
    const allProductsRaw = [
      ...buckets.trending,
      ...buckets.new,
      ...buckets.sale,
      ...buckets.seasonal,
      ...buckets.staff,
      ...buckets.selection,
      ...buckets.random
    ];

    // Deduplicate products across all buckets to prevent double-counting
    const productMap = new Map<string, any>();
    allProductsRaw.forEach(product => {
      const productId = product.id || product.inventory_item_id;
      if (!productMap.has(productId)) {
        productMap.set(productId, product);
      }
    });
    const allProducts = Array.from(productMap.values());

    const categoryMap = new Map<string, number>();
    allProducts.forEach(product => {
      const category = product.categoryName || product.category_name;
      if (category) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      }
    });
    
    const categoryList = Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));
    setCategories(categoryList.sort((a, b) => a.name.localeCompare(b.name)));
  }, [buckets]);

  // Filter and sort products
  const filterAndSortProducts = (products: any[]) => {
    let filtered = [...products];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.categoryName?.toLowerCase().includes(query) ||
        p.category_name?.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(p => 
        p.categoryName === selectedCategory || p.category_name === selectedCategory
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'rating':
          return (b.ratingAvg || 0) - (a.ratingAvg || 0);
        case 'products':
          return (b.stock || 0) - (a.stock || 0);
        case 'newest':
          return new Date(b.featuredAt || 0).getTime() - new Date(a.featuredAt || 0).getTime();
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  // Show traditional listing when searching or filtering
  const showTraditionalListing = searchQuery || selectedCategory || sortBy !== 'name';

  const fetchShops = async () => {
    setShopsLoading(true);
    setShopsError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await fetch(`${apiBaseUrl}/api/public/shops`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch shops');
      }
      
      const data = await res.json();
      if (data.success && data.shops) {
        setShops(data.shops);
      }
    } catch (err) {
      setShopsError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setShopsLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Track shops landing page view */}
      <ShopViewTracker 
        tenantId="shops_landing" 
        pageType="shop_directory"
        category={null}
      />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Discover Shops
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Explore unique products from local businesses in your area
                </p>
              </div>
            </div>
            <div className="ml-4">
              <StorefrontActions 
                tenantId=""
                businessName="Shops Directory"
                currentUrl="/shops"
              />
            </div>
          </div>
        </div>
        
        {/* Scope Filter Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <ScopeFilterBar
            onScopeChange={handleScopeChange}
            initialScope={scopeParams}
          />
        </div>

        {/* Active Filters */}
        {scopeParams.scope !== 'global' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Active Filters:
              </span>
              
              {scopeParams.scope === 'category' && scopeParams.category && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                  <Tag size={14} />
                  {scopeParams.category.productName || scopeParams.category.shopCategoryName}
                  <button
                    onClick={clearScope}
                    className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              
              {scopeParams.scope === 'location' && scopeParams.location && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
                  <MapPin size={14} />
                  {scopeParams.location.city && scopeParams.location.state
                    ? `${scopeParams.location.city}, ${scopeParams.location.state}`
                    : scopeParams.location.zip
                    ? `ZIP ${scopeParams.location.zip}`
                    : scopeParams.location.latitude
                    ? `Near Me (${scopeParams.location.radius || 25}mi)`
                    : 'Location Filter'}
                  <button
                    onClick={clearScope}
                    className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              
              <button
                onClick={clearScope}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search shops, products, or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="name">Sort by Name</option>
                <option value="rating">Sort by Rating</option>
                <option value="products">Sort by Products</option>
                <option value="newest">Sort by Newest</option>
              </select>
              
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Bucket Discovery Experience */}
      {!showTraditionalListing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Above Fold: High Engagement Buckets */}
          <div className="space-y-12 mb-16">
            <ProductBucket
              products={filterAndSortProducts(buckets.trending)}
              loading={loading}
              error={error}
              title="🔥 Trending Products"
              subtitle="Hot products gaining traction across all shops"
              maxItems={8}
              onProductClick={handleProductClick}
              viewMode={viewMode}
            />
            
            <ProductBucket
              products={filterAndSortProducts(buckets.new)}
              loading={loading}
              error={error}
              title="✨ New Arrivals"
              subtitle="Fresh products just added to our marketplace"
              maxItems={8}
              onProductClick={handleProductClick}
              viewMode={viewMode}
            />
            
            <ProductBucket
              products={filterAndSortProducts(buckets.random)}
              loading={loading}
              error={error}
              title="🎲 Discover Something New"
              subtitle="Randomly selected gems from our curated collection"
              maxItems={8}
              onProductClick={handleProductClick}
              viewMode={viewMode}
            />
          </div>

          {/* Mid Page: Conversion Focused */}
          <div className="space-y-12 mb-16">
            <ProductBucket
              products={filterAndSortProducts(buckets.sale)}
              loading={loading}
              error={error}
              title="🏷️ Sale & Deals"
              subtitle="Limited-time offers and special promotions"
              maxItems={8}
              showViewAll={true}
              viewAllUrl="/shops?filter=sale"
              onProductClick={handleProductClick}
              viewMode={viewMode}
            />
            
            <ProductBucket
              products={filterAndSortProducts(buckets.seasonal)}
              loading={loading}
              error={error}
              title="🍂 Seasonal Picks"
              subtitle="Perfect products for the current season"
              maxItems={8}
              onProductClick={handleProductClick}
              viewMode={viewMode}
            />
            
            <ProductBucket
              products={filterAndSortProducts(buckets.staff)}
              loading={loading}
              error={error}
              title="⭐ Staff Picks"
              subtitle="Hand-picked favorites from our team"
              maxItems={8}
              onProductClick={handleProductClick}
              viewMode={viewMode}
            />
          </div>

          {/* Below Fold: Discovery & Exploration */}
          <div className="space-y-12">
            <ShopBucket
              shops={buckets.trendingShops}
              loading={loading}
              error={error}
              title="🔥 Trending Shops"
              subtitle="Popular shops with high engagement"
              maxItems={6}
              showViewAll={true}
              viewAllUrl="/shops?sort=trending"
              onShopClick={handleShopClick}
            />
            
            <ProductBucket
              products={buckets.selection}
              loading={loading}
              error={error}
              title="🏪 Store Selections"
              subtitle="Curated collections from individual shops"
              maxItems={8}
              onProductClick={handleProductClick}
            />
          </div>

          {/* Performance Metrics (Development Only) */}
          {process.env.NODE_ENV === 'development' && metrics && (
            <div className="mt-16 p-6 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Response Time:</span>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{metrics.totalResponseTime}ms</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Cache Hit Rate:</span>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{metrics.cacheHitRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Buckets Loaded:</span>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{metrics.bucketCount}</span>
                </div>
              </div>
              <button onClick={refetch} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                🔄 Refetch Buckets
              </button>
            </div>
          )}
        </div>
      )}

      {/* Traditional Shops Listing (for search/filter) */}
      {showTraditionalListing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {searchQuery && `Search Results for "${searchQuery}"`}
              {selectedCategory && `${selectedCategory} Shops`}
              {!searchQuery && !selectedCategory && 'All Shops'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {shops.length} shops found
            </p>
          </div>
          
          {shopsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm animate-pulse">
                  <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-t-xl"></div>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                    <div className="flex gap-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : shopsError ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">Error loading shops: {shopsError}</p>
              <button onClick={fetchShops} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Try Again
              </button>
            </div>
          ) : shops.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No shops found</h3>
              <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
              {shops.map((shop, index) => (
                <div 
                  key={shop.id} 
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer"
                  onClick={() => handleShopCardClick(shop, index + 1, 'featured')}
                >
                  <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {shop.logo_url ? (
                      <Image
                        src={shop.logo_url}
                        alt={shop.name}
                        width={120}
                        height={120}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store size={48} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2 truncate">{shop.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {shop.business_description || 'Quality products and great service'}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <ShoppingBag size={14} />
                        {shop.product_count} products
                      </span>
                      {shop.rating_avg && (
                        <span className="flex items-center gap-1">
                          <Star size={14} className="text-yellow-400" />
                          {shop.rating_avg.toFixed(1)} ({shop.rating_count})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {shop.city && shop.state && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {shop.city}, {shop.state}
                        </span>
                      )}
                      {shop.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={14} />
                          {shop.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShopsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading shops...</p>
        </div>
      </div>
    }>
      <ShopsPageContent />
      <TroubleshootingToggle />
    </Suspense>
  );
}
