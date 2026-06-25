'use client';

import React, { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Pagination } from '@/components/ui';
import { useRouter, useSearchParams } from 'next/navigation';

import ProductSearch from '@/components/storefront/ProductSearch';
import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import FeaturedBucketsShowcase from '@/components/storefront/FeaturedBucketsShowcase';
import SmartProductCard from '@/components/products/SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { SocialShareButtons } from '@/components/storefront/SocialShareButtons';

interface ProductSectionProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  tenantSlug: string;
  products: any[];
  categories: any[];
  productCategories: any[];
  search?: string;
  category?: string;
  featured?: string;
  view?: string;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  isProductsOnly?: boolean;
  isFullWidth?: boolean;
  storefrontStatus: { shouldShowPanel: boolean };
  showsCategoryProduct: boolean;
  showsQRCodes: boolean;
  showsGallery: boolean;
  showsVariants: boolean;
  allowedFeaturedTypes: string[];
  featuredData: any;
  featuredCounts: Record<string, number>;
  hasActivePaymentGateway: boolean;
  defaultGatewayType: string;
  layoutVariant: StorefrontLayoutKey;
  currentUrl: string;
  storefrontOptionFlags: StorefrontOptionFlags | null;
  getFeaturedTypeName: (type: string) => string;
  getCategoryUrl: (category: any, basePath: string) => string;
  isSocialStore?: boolean;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
}

