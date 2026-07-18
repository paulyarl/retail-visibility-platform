'use client';

import React, { useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Pagination } from '@/components/ui';

// Store status & hours
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';

// Directory & actions
import DirectoryActions from '@/components/directory/DirectoryActions';

// Maps
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StorefrontMap from '@/components/storefront/StorefrontMap';
import TenantMapSection from '@/components/tenant/TenantMapSection';

// Products & catalog
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import FeaturedBucketsShowcase from '@/components/storefront/FeaturedBucketsShowcase';
import ProductSearch from '@/components/storefront/ProductSearch';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';

// Reviews
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';

// Status panel
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';

// Shared
import GBPCategoryBadges from '@/components/shared/GBPCategoryBadges';

// Engagement & shopping
import LastViewed from '@/components/directory/LastViewed';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
import { StorefrontRecommendations } from './StorefrontClient';

// Service section
import { ServiceSection } from '@/components/storefront/sections/ServiceSection';
import { DigitalSection } from '@/components/storefront/sections/DigitalSection';
import { HybridSection } from '@/components/storefront/sections/HybridSection';
import { SocialProofSection } from '@/components/storefront/sections/SocialProofSection';

// FAQ & CRM
import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';

// Payment context
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';

// Shared layout hook & types
import { useStorefrontState } from './layouts/hooks/useStorefrontState';
import { StorefrontLayoutProps } from './layouts/types';
import StorefrontFooter from './layouts/shared/StorefrontFooter';
import { Button } from '@mantine/core';

// ---------------------------------------------------------------------------
// Layout B – Modern Editorial
// ---------------------------------------------------------------------------

