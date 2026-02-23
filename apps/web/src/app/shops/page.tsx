"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Star, Phone, Globe, Clock, Filter, Grid, List, ChevronDown, Store, ShoppingBag, TrendingUp, Sparkles, Tag, Users, Calendar, ArrowLeft, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Container, Grid as MantineGrid, SimpleGrid } from '@mantine/core';
import StorefrontActions from '../../components/storefront/StorefrontActions';
import { useShopsFeaturedBuckets } from '../../hooks/shops/useShopsFeaturedBuckets';
import { BucketSection, ProductBucket } from '../../components/shops/BucketSection';
import { TrendingShopsContainer } from '../../components/shops/TrendingShopsContainer';
import { TrendingProductsContainer } from '../../components/shops/TrendingProductsContainer';
import ScopeFilterBar from '../../components/shops/ScopeFilterBar';
import { useScopeUrlState } from '../../hooks/shops/useScopeUrlState';
import { ScopeParams } from '../../types/scope';
import TroubleshootingToggle from '../../components/debug/TroubleshootingToggle';
import { trackBehaviorClient } from '../../utils/behaviorTracking';
import { ShopViewTracker } from '../../components/tracking/ShopViewTracker';
import { directorySingletonService } from '../../services/DirectorySingletonService';
import { shopsService } from '../../services/ShopsService';

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
  const [categories, setCategories] = useState<{name: string, count: number, type: 'shop' | 'product'}[]>([]);
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

  // Multi-bucket data using modern hook
  const {
    refresh,
    loading,
    error,
    // Legacy bucket properties for existing page logic
    trending,
    new: newShops,
    sale,
    seasonal,
    staff,
    selection,
    random,
    buckets
  } = useShopsFeaturedBuckets();

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

  // Extract categories from both shops, products, and API
  useEffect(() => {
    const categoryMap = new Map<string, { count: number; type: 'shop' | 'product' }>();
    
    console.log('[ShopsPage] Extracting categories - shops.length:', shops.length);
    
    // Add shop categories
    if (shops.length) {
      shops.forEach(shop => {
        const category = shop.primary_category || 'General';
        const existing = categoryMap.get(category);
        if (existing) {
          existing.count += 1;
        } else {
          categoryMap.set(category, { count: 1, type: 'shop' });
        }
      });
      console.log('[ShopsPage] Shop categories added:', Array.from(categoryMap.keys()));
    }
    
    // Add product categories from all buckets
    const allProductsRaw = [
      ...trending,
      ...newShops,
      ...sale,
      ...seasonal,
      ...staff,
      ...selection,
      ...random
    ];
    
    console.log('[ShopsPage] Product buckets sizes:', {
      trending: trending.length,
      newShops: newShops.length,
      sale: sale.length,
      seasonal: seasonal.length,
      staff: staff.length,
      selection: selection.length,
      random: random.length
    });
    
    // Deduplicate products
    const productMap = new Map<string, any>();
    allProductsRaw.forEach(product => {
      const productId = product.id || product.inventory_item_id;
      if (productId && !productMap.has(productId)) {
        productMap.set(productId, product);
      }
    });
    const allProducts = Array.from(productMap.values());
    
    console.log('[ShopsPage] Unique products for categories:', allProducts.length);
    
    // Add product categories
    allProducts.forEach(product => {
      console.log('[ShopsPage] Processing product for category:', product.name, 'category fields:', {
        categoryName: product.categoryName,
        category_name: product.category_name,
        product_category: product.product_category,
        category: product.category
      });
      
      const category = product.categoryName || product.category_name || product.product_category || product.category;
      if (category) {
        const existing = categoryMap.get(category);
        if (existing) {
          existing.count += 1;
        } else {
          categoryMap.set(category, { count: 1, type: 'product' });
        }
      }
    });
    
    console.log('[ShopsPage] Product categories extracted:', Array.from(categoryMap.entries()).filter(([name, data]) => data.type === 'product'));
    
    console.log('[ShopsPage] Categories before API call:', Array.from(categoryMap.entries()));
    
    // Fetch categories from API to ensure we have all available categories
    const fetchApiCategories = async () => {
      try {
        const response = await shopsService.getCategories();
        console.log('[ShopsPage] API categories response:', response);
        
        // Handle the response structure: { success: true, data: [...] }
        let categoriesData = [];
        if (response && (response as any).categories && (response as any).categories.data) {
          // Triple-wrapped: { categories: { data: [...] } }
          categoriesData = (response as any).categories.data;
          console.log('[ShopsPage] Using triple-wrapped structure');
        } else if (response && (response as any).data) {
          // Double-wrapped: { data: [...] }
          categoriesData = (response as any).data;
          console.log('[ShopsPage] Using double-wrapped structure');
        } else if (Array.isArray(response)) {
          // Direct array
          categoriesData = response;
          console.log('[ShopsPage] Using direct array structure');
        } else {
          console.log('[ShopsPage] No matching structure found, response keys:', Object.keys(response || {}));
        }
        
        console.log('[ShopsPage] Extracted categories data:', categoriesData);
        
        if (categoriesData && Array.isArray(categoriesData)) {
          categoriesData.forEach((apiCategory: any) => {
            const existing = categoryMap.get(apiCategory.name);
            if (existing) {
              existing.count += apiCategory.count;
            } else {
              categoryMap.set(apiCategory.name, { count: apiCategory.count, type: 'shop' });
            }
          });
          console.log('[ShopsPage] Categories after API call:', Array.from(categoryMap.entries()));
        }
      } catch (error) {
        console.error('[ShopsPage] Failed to fetch API categories:', error);
      }
    };
    
    fetchApiCategories().then(() => {
      const categoryList = Array.from(categoryMap.entries()).map(([name, data]) => ({ 
        name, 
        count: data.count,
        type: data.type
      }));
      console.log('[ShopsPage] Final categories list:', categoryList);
      setCategories(categoryList.sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [shops.length]); // Only depend on shops.length to prevent infinite loops

  // Filter and sort shops
  const filterAndSortShops = (shopsList: any[]) => {
    let filtered = [...shopsList];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(shop => 
        shop.name?.toLowerCase().includes(query) ||
        shop.business_name?.toLowerCase().includes(query) ||
        shop.description?.toLowerCase().includes(query) ||
        shop.primary_category?.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      console.log('[ShopsPage] Filtering shops by category:', selectedCategory);
      console.log('[ShopsPage] Shops before filter:', shops.map(s => ({ name: s.name, primary_category: s.primary_category })));
      filtered = filtered.filter(shop => 
        shop.primary_category === selectedCategory
      );
      console.log('[ShopsPage] Shops after filter:', filtered.map(s => ({ name: s.name, primary_category: s.primary_category })));
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'rating':
          return (b.rating_avg || 0) - (a.rating_avg || 0);
        case 'products':
          return (b.product_count || 0) - (a.product_count || 0);
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        default:
          return 0;
      }
    });
    
    return filtered;
  };

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
        p.category_name?.toLowerCase().includes(query) ||
        p.product_category?.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      console.log('[ShopsPage] Filtering products by category:', selectedCategory);
      console.log('[ShopsPage] Products before filter:', products.slice(0, 3).map(p => ({ name: p.name, categoryFields: { categoryName: p.categoryName, category_name: p.category_name, product_category: p.product_category, category: p.category } })));
      filtered = filtered.filter(p => 
        p.category === selectedCategory // Use the correct field that has data
      );
      console.log('[ShopsPage] Products after filter:', filtered.length, 'products found');
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

  // Helper function to get all products from all buckets
  const getAllProducts = () => {
    const allProductsRaw = [
      ...trending,
      ...newShops,
      ...sale,
      ...seasonal,
      ...staff,
      ...selection,
      ...random
    ];
    
    // Deduplicate products
    const productMap = new Map<string, any>();
    allProductsRaw.forEach(product => {
      const productId = product.id || product.inventory_item_id;
      if (productId && !productMap.has(productId)) {
        productMap.set(productId, product);
      }
    });
    return Array.from(productMap.values());
  };

  // Show traditional listing when searching or filtering
  const showTraditionalListing = searchQuery || selectedCategory || sortBy !== 'name';

  const fetchShops = async () => {
    setShopsLoading(true);
    setShopsError(null);
    try {
      const shops = await directorySingletonService.getPublicShops();
      setShops(shops);
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
        
        {/* Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-900 dark:text-white">Shops & Products</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/shops/directory">
                <Button variant="ghost" size="sm">
                  <Store className="h-4 w-4 mr-2" />
                  Shops Directory
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
        
        {/* Scope Filter Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <ScopeFilterBar
            onScopeChange={handleScopeChange}
            initialScope={scopeParams}
            categories={categories}
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
                {categories.map((category) => {
                  console.log('[ShopsPage] Rendering category option:', category);
                  return (
                    <option key={category.name} value={category.name}>
                      {category.name} ({category.count})
                    </option>
                  );
                })}
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

      {/* Separated Containers with Mantine Grid */}
      {!showTraditionalListing && (
        <Container size="xl" py="md">
          {/* Trending Section with Shops and Products */}
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl" mb="xl">
            {/* Trending Shops Container */}
            <div>
              <ProductBucket
                products={trending}
                loading={loading}
                error={error}
                title="Featured Shops"
                subtitle="Trending and popular shops in your area"
                maxItems={8}
                onShopClick={handleShopClick}
              />
            </div>
            
            {/* Trending Products Container */}
            <div>
              <TrendingProductsContainer 
                trendingProducts={trending}
                loading={loading}
                error={error}
              />
            </div>
          </SimpleGrid>

          {/* Other Product Buckets */}
          <div className="space-y-12">
            {/* Mid Page: Conversion Focused */}
            <div className="space-y-12 mb-16">
              <ProductBucket
                products={filterAndSortProducts(newShops)}
                loading={loading}
                error={error}
                title="✨ New Arrivals"
                subtitle="Fresh products just added to our marketplace"
                maxItems={8}
                onShopClick={handleShopClick}
              />
              
              <ProductBucket
                products={filterAndSortProducts(random)}
                loading={loading}
                error={error}
                title="🎲 Discover Something New"
                subtitle="Randomly selected gems from our curated collection"
                maxItems={8}
                onShopClick={handleShopClick}
              />
            </div>

            <div className="space-y-12 mb-16">
              <ProductBucket
                products={filterAndSortProducts(sale)}
                loading={loading}
                error={error}
                title="🏷️ Sale & Deals"
                subtitle="Limited-time offers and special promotions"
                maxItems={8}
                showViewAll={true}
                viewAllUrl="/shops?filter=sale"
                onShopClick={handleShopClick}
              />
              
              <ProductBucket
                products={filterAndSortProducts(seasonal)}
                loading={loading}
                error={error}
                title="🍂 Seasonal Picks"
                subtitle="Perfect products for the current season"
                maxItems={8}
                onShopClick={handleShopClick}
              />
              
              <ProductBucket
                products={filterAndSortProducts(staff)}
                loading={loading}
                error={error}
                title="⭐ Staff Picks"
                subtitle="Hand-picked favorites from our team"
                maxItems={8}
                onShopClick={handleShopClick}
              />
            </div>

            {/* Below Fold: Discovery & Exploration */}
            <div className="space-y-12">
              <ProductBucket
                products={selection}
                loading={loading}
                error={error}
                title="🏪 Store Selections"
                subtitle="Curated collections from individual shops"
                maxItems={8}
                onShopClick={handleShopClick}
              />
            </div>
          </div>

          {/* Performance Metrics (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-16 p-6 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Buckets Loaded:</span>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{buckets.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Products:</span>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{buckets.reduce((sum, b) => sum + b.products.length, 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{loading ? 'Loading...' : 'Ready'}</span>
                </div>
              </div>
              <button onClick={refresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                🔄 Refetch Buckets
              </button>
            </div>
          )}
        </Container>
      )}

      {/* Traditional Listing (for search/filter) - Shows both Shops and Products */}
      {showTraditionalListing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {searchQuery && `Search Results for "${searchQuery}"`}
              {selectedCategory && !searchQuery && `${selectedCategory} Results`}
              {!searchQuery && !selectedCategory && 'All Results'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {filterAndSortShops(shops).length} shops and {filterAndSortProducts(getAllProducts()).length} products found
            </p>
          </div>
          
          {/* Shops Section */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Store size={20} />
              Shops ({filterAndSortShops(shops).length})
            </h3>
            
            {shopsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
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
            ) : filterAndSortShops(shops).length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏪</div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No shops found</h3>
                <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {filterAndSortShops(shops).map((shop, index) => (
                  <div 
                    key={shop.id} 
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer"
                    onClick={() => handleShopCardClick(shop, index + 1, 'search')}
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
                          <MapPin size={14} />
                          {shop.city || 'Location'}
                        </span>
                        <span>{shop.product_count || 0} products</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star size={14} className="text-yellow-500 fill-current" />
                          <span className="font-medium">{shop.rating_avg?.toFixed(1) || 'N/A'}</span>
                        </div>
                        <span className="text-gray-400">({shop.rating_count || 0} reviews)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Products Section */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <ShoppingBag size={20} />
              Products ({filterAndSortProducts(getAllProducts()).length})
            </h3>
            
            {filterAndSortProducts(getAllProducts()).length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No products found</h3>
                <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters</p>
              </div>
            ) : (
              <ProductBucket
                products={filterAndSortProducts(getAllProducts())}
                loading={loading}
                error={error}
                title=""
                subtitle=""
                maxItems={undefined}
                onShopClick={handleShopClick}
              />
            )}
          </div>
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