export function ProductSection(props: ProductSectionProps) {
  if (props.layoutVariant === 'immersive') {
    return <ImmersiveProductSection {...props} />;
  }

  if (props.layoutVariant === 'editorial') {
    return <EditorialProductSection {...props} />;
  }

  return <ClassicProductSection {...props} />;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function handlePageChangeClassic(page: number, search?: string, category?: string, featured?: string, view?: string) {
  const params = new URLSearchParams(window.location.search);
  params.set('page', page.toString());
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (featured) params.set('featured', featured);
  if (view) params.set('view', view);
  window.location.href = `${window.location.pathname}?${params.toString()}`;
}

function handlePageSizeChangeClassic(size: number) {
  const params = new URLSearchParams(window.location.search);
  params.set('page', '1');
  params.set('limit', size.toString());
  window.location.href = `${window.location.pathname}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Classic variant
// ---------------------------------------------------------------------------

function ClassicProductSection({
  tenantId,
  tenant,
  businessName,
  products,
  categories,
  search,
  category,
  featured,
  view,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  isProductsOnly,
  isFullWidth,
  storefrontStatus,
  showsCategoryProduct,
  showsQRCodes,
  showsGallery,
  showsVariants,
  allowedFeaturedTypes,
  featuredData,
  hasActivePaymentGateway,
  defaultGatewayType,
  currentUrl,
  storefrontOptionFlags,
  isSocialStore,
  socialCommerceFlags,
}: ProductSectionProps) {
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) && isSocialStore;
  return (
    <>
      {/* Featured Navigation Controls - Quick Jump */}
      {!storefrontStatus.shouldShowPanel && featuredData && Object.keys(featuredData.bucketCounts || {}).length > 0 && Object.values(featuredData.bucketCounts || {}).some((count: any) => count > 0) && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="py-4 border-b border-neutral-200 dark:border-neutral-700 sticky top-[60px] z-30 bg-white dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Quick Jump:</span>
              {Object.entries(featuredData.bucketCounts || {}).map(([type, count]: [string, any]) => {
                if (count === 0) return null;
                const style = getFeaturedButtonStyle(type);
                return (
                  <button
                    key={type}
                    onClick={() => { const el = document.getElementById(`${type}-section`); el?.scrollIntoView({ behavior: 'smooth' }); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${style.bgClass} ${style.textClass} ${style.borderClass} ${style.hoverClass} transition-colors whitespace-nowrap`}
                    title={`Jump to ${style.label}`}
                  >
                    <span>{style.icon}</span>
                    <span>{style.label} ({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Product Catalog */}
      {!storefrontStatus.shouldShowPanel && !isProductsOnly && products.length > 0 && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="py-8">
            <div className="mb-8">
              <div className="mb-6">
                <ProductSearch tenantId={tenantId} />
              </div>
            </div>

            {!storefrontStatus.shouldShowPanel && (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Desktop Category Sidebar */}
                <div className="hidden lg:block lg:w-64 flex-shrink-0">
                  {showsCategoryProduct && <ProductCategorySidebar tenantId={tenantId} categories={categories} totalProducts={totalItems || 0} />}
                  {showsQRCodes && <TenantQRCode url={currentUrl} tenantId={tenantId} label="Scan to Share" downloadName={businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')} size={200} showDownload={true} className="mt-4" pageType="storefront" capabilityFlags={storefrontOptionFlags} />}
                </div>

                {/* Mobile Category Dropdown */}
                <div className="lg:hidden">
                  {showsCategoryProduct && <CategoryMobileDropdown tenantId={tenantId} categories={categories} totalProducts={totalItems || 0} />}
                  {showsQRCodes && <TenantQRCode url={currentUrl} tenantId={tenantId} label="Scan to Share" downloadName={businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')} size={200} showDownload={true} className="mt-4" pageType="storefront" capabilityFlags={storefrontOptionFlags} />}
                </div>

                {/* Main Content Area */}
                <div className="flex-1">
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Store Inventory</h2>
                    <p className="text-lg text-neutral-600 dark:text-neutral-400">
                      Browse our complete catalog of {totalItems} products
                      {search && ` matching "${search}"`}
                      {category && ` in ${categories.find((c: any) => c.slug === category)?.name || category}`} aisle
                    </p>
                    {showShareButtons && (
                      <div className="mt-3">
                        <SocialShareButtons url={currentUrl} title={businessName} layoutVariant="classic" />
                      </div>
                    )}
                  </div>

                  <TenantPaymentProvider tenantId={tenantId}>
                    <EnhancedProductDisplay
                      products={products}
                      tenantId={tenantId}
                      tenantSlug={tenant.slug}
                      tenantLogo={tenant.metadata?.logo_url}
                      hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
                      defaultGatewayType={tenant.metadata?.defaultGatewayType}
                      useSingletonData={true}
                      showFeaturedBadges={true}
                      initialPageSize={12}
                      showPageSizeControl={true}
                    />
                  </TenantPaymentProvider>

                  {totalPages > 1 && (
                    <div className="mt-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
                      Page {currentPage} of {totalPages} • {totalItems} total products
                    </div>
                  )}

                  {totalPages > 1 && !storefrontStatus.shouldShowPanel && (
                    <div className="mt-6 flex justify-center">
                      <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems || 0}
                        pageSize={12}
                        onPageChange={(page) => handlePageChangeClassic(page, search, category, featured, view)}
                        onPageSizeChange={(size) => handlePageSizeChangeClassic(size)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Featured Products Showcase */}
      {!storefrontStatus.shouldShowPanel && featuredData && featuredData.totalCount > 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
          <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Featured Selections</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Discover our hand-picked selection of featured items</p>
            </div>
            {featuredData && <FeaturedBucketsShowcase
              featuredData={featuredData}
              tenantId={tenantId}
              hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
              defaultGatewayType={tenant.metadata?.defaultGatewayType}
              allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
            />}
          </div>
        </div>
      )}

      {/* Products-Only View */}
      {!storefrontStatus.shouldShowPanel && isProductsOnly && products.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {featured && (
            <div className="flex items-center gap-3 mb-6">
              <Link href={`/tenant/${tenantId}`} className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">← Back to store</Link>
              <span className="text-neutral-300 dark:text-neutral-600">|</span>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                {featured === 'true' || featured === '1' ? 'All Featured Products' : 'Featured'}
              </h1>
            </div>
          )}
          <TenantPaymentProvider tenantId={tenantId}>
            <EnhancedProductDisplay
              products={products}
              tenantId={tenantId}
              tenantSlug={tenant.slug}
              tenantLogo={tenant.metadata?.logo_url}
              hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
              defaultGatewayType={tenant.metadata?.defaultGatewayType}
              useSingletonData={true}
              showFeaturedBadges={true}
              initialPageSize={12}
              showPageSizeControl={true}
            />
          </TenantPaymentProvider>
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems || 0}
                pageSize={12}
                onPageChange={(page) => handlePageChangeClassic(page, search, category, featured, view)}
                onPageSizeChange={() => {}}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Editorial variant
// ---------------------------------------------------------------------------

function EditorialProductSection({
  tenantId,
  tenant,
  businessName,
  products,
  categories,
  search,
  category,
  featured,
  view,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  isProductsOnly,
  storefrontStatus,
  showsCategoryProduct,
  showsGallery,
  showsVariants,
  allowedFeaturedTypes,
  featuredData,
  hasActivePaymentGateway,
  defaultGatewayType,
  getFeaturedTypeName,
  getCategoryUrl,
  currentUrl,
  isSocialStore,
  socialCommerceFlags,
}: ProductSectionProps) {
  const collectionRef = useRef<HTMLDivElement>(null);
  const scrollToCollection = () => collectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) && isSocialStore;

  const spotlightProducts = useMemo(() => {
    if (!featuredData?.buckets?.[0]?.products) return [];
    return featuredData.buckets[0].products.slice(0, 3);
  }, [featuredData]);

  return (
    <>
      {/* FEATURED SPOTLIGHT */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && featuredData && featuredData.totalCount > 0 && spotlightProducts.length > 0 && (
        <section className="bg-white dark:bg-neutral-900" aria-label="Featured spotlight">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              {featuredData.buckets?.[0] ? getFeaturedTypeName(featuredData.buckets[0].bucketType) : 'Featured'}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">Hand-picked selections from our collection</p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
              {spotlightProducts[0] && (
                <div className="md:col-span-3 md:row-span-2">
                  <div className="relative h-full min-h-[320px] md:min-h-[460px] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 group">
                    {spotlightProducts[0].imageUrl || spotlightProducts[0].image_url ? (
                      <Image src={spotlightProducts[0].imageUrl || spotlightProducts[0].image_url} alt={spotlightProducts[0].name || 'Featured product'} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 60vw" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-16 h-16 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">{spotlightProducts[0].name}</h3>
                      {(spotlightProducts[0].price != null) && <p className="text-white/80 text-lg font-medium">${Number(spotlightProducts[0].price).toFixed(2)}</p>}
                      {spotlightProducts[0].slug && (
                        <Link href={`/products/${spotlightProducts[0].slug || spotlightProducts[0].id}`} className="inline-flex items-center gap-1 mt-3 text-sm text-white/90 hover:text-white underline underline-offset-2">
                          View details
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-2 flex flex-col gap-4 md:gap-6">
                {spotlightProducts.slice(1, 3).map((product: any, idx: number) => (
                  <div key={product.id || idx} className="relative h-48 md:h-auto md:flex-1 md:min-h-[220px] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 group">
                    {product.imageUrl || product.image_url ? (
                      <Image src={product.imageUrl || product.image_url} alt={product.name || 'Featured product'} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 40vw" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-12 h-12 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-base font-bold text-white mb-0.5 truncate">{product.name}</h3>
                      {(product.price != null) && <p className="text-white/80 text-sm font-medium">${Number(product.price).toFixed(2)}</p>}
                      {product.slug && (
                        <Link href={`/products/${product.slug || product.id}`} className="inline-flex items-center gap-1 mt-1 text-xs text-white/80 hover:text-white underline underline-offset-2">View details</Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* "Our Collection" */}
      {!storefrontStatus.shouldShowPanel && !isProductsOnly && products.length > 0 && (
        <section ref={collectionRef} className="bg-neutral-50 dark:bg-neutral-950" aria-label="Product collection">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Our Collection</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8">
              Browse our complete catalog of {totalItems} products
              {search && ` matching "${search}"`}
              {category && ` in ${categories.find((c: any) => c.slug === category)?.name || category}`}
            </p>

            {showShareButtons && (
              <div className="mb-6">
                <SocialShareButtons url={currentUrl} title={businessName} layoutVariant="editorial" />
              </div>
            )}

            <div className="mb-6">
              <ProductSearch tenantId={tenantId} />
            </div>

            {showsCategoryProduct && categories.length > 0 && (
              <div className="mb-8">
                <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <a href={`/tenant/${tenantId}`} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!category ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'}`}>All</a>
                  {categories.map((cat: any) => (
                    <a key={cat.id || cat.slug} href={getCategoryUrl(cat, `/tenant/${tenantId}`)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${category === cat.slug ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'}`}>
                      {cat.name}
                      {cat.productCount != null && <span className="ml-1.5 text-neutral-400 dark:text-neutral-500">({cat.productCount})</span>}
                    </a>
                  ))}
                </div>
                <div className="sm:hidden">
                  <CategoryMobileDropdown tenantId={tenantId} categories={categories} totalProducts={totalItems || 0} />
                </div>
              </div>
            )}

            <TenantPaymentProvider tenantId={tenantId}>
              <EnhancedProductDisplay
                products={products}
                tenantId={tenantId}
                tenantSlug={tenant.slug}
                tenantLogo={tenant.metadata?.logo_url}
                hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
                defaultGatewayType={tenant.metadata?.defaultGatewayType}
                useSingletonData={true}
                showFeaturedBadges={true}
                initialPageSize={12}
                showPageSizeControl={true}
                showGallery={showsGallery}
                showVariants={showsVariants}
                allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
              />
            </TenantPaymentProvider>

            {totalPages > 1 && (
              <>
                <div className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">Page {currentPage} of {totalPages} &middot; {totalItems} total products</div>
                <div className="mt-4 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems || 0}
                    pageSize={12}
                    onPageChange={(page: number) => handlePageChangeClassic(page, search, category, featured, view)}
                    onPageSizeChange={(size: number) => handlePageSizeChangeClassic(size)}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Products-Only View */}
      {!storefrontStatus.shouldShowPanel && isProductsOnly && products.length > 0 && (
        <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Products">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {featured && (
              <div className="flex items-center gap-3 mb-6">
                <Link href={`/tenant/${tenantId}`} className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">← Back to store</Link>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{featured === 'true' || featured === '1' ? 'All Featured Products' : getFeaturedTypeName(featured)}</h1>
              </div>
            )}
            <TenantPaymentProvider tenantId={tenantId}>
              <EnhancedProductDisplay
                products={products}
                tenantId={tenantId}
                tenantSlug={tenant.slug}
                tenantLogo={tenant.metadata?.logo_url}
                hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
                defaultGatewayType={tenant.metadata?.defaultGatewayType}
                useSingletonData={true}
                showFeaturedBadges={true}
                initialPageSize={12}
                showPageSizeControl={true}
                showGallery={showsGallery}
                showVariants={showsVariants}
                allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
              />
            </TenantPaymentProvider>
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalItems || 0}
                  pageSize={12}
                  onPageChange={(page: number) => handlePageChangeClassic(page, search, category, featured, view)}
                  onPageSizeChange={() => {}}
                />
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Immersive variant
// ---------------------------------------------------------------------------

function ImmersiveProductSection({
  tenantId,
  tenant,
  businessName,
  tenantSlug,
  products,
  categories,
  productCategories,
  search,
  category: activeCategorySlug,
  featured,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  isProductsOnly,
  storefrontStatus,
  showsCategoryProduct,
  showsGallery,
  showsVariants,
  allowedFeaturedTypes,
  featuredData,
  hasActivePaymentGateway,
  defaultGatewayType,
  getFeaturedTypeName,
  currentUrl,
  isSocialStore,
  socialCommerceFlags,
}: ProductSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) && isSocialStore;

  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categoryChips = useMemo(() => {
    const chips: { slug: string; name: string }[] = [{ slug: '', name: 'All' }];
    if (Array.isArray(productCategories)) {
      productCategories.forEach((c: any) => {
        if (c?.name) {
          chips.push({ slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'), name: c.name });
        }
      });
    }
    return chips;
  }, [productCategories]);

  const sortedProducts = useMemo(() => {
    const list = [...products];
    switch (sortBy) {
      case 'price-asc': return list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      case 'price-desc': return list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case 'name': return list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      default: return list;
    }
  }, [products, sortBy]);

  const heroProducts = useMemo(() => products.slice(0, 8), [products]);

  const handleCategoryClick = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) { params.set('category', slug); } else { params.delete('category'); }
    params.delete('page');
    router.push(`/tenant/${tenantId}?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) { params.set('page', String(page)); } else { params.delete('page'); }
    router.push(`/tenant/${tenantId}?${params.toString()}`);
  };

  return (
    <>
      {/* HERO STRIP */}
      {!isProductsOnly && heroProducts.length > 0 && (
        <section className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wide">Trending Now</h2>
              <Link href={`/tenant/${tenantId}?featured=true&products_only=true`} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">View all</Link>
            </div>
            <EnhancedProductDisplay
              products={heroProducts as any}
              tenantId={tenantId}
              tenantSlug={tenantSlug}
              displayMode="carousel"
              carouselItemsVisible={4}
              variant="grid"
              showGallery={showsGallery}
              showVariants={showsVariants}
              allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
            />
          </div>
        </section>
      )}

      {/* FILTER BAR */}
      <div className="sticky top-[56px] md:top-[88px] z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {showsCategoryProduct && categoryChips.map((chip) => {
              const isActive = (!activeCategorySlug && !chip.slug) || activeCategorySlug === chip.slug;
              return (
                <button
                  key={chip.slug || 'all'}
                  onClick={() => handleCategoryClick(chip.slug)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                >
                  {chip.name}
                </button>
              );
            })}
            <div className="flex-1 min-w-[1px]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="flex-shrink-0 text-xs bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name A-Z</option>
            </select>
            <div className="hidden sm:flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden flex-shrink-0">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-400'}`} aria-label="Grid view">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25A2.25 2.25 0 0110.5 15.75v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25v2.25A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                </svg>
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-400'}`} aria-label="List view">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5M3.75 12h16.5m-16.5 6.75h16.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCT GRID */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6">
        {isProductsOnly && featured && (
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/tenant/${tenantId}`} className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">← Back to store</Link>
            <span className="text-neutral-300 dark:text-neutral-600">|</span>
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-white">{featured === 'true' || featured === '1' ? 'All Featured Products' : getFeaturedTypeName(featured)}</h1>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {search ? `Results for "${search}"` : `${totalItems} product${totalItems !== 1 ? 's' : ''}`}
            </p>
            {showShareButtons && (
              <SocialShareButtons url={currentUrl} title={businessName} layoutVariant="immersive" />
            )}
          </div>
          {totalPages > 1 && <span className="text-xs text-neutral-400 dark:text-neutral-500">Page {currentPage} of {totalPages}</span>}
        </div>

        {sortedProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 dark:text-neutral-400 text-lg mb-2">No products found</p>
            {search && (
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('search');
                  router.push(`/tenant/${tenantId}?${params.toString()}`);
                }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {sortedProducts.map((product: any) => (
                  <SmartProductCard
                    key={product.id}
                    product={product}
                    tenantId={tenantId}
                    tenantName={businessName}
                    tenantSlug={tenantSlug}
                    variant="grid"
                    showQuickAdd
                    showQuickView
                    imageAspectRatio="1:1"
                    truncateTitle={40}
                    hasActivePaymentGateway={hasActivePaymentGateway}
                    defaultGatewayType={defaultGatewayType}
                    allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
                    className="border border-neutral-100 dark:border-neutral-800 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedProducts.map((product: any) => (
                  <SmartProductCard
                    key={product.id}
                    product={product}
                    tenantId={tenantId}
                    tenantName={businessName}
                    tenantSlug={tenantSlug}
                    variant="list"
                    showQuickAdd
                    showQuickView
                    hasActivePaymentGateway={hasActivePaymentGateway}
                    defaultGatewayType={defaultGatewayType}
                    allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
                    className="border border-neutral-100 dark:border-neutral-800 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <Pagination currentPage={currentPage} totalItems={totalItems || 0} pageSize={12} onPageChange={handlePageChange} onPageSizeChange={() => {}} />
              </div>
            )}
          </>
        )}
      </main>

      {/* TABBED FEATURED SECTIONS */}
      {!isProductsOnly && featuredData && featuredData.buckets && featuredData.buckets.length > 0 && (
        <section className="bg-neutral-50 dark:bg-neutral-900 py-10">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <FeaturedBucketsShowcase
              featuredData={featuredData}
              tenantId={tenantId}
              hasActivePaymentGateway={hasActivePaymentGateway}
              defaultGatewayType={defaultGatewayType}
              displayMode="tabbed"
              allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
            />
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Featured button style helper (shared by classic quick-jump)
// ---------------------------------------------------------------------------

function getFeaturedButtonStyle(type: string) {
  const styles: Record<string, any> = {
    bestseller: { bgClass: 'bg-yellow-100 dark:bg-yellow-900/30', textClass: 'text-yellow-700 dark:text-yellow-300', borderClass: 'border-yellow-300 dark:border-yellow-600', hoverClass: 'hover:bg-yellow-200 dark:hover:bg-yellow-900/50', icon: '🏆', label: 'Bestsellers' },
    clearance: { bgClass: 'bg-pink-100 dark:bg-pink-900/30', textClass: 'text-pink-700 dark:text-pink-300', borderClass: 'border-pink-300 dark:border-pink-600', hoverClass: 'hover:bg-pink-200 dark:hover:bg-pink-900/50', icon: '🏷️', label: 'Clearance' },
    featured: { bgClass: 'bg-indigo-100 dark:bg-indigo-900/30', textClass: 'text-indigo-700 dark:text-indigo-300', borderClass: 'border-indigo-300 dark:border-indigo-600', hoverClass: 'hover:bg-indigo-200 dark:hover:bg-indigo-900/50', icon: '⭐', label: 'Featured' },
    new_arrival: { bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300', borderClass: 'border-green-300 dark:border-green-600', hoverClass: 'hover:bg-green-200 dark:hover:bg-green-900/50', icon: '✨', label: 'New Arrivals' },
    recommended: { bgClass: 'bg-cyan-100 dark:bg-cyan-900/30', textClass: 'text-cyan-700 dark:text-cyan-300', borderClass: 'border-cyan-300 dark:border-cyan-600', hoverClass: 'hover:bg-cyan-200 dark:hover:bg-cyan-900/50', icon: '👍', label: 'Recommended' },
    sale: { bgClass: 'bg-red-100 dark:bg-red-900/30', textClass: 'text-red-700 dark:text-red-300', borderClass: 'border-red-300 dark:border-red-600', hoverClass: 'hover:bg-red-200 dark:hover:bg-red-900/50', icon: '💰', label: 'Sale Items' },
    seasonal: { bgClass: 'bg-orange-100 dark:bg-orange-900/30', textClass: 'text-orange-700 dark:text-orange-300', borderClass: 'border-orange-300 dark:border-orange-600', hoverClass: 'hover:bg-orange-200 dark:hover:bg-orange-900/50', icon: '🎃', label: 'Seasonal' },
    staff_pick: { bgClass: 'bg-amber-100 dark:bg-amber-900/30', textClass: 'text-amber-700 dark:text-amber-300', borderClass: 'border-amber-300 dark:border-amber-600', hoverClass: 'hover:bg-amber-200 dark:hover:bg-amber-900/50', icon: '⭐', label: 'Staff Picks' },
    store_selection: { bgClass: 'bg-purple-100 dark:bg-purple-900/30', textClass: 'text-purple-700 dark:text-purple-300', borderClass: 'border-purple-300 dark:border-purple-600', hoverClass: 'hover:bg-purple-200 dark:hover:bg-purple-900/50', icon: '🏪', label: 'Store Selection' },
    trending: { bgClass: 'bg-rose-100 dark:bg-rose-900/30', textClass: 'text-rose-700 dark:text-rose-300', borderClass: 'border-rose-300 dark:border-rose-600', hoverClass: 'hover:bg-rose-200 dark:hover:bg-rose-900/50', icon: '🔥', label: 'Trending' },
  };
  return styles[type] || { bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-700 dark:text-blue-300', borderClass: 'border-blue-300 dark:border-blue-600', hoverClass: 'hover:bg-blue-200 dark:hover:bg-blue-900/50', icon: '⭐', label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') };
}
