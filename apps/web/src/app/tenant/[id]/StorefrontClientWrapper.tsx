"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { featuredProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
// import { FeaturedProduct } from '@/providers/data/FeaturedProductsSingleton';
// import StorefrontViewTracker from '@/components/tracking/StorefrontViewTracker';
// import ContactInformationCollapsible from '@/components/storefront/ContactInformationCollapsible';

// store status
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { useFeaturedOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
// Capability data now passed as server-fetched props — eliminates client-side waterfall 
// import SmartProductCard from '@/components/products/SmartProductCard';
// import StorefrontActions from '@/components/products/StorefrontActions';
// import StoreStatusIndicator from '@/components/storefront/StoreStatusIndicator';
import { useStorefrontStatus } from '@/components/storefront/StorefrontStatusPanel';
import { SubscriptionStatusPanel } from '@/components/subscription/SubscriptionStatusPanel';

// Product Discovery & Navigation
// import ProductCategoriesCollapsible from '@/components/storefront/ProductCategoriesCollapsible';
// import GBPCategoriesNav from '@/components/storefront/GBPCategoriesNav';
// import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';

// Store Information & Location
// import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';

// User Engagement & Shopping Experience
import LastViewed from '@/components/directory/LastViewed';
import CollapsibleCatalogSidebar from '@/components/storefront/CollapsibleCatalogSidebar';
import { StorefrontRecommendations } from './StorefrontClient';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import { PublicCrmOptionsFlags } from '@/services/CapabilityResolutionService';
import { ProductOptionFlags } from '@/services/CapabilityResolutionService';

// Extracted storefront section components
import { StorefrontHeader } from '@/components/storefront/sections/StorefrontHeader';
import { ProductSection } from '@/components/storefront/sections/ProductSection';
import { StoreInfoSection, StoreAboutSection } from '@/components/storefront/sections/StoreInfoSection';
import { FAQSection } from '@/components/storefront/sections/FAQSection';
import { InquirySection } from '@/components/storefront/sections/InquirySection';
import { ReviewsSection } from '@/components/storefront/sections/ReviewsSection';
import { ServiceSection } from '@/components/storefront/sections/ServiceSection';
import { DigitalSection } from '@/components/storefront/sections/DigitalSection';
import { HybridSection } from '@/components/storefront/sections/HybridSection';
import { SocialProofSection } from '@/components/storefront/sections/SocialProofSection';

// import { useStoreContactData } from '@/hooks/useStoreContactData';

// import { computeStoreStatus } from '@/lib/hours-utils';
// import { directoryService } from '@/services/DirectorySingletonService';
import { useMultiCart } from '@/hooks/useMultiCart';


interface StorefrontClientWrapperProps {
  tenantId: string;
  tenant: any;
  platformSettings: any;
  mapLocation: any;
  hasBranding: boolean;
  storeStatus: any;
  categories: any[];
  productCategories: any[];
  storeCategories: any[];
  uncategorizedCount: number;
  paymentGateways?: any[];
  businessName: string;
  businessHours?: any;
  search?: string;
  category?: string;
  featured?: string;
  view?: string;
  isProductsOnly: boolean;
  directoryPublished: boolean;
  tenantSlug: string;
  primaryGBPCategory: any;
  secondaryGBPCategories: any[];
  tier: string;
  features: any;
  totalAllProducts: number;
  fullWidthLayout?: boolean;
  products?: any[]; // Add products prop
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  // Location status fields from public API
  locationStatus?: string | null;
  statusInfo?: any;
  // Server-side resolved storefront option flags (eliminates client-side waterfall)
  initialStorefrontOptionFlags?: StorefrontOptionFlags | null;
  // Server-side resolved commerce settings (merchant gate)
  initialCommerceSettings?: { enabled?: boolean; show_payment_options?: boolean; require_payment_upfront?: boolean; allow_payment_on_pickup?: boolean } | null;
  // Server-side resolved payment gateway settings (merchant gate)
  initialPaymentGatewaySettings?: { gateway_enabled?: boolean; stripe_enabled?: boolean; paypal_enabled?: boolean; square_enabled?: boolean; clover_enabled?: boolean } | null;
  // Server-side resolved storefront type settings (merchant gate)
  initialStorefrontTypeSettings?: { settings?: { storefront_type_enabled?: boolean; selected_storefront_type?: string | null }; tierState?: { enabled?: boolean; type?: string; effectiveType?: string } } | null;
  // Server-side resolved FAQ option flags
  initialFaqFlags?: PublicFaqOptionsFlags | null;
  // Server-side resolved CRM option flags
  initialCrmFlags?: PublicCrmOptionsFlags | null;
  // Server-side resolved product option flags
  initialProductOptionFlags?: ProductOptionFlags | null;
  // Server-side resolved social commerce flags
  initialSocialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
}

export default function StorefrontClientWrapper({
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
}: StorefrontClientWrapperProps) {
  // Extract logo URL with multiple fallbacks
  const logoUrl = tenant?.metadata?.logo_url || tenant?.logo_url || tenant?.branding?.logoUrl || null;

  // console.log(`primaryGBPCategory    : ${JSON.stringify(primaryGBPCategory)}`);
  // console.log(`secondaryGBPCategories: ${JSON.stringify(secondaryGBPCategories)}`);
  // console.log(`locationStatus        : ${locationStatus}`);
  // console.log(`initialStorefrontOptionFlags: ${JSON.stringify(initialStorefrontOptionFlags)}`);

  const [featuredCounts, setFeaturedCounts] = useState<Record<string, number>>({});

  const [isFullWidth, setIsFullWidth] = useState(fullWidthLayout);
  const [featuredData, setFeaturedData] = useState<any>(null);
  const { totalItems: cartTotalItems } = useMultiCart();
  const router = useRouter();

  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : process.env.WEB_URL) || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/tenant/${tenantId}`;
  // console.log(`Storefront CurrentUrl: ${currentUrl}`);
  // console.log(`Storefront CurrentUrl: ${typeof window !== 'undefined' ? window.location.href : 'window not defined'}`);

  // Handle view cart
  const handleViewCart = () => {
    router.push('/carts');
  };
  const { status: hoursStatus } = useStoreStatus(tenantId, true); // Public scope

  // Featured options (capability-gated allowed types)
  const featuredCap = useFeaturedOptionsCapability(tenantId);
  const allowedFeaturedTypes = useMemo(() => {
    if (featuredCap.data?.enabled && featuredCap.data.effectiveTypes) {
      return featuredCap.data.effectiveTypes as string[];
    }
    return [];
  }, [featuredCap.data]);

  // Memoize tenant info object to prevent infinite re-renders
  const tenantInfoForStatus = useMemo(() => ({
    id: tenantId,
    name: businessName,
    slug: tenantSlug,
    subscriptionStatus: tenant?.subscriptionStatus || 'unknown',
    subscriptionTier: tier,
    locationStatus,
    statusInfo,
    hasDirectory: directoryPublished,
    createdAt: '',
    updatedAt: '',
  }), [tenantId, businessName, tenantSlug, tenant?.subscriptionStatus, tier, locationStatus, statusInfo, directoryPublished]);

  // Check if storefront status panel should be shown
  const storefrontStatus = useStorefrontStatus(tenantId, tenantInfoForStatus as any);

  // Storefront capability-driven content control — now from server-fetched props
  const storefrontCap = {
    data: {
      enabled: initialStorefrontTypeSettings?.settings?.storefront_type_enabled ?? true,
      type: initialStorefrontTypeSettings?.tierState?.effectiveType ?? initialStorefrontTypeSettings?.tierState?.type ?? 'flexible',
    },
    loading: false,
  };
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? true;
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'flexible';
  const isOnlineStore = storefrontCap.data?.type === 'online' || storefrontCap.data?.type === 'flexible';
  const isServiceStore = storefrontCap.data?.type === 'service' || storefrontCap.data?.type === 'flexible';
  const isSocialStore = storefrontCap.data?.type === 'social' || storefrontCap.data?.type === 'flexible';

  // Product option flags — for service product gating
  const [productOptionFlags] = useState<ProductOptionFlags | null>(initialProductOptionFlags ?? null);
  const showServices = !!(productOptionFlags?.merchantPreferences?.product_service_enabled) || isServiceStore;
  const showDigital = !!(productOptionFlags?.merchantPreferences?.product_digital_enabled);
  const showHybrid = !!(productOptionFlags?.merchantPreferences?.product_hybrid_enabled);

  // Social commerce flags — for social proof gating
  const [socialCommerceFlags] = useState<{ enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null>(
    initialSocialCommerceFlags ?? null,
  );
  const showSocialProof =
    !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseSocialProof) || isSocialStore;

  // Filter products by product_type into section buckets.
  // Switch-based for extensibility — adding 'digital', 'hybrid', or future
  // types only requires adding a new case + accumulator array.
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
    return {
      physicalProducts: buckets.physical,
      serviceProducts: buckets.service,
      digitalProducts: buckets.digital,
      hybridProducts: buckets.hybrid,
    };
  }, [products]);

  // showsHours/showsMap/showsLocation now come from storefront_options (merchant-controlled)
  // storefront_type (platform-controlled) still determines isRetailStore/isOnlineStore/isServiceStore

  // Storefront options capability flags — initialized from server-side fetch (no waterfall)
  const [storefrontOptionFlags] = useState<StorefrontOptionFlags | null>(initialStorefrontOptionFlags ?? null);

  // FAQ options flags — initialized from server-side fetch
  const [faqFlags] = useState<PublicFaqOptionsFlags | null>(initialFaqFlags ?? null);
  const faqEnabled = faqFlags?.faq_enabled && faqFlags?.faq_display_storefront_accordion;
  const faqFeedbackEnabled = faqFlags?.faq_enabled && faqFlags?.faq_display_feedback;

  // CRM options flags — initialized from server-side fetch
  const [crmFlags] = useState<PublicCrmOptionsFlags | null>(initialCrmFlags ?? null);
  const crmInquiryStorefrontEnabled = crmFlags?.crm_enabled && crmFlags?.crm_inquiry_storefront_enabled;

  // Capability-aware visibility flags (fall back to true while loading)
  const optFlags = storefrontOptionFlags;
  const showsHours = optFlags?.showHoursDisplay ?? true;
  const showsMap = optFlags?.showMapDisplay ?? true;
  const showsLocation = optFlags?.showLocationDisplay ?? true;
  const showsAnimatedHours = optFlags?.showAnimatedHours ?? true;
  const showsHoursStatus = optFlags?.showHoursStatus ?? true;
  const showsCategoryStore = optFlags?.showCategoryStore ?? true;
  const showsCategoryProduct = optFlags?.showCategoryProduct ?? true;
  const showsRecommendStore = optFlags?.showRecommendStore ?? true;
  const showsRecentlyViewed = optFlags?.showRecentlyViewed ?? true;
  const showsInteractiveMaps = optFlags?.showInteractiveMaps ?? true;
  const showsContact = optFlags?.showContact ?? true;
  const showsSocialMedia = optFlags?.showSocialMedia ?? true;
  const showsStorefrontActions = optFlags?.showStorefrontActions ?? true;
  const showsQRCodes = optFlags?.showQRCodes ?? true;
  // Product-page concepts default to enabled on the storefront since there are
  // no equivalent storefront option fields; product pages use ProductOptionFlags directly.
  const showsReviews = true;
  const showsFulfillment = true;
  const showsGallery = true;
  const showsVariants = true;

  // console.log(`----------------------------isRetailStore---------------------------------------: ${isRetailStore}`)
  // console.log(`optFlags: ${optFlags}`)
  // console.log(`showsHours: ${showsHours}`)
  // console.log(`showsMap: ${showsMap}`)
  // console.log(`showsLocation: ${showsLocation}`)
  // console.log(`showsHoursStatus: ${showsHoursStatus}`)
  // console.log(`showsInteractiveMaps: ${showsInteractiveMaps}`)
  // console.log(`showsStorefrontActions: ${showsStorefrontActions}`)

  // Extract contact information from tenant metadata with fallbacks
  // Lazy: wait for storefrontCap to resolve before computing, so capability-driven
  // visibility (showsLocation, showsMap) is available before first render that uses it
  const contactInfo = useMemo(() => {
    if (storefrontCap.loading) return { phone: null, email: null, address: null, website: null };
    return {
      phone: tenant?.metadata?.phone || tenant?.phone || null,
      email: tenant?.metadata?.email || tenant?.email || null,
      address: tenant?.metadata?.address ||
        (tenant?.address_line1 ? `${tenant.address_line1}${tenant.city ? ', ' + tenant.city : ''}${tenant.state ? ', ' + tenant.state : ''}${tenant.postal_code ? ' ' + tenant.postal_code : ''}` : null),
      website: tenant?.metadata?.website || tenant?.website || null
    };
  }, [storefrontCap.loading, tenant]);

  // Status indicator color
  // const getStatusColor = () => {
  //   if (!hoursStatus) return 'bg-gray-400';
  //   switch (hoursStatus.status) {
  //     case 'open': return 'bg-green-500';
  //     case 'closed': return 'bg-red-500';
  //     case 'opening-soon': return 'bg-blue-500';
  //     case 'closing-soon': return 'bg-yellow-500';
  //     default: return 'bg-gray-400';
  //   }
  // };


  // Fetch featured data on mount
  useEffect(() => {
    const loadFeaturedCounts = async () => {
      try {
        let data = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20);

        // Validate cache: if data is empty, force a fresh fetch
        if (data && data.totalCount === 0 && (!data.buckets || data.buckets.length === 0)) {
          // console.warn('[StorefrontClientWrapper] Detected empty cached data, forcing fresh fetch');
          // Clear cache and fetch fresh data
          await featuredProductsSingleton.clearCache();
          data = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20);
        }

        if (data) {
          // console.log('Featured data response:', data);
          // console.log('Buckets:', data.buckets);

          // Debug each bucket
          /* data.buckets?.forEach((bucket: any) => {
            console.log(`Bucket ${bucket.bucketType}:`, {
              totalCount: bucket.totalCount,
              productsCount: bucket.products?.length || 0,
              products: bucket.products?.slice(0, 2).map((p: any) => ({ id: p.id, name: p.name }))
            });
          }); */

          // Transform bucket data into the expected format - all 10 types
          const transformedData = {
            totalCount: data.totalCount,
            buckets: data.buckets || [],
            bucketCounts: data.bucketCounts || {}
          };

          setFeaturedData(transformedData);

          // Set featured counts dynamically from API response
          setFeaturedCounts(transformedData.bucketCounts || {});
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
      {/* Header */}
      <StorefrontHeader
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        logoUrl={logoUrl}
        layoutVariant="classic"
        storefrontStatus={storefrontStatus}
        isRetailStore={isRetailStore}
        directoryPublished={directoryPublished}
        tenantSlug={tenantSlug}
        primaryGBPCategory={primaryGBPCategory}
        secondaryGBPCategories={secondaryGBPCategories}
        hoursStatus={hoursStatus}
        showsHours={showsHours}
        showsHoursStatus={showsHoursStatus}
        showsAnimatedHours={showsAnimatedHours}
        showsCategoryStore={showsCategoryStore}
        showsStorefrontActions={showsStorefrontActions}
        showsSocialMedia={showsSocialMedia}
        cartTotalItems={cartTotalItems}
        handleViewCart={handleViewCart}
        currentUrl={currentUrl}
      />

      {/* Subscription status panel for non-active subscriptions */}
      <SubscriptionStatusPanel
        subscriptionStatus={tenant?.subscriptionStatus || 'active'}
        subscriptionTier={tier}
        trialEndsAt={tenant?.trialEndsAt ?? null}
        subscriptionEndsAt={tenant?.subscriptionEndsAt ?? null}
      />

      {/* About the Store */}
      <StoreAboutSection
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        logoUrl={logoUrl}
        layoutVariant="classic"
        storefrontStatus={storefrontStatus}
        isRetailStore={isRetailStore}
        businessHours={businessHours}
        mapLocation={mapLocation}
        contactInfo={contactInfo}
        hoursStatus={hoursStatus}
        primaryGBPCategory={primaryGBPCategory}
        totalItems={totalItems}
        showsHours={showsHours}
        showsHoursStatus={showsHoursStatus}
        showsAnimatedHours={showsAnimatedHours}
        showsMap={showsMap}
        showsLocation={showsLocation}
        showsContact={showsContact}
        showsSocialMedia={showsSocialMedia}
        showsFulfillment={showsFulfillment}
        showsInteractiveMaps={showsInteractiveMaps}
        showsReviews={showsReviews}
      />

      {/* Product Section: Featured Navigation, Status Panel, Product Catalog, Featured Showcase */}
      <ProductSection
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        tenantSlug={tenantSlug}
        products={physicalProducts}
        categories={categories}
        productCategories={productCategories}
        search={search}
        category={category}
        featured={featured}
        view={view}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        isProductsOnly={isProductsOnly}
        isFullWidth={isFullWidth}
        storefrontStatus={storefrontStatus}
        showsCategoryProduct={showsCategoryProduct}
        showsQRCodes={showsQRCodes}
        showsGallery={showsGallery}
        showsVariants={showsVariants}
        allowedFeaturedTypes={allowedFeaturedTypes}
        featuredData={featuredData}
        featuredCounts={featuredCounts}
        hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
        defaultGatewayType={tenant.metadata?.defaultGatewayType}
        layoutVariant="classic"
        currentUrl={currentUrl}
        storefrontOptionFlags={storefrontOptionFlags}
        getFeaturedTypeName={getFeaturedTypeName}
        getCategoryUrl={getCategoryUrl}
        isSocialStore={isSocialStore}
        socialCommerceFlags={socialCommerceFlags}
      />

      {/* Service Section: Service offerings with booking CTAs (gated by product_service_enabled) */}
      {showServices && serviceProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <ServiceSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          services={serviceProducts}
          layoutVariant="classic"
          isServiceStore={isServiceStore}
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* Digital Section: Downloadable products (gated by product_digital_enabled) */}
      {showDigital && digitalProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <DigitalSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          digitalProducts={digitalProducts}
          layoutVariant="classic"
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* Hybrid Section: Physical + Digital bundles (gated by product_hybrid_enabled) */}
      {showHybrid && hybridProducts.length > 0 && !storefrontStatus.shouldShowPanel && (
        <HybridSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          hybridProducts={hybridProducts}
          layoutVariant="classic"
          hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
          currentUrl={currentUrl}
        />
      )}

      {/* Social Proof Section: Platform badges, follower counts, UGC (gated by showSocialProof) */}
      {showSocialProof && !storefrontStatus.shouldShowPanel && (
        <SocialProofSection
          tenantId={tenantId}
          tenant={tenant}
          businessName={businessName}
          layoutVariant="classic"
          isSocialStore={isSocialStore}
          socialCommerceFlags={socialCommerceFlags}
        />
      )}

      {/* Store Information Card - Consolidated Location, Contact, Hours */}
      <StoreInfoSection
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        logoUrl={logoUrl}
        layoutVariant="classic"
        storefrontStatus={storefrontStatus}
        isRetailStore={isRetailStore}
        isProductsOnly={isProductsOnly}
        businessHours={businessHours}
        mapLocation={mapLocation}
        contactInfo={contactInfo}
        hoursStatus={hoursStatus}
        primaryGBPCategory={primaryGBPCategory}
        totalItems={totalItems}
        showsHours={showsHours}
        showsHoursStatus={showsHoursStatus}
        showsAnimatedHours={showsAnimatedHours}
        showsMap={showsMap}
        showsLocation={showsLocation}
        showsContact={showsContact}
        showsSocialMedia={showsSocialMedia}
        showsFulfillment={showsFulfillment}
        showsInteractiveMaps={showsInteractiveMaps}
        showsReviews={showsReviews}
      />
      {/* Store Ratings and Reviews */}
      {/* Gradient border line */}
      {/* Advanced Catalog Navigation */}
      {!storefrontStatus.shouldShowPanel && showsCategoryProduct && (categories.length > 0 || productCategories.length > 0 || storeCategories.length > 0) && isRetailStore && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <CollapsibleCatalogSidebar
            tenantId={tenantId}
            categories={categories}
            totalProducts={totalItems || 0}
            productsLength={products.length}
            tenantSlug={tenant.slug}
            tenantLogo={tenant.metadata?.logo_url}
            totalPages={totalPages || 1}
            currentPage={currentPage || 1}
            search={search}
            currentCategory={category}
            featured={featured}
            view={view}
            featuredCounts={featuredCounts}
          />
        </div>
      )}
      {/* FAQ Section */}
      <FAQSection
        tenantId={tenantId}
        faqEnabled={!!faqEnabled}
        faqFeedbackEnabled={!!faqFeedbackEnabled}
        layoutVariant="classic"
      />

      {/* Contact / Inquiry Form */}
      {crmInquiryStorefrontEnabled && !storefrontStatus.shouldShowPanel && tenantId && (
        <InquirySection
          tenantId={tenantId}
          businessName={businessName}
          layoutVariant="classic"
        />
      )}

      {!storefrontStatus.shouldShowPanel && showsReviews && (
        <ReviewsSection
          tenantId={tenantId}
          layoutVariant="classic"
        />
      )}

      {/* Storefront Recommendations */}
      {!storefrontStatus.shouldShowPanel && isRetailStore && showsRecommendStore && (
        <StorefrontRecommendations tenantId={tenantId} />
      )}
      {/* Recently Viewed - always last for consistency with other public pages */}

      {!storefrontStatus.shouldShowPanel && showsRecentlyViewed && (
        <LastViewed />
      )}

      {/* Tier-Based Footer */}

      <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            {/* Quick Links */}
            <div>
              <div className="flex flex-wrap gap-4">
                {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                  <><h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Quick Links
                  </h3><Link
                    href={`/directory/${tenantSlug}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-medium"
                  >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      View in Directory
                    </Link></>
                )}
                {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                  <Link
                    href={`/shops/${tenantSlug}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-medium"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4z" />
                    </svg>
                    View in Shops
                  </Link>
                )}
                {!storefrontStatus.shouldShowPanel && isRetailStore && (
                  <><Link
                    href="/directory"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Browse Directory
                  </Link><Link
                    href="/shops"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium"
                  >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4z" />
                      </svg>
                      Browse Shops
                    </Link></>
                )}
              </div>
            </div>
          </div>
          {/* Platform Branding */}
          {!features.removePlatformBranding && (
            <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700 text-sm text-neutral-500">
              <Link href="/" title={platformSettings?.platformName || 'Visible Shelf'} style={{ textDecoration: 'none' }}>
                <div className="flex items-center justify-center gap-2">
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

