"use client";

import React, { useState, useEffect } from 'react';
import CollapsibleCatalogSidebar from '@/components/storefront/CollapsibleCatalogSidebar';
import { featuredProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
import { FeaturedProduct } from '@/providers/data/FeaturedProductsSingleton';
import StorefrontViewTracker from '@/components/tracking/StorefrontViewTracker';
import ContactInformationCollapsible from '@/components/storefront/ContactInformationCollapsible';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StorefrontMap from '@/components/storefront/StorefrontMap';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import FeaturedProductsSection from '@/components/storefront/FeaturedProductsSection';
import Image from 'next/image';
import Link from 'next/link';

interface StorefrontClientWrapperProps {
  tenantId: string;
  tenant: any;
  products: any[];
  total: number;
  limit: number;
  platformSettings: any;
  mapLocation: any;
  hasBranding: boolean;
  businessHours: any;
  storeStatus: any;
  categories: any[];
  productCategories: any[];
  storeCategories: any[];
  uncategorizedCount: number;
  currentCategory: any;
  paymentGateways: any[];
  businessName: string;
  currentPage: number;
  totalPages: number;
  search?: string;
  category?: string;
  featured?: string;
  view?: string;
  isProductsOnly: boolean;
  apiBaseUrl: string;
  directoryPublished: boolean;
  tenantSlug: string;
  primaryStoreCategory: any;
  primaryGBPCategory: any;
  secondaryGBPCategories: any[];
  tier: string;
  features: any;
  totalAllProducts: number;
  fullWidthLayout?: boolean;
}

export default function StorefrontClientWrapper({
  tenantId,
  tenant,
  products,
  total,
  limit,
  platformSettings,
  mapLocation,
  hasBranding,
  businessHours,
  storeStatus,
  categories,
  productCategories,
  storeCategories,
  uncategorizedCount,
  currentCategory,
  paymentGateways,
  businessName,
  currentPage,
  totalPages,
  search,
  category,
  featured,
  view,
  isProductsOnly,
  apiBaseUrl,
  directoryPublished,
  tenantSlug,
  primaryStoreCategory,
  primaryGBPCategory,
  secondaryGBPCategories,
  tier,
  features,
  totalAllProducts,
  fullWidthLayout = false,
}: StorefrontClientWrapperProps) {
  const [featuredCounts, setFeaturedCounts] = useState({
    staffPick: 0,
    seasonal: 0,
    sale: 0,
    newArrival: 0,
    storeSelection: 0,
  });

  const [isFullWidth, setIsFullWidth] = useState(fullWidthLayout);
  const [featuredData, setFeaturedData] = useState<any>(null);

  // Fetch featured data on mount
  useEffect(() => {
    const loadFeaturedCounts = async () => {
      try {
        const data = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20);
        if (data) {
          console.log('Featured data response:', data);
          console.log('Buckets:', data.buckets);
          
          setFeaturedData(data);
          
          // Extract counts from buckets
          const getBucketCount = (bucketType: string) => {
            const bucket = data.buckets?.find((b: any) => b.bucketType === bucketType);
            return bucket?.totalCount || 0;
          };
          
          setFeaturedCounts({
            staffPick: getBucketCount('staff_pick'),
            seasonal: getBucketCount('seasonal'),
            sale: getBucketCount('sale'),
            newArrival: getBucketCount('new_arrival'),
            storeSelection: getBucketCount('store_selection'),
          });
        }
      } catch (err) {
        console.error('Failed to load featured counts:', err);
      }
    };

    if (tenantId) {
      loadFeaturedCounts();
    }
  }, [tenantId]);

  // Helper function to get featured type display name
  const getFeaturedTypeName = (type: string) => {
    switch (type) {
      case 'store_selection': return 'Featured Products';
      case 'new_arrival': return 'New Arrivals';
      case 'seasonal': return 'Seasonal Specials';
      case 'sale': return 'Sale Items';
      case 'staff_pick': return 'Staff Picks';
      default: return 'Products';
    }
  };

  const getCategoryUrl = (category: any, basePath: string) => {
    if (!category) return basePath;
    const categoryName = category.name?.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-') || 'uncategorized';
    return `${basePath}/${categoryName}`;
  };

  return (
    <>
      {/* Page Controls */}
      <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        <div className="py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              Page controls and navigation
            </div>
            
            {/* Layout Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Layout:</span>
              <button
                onClick={() => setIsFullWidth(!isFullWidth)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                title={isFullWidth ? "Switch to constrained layout" : "Switch to full width layout"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isFullWidth ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20H5a2 2 0 01-2-2V6a2 2 0 012-2h4m10 0h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M9 4h6v16H9V4z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
                {isFullWidth ? 'Constrained' : 'Full Width'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header with Business Name and Logo - AT THE TOP */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-6">
            {tenant.metadata?.logo_url && (
              <div className="relative w-24 h-24 shrink-0">
                <Image
                  src={tenant.metadata.logo_url}
                  alt={businessName}
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
                  {businessName}
                </h1>
                
                {/* Layout Toggle Button */}
                <button
                  onClick={() => setIsFullWidth(!isFullWidth)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  title={isFullWidth ? "Switch to constrained layout" : "Switch to full width layout"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isFullWidth ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20H5a2 2 0 01-2-2V6a2 2 0 012-2h4m10 0h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M9 4h6v16H9V4z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    )}
                  </svg>
                  {isFullWidth ? 'Constrained' : 'Full Width'}
                </button>
              </div>

              {/* GBP Categories - Clean badges below store name */}
              {(primaryGBPCategory || (storeCategories && storeCategories.length > 0)) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {/* Primary GBP Category */}
                  {primaryGBPCategory && (
                    <Link
                      href={`/directory/stores/${primaryGBPCategory.id?.replace('gcid:', '').replace(/_/g, '-') || primaryGBPCategory.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      title={`Browse all ${primaryGBPCategory.name} stores`}
                    >
                      <span className="text-base">
                        {primaryGBPCategory.name === 'Grocery store' && '🏪'}
                        {primaryGBPCategory.name === 'Electronics store' && '🛍️'}
                        {primaryGBPCategory.name === 'Shoe store' && '👟'}
                        {primaryGBPCategory.name === 'Supermarket' && '🛒'}
                        {primaryGBPCategory.name === 'Clothing store' && '👕'}
                        {primaryGBPCategory.name === 'Hardware store' && '🔧'}
                        {primaryGBPCategory.name === 'Restaurant' && '🍽️'}
                        {primaryGBPCategory.name === 'Pharmacy' && '💊'}
                        {primaryGBPCategory.name === 'Bookstore' && '📚'}
                        {primaryGBPCategory.name === 'Pet store' && '🐕'}
                        {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(primaryGBPCategory.name) && '🏢'}
                      </span>
                      <span>{primaryGBPCategory.name}</span>
                    </Link>
                  )}

                  {/* Secondary GBP Categories */}
                  {secondaryGBPCategories && secondaryGBPCategories.length > 0 && secondaryGBPCategories.map((category: any, index: number) => (
                    <Link
                      key={category.id || index}
                      href={`/directory/stores/${category.id?.replace('gcid:', '').replace(/_/g, '-') || category.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      title={`Browse all ${category.name} stores`}
                    >
                      <span className="text-base">
                        {category.name === 'Grocery store' && '🏪'}
                        {category.name === 'Electronics store' && '🛍️'}
                        {category.name === 'Shoe store' && '👟'}
                        {category.name === 'Supermarket' && '🛒'}
                        {category.name === 'Clothing store' && '👕'}
                        {category.name === 'Hardware store' && '🔧'}
                        {category.name === 'Restaurant' && '🍽️'}
                        {category.name === 'Pharmacy' && '💊'}
                        {category.name === 'Bookstore' && '📚'}
                        {category.name === 'Pet store' && '🐕'}
                        {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(category.name) && '🏢'}
                      </span>
                      <span>{category.name}</span>
                    </Link>
                  ))}

                  {/* Fallback: Show store categories if no GBP categories */}
                  {!primaryGBPCategory && storeCategories && storeCategories.length > 0 &&
                    storeCategories
                      .sort((a: any, b: any) => {
                        if (a.is_primary && !b.is_primary) return -1;
                        if (!a.is_primary && b.is_primary) return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((category: any) => (
                        <Link
                          key={category.id}
                          href={getCategoryUrl(category, "/directory/stores")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category.is_primary
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          title={`Browse all ${category.name} stores`}
                        >
                          <span className="text-base">
                            {category.name === 'Grocery store' && '🏪'}
                            {category.name === 'Electronics store' && '🛍️'}
                            {category.name === 'Shoe store' && '👟'}
                            {category.name === 'Supermarket' && '🛒'}
                            {category.name === 'Clothing store' && '👕'}
                            {category.name === 'Hardware store' && '🔧'}
                            {category.name === 'Restaurant' && '🍽️'}
                            {category.name === 'Pharmacy' && '💊'}
                            {category.name === 'Bookstore' && '📚'}
                            {category.name === 'Pet store' && '🐕'}
                            {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(category.name) && '🏢'}
                          </span>
                          <span>{category.name}</span>
                        </Link>
                      ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Featured Navigation Controls - Top of Page */}
      {featuredData && (featuredCounts.staffPick > 0 || featuredCounts.newArrival > 0 || featuredCounts.sale > 0 || featuredCounts.seasonal > 0 || featuredCounts.storeSelection > 0) && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="py-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Quick Jump:</span>
              
              {/* Staff Picks */}
              {featuredCounts.staffPick > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('staff_pick-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Staff Picks"
                >
                  <span>⭐</span>
                  <span>Staff Picks ({featuredCounts.staffPick})</span>
                </button>
              )}

              {/* New Arrivals */}
              {featuredCounts.newArrival > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('new_arrival-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                  title="Jump to New Arrivals"
                >
                  <span>✨</span>
                  <span>New Arrivals ({featuredCounts.newArrival})</span>
                </button>
              )}

              {/* Sale Items */}
              {featuredCounts.sale > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('sale-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Sale Items"
                >
                  <span>💰</span>
                  <span>Sale ({featuredCounts.sale})</span>
                </button>
              )}

              {/* Seasonal Specials */}
              {featuredCounts.seasonal > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('seasonal-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Seasonal Specials"
                >
                  <span>🍂</span>
                  <span>Seasonal ({featuredCounts.seasonal})</span>
                </button>
              )}

              {/* Store Selection */}
              {featuredCounts.storeSelection > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('store_selection-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Store Selection"
                >
                  <span>🏪</span>
                  <span>Store Selection ({featuredCounts.storeSelection})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Featured Products Section - Conditional Width */}
      {featuredData && featuredData.totalCount > 0 && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="featured-products-section mb-12">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">
                Featured Products
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Discover our hand-picked selection of featured items
              </p>
            </div>

            <div className="space-y-8">
              {/* Staff Picks Bucket */}
              {featuredData.staffPick.length > 0 && (
                <div id="staff_pick-section">
                  <FeaturedBucket
                    title="⭐ Staff Picks"
                    description="Our team's favorite picks"
                    products={featuredData.staffPick}
                    totalCount={featuredData.bucketCounts.staff_pick}
                    bucketType="staff_pick"
                  />
                </div>
              )}

              {/* New Arrivals Bucket */}
              {featuredData.newArrival.length > 0 && (
                <div id="new_arrival-section">
                  <FeaturedBucket
                    title="✨ New Arrivals"
                    description="Fresh additions to our collection"
                    products={featuredData.newArrival}
                    totalCount={featuredData.bucketCounts.new_arrival}
                    bucketType="new_arrival"
                  />
                </div>
              )}

              {/* Sale Bucket */}
              {featuredData.sale.length > 0 && (
                <div id="sale-section">
                  <FeaturedBucket
                    title="💰 Sale"
                    description="Great deals on selected items"
                    products={featuredData.sale}
                    totalCount={featuredData.bucketCounts.sale}
                    bucketType="sale"
                  />
                </div>
              )}

              {/* Seasonal Bucket */}
              {featuredData.seasonal.length > 0 && (
                <div id="seasonal-section">
                  <FeaturedBucket
                    title="🍂 Seasonal"
                    description="Perfect for the current season"
                    products={featuredData.seasonal}
                    totalCount={featuredData.bucketCounts.seasonal}
                    bucketType="seasonal"
                  />
                </div>
              )}

              {/* Store Selection Bucket */}
              {featuredData.storeSelection.length > 0 && (
                <div id="store_selection-section">
                  <FeaturedBucket
                    title="🏪 Store Selection"
                    description="Curated by our store experts"
                    products={featuredData.storeSelection}
                    totalCount={featuredData.bucketCounts.store_selection}
                    bucketType="store_selection"
                  />
                </div>
              )}
            </div>

            {/* Visual Separator Banner */}
            <div className="relative my-16">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-50 via-primary-100 to-primary-50 dark:from-primary-950 dark:via-primary-900 dark:to-primary-950" />
              <div className="relative px-8 py-12 text-center">
                <div className="max-w-3xl mx-auto">
                  <h3 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-3">
                    Discover More Amazing Products
                  </h3>
                  <p className="text-primary-700 dark:text-primary-300 text-lg mb-6">
                    Explore our complete collection of {featuredData.totalCount > 0 ? `${featuredData.totalCount}+ ` : ''}products
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Catalog Area - Conditional Width */}
      <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        <div className="flex">
          {/* Collapsible Sidebar Catalog Layout */}
          <div className="w-80 shrink-0">
            <CollapsibleCatalogSidebar
              tenantId={tenantId}
              categories={productCategories}
              totalProducts={totalAllProducts}
              productsLength={products.length}
              totalPages={totalPages}
              currentPage={currentPage}
              search={search}
              currentCategory={currentCategory}
              featured={featured}
              view={view}
              featuredCounts={featuredCounts}
            />
          </div>

          {/* Main Content - Full Width */}
          <div className="flex-1">
            <div id="catalog-banner" className="transition-all duration-300">
              {/* Current Context Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {featured ? getFeaturedTypeName(featured) : (currentCategory ? currentCategory.name : 'All Products')} ({total})
                </h2>
                {(search || currentCategory || featured) && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {featured && !search && !currentCategory && `Showing ${getFeaturedTypeName(featured).toLowerCase()}`}
                    {currentCategory && !search && !featured && `Showing all ${currentCategory.name.toLowerCase()} products`}
                    {search && !currentCategory && !featured && `Results for "${search}"`}
                    {search && currentCategory && !featured && `Results for "${search}" in ${currentCategory.name}`}
                    {search && featured && !currentCategory && `Results for "${search}" in ${getFeaturedTypeName(featured)}`}
                  </p>
                )}
              </div>

              {/* Enhanced Product Display */}
              <div className="space-y-8">
                <EnhancedProductDisplay
                  products={products}
                  tenantId={tenantId}
                  tenantName={businessName}
                  tenantLogo={tenant.metadata?.logo_url}
                  useSingletonData={true}
                  showFeaturedBadges={true}
                />
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  {currentPage > 1 && (
                    <button
                      className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    >
                      ← Previous
                    </button>
                  )}

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`px-4 py-2 rounded-lg transition-colors ${pageNum === currentPage
                          ? 'bg-primary-600 text-white'
                          : 'border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {currentPage < totalPages && (
                    <button
                      className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    >
                      Next →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client-side storefront tracking */}
      <StorefrontViewTracker tenantId={tenantId} categoriesViewed={productCategories.map((c: any) => c.name)} />

      {/* Contact Information and Business Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-8 xl:gap-4 2xl:gap-2">
        {/* Contact Information */}
        <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 md:border-b-0">
          <div>
            <ContactInformationCollapsible tenant={tenant} />
          </div>
          
        </div>

        {/* Business Hours */}
        <BusinessHoursCollapsible businessHours={businessHours} />
      </div>

      {/* Map Section - How to Get There */}
      {tenant.metadata?.address && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Find Us</h2>
            <GoogleMapEmbed address={tenant.metadata.address} height="h-64 sm:h-80" />
          </div>
        </div>
      )}

      {/* Tier-Based Footer */}
      <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 mb-4">
                <div className="space-y-3 text-sm">
                  {/* Directory Entry Link */}
                  {directoryPublished && tenantSlug && (
                    <Link
                      href={`/directory/${tenantSlug}`}
                      className="flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      View Store in Directory
                    </Link>
                  )}

                </div>
              </div>

            </div>

            {/* Store Location Map */}
            <StorefrontMap
              tenant={{
                id: tenant.id,
                businessName: businessName,
                slug: tenantSlug,
                metadata: tenant.metadata
              }}
              primaryCategory={primaryStoreCategory?.name}
              productCount={total}
            />
          </div>

          {/* Platform Branding (unless Enterprise with removal) */}
          {!features.removePlatformBranding && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 text-sm text-neutral-500">
              <Link href="/" title={platformSettings?.platformName || 'Visible Shelf'} style={{ textDecoration: 'none' }} ><div className="flex items-center justify-center gap-2" >
                <span>⚡Powered by</span>
                <img 
                  src={platformSettings?.logoUrl} 
                  alt={platformSettings?.platformName || 'Platform Logo'} 
                  className="h-8 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                  width="32"
                  height="32"
                />
                <span>{platformSettings?.platformName || 'Visible Shelf'}</span>
              </div>
              </Link>
            </div>
          )}
        </div>
      </footer>
    </>
  );
}

// FeaturedBucket Component
interface FeaturedBucketProps {
  title: string;
  description: string;
  products: FeaturedProduct[];
  totalCount: number;
  bucketType: string;
}

function FeaturedBucket({ title, description, products, totalCount, bucketType }: FeaturedBucketProps) {
  if (products.length === 0) return null;

  // Get banner styling based on bucket type
  const getBannerStyles = (type: string) => {
    switch (type) {
      case 'staff_pick':
        return {
          bgGradient: 'from-amber-50 via-amber-100 to-amber-50 dark:from-amber-950 dark:via-amber-900 dark:to-amber-950',
          textColor: 'text-amber-900 dark:text-amber-100',
          subTextColor: 'text-amber-700 dark:text-amber-300',
          borderColor: 'border-amber-200 dark:border-amber-800'
        };
      case 'seasonal':
        return {
          bgGradient: 'from-emerald-50 via-emerald-100 to-emerald-50 dark:from-emerald-950 dark:via-emerald-900 dark:to-emerald-950',
          textColor: 'text-emerald-900 dark:text-emerald-100',
          subTextColor: 'text-emerald-700 dark:text-emerald-300',
          borderColor: 'border-emerald-200 dark:border-emerald-800'
        };
      case 'sale':
        return {
          bgGradient: 'from-red-50 via-red-100 to-red-50 dark:from-red-950 dark:via-red-900 dark:to-red-950',
          textColor: 'text-red-900 dark:text-red-100',
          subTextColor: 'text-red-700 dark:text-red-300',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      case 'new_arrival':
        return {
          bgGradient: 'from-blue-50 via-blue-100 to-blue-50 dark:from-blue-950 dark:via-blue-900 dark:to-blue-950',
          textColor: 'text-blue-900 dark:text-blue-100',
          subTextColor: 'text-blue-700 dark:text-blue-300',
          borderColor: 'border-blue-200 dark:border-blue-800'
        };
      case 'store_selection':
        return {
          bgGradient: 'from-purple-50 via-purple-100 to-purple-50 dark:from-purple-950 dark:via-purple-900 dark:to-purple-950',
          textColor: 'text-purple-900 dark:text-purple-100',
          subTextColor: 'text-purple-700 dark:text-purple-300',
          borderColor: 'border-purple-200 dark:border-purple-800'
        };
      default:
        return {
          bgGradient: 'from-gray-50 via-gray-100 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950',
          textColor: 'text-gray-900 dark:text-gray-100',
          subTextColor: 'text-gray-700 dark:text-gray-300',
          borderColor: 'border-gray-200 dark:border-gray-800'
        };
    }
  };

  const bannerStyles = getBannerStyles(bucketType);

  return (
    <div className="featured-bucket mb-12">
      {/* Bucket Banner */}
      <div className={`relative mb-8 rounded-lg border ${bannerStyles.borderColor} overflow-hidden`}>
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-r ${bannerStyles.bgGradient}`} />
        
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-gradient-to-br from-current/20 to-transparent" />
        </div>
        
        {/* Content */}
        <div className="relative px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-xl font-bold ${bannerStyles.textColor} flex items-center gap-2 mb-1`}>
                {title}
                <span className={`text-sm font-normal ${bannerStyles.subTextColor}`}>
                  ({totalCount})
                </span>
              </h3>
              <p className={`${bannerStyles.subTextColor}`}>
                {description}
              </p>
            </div>
            
            {/* View All Link */}
            {totalCount > products.length && (
              <a
                href={`/tenant/${products[0].tenantId}?featured=${bucketType}`}
                className={`text-sm ${bannerStyles.textColor} hover:underline font-medium`}
              >
                View All →
              </a>
            )}
          </div>
        </div>
        
        {/* Bottom Gradient Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent" />
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.slice(0, 8).map((product) => (
          <FeaturedProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Show More Link */}
      {totalCount > 8 && (
        <div className="mt-6 text-center">
          <a
            href={`/tenant/${products[0].tenantId}?featured=${bucketType}`}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium ${bannerStyles.textColor} border ${bannerStyles.borderColor} rounded-lg hover:bg-current/10 transition-colors`}
          >
            View All {totalCount} {title.toLowerCase()} →
          </a>
        </div>
      )}
    </div>
  );
}

// FeaturedProductCard Component
function FeaturedProductCard({ product }: { product: FeaturedProduct }) {
  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="aspect-square relative bg-neutral-100 dark:bg-neutral-700">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {/* Featured Badge */}
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-primary-600 text-white rounded-full">
            {product.featuredType ? getFeaturedTypeLabel(product.featuredType) : 'Featured'}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Product Name */}
        <h4 className="font-medium text-neutral-900 dark:text-white line-clamp-2 mb-2">
          {product.name}
        </h4>

        {/* Brand */}
        {product.brand && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
            {product.brand}
          </p>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-semibold text-neutral-900 dark:text-white">
            ${(product.priceCents / 100).toFixed(2)}
          </span>
          {product.salePriceCents && product.salePriceCents < product.priceCents && (
            <>
              <span className="text-sm text-neutral-500 dark:text-neutral-400 line-through">
                ${(product.priceCents / 100).toFixed(2)}
              </span>
              <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                ${(product.salePriceCents / 100).toFixed(2)}
              </span>
            </>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center gap-2 text-sm">
          {product.stock > 0 ? (
            <span className="text-green-600 dark:text-green-400">
              ✓ In Stock ({product.stock})
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400">
              ✗ Out of Stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to get featured type label
function getFeaturedTypeLabel(featuredType: string): string {
  switch (featuredType) {
    case 'staff_pick':
      return 'Staff Pick';
    case 'seasonal':
      return 'Seasonal';
    case 'sale':
      return 'Sale';
    case 'new_arrival':
      return 'New';
    case 'store_selection':
      return 'Featured';
    default:
      return 'Featured';
  }
}
