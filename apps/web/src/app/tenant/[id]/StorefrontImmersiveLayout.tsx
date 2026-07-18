'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/ui';

import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
// LocationClosedBanner is rendered by page.tsx before layout selection
import TenantMapSection from '@/components/tenant/TenantMapSection';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import FeaturedBucketsShowcase from '@/components/storefront/FeaturedBucketsShowcase';
import SmartProductCard from '@/components/products/SmartProductCard';
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
import LastViewed from '@/components/directory/LastViewed';
import StorefrontBadgeFilter from '@/components/storefront/StorefrontBadgeFilter';
import { StorefrontRecommendations } from './StorefrontClient';
import { ServiceSection } from '@/components/storefront/sections/ServiceSection';
import { DigitalSection } from '@/components/storefront/sections/DigitalSection';
import { HybridSection } from '@/components/storefront/sections/HybridSection';
import { SocialProofSection } from '@/components/storefront/sections/SocialProofSection';
import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';
import { useStorefrontState } from './layouts/hooks/useStorefrontState';
import { StorefrontLayoutProps } from './layouts/types';
import StorefrontFooter from './layouts/shared/StorefrontFooter';
import TrustSignalsBar from './layouts/shared/TrustSignalsBar';
import SectionDivider from './layouts/shared/SectionDivider';
import StickySearchBar from './layouts/shared/StickySearchBar';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';

