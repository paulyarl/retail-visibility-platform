"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Package, Search, Filter, Grid, List, ChevronDown, ShoppingCart, Heart, Share2, Truck, Shield, Sparkles, Store } from 'lucide-react';
import { useProductLayout, layoutVariantDescriptions } from '@/contexts/ProductLayoutContext';
import StorefrontActions from '@/components/storefront/StorefrontActions';
import { clientLogger } from '@/lib/client-logger';

// Dynamic import for apiRequest to avoid SSR issues
const apiRequest = () => import('@/lib/api').then(mod => mod.apiRequest);

interface CatalogProduct {
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
  tenantId: string;
  tenantName?: string;
  tenantSlug?: string;
  categoryName?: string;
  categorySlug?: string;
  condition?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  ratingAvg?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  featuredTypes?: string[];
  hasVariants?: boolean;
  metadata?: Record<string, any>;
  price?: number;
  salePrice?: number;
  currency?: string;
}

interface CatalogResponse {
  items: CatalogProduct[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  business_name?: string;
  logo_url?: string;
}

function CatalogPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'price-low' | 'price-high' | 'rating'>('featured');
  const { variant: layoutVariant, setVariant } = useProductLayout();

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '24',
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedTenant && { tenant: selectedTenant }),
        ...(searchQuery && { search: searchQuery }),
        ...(sortBy && { sort: sortBy }),
      });

      const response = await (await apiRequest())(`/public/catalog?${params}`, {
        skipAuth: true // Skip authentication for public endpoint
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data: CatalogResponse = await response.json();
      setProducts(data.items);
      setTotalPages(data.pagination.totalPages);
      setTotalItems(data.pagination.totalItems);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await (await apiRequest())('/public/categories', {
        skipAuth: true // Skip authentication for public endpoint
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      clientLogger.error('Failed to fetch categories:', { detail: err });
    }
  };

  // Fetch tenants
  const fetchTenants = async () => {
    try {
      const response = await (await apiRequest())('/public/tenants', {
        skipAuth: true // Skip authentication for public endpoint
      });
      if (!response.ok) throw new Error('Failed to fetch tenants');
      
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (err) {
      clientLogger.error('Failed to fetch tenants:', { detail: err });
    }
  };

  // Initialize from URL params
  useEffect(() => {
    const page = searchParams.get('page');
    const category = searchParams.get('category');
    const tenant = searchParams.get('tenant');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort');
    
    if (page) setCurrentPage(parseInt(page));
    if (category) setSelectedCategory(category);
    if (tenant) setSelectedTenant(tenant);
    if (search) setSearchQuery(search || '');
    if (sort) setSortBy(sort as any);
  }, [searchParams]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchTenants();
  }, [currentPage, selectedCategory, selectedTenant, searchQuery, sortBy]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedTenant) params.set('tenant', selectedTenant);
    if (searchQuery) params.set('search', searchQuery);
    if (sortBy !== 'featured') params.set('sort', sortBy);
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [currentPage, selectedCategory, selectedTenant, searchQuery, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleTenantChange = (tenant: string) => {
    setSelectedTenant(tenant);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort as any);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Enhanced product card for conversion optimization
  const ProductCard = ({ product }: { product: CatalogProduct }) => {
    const price = Number(product.price || (product.priceCents / 100)) || 0;
    const salePrice = product.salePriceCents ? Number(product.salePrice || (product.salePriceCents / 100)) : undefined;
    const isOnSale = salePrice && salePrice < price;
    const discount = isOnSale ? Math.round(((price - salePrice!) / price) * 100) : 0;

    return (
      <div className="group relative bg-white dark:bg-neutral-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600">
        {/* Product Image */}
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
          )}

          {/* Conversion-Optimized Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex gap-2">
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1">
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
                <button className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors">
                  <Heart className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Featured Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isFeatured && (
              <span className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                ⭐ Featured
              </span>
            )}
            {isOnSale && (
              <span className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg">
                💰 {discount}% OFF
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Stock Status */}
          {product.availability === 'out_of_stock' && (
            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
              <span className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4">
          {/* Store Name */}
          {product.tenantName && (
            <div className="mb-2">
              <Link
                href={`/t/${product.tenantSlug}`}
                className="inline-flex items-center px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <Store className="w-3 h-3 mr-1" />
                {product.tenantName}
              </Link>
            </div>
          )}

          {/* Category */}
          {product.categoryName && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
                🏷️ {product.categoryName}
              </span>
            </div>
          )}

          {/* Brand */}
          {product.brand && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1 font-medium">
              {product.brand}
            </p>
          )}

          {/* Name */}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {product.name}
          </h3>

          {/* Trust Indicators */}
          <div className="flex items-center gap-2 mb-2">
            {product.stock !== undefined && product.stock > 0 && (
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">
                <Truck className="w-3 h-3 mr-1" />
                In Stock ({product.stock})
              </span>
            )}
            {product.condition === 'brand_new' && (
              <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded">
                <Shield className="w-3 h-3 mr-1" />
                Brand New
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  ${price.toFixed(2)}
                </span>
                {isOnSale && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                    ${salePrice!.toFixed(2)}
                  </span>
                )}
              </div>
              {isOnSale && (
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Save ${(price - salePrice!).toFixed(2)} ({discount}% off)
                </p>
              )}
            </div>
          </div>

          {/* Rating */}
          {product.ratingAvg && (
            <div className="flex items-center gap-1 mb-3">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(product.ratingAvg!)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)
              </span>
            </div>
          )}

          {/* Call to Action */}
          <div className="flex gap-2">
            <Link
              href={`/products/${product.id}`}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
            >
              View Details
            </Link>
            <button className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              <Heart className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-xl h-96"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-lg mb-4">Error loading catalog</div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* SEO-Optimized Header with Action Bar */}
      <div className="bg-white dark:bg-neutral-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Public Product Catalog
                </span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
                Discover products from {tenants.length} stores across our platform
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  Quality Guaranteed
                </span>
                <span className="flex items-center gap-1">
                  <Truck className="w-4 h-4" />
                  Fast Shipping
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  Curated Selection
                </span>
              </div>
            </div>
            <div className="ml-4">
              <StorefrontActions 
                tenantId="public"
                businessName="Public Catalog"
                currentUrl={typeof window !== 'undefined' ? window.location.href : ''}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Conversion-Optimized Search and Filters */}
      <div className="bg-white dark:bg-neutral-800 shadow-lg sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products across all stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-neutral-700 dark:text-white"
                />
              </div>
            </form>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Store Filter */}
              <div className="relative">
                <select
                  value={selectedTenant}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  className="appearance-none bg-white dark:bg-neutral-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                >
                  <option value="">All Stores</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.business_name || tenant.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="appearance-none bg-white dark:bg-neutral-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name} ({category.productCount})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="appearance-none bg-white dark:bg-neutral-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                >
                  <option value="featured">Featured</option>
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>

              {/* View Mode */}
              <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-neutral-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-neutral-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              {/* Layout Variant */}
              <div className="relative">
                <select
                  value={layoutVariant}
                  onChange={(e) => setVariant(e.target.value as any)}
                  className="appearance-none bg-white dark:bg-neutral-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                >
                  {Object.entries(layoutVariantDescriptions).map(([key, desc]) => (
                    <option key={key} value={key}>
                      {desc.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">
              {totalItems} Products Found
            </span>
            <span className="text-sm ml-2">
              from {tenants.length} stores
            </span>
            <span className="text-sm ml-2">
              Showing {((currentPage - 1) * 24) + 1}-{Math.min(currentPage * 24, totalItems)}
            </span>
          </div>
          
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 dark:text-gray-400">
            <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-300">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 dark:text-white">Catalog</span>
          </nav>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              No products found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSelectedCategory('');
                setSelectedTenant('');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Conversion-Optimized Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-12">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-6 py-3 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-neutral-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-neutral-700 transition-colors"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-6 py-3 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-neutral-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-neutral-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* SEO Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              Browse our complete catalog with {totalItems} products from {tenants.length} stores across {categories.length} aisles
            </p>
            <p className="text-sm">
              Quality products, fast shipping, and excellent customer service guaranteed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicCatalogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading catalog...</p>
        </div>
      </div>
    }>
      <CatalogPageContent />
    </Suspense>
  );
}