export default function StorefrontEditorialLayout({
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
  category,
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
  // ---- Shared state via hook ----
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
    featuredCounts,
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
  console.log(`StorefrontEditorialLayout: hoursStatus ${JSON.stringify(hoursStatus)}`);
  console.log(`StorefrontEditorialLayout: logoUrl ${JSON.stringify(logoUrl)}`);
  console.log(`StorefrontEditorialLayout: currentUrl ${JSON.stringify(currentUrl)}`);
  console.log(`StorefrontEditorialLayout: storefrontStatus ${JSON.stringify(storefrontStatus)}`);
  console.log(`StorefrontEditorialLayout: isRetailStore ${JSON.stringify(isRetailStore)}`);
  console.log(`StorefrontEditorialLayout: isServiceStore ${JSON.stringify(isServiceStore)}`);
  console.log(`StorefrontEditorialLayout: showsHours ${JSON.stringify(showsHours)}`);
  console.log(`StorefrontEditorialLayout: optFlags ${JSON.stringify(optFlags)}`);
  console.log(`StorefrontEditorialLayout: showsMap ${JSON.stringify(showsMap)}`);
  console.log(`StorefrontEditorialLayout: showsInteractiveMaps ${JSON.stringify(showsInteractiveMaps)}`);
  console.log(`StorefrontEditorialLayout: showsLocation ${JSON.stringify(showsLocation)}`);
  console.log(`StorefrontEditorialLayout: showsHoursStatus ${JSON.stringify(showsHoursStatus)}`);

  // ---- Ref for hero CTA scroll ----
  const collectionRef = useRef<HTMLDivElement>(null);

  const scrollToCollection = () => {
    collectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- Derived: banner image or gradient ----
  const bannerUrl = tenant?.metadata?.banner_url || null;
  const primaryColor = tenant?.metadata?.primary_color || tenant?.branding?.primaryColor || '#6366f1';

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

  // ---- Derived: first 3 featured products for spotlight (prefer active featured) ----
  const spotlightProducts = useMemo(() => {
    if (activeFeatured?.hasActive && activeFeatured.products.length > 0) {
      return activeFeatured.products.slice(0, 3);
    }
    if (!featuredData?.buckets?.[0]?.products) return [];
    return featuredData.buckets[0].products.slice(0, 3);
  }, [activeFeatured, featuredData]);

  // ---- Derived: social links ----
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

  // ---- Derived: business description ----
  const businessDescription =
    tenant?.metadata?.business_description ||
    tenant?.metadata?.description ||
    tenant?.description ||
    '';

  // ---- Social icon SVG paths (inline for zero-dependency) ----
  const socialIconMap: Record<string, React.ReactNode> = {
    instagram: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    facebook: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    x: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    tiktok: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.1 1.03-1.35 1.74-.25.69-.23 1.44-.07 2.15.34 1.44 1.75 2.59 3.27 2.63 1.12.04 2.2-.54 2.84-1.43.22-.29.39-.62.49-.97.14-.58.1-1.19.11-1.78.01-3.54 0-7.08.01-10.62-.01-1.59.06-3.2-.26-4.77z" />
      </svg>
    ),
    linkedin: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    youtube: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  };

  // ---- Early exit: status panel ----
  if (storefrontStatus.shouldShowPanel && storefrontStatus.tenant) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900">
        {/* Minimal header even on status panel */}
        <header className="border-b border-neutral-200 dark:border-neutral-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative w-10 h-10">
                  <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="40px" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-300 font-bold text-lg">
                    {businessName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <span className="font-semibold text-neutral-900 dark:text-white">{businessName}</span>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <StorefrontStatusPanel tenantInfo={storefrontStatus.tenant as any} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      {/* ================================================================= */}
      {/* MINIMAL HEADER BAR                                                */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            {/* Logo (left) */}
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <div className="relative w-9 h-9 flex-shrink-0">
                  <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="36px" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 dark:text-primary-300 font-bold text-sm">
                    {businessName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <span className="font-semibold text-neutral-900 dark:text-white truncate text-sm sm:text-base">
                {businessName}
              </span>
            </div>

            {/* Search icon + Cart icon (right) */}
            <div className="flex items-center gap-3">
              {/* Search icon — scrolls to collection */}
              <Button
                onClick={scrollToCollection}
                size='lg' 
                variant='gradient'
                className="p-2 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Search products"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Button>

              {/* Cart icon */}
              {cartTotalItems > 0 && (
                <Button
                  onClick={handleViewCart}
                  size='lg'
                  variant='gradient'
                  className="relative p-2 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label={`View cart with ${cartTotalItems} items`}
                >
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4z" />
                  </svg>
                  <span className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartTotalItems > 99 ? '99+' : cartTotalItems}
                  </span>
                </Button>
              )}

              {/* Directory actions */}
              {showsStorefrontActions && tenantSlug && (
                <DirectoryActions
                  listing={{
                    business_name: tenant.name,
                    slug: tenant.slug,
                    tenantId: tenant.id,
                    id: tenant.id,
                  }}
                  currentUrl={currentUrl}
                />
              )}
            </div>
          </div>

          {/* Thin trust bar */}
          <div className="flex items-center gap-3 pb-2 text-xs text-neutral-500 dark:text-neutral-400">
            {showsHours && showsHoursStatus && isRetailStore && (
              <HoursStatusBadge status={hoursStatus} size="sm" animate={showsAnimatedHours} />
            )}
            {hoursStatus?.label && (
              <span className="hidden sm:inline">· {hoursStatus.label}</span>
            )}
            {primaryGBPCategory && isRetailStore && showsCategoryStore && (
              <span className="hidden sm:inline">· {primaryGBPCategory.name}</span>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* HERO BANNER (full-width, 60vh)                                    */}
      {/* ================================================================= */}
      {!isProductsOnly && <section
        className="relative w-full min-h-[60vh] flex items-end overflow-hidden"
        aria-label={`${businessName} hero banner`}
      >
        {/* Background: banner image or gradient */}
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt={`${businessName} banner`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}88 50%, ${primaryColor}33 100%)`,
            }}
          />
        )}

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Content overlay */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-24">
          <div className="max-w-2xl">
            {/* Store name (large) */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-3 leading-tight">
              {businessName}
            </h1>

            {/* Tagline */}
            {businessDescription && (
              <p className="text-lg sm:text-xl text-white/80 mb-6 line-clamp-3">
                {businessDescription}
              </p>
            )}

            {/* CTA: Browse Collection */}
            {isRetailStore && physicalProducts.length > 0 && (
              <button
                onClick={scrollToCollection}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-neutral-900 font-semibold text-sm hover:bg-neutral-100 transition-colors shadow-lg"
                aria-label="Browse the product collection"
              >
                Browse Collection
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* GBP category badges (overlaid, bottom) */}
          {primaryGBPCategory && isRetailStore && showsCategoryStore && (
            <div className="mt-8">
              <GBPCategoryBadges
                categories={[primaryGBPCategory, ...secondaryGBPCategories]}
                showCount={true}
                size="sm"
              />
            </div>
          )}
        </div>
      </section>}

      {/* ================================================================= */}
      {/* FEATURED SPOTLIGHT (2-col asymmetric)                              */}
      {/* ================================================================= */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && featuredData && featuredData.totalCount > 0 && spotlightProducts.length > 0 && (
        <section className="bg-white dark:bg-neutral-900" aria-label="Featured spotlight">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              {featuredData.buckets?.[0]
                ? getFeaturedTypeName(featuredData.buckets[0].bucketType)
                : 'Featured'}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
              Hand-picked selections from our collection
            </p>

            {/* Asymmetric 2-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
              {/* Hero Product (large card) — takes 3 of 5 cols */}
              {spotlightProducts[0] && (
                <div className="md:col-span-3 md:row-span-2">
                  <div className="relative h-full min-h-[320px] md:min-h-[460px] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 group">
                    {spotlightProducts[0].imageUrl || spotlightProducts[0].image_url ? (
                      <Image
                        src={spotlightProducts[0].imageUrl || spotlightProducts[0].image_url}
                        alt={spotlightProducts[0].name || 'Featured product'}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 60vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-16 h-16 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                        {spotlightProducts[0].name}
                      </h3>
                      {(spotlightProducts[0].price != null) && (
                        <p className="text-white/80 text-lg font-medium">
                          ${Number(spotlightProducts[0].price).toFixed(2)}
                        </p>
                      )}
                      {spotlightProducts[0].slug && (
                        <Link
                          href={`/products/${spotlightProducts[0].slug || spotlightProducts[0].id}`}
                          className="inline-flex items-center gap-1 mt-3 text-sm text-white/90 hover:text-white underline underline-offset-2"
                        >
                          View details
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Product 2 & Product 3 (stacked) — take 2 of 5 cols */}
              <div className="md:col-span-2 flex flex-col gap-4 md:gap-6">
                {spotlightProducts.slice(1, 3).map((product: any, idx: number) => (
                  <div
                    key={product.id || idx}
                    className="relative h-48 md:h-auto md:flex-1 md:min-h-[220px] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 group"
                  >
                    {product.imageUrl || product.image_url ? (
                      <Image
                        src={product.imageUrl || product.image_url}
                        alt={product.name || 'Featured product'}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 40vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-12 h-12 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-base font-bold text-white mb-0.5 truncate">
                        {product.name}
                      </h3>
                      {(product.price != null) && (
                        <p className="text-white/80 text-sm font-medium">
                          ${Number(product.price).toFixed(2)}
                        </p>
                      )}
                      {product.slug && (
                        <Link
                          href={`/products/${product.slug || product.id}`}
                          className="inline-flex items-center gap-1 mt-1 text-xs text-white/80 hover:text-white underline underline-offset-2"
                        >
                          View details
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION: "Our Collection" (bg-neutral-50)                          */}
      {/* ================================================================= */}
      {!storefrontStatus.shouldShowPanel && !isProductsOnly && physicalProducts.length > 0 && (
        <section
          ref={collectionRef}
          className="bg-neutral-50 dark:bg-neutral-950"
          aria-label="Product collection"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Section heading */}
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              Our Collection
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8">
              Browse our complete catalog of {totalItems} products
              {search && ` matching "${search}"`}
              {category && ` in ${categories.find((c: any) => c.slug === category)?.name || category}`}
            </p>

            {/* Search bar (inline, minimal border-bottom style) */}
            <div className="mb-6">
              <ProductSearch tenantId={tenantId} />
            </div>

            {/* Inline filter tabs: horizontal scroll pills */}
            {showsCategoryProduct && categories.length > 0 && (
              <div className="mb-8">
                {/* Desktop: horizontal pills */}
                <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <a
                    href={`/tenant/${tenantId}`}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      !category
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    All
                  </a>
                  {categories.map((cat: any) => (
                    <a
                      key={cat.id || cat.slug}
                      href={getCategoryUrl(cat, `/tenant/${tenantId}`)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        category === cat.slug
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {cat.name}
                      {cat.productCount != null && (
                        <span className="ml-1.5 text-neutral-400 dark:text-neutral-500">({cat.productCount})</span>
                      )}
                    </a>
                  ))}
                </div>

                {/* Mobile: dropdown */}
                <div className="sm:hidden">
                  <CategoryMobileDropdown
                    tenantId={tenantId}
                    categories={categories}
                    totalProducts={totalItems || 0}
                  />
                </div>
              </div>
            )}

            {/* Product grid: 3-col desktop, 2-col tablet, 1-col mobile */}
            <TenantPaymentProvider tenantId={tenantId}>
              <EnhancedProductDisplay
                products={physicalProducts}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <>
                <div className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
                  Page {currentPage} of {totalPages} &middot; {totalItems} total products
                </div>
                <div className="mt-4 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems || 0}
                    pageSize={12}
                    onPageChange={(page: number) => {
                      const params = new URLSearchParams(window.location.search);
                      params.set('page', page.toString());
                      if (search) params.set('search', search);
                      if (category) params.set('category', category);
                      if (featured) params.set('featured', featured);
                      if (view) params.set('view', view);
                      window.location.href = `${window.location.pathname}?${params.toString()}`;
                    }}
                    onPageSizeChange={(size: number) => {
                      const params = new URLSearchParams(window.location.search);
                      params.set('page', '1');
                      params.set('limit', size.toString());
                      window.location.href = `${window.location.pathname}?${params.toString()}`;
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* PRODUCTS-ONLY VIEW (when ?products_only=true)                     */}
      {/* ================================================================= */}
      {!storefrontStatus.shouldShowPanel && isProductsOnly && physicalProducts.length > 0 && (
        <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Products">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {featured && (
              <div className="flex items-center gap-3 mb-6">
                <Link href={`/tenant/${tenantId}`} className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">← Back to store</Link>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {featured === 'true' || featured === '1' ? 'All Featured Products' : getFeaturedTypeName(featured)}
                </h1>
              </div>
            )}
            <TenantPaymentProvider tenantId={tenantId}>
              <EnhancedProductDisplay
                products={physicalProducts}
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
                  onPageChange={(page: number) => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', page.toString());
                    if (search) params.set('search', search);
                    if (category) params.set('category', category);
                    if (featured) params.set('featured', featured);
                    window.location.href = `${window.location.pathname}?${params.toString()}`;
                  }}
                  onPageSizeChange={() => {}}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SERVICE SECTION (service product offerings)                       */}
      {/* ================================================================= */}
      {showServices && serviceProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <ServiceSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          services={serviceProducts}
          layoutVariant="editorial"
          isServiceStore={isServiceStore}
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* ================================================================= */}
      {/* DIGITAL SECTION (downloadable products)                           */}
      {/* ================================================================= */}
      {showDigital && digitalProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <DigitalSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          digitalProducts={digitalProducts}
          layoutVariant="editorial"
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* ================================================================= */}
      {/* HYBRID SECTION (physical + digital bundles)                      */}
      {/* ================================================================= */}
      {showHybrid && hybridProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <HybridSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          hybridProducts={hybridProducts}
          layoutVariant="editorial"
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* ================================================================= */}
      {/* SOCIAL PROOF SECTION (platform badges, share buttons)             */}
      {/* ================================================================= */}
      {showSocialProof && !storefrontStatus.shouldShowPanel && (
        <SocialProofSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          layoutVariant="editorial"
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
        />
      )}

      {/* ================================================================= */}
      {/* EDITORIAL STORY SECTION (full-width, bg-white)                    */}
      {/* ================================================================= */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && (businessDescription || showsSocialMedia && socialLinks.length > 0) && (
        <section className="bg-white dark:bg-neutral-900" aria-label="About the store">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Image column */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={`${businessName} logo`}
                    fill
                    className="object-contain p-8"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : tenant?.metadata?.banner_url ? (
                  <Image
                    src={tenant.metadata.banner_url}
                    alt={`${businessName}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}11 100%)`,
                    }}
                  >
                    <span className="text-6xl sm:text-8xl font-bold text-neutral-200 dark:text-neutral-700 select-none">
                      {businessName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Text column */}
              <div>
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
                  About {businessName}
                </h2>
                {businessDescription && (
                  <p className="text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed mb-6">
                    {businessDescription}
                  </p>
                )}

                {/* Social links as icon-only row */}
                {showsSocialMedia && socialLinks.length > 0 && (
                  <div className="flex items-center gap-3">
                    {socialLinks.map((link) => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        aria-label={`Visit our ${link.platform} page`}
                      >
                        {socialIconMap[link.icon] || (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        )}
                      </a>
                    ))}
                  </div>
                )}

                {/* Contact info */}
                {showsContact && (contactInfo.phone || contactInfo.email || contactInfo.website) && (
                  <div className="mt-6 space-y-2 text-sm">
                    {contactInfo.phone && (
                      <a
                        href={`tel:${contactInfo.phone}`}
                        className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {contactInfo.phone}
                      </a>
                    )}
                    {contactInfo.email && (
                      <a
                        href={`mailto:${contactInfo.email}`}
                        className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {contactInfo.email}
                      </a>
                    )}
                    {contactInfo.website && (
                      <a
                        href={contactInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        Visit website
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* FEATURED BUCKETS (horizontal scroll carousels)                     */}
      {/* ================================================================= */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && featuredData && featuredData.totalCount > 0 && (
        <section className="bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800" aria-label="Featured selections">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Featured Selections
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
              Discover our hand-picked selection of featured items
            </p>
            <FeaturedBucketsShowcase
              featuredData={featuredData}
              tenantId={tenantId}
              hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
              defaultGatewayType={tenant.metadata?.defaultGatewayType}
              allowedFeaturedTypes={allowedFeaturedTypes.length > 0 ? allowedFeaturedTypes : undefined}
            />
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* STORE INFORMATION (2-col grid + hours row, bg-neutral-50)          */}
      {/* ================================================================= */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && (showsLocation || showsHours || showsContact) && isRetailStore && (
        <section
          id="hours-section"
          className="bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800"
          aria-label="Store information"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Top row: Visit Us + Get in Touch (2-col) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Visit Us (address + map) */}
              {showsLocation && showsContact && contactInfo.address && (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        Visit Us
                      </h3>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">
                      {contactInfo.address}
                    </p>
                    {showsHoursStatus && (
                      <div className="flex items-center gap-2 mb-3">
                        <HoursStatusBadge status={hoursStatus} size="sm" animate={showsAnimatedHours} />
                        {hoursStatus?.label && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">{hoursStatus.label}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Map */}
                  {showsMap && showsInteractiveMaps && (
                    <div className="h-48">
                      {mapLocation ? (
                        <TenantMapSection location={mapLocation} />
                      ) : contactInfo.address ? (
                        <GoogleMapEmbed address={contactInfo.address} height="h-48" showDirections={true} />
                      ) : tenant ? (
                        <StorefrontMap
                          tenant={{
                            id: tenantId,
                            businessName: businessName,
                            metadata: {
                              address: tenant.address_line1,
                              city: tenant.city,
                              state: tenant.state,
                              zip_code: tenant.postal_code,
                              latitude: tenant.metadata?.latitude,
                              longitude: tenant.metadata?.longitude,
                              logo_url: tenant.metadata?.logo_url,
                              phone: tenant.metadata?.phone,
                            },
                          }}
                          primaryCategory={primaryGBPCategory?.name}
                          productCount={totalItems}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* Card 2: Get in Touch (contact + fulfillment) */}
              {showsContact && (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      Get in Touch
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    {contactInfo.phone && (
                      <a
                        href={`tel:${contactInfo.phone}`}
                        className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <span className="text-base">📞</span> {contactInfo.phone}
                      </a>
                    )}
                    {contactInfo.email && (
                      <a
                        href={`mailto:${contactInfo.email}`}
                        className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <span className="text-base">✉️</span> {contactInfo.email}
                      </a>
                    )}
                    {contactInfo.website && (
                      <a
                        href={contactInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <span className="text-base">🌐</span> Website
                      </a>
                    )}
                    {!contactInfo.phone && !contactInfo.email && !contactInfo.website && (
                      <p className="text-neutral-500 dark:text-neutral-400 italic">
                        Contact information not available
                      </p>
                    )}
                  </div>

                  {/* Fulfillment options */}
                  {showsFulfillment && (
                  <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                    <FulfillmentOptionsPane tenantId={tenantId} compact={true} />
                  </div>
                  )}
                </div>
              )}
            </div>

            {/* Hours row: full-width below the grid for breathing room */}
            {showsHours && (
              <div className="mt-6 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    Hours
                  </h3>
                </div>
                <BusinessHoursCollapsible
                  businessHours={businessHours}
                  isRetailStore={isRetailStore}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SOCIAL PROOF (bg-white)                                            */}
      {/* ================================================================= */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && showsReviews && (
        <section className="bg-white dark:bg-neutral-900" aria-label="Store reviews">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div id="reviews-section" />
            <div className="max-w-2xl mx-auto">
              <StoreRatingDisplay tenantId={tenantId} showWriteReview={true} isPublic={true} />
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* FAQ ACCORDION (conditional, bg-neutral-50)                         */}
      {/* ================================================================= */}
      {!isProductsOnly && faqEnabled && tenantId && (
        <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Frequently asked questions">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 text-center">
                Frequently Asked Questions
              </h2>
              <FaqStorefrontDisplay
                tenantId={tenantId}
                enabled={faqEnabled}
                feedbackEnabled={faqFeedbackEnabled}
              />
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* INQUIRY FORM (conditional, bg-white)                               */}
      {/* ================================================================= */}
      {!isProductsOnly && crmInquiryStorefrontEnabled && !storefrontStatus.shouldShowPanel && tenantId && (
        <section className="bg-white dark:bg-neutral-900" aria-label="Send an inquiry">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="max-w-lg mx-auto">
              <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                      Send an Inquiry
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Ask {businessName || 'this store'} a question
                    </p>
                  </div>
                </div>
                <PublicInquiryForm tenantId={tenantId} tenantName={businessName} sourceLabel="Storefront" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* RECOMMENDATIONS + RECENTLY VIEWED                                  */}
      {/* ================================================================= */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && isRetailStore && showsRecommendStore && (
        <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Recommended stores">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <StorefrontRecommendations tenantId={tenantId} />
          </div>
        </section>
      )}

      {!isProductsOnly && !storefrontStatus.shouldShowPanel && showsRecentlyViewed && (
        <section className="bg-white dark:bg-neutral-900" aria-label="Recently viewed">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <LastViewed />
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SHARED FOOTER                                                      */}
      {/* ================================================================= */}
      {!isProductsOnly && <StorefrontFooter
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
        variant="full"
      />}
    </div>
  );
}