export default function StorefrontImmersiveLayout({
  tenantId,
  tenant,
  platformSettings,
  mapLocation,
  hasBranding,
  storeStatus: initialStoreStatus,
  categories,
  productCategories,
  storeCategories,
  uncategorizedCount,
  paymentGateways,
  businessName,
  businessHours,
  search,
  category: activeCategorySlug,
  featured,
  view,
  isProductsOnly,
  directoryPublished,
  tenantSlug,
  primaryGBPCategory,
  secondaryGBPCategories,
  tier,
  features,
  totalAllProducts,
  fullWidthLayout = false,
  products = [],
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  locationStatus,
  statusInfo,
  initialStorefrontOptionFlags,
  initialCommerceSettings,
  initialPaymentGatewaySettings,
  initialStorefrontTypeSettings,
  initialFaqFlags,
  initialCrmFlags,
  initialProductOptionFlags,
  initialSocialCommerceFlags,
  layoutVariant,
}: StorefrontLayoutProps) {
  const {
    router,
    handleViewCart,
    cartTotalItems,
    hoursStatus,
    logoUrl,
    currentUrl,
    storefrontStatus,
    isStorefrontEnabled,
    isRetailStore,
    isOnlineStore,
    isServiceStore,
    isSocialStore,
    optFlags,
    showsHours,
    showsMap,
    showsLocation,
    showsAnimatedHours,
    showsHoursStatus,
    showsCategoryStore,
    showsCategoryProduct,
    showsRecommendStore,
    showsRecentlyViewed,
    showsInteractiveMaps,
    showsContact,
    showsSocialMedia,
    showsStorefrontActions,
    showsReviews,
    showsFulfillment,
    showsLocationAvailability,
    showsGallery,
    showsVideo,
    showsVariants,
    showsQRCodes,
    allowedFeaturedTypes,
    faqEnabled,
    faqFeedbackEnabled,
    crmInquiryStorefrontEnabled,
    showServices,
    showDigital,
    showHybrid,
    showSocialProof,
    socialCommerceFlags,
    contactInfo,
    featuredData,
    activeFeatured,
    getFeaturedTypeName,
    getCategoryUrl,
  } = useStorefrontState({
    tenantId,
    tenant,
    businessName,
    tenantSlug,
    tier,
    directoryPublished,
    locationStatus,
    statusInfo,
    initialStorefrontOptionFlags,
    initialStorefrontTypeSettings,
    initialFaqFlags,
    initialCrmFlags,
    initialProductOptionFlags,
    initialSocialCommerceFlags,
  });

  // DEBUG
  // console.log(`StorefrontimmersiveLayout: hoursStatus ${JSON.stringify(hoursStatus)}`);
  // console.log(`StorefrontimmersiveLayout: logoUrl ${JSON.stringify(logoUrl)}`);
  // console.log(`StorefrontimmersiveLayout: currentUrl ${JSON.stringify(currentUrl)}`);
  // console.log(`StorefrontimmersiveLayout: storefrontStatus ${JSON.stringify(storefrontStatus)}`);
  // console.log(`StorefrontimmersiveLayout: isRetailStore ${JSON.stringify(isRetailStore)}`);
  // console.log(`StorefrontimmersiveLayout: isServiceStore ${JSON.stringify(isServiceStore)}`);
  // console.log(`StorefrontimmersiveLayout: showsHours ${JSON.stringify(showsHours)}`);
  // console.log(`StorefrontimmersiveLayout: optFlags ${JSON.stringify(optFlags)}`);
  // console.log(`StorefrontimmersiveLayout: showsMap ${JSON.stringify(showsMap)}`);
  // console.log(`StorefrontimmersiveLayout: showsInteractiveMaps ${JSON.stringify(showsInteractiveMaps)}`);
  // console.log(`StorefrontimmersiveLayout: mapLocation ${JSON.stringify(mapLocation)}`);
  // console.log(`StorefrontimmersiveLayout: showsLocation ${JSON.stringify(showsLocation)}`);
  // console.log(`StorefrontimmersiveLayout: showsLocationAvailability ${JSON.stringify(showsLocationAvailability)}`);
  // console.log(`StorefrontimmersiveLayout: contactInfo.address ${JSON.stringify(contactInfo.address)}`);
  // console.log(`StorefrontimmersiveLayout: businessDescription ${JSON.stringify(businessDescription)}`);
  // console.log(`StorefrontimmersiveLayout: showsHoursStatus ${JSON.stringify(showsHoursStatus)}`);

  const searchParams = useSearchParams();

  const [isScrolled, setIsScrolled] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [infoExpanded, setInfoExpanded] = useState(showsLocation);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const categoryChips = useMemo(() => {
    const chips: { slug: string; name: string }[] = [{ slug: '', name: 'All' }];
    if (Array.isArray(productCategories)) {
      productCategories.forEach((c: any) => {
        if (c?.name) {
          chips.push({
            slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
            name: c.name,
          });
        }
      });
    }
    return chips;
  }, [productCategories]);

  // ---- Derived: filter products by product_type (switch-based for extensibility) ----
  const { physicalProducts, serviceProducts, digitalProducts, hybridProducts } = useMemo(() => {
    const buckets: Record<string, any[]> = { physical: [], service: [], digital: [], hybrid: [] };
    for (const p of products) {
      const pt = p.productType || p.product_type || 'physical';
      switch (pt) {
        case 'service':
          buckets.service.push(p);
          break;
        case 'digital':
          buckets.digital.push(p);
          break;
        case 'hybrid':
          buckets.hybrid.push(p);
          break;
        case 'physical':
        default:
          buckets.physical.push(p);
          break;
      }
    }
    return { physicalProducts: buckets.physical, serviceProducts: buckets.service, digitalProducts: buckets.digital, hybridProducts: buckets.hybrid };
  }, [products]);

  const sortedProducts = useMemo(() => {
    const list = [...physicalProducts];
    switch (sortBy) {
      case 'price-asc':
        return list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      case 'price-desc':
        return list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case 'name':
        return list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      default:
        return list;
    }
  }, [physicalProducts, sortBy]);

  const heroProducts = useMemo(() => {
    if (activeFeatured?.hasActive && activeFeatured.products.length > 0) {
      return activeFeatured.products.slice(0, 8);
    }
    return physicalProducts.slice(0, 8);
  }, [activeFeatured, physicalProducts]);

  const primaryColor =
    tenant?.metadata?.primary_color || tenant?.branding?.primaryColor || '#6366f1';

  const shippingText =
    tenant?.metadata?.free_shipping_threshold && tenant?.metadata?.free_shipping_threshold > 0
      ? `Free shipping over $${tenant.metadata.free_shipping_threshold}`
      : undefined;

  const socialLinks = useMemo(() => {
    const links: { platform: string; url: string; icon: string }[] = [];
    const meta = tenant?.metadata || {};
    if (meta.instagram) links.push({ platform: 'Instagram', url: meta.instagram, icon: 'instagram' });
    if (meta.facebook) links.push({ platform: 'Facebook', url: meta.facebook, icon: 'facebook' });
    if (meta.twitter || meta.x) links.push({ platform: 'X', url: meta.twitter || meta.x, icon: 'x' });
    if (meta.tiktok) links.push({ platform: 'TikTok', url: meta.tiktok, icon: 'tiktok' });
    if (meta.linkedin) links.push({ platform: 'LinkedIn', url: meta.linkedin, icon: 'linkedin' });
    if (meta.youtube) links.push({ platform: 'YouTube', url: meta.youtube, icon: 'youtube' });
    return links;
  }, [tenant]);

  const handleCategoryClick = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set('category', slug);
    } else {
      params.delete('category');
    }
    params.delete('page');
    router.push(`/tenant/${tenantId}?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) {
      params.set('page', String(page));
    } else {
      params.delete('page');
    }
    router.push(`/tenant/${tenantId}?${params.toString()}`);
  };

  // Closed banner is handled by page.tsx before layout selection

  const businessDescription =
    tenant?.metadata?.business_description ||
    tenant?.description ||
    tenant?.metadata?.description ||
    '';

  const hasActivePaymentGateway =
    tenant?.metadata?.hasActivePaymentGateway ||
    initialPaymentGatewaySettings?.hasActiveGateway ||
    false;

  const defaultGatewayType =
    tenant?.metadata?.defaultGatewayType ||
    initialPaymentGatewaySettings?.defaultGatewayType ||
    '';

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* HEADER */}
      <header
        className={`sticky top-0 z-50 transition-all duration-200 ${isScrolled
            ? 'bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-sm border-b border-neutral-200 dark:border-neutral-800'
            : 'bg-white dark:bg-neutral-950 border-b border-transparent'
          }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 gap-3">
            <Link href={`/tenant/${tenantId}`} className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
              {logoUrl ? (
                <div className="relative w-8 h-8 flex-shrink-0">
                  <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="32px" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                  <span className="text-white font-bold text-sm">{businessName?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
              )}
              <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate hidden sm:block">{businessName}</span>
            </Link>

            <div className="hidden md:block flex-1 max-w-md mx-4">
              <StickySearchBar tenantId={tenantId} placeholder="Search products..." />
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button onClick={handleViewCart} className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" aria-label="View cart">
                <svg className="w-5 h-5 text-neutral-700 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                {cartTotalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartTotalItems > 99 ? '99+' : cartTotalItems}
                  </span>
                )}
              </button>

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" aria-label="Toggle menu">
                <svg className="w-5 h-5 text-neutral-700 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-3 border-t border-neutral-100 dark:border-neutral-800 pt-3 space-y-3">
              <StickySearchBar tenantId={tenantId} placeholder="Search products..." />
              <TrustSignalsBar tenantId={tenantId} shippingText={shippingText} showHours={showsHoursStatus} showRating showShipping={!!shippingText} className="px-1" />
            </div>
          )}
        </div>

        <div className="hidden md:block border-t border-neutral-100 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1.5">
            <TrustSignalsBar tenantId={tenantId} shippingText={shippingText} showHours={showsHoursStatus} showRating showShipping={!!shippingText} />
          </div>
        </div>
      </header>

      {/* Situational Status Panel — shown when storefront is disabled by tier, location status, or subscription issue */}
      {storefrontStatus.shouldShowPanel && (
        <StorefrontStatusPanel tenantId={tenantId} tenantInfo={storefrontStatus.tenant as any} />
      )}

      {/* HERO STRIP */}
      {!isProductsOnly && heroProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <section className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wide">{activeFeatured?.hasActive ? 'Featured' : 'Trending Now'}</h2>
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
      {!storefrontStatus.shouldShowPanel && (
        <div className="sticky top-[56px] md:top-[88px] z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              {showsCategoryProduct && categoryChips.map((chip) => {
                const isActive = (!activeCategorySlug && !chip.slug) || activeCategorySlug === chip.slug;
                return (
                  <button
                    key={chip.slug || 'all'}
                    onClick={() => handleCategoryClick(chip.slug)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isActive
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
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
      )}

      {/* BADGE FILTER */}
      {!storefrontStatus.shouldShowPanel && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3">
          <StorefrontBadgeFilter tenantId={tenantId} />
        </div>
      )}

      {/* PRODUCT GRID */}
      {!storefrontStatus.shouldShowPanel && (
        <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6">
          {isProductsOnly && featured && (
            <div className="flex items-center gap-3 mb-4">
              <Link href={`/tenant/${tenantId}`} className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">← Back to store</Link>
              <span className="text-neutral-300 dark:text-neutral-600">|</span>
              <h1 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {featured === 'true' || featured === '1' ? 'All Featured Products' : getFeaturedTypeName(featured)}
              </h1>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {search ? `Results for "${search}"` : `${totalItems} product${totalItems !== 1 ? 's' : ''}`}
            </p>
            {totalPages > 1 && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">Page {currentPage} of {totalPages}</span>
            )}
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
                  <Pagination currentPage={currentPage} totalItems={totalItems || 0} pageSize={12} onPageChange={handlePageChange} onPageSizeChange={() => { }} />
                </div>
              )}
            </>
          )}
        </main>
      )}

      {!isProductsOnly && !storefrontStatus.shouldShowPanel && <SectionDivider variant="gradient" />}

      {/* SERVICE SECTION */}
      {showServices && serviceProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <ServiceSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          services={serviceProducts}
          layoutVariant="immersive"
          isServiceStore={isServiceStore}
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* DIGITAL SECTION */}
      {showDigital && digitalProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <DigitalSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          digitalProducts={digitalProducts}
          layoutVariant="immersive"
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* HYBRID SECTION */}
      {showHybrid && hybridProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <HybridSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          hybridProducts={hybridProducts}
          layoutVariant="immersive"
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* SOCIAL PROOF SECTION */}
      {showSocialProof && !storefrontStatus.shouldShowPanel && (
        <SocialProofSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          layoutVariant="immersive"
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
        />
      )}

      {/* TABBED FEATURED SECTIONS */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && featuredData && featuredData.buckets && featuredData.buckets.length > 0 && (
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
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && <SectionDivider variant="spacer" />}

      {/* QUICK STORE INFO ROW */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && (businessDescription || showsContact || showsHours) && (
        <section className="bg-white dark:bg-neutral-950 py-8">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <div
              onClick={() => setInfoExpanded(!infoExpanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setInfoExpanded(!infoExpanded);
                }
              }}
              role="button"
              tabIndex={0}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4 text-left">
                {logoUrl && (
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="40px" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">{businessName}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    {showsReviews && <StoreRatingDisplay tenantId={tenantId} variant="inline" />}
                    {showsHoursStatus && <HoursStatusBadge status={hoursStatus} size="sm" animate={showsAnimatedHours} />}
                    {contactInfo.address && <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[200px]">{contactInfo.address}</span>}
                  </div>
                </div>
              </div>
              <svg className={`w-5 h-5 text-neutral-400 transition-transform ${infoExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {infoExpanded && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                {businessDescription && (
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900">
                    <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">About</h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{businessDescription}</p>
                  </div>
                )}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 space-y-3">
                  {showsHours && businessHours && (
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Hours</h4>
                      <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                    </div>
                  )}
                  {showsContact && (contactInfo.phone || contactInfo.email) && (
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Contact</h4>
                      <div className="space-y-1 text-sm">
                        {contactInfo.phone && <a href={`tel:${contactInfo.phone}`} className="block text-primary-600 dark:text-primary-400 hover:underline">{contactInfo.phone}</a>}
                        {contactInfo.email && <a href={`mailto:${contactInfo.email}`} className="block text-primary-600 dark:text-primary-400 hover:underline">{contactInfo.email}</a>}
                      </div>
                    </div>
                  )}
                  {showsMap && showsInteractiveMaps && (showsLocation || contactInfo.address) && (
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Location</h4>
                      <div className="h-48">
                        {mapLocation ? (
                          <TenantMapSection location={mapLocation} />
                        ) : contactInfo.address ? (
                          <GoogleMapEmbed address={contactInfo.address} height="h-48" showDirections={true} />
                        ) : null}
                      </div>
                    </div>
                  )}
                  {showsSocialMedia && socialLinks.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Social</h4>
                      <div className="flex flex-wrap gap-2">
                        {socialLinks.map((link) => (
                          <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors">
                            {link.platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && <SectionDivider variant="spacer" />}

      {/* FAQ + INQUIRY SIDE BY SIDE */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && faqEnabled && (
        <section className="bg-white dark:bg-neutral-950 py-10">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <FaqStorefrontDisplay tenantId={tenantId} enabled={faqEnabled} feedbackEnabled={faqFeedbackEnabled} />
              </div>
              {crmInquiryStorefrontEnabled && (
                <div className="lg:border-l lg:border-neutral-200 lg:dark:border-neutral-800 lg:pl-8">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Contact Us</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Have a question? Send us a message and we will get back to you.</p>
                  <PublicInquiryForm tenantId={tenantId} tenantName={businessName} sourceLabel="Storefront" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* RECOMMENDATIONS */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && isRetailStore && showsRecommendStore && (
        <section className="bg-neutral-50 dark:bg-neutral-900 py-10" aria-label="Recommended stores">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">Recommended for You</h2>
            <StorefrontRecommendations tenantId={tenantId} />
          </div>
        </section>
      )}

      {/* RECENTLY VIEWED */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && showsRecentlyViewed && (
        <section className="bg-white dark:bg-neutral-950 py-10" aria-label="Recently viewed">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">Recently Viewed</h2>
            <LastViewed />
          </div>
        </section>
      )}

      {/* COMPACT FOOTER */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && <StorefrontFooter
        tenantId={tenantId}
        businessName={businessName}
        businessDescription={businessDescription}
        logoUrl={logoUrl}
        platformSettings={platformSettings}
        features={features}
        directoryPublished={directoryPublished}
        tenantSlug={tenantSlug}
        isRetailStore={isRetailStore}
        contactInfo={contactInfo}
        socialLinks={socialLinks}
        showsSocialMedia={showsSocialMedia}
        optFlags={optFlags}
        currentUrl={currentUrl}
        variant="compact"
        primaryColor={primaryColor}
      />}
    </div>
  );
}
