"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Pagination } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { featuredProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
// import { FeaturedProduct } from '@/providers/data/FeaturedProductsSingleton';
// import StorefrontViewTracker from '@/components/tracking/StorefrontViewTracker';
// import ContactInformationCollapsible from '@/components/storefront/ContactInformationCollapsible';

// store status
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { useFeaturedOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
// Capability data now passed as server-fetched props — eliminates client-side waterfall 
import { Badge as MantineBadge } from '@mantine/core';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';

import DirectoryActions from '@/components/directory/DirectoryActions';

import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StorefrontMap from '@/components/storefront/StorefrontMap';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
// import SmartProductCard from '@/components/products/SmartProductCard';
import FeaturedBucketsShowcase from '@/components/storefront/FeaturedBucketsShowcase';
// import StorefrontActions from '@/components/products/StorefrontActions';
// import StoreStatusIndicator from '@/components/storefront/StoreStatusIndicator';
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
import { StorefrontStatusPanel, useStorefrontStatus } from '@/components/storefront/StorefrontStatusPanel';
import { SubscriptionStatusPanel } from '@/components/subscription/SubscriptionStatusPanel';

// Product Discovery & Navigation
import ProductSearch from '@/components/storefront/ProductSearch';
import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
// import ProductCategoriesCollapsible from '@/components/storefront/ProductCategoriesCollapsible';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
// import GBPCategoriesNav from '@/components/storefront/GBPCategoriesNav';
import GBPCategoryBadges from '@/components/shared/GBPCategoryBadges';
// import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';

// Store Information & Location
import TenantMapSection from '@/components/tenant/TenantMapSection';
// import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';

// User Engagement & Shopping Experience
import LastViewed from '@/components/directory/LastViewed';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
import CollapsibleCatalogSidebar from '@/components/storefront/CollapsibleCatalogSidebar';
import { StorefrontRecommendations } from './StorefrontClient';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import { PublicCrmOptionsFlags } from '@/services/CapabilityResolutionService';
import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';

// import { useStoreContactData } from '@/hooks/useStoreContactData';

// import { computeStoreStatus } from '@/lib/hours-utils';
// import { directoryService } from '@/services/DirectorySingletonService';
import { useMultiCart } from '@/hooks/useMultiCart';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';


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
      type: initialStorefrontTypeSettings?.tierState?.effectiveType ?? initialStorefrontTypeSettings?.tierState?.type ?? 'both',
    },
    loading: false,
  };
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? true;
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'both';
  const isOnlineStore = storefrontCap.data?.type === 'online' || storefrontCap.data?.type === 'both';
  const isServiceStore = storefrontCap.data?.type === 'service' || storefrontCap.data?.type === 'both';
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
      {/* Hero Header - Brand Identity, Status, Navigation, Actions */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Header Row */}
          <div className="flex items-center gap-4 py-4">
            {/* Brand Identity */}
            <div className="flex items-center gap-4 flex-shrink-0 min-w-0">
              {/* Store Logo */}
              <div className="flex-shrink-0">
                {logoUrl ? (
                  <div className="relative w-14 h-14">
                    <Image
                      src={logoUrl}
                      alt={businessName}
                      fill
                      className="object-contain rounded-lg shadow-sm"
                      sizes="56px"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center shadow-sm">
                    <svg className="w-7 h-7 text-primary-600 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Store Name, Category, and Status */}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-white truncate">
                    {businessName || 'Store Name Not Available'}
                  </h1>
                </div>
                {primaryGBPCategory && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {primaryGBPCategory.name}
                  </p>
                )}
              </div>

            </div>
            {/* Quick Actions */}
            <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
              {/* Navigation Pills */}
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                  <a
                    href={`/directory/${tenantSlug}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                    title="View Store in Directory"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" />
                    </svg>
                    <span className="hidden lg:inline">Directory</span>
                  </a>
                )}

                {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                  <a
                    href={`/shops/${tenantSlug}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                    title="View Store in Shops"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4zm0 0v10a2 2 0 002 2h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" />
                    </svg>
                    <span className="hidden lg:inline">Shop</span>
                  </a>
                )}

                {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                  <a
                    onClick={() => {
                      const hoursSection = document.getElementById('hours-section');
                      if (hoursSection) {
                        hoursSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                    title="View Store Hours"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="hidden lg:inline">Hours</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Category Badges */}
          {primaryGBPCategory && isRetailStore && showsCategoryStore && (
            <div className="flex-1">
              <GBPCategoryBadges
                categories={[primaryGBPCategory, ...secondaryGBPCategories]}
                showCount={true}
                size="sm"
              />  {/* Store Status Badge */}
            </div>
          )}
          {/* Action Buttons - Below categories for better responsive behavior */}
          {!storefrontStatus.shouldShowPanel && tenantSlug && (
            <div className="hidden sm:flex justify-end mt-3">
              {showsHours && showsHoursStatus && isRetailStore && (
                <HoursStatusBadge status={hoursStatus} size="lg" animate={showsAnimatedHours} />
              )}
              {showsStorefrontActions && <DirectoryActions
                listing={{
                  business_name: tenant.name,
                  slug: tenant.slug,
                  tenantId: tenant.id,
                  id: tenant.id
                }}
                currentUrl={currentUrl}
              />}
            </div>
          )}
          {/* Mobile Navigation */}
          <div className="sm:hidden pb-3 flex items-center gap-2 overflow-x-auto">
            {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
              <a
                href={`/directory/${tenantSlug}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Directory</span>
              </a>
            )}
            {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
              <a
                href={`/shops/${tenantSlug}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4zm0 0v10a2 2 0 002 2h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" />
                </svg>
                <span>Shop</span>
              </a>
            )}
            {!storefrontStatus.shouldShowPanel && (
              <a
                onClick={() => {
                  const reviewsSection = document.getElementById('reviews-section');
                  if (reviewsSection) {
                    reviewsSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                title="View Store Reviews"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="hidden lg:inline">Reviews</span>
              </a>
            )}
            {!storefrontStatus.shouldShowPanel && showsHours && isRetailStore && (
              <a
                onClick={() => {
                  const hoursSection = document.getElementById('hours-section');
                  if (hoursSection) {
                    hoursSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                title="View Store Hours"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden lg:inline">Hours</span>
              </a>
            )}
            {!storefrontStatus.shouldShowPanel && (
              <a
                onClick={handleViewCart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                title="View Shopping Cart"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 014 4z" />
                </svg>
                {cartTotalItems > 0 && (
                  <span className="flex -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {cartTotalItems > 99 ? '99+' : cartTotalItems}
                  </span>
                )}
                <span className="hidden lg:inline">Cart</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Subscription status panel for non-active subscriptions */}
      <SubscriptionStatusPanel
        subscriptionStatus={tenant?.subscriptionStatus || 'active'}
        subscriptionTier={tier}
        trialEndsAt={tenant?.trialEndsAt ?? null}
        subscriptionEndsAt={tenant?.subscriptionEndsAt ?? null}
      />

      {/* Shop Description & Gallery - About the Store */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Shop Description */}
            <div className="lg:col-span-2">
              <div className="space-y-6">
                {!storefrontStatus.shouldShowPanel && (tenant.profileData?.business_description || tenant.profileData?.businessDescription || tenant.metadata?.businessDescription) && (
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">About {businessName}</h2>
                    <div className="prose prose-neutral dark:prose-invert max-w-none">
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {tenant.metadata?.businessDescription ||
                          `${businessName} is your trusted local store offering quality products and exceptional service. We're committed to providing the best shopping experience for our customers.`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {!storefrontStatus.shouldShowPanel && showsSocialMedia && tenant.profileData?.social_links && (
                  <div>
                    <div className="flex flex-wrap gap-3">
                      {(tenant.profileData.social_links.facebook
                        || tenant.profileData.social_links?.instagram
                        || tenant.profileData.social_links?.twitter
                        || tenant.profileData.social_links?.linkedin) && (
                          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">Connect With Us</h3>
                        )}
                      {tenant.profileData.social_links.facebook && (
                        <a
                          href={tenant.profileData.social_links.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-1.58 1.036-2.683 2.499-2.683h2.09v3.47h-2.09c-.247 0-.447.22-.447.49v2.46h2.53v3.47h-2.53c-.246 0-.447.22-.447.49v4.354C19.612 23.027 24 18.062 24 12.073z" />
                          </svg>
                          Facebook
                        </a>
                      )}
                      {tenant.profileData.social_links?.instagram && (
                        <a
                          href={tenant.profileData.social_links.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 2.165.045.12.12.259.12.424 0 .165-.046.349-.12.424-.049-.104-.4-.15-.852-.15-.656.02-1.305.08-1.917.161-.425.084-.849.262-1.165.516-.316.253-.58.598-.734.976-.154.378-.258.771-.316 1.165-.058.394-.08.8-.08 1.165 0 1.495.145 2.842.145 3.204v3.92h-3.25v-2.928c0-.656-.145-1.12-.425-1.495a1.59 1.59 0 0 0-1.12-.425H8.25v-3.92h3.25c.065 0 .13-.003.195-.008V8.4c-.065.005-.13.008-.195.008-3.626 0-6.562 2.936-6.562 6.562 0 1.686.629 3.215 1.658 4.386a1.59 1.59 0 0 0 .425 1.12c.375.28.839.425 1.495.425h3.92v2.928h-3.92c-.065 0-.13-.003-.195-.008v3.92c0 3.626 2.936 6.562 6.562 6.562 1.686 0 3.215-.629 4.386-1.658a1.59 1.59 0 0 0 1.12-.425c.28-.375.425-.839.425-1.495v-2.928h3.92v-3.92c0-.065.003-.13.008-.195z" />
                          </svg>
                          Instagram
                        </a>
                      )}
                      {tenant.profileData.social_links?.twitter && (
                        <a
                          href={tenant.profileData.social_links.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 00-2.143-2.714c0-.054.008-.108.008-.163a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191z" />
                          </svg>
                          Twitter
                        </a>
                      )}
                      {tenant.profileData.social_links?.linkedin && (
                        <a
                          href={tenant.profileData.social_links.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                          </svg>
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Store Image/Logo Display */}
            <div>
              {!storefrontStatus.shouldShowPanel && (tenant.metadata.logo_url || tenant.metadata.logoUrl) && (
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
                  {tenant.metadata?.logo_url ? (
                    <div className="relative aspect-square">
                      <Image
                        src={tenant.metadata.logo_url}
                        alt={`${businessName} logo`}
                        fill
                        className="object-contain p-8"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-16 h-16 text-primary-600 dark:text-primary-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <p className="text-primary-600 dark:text-primary-300 font-medium">{businessName}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Navigation Controls - Top of Page */}
      {!storefrontStatus.shouldShowPanel && featuredData && Object.keys(featuredCounts).length > 0 && Object.values(featuredCounts).some(count => count > 0) && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="py-4 border-b border-neutral-200 dark:border-neutral-700 sticky top-[60px] z-30 bg-white dark:bg-neutral-900">
            {/* First Row - Product Categories */}
            {(
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Quick Jump:</span>

                {/* Dynamic Featured Type Buttons */}
                {Object.entries(featuredCounts).map(([type, count]) => {
                  if (count === 0) return null;

                  // Get button styling based on type
                  const getButtonStyle = (type: string) => {
                    switch (type) {
                      case 'bestseller':
                        return {
                          bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
                          textClass: 'text-yellow-700 dark:text-yellow-300',
                          borderClass: 'border-yellow-300 dark:border-yellow-600',
                          hoverClass: 'hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
                          icon: '🏆',
                          label: 'Bestsellers'
                        };
                      case 'clearance':
                        return {
                          bgClass: 'bg-pink-100 dark:bg-pink-900/30',
                          textClass: 'text-pink-700 dark:text-pink-300',
                          borderClass: 'border-pink-300 dark:border-pink-600',
                          hoverClass: 'hover:bg-pink-200 dark:hover:bg-pink-900/50',
                          icon: '🏷️',
                          label: 'Clearance'
                        };
                      case 'featured':
                        return {
                          bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
                          textClass: 'text-indigo-700 dark:text-indigo-300',
                          borderClass: 'border-indigo-300 dark:border-indigo-600',
                          hoverClass: 'hover:bg-indigo-200 dark:hover:bg-indigo-900/50',
                          icon: '⭐',
                          label: 'Featured'
                        };
                      case 'new_arrival':
                        return {
                          bgClass: 'bg-green-100 dark:bg-green-900/30',
                          textClass: 'text-green-700 dark:text-green-300',
                          borderClass: 'border-green-300 dark:border-green-600',
                          hoverClass: 'hover:bg-green-200 dark:hover:bg-green-900/50',
                          icon: '✨',
                          label: 'New Arrivals'
                        };
                      case 'recommended':
                        return {
                          bgClass: 'bg-cyan-100 dark:bg-cyan-900/30',
                          textClass: 'text-cyan-700 dark:text-cyan-300',
                          borderClass: 'border-cyan-300 dark:border-cyan-600',
                          hoverClass: 'hover:bg-cyan-200 dark:hover:bg-cyan-900/50',
                          icon: '👍',
                          label: 'Recommended'
                        };
                      case 'sale':
                        return {
                          bgClass: 'bg-red-100 dark:bg-red-900/30',
                          textClass: 'text-red-700 dark:text-red-300',
                          borderClass: 'border-red-300 dark:border-red-600',
                          hoverClass: 'hover:bg-red-200 dark:hover:bg-red-900/50',
                          icon: '💰',
                          label: 'Sale Items'
                        };
                      case 'seasonal':
                        return {
                          bgClass: 'bg-orange-100 dark:bg-orange-900/30',
                          textClass: 'text-orange-700 dark:text-orange-300',
                          borderClass: 'border-orange-300 dark:border-orange-600',
                          hoverClass: 'hover:bg-orange-200 dark:hover:bg-orange-900/50',
                          icon: '🎃',
                          label: 'Seasonal'
                        };
                      case 'staff_pick':
                        return {
                          bgClass: 'bg-amber-100 dark:bg-amber-900/30',
                          textClass: 'text-amber-700 dark:text-amber-300',
                          borderClass: 'border-amber-300 dark:border-amber-600',
                          hoverClass: 'hover:bg-amber-200 dark:hover:bg-amber-900/50',
                          icon: '⭐',
                          label: 'Staff Picks'
                        };
                      case 'store_selection':
                        return {
                          bgClass: 'bg-purple-100 dark:bg-purple-900/30',
                          textClass: 'text-purple-700 dark:text-purple-300',
                          borderClass: 'border-purple-300 dark:border-purple-600',
                          hoverClass: 'hover:bg-purple-200 dark:hover:bg-purple-900/50',
                          icon: '🏪',
                          label: 'Store Selection'
                        };
                      case 'trending':
                        return {
                          bgClass: 'bg-rose-100 dark:bg-rose-900/30',
                          textClass: 'text-rose-700 dark:text-rose-300',
                          borderClass: 'border-rose-300 dark:border-rose-600',
                          hoverClass: 'hover:bg-rose-200 dark:hover:bg-rose-900/50',
                          icon: '🔥',
                          label: 'Trending'
                        };
                      default:
                        return {
                          bgClass: 'bg-blue-100 dark:bg-blue-900/30',
                          textClass: 'text-blue-700 dark:text-blue-300',
                          borderClass: 'border-blue-300 dark:border-blue-600',
                          hoverClass: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
                          icon: '⭐',
                          label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
                        };
                    }
                  };

                  const style = getButtonStyle(type);

                  return (
                    <button
                      key={type}
                      onClick={() => {
                        const element = document.getElementById(`${type}-section`);
                        element?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${style.bgClass} ${style.textClass} ${style.borderClass} ${style.hoverClass} transition-colors whitespace-nowrap`}
                      title={`Jump to ${style.label}`}
                    >
                      <span>{style.icon}</span>
                      <span>{style.label} ({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}


      {/* Status Panel - shows when products/categories are hidden */}
      {storefrontStatus.shouldShowPanel && storefrontStatus.tenant && (
        <div className="mb-8">
          <StorefrontStatusPanel tenantInfo={storefrontStatus.tenant as any} />
        </div>
      )}
      {/* Main Product Catalog Section - PRIMARY CONTENT (Above-the-Fold) */}
      {!storefrontStatus.shouldShowPanel && !isProductsOnly && products.length > 0 && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="py-8">

            {/* Product Search and Navigation */}
            <div className="mb-8">
              {/* Search Bar */}

              <div className="mb-6">
                <ProductSearch tenantId={tenantId} />
              </div>

            </div>

            {/* Category Navigation - hidden when status panel shows */}
            {!storefrontStatus.shouldShowPanel && (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Desktop Category Sidebar */}
                <div className="hidden lg:block lg:w-64 flex-shrink-0">
                  {showsCategoryProduct && <ProductCategorySidebar
                    tenantId={tenantId}
                    categories={categories}
                    totalProducts={totalItems || 0}
                  />}
                  {/* QR Code - under categories */}
                  {showsQRCodes && <TenantQRCode
                    url={currentUrl}
                    tenantId={tenantId}
                    label="Scan to Share"
                    downloadName={businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                    size={200}
                    showDownload={true}
                    className="mt-4"
                    pageType="storefront"
                    capabilityFlags={storefrontOptionFlags}
                  />}
                </div>

                {/* Mobile Category Dropdown */}
                <div className="lg:hidden">
                  {showsCategoryProduct && <CategoryMobileDropdown
                    tenantId={tenantId}
                    categories={categories}
                    totalProducts={totalItems || 0}
                  />}
                  {/* QR Code - under categories */}
                  {showsQRCodes && <TenantQRCode
                    url={currentUrl}
                    tenantId={tenantId}
                    label="Scan to Share"
                    downloadName={businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                    size={200}
                    showDownload={true}
                    className="mt-4"
                    pageType="storefront"
                    capabilityFlags={storefrontOptionFlags}
                  />}
                </div>

                {/* Main Content Area */}
                <div className="flex-1">
                  {/* Section Header */}
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
                      Store Inventory
                    </h2>
                    <p className="text-lg text-neutral-600 dark:text-neutral-400">
                      Browse our complete catalog of {totalItems} products
                      {search && ` matching "${search}"`}
                      {category && ` in ${categories.find((c: any) => c.slug === category)?.name || category}`} aisle
                    </p>


                  </div>

                  {/* Enhanced Product Display */}
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

                  {/* Pagination Info */}
                  {totalPages > 1 && (
                    <div className="mt-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
                      Page {currentPage} of {totalPages} • {totalItems} total products
                    </div>
                  )}

                  {/* Pagination Component */}
                  {totalPages > 1 && !storefrontStatus.shouldShowPanel && (
                    <div className="mt-6 flex justify-center">
                      <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems || 0}
                        pageSize={12}
                        onPageChange={(page) => {
                          const params = new URLSearchParams(window.location.search);
                          params.set('page', page.toString());
                          if (search) params.set('search', search);
                          if (category) params.set('category', category);
                          if (featured) params.set('featured', featured);
                          if (view) params.set('view', view);
                          const newUrl = `${window.location.pathname}?${params.toString()}`;
                          window.location.href = newUrl;
                        }}
                        onPageSizeChange={(size) => {
                          const params = new URLSearchParams(window.location.search);
                          params.set('page', '1');
                          params.set('limit', size.toString());
                          const newUrl = `${window.location.pathname}?${params.toString()}`;
                          window.location.href = newUrl;
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Featured Products Showcase - hidden when status panel shows */}
      {!storefrontStatus.shouldShowPanel && featuredData && featuredData.totalCount > 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
          <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                Featured Selections
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Discover our hand-picked selection of featured items
              </p>
            </div>

            {/* Featured Buckets with Products and Section IDs for Quick Jump */}
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
      {/* Gradient border line */}
      <div id="hours-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

      {/* Store Information Card - Consolidated Location, Contact, Hours */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {!storefrontStatus.shouldShowPanel && showsHours && showsHoursStatus && businessHours && isRetailStore && (
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                    <><h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Our Store Hours
                    </h3><BusinessHoursCollapsible businessHours={businessHours} /></>
                  </div>
                </div>

              </div>
            )}
            {/* Contact & Hours Sidebar */}
            <div className="space-y-6">

              {!storefrontStatus.shouldShowPanel && showsLocation && showsContact && contactInfo.address && (
                <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Contact
                  </h3>
                  <div className="space-y-3 text-sm">
                    {contactInfo.phone && (
                      <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400">
                        <span>📞</span> {contactInfo.phone}
                      </a>
                    )}
                    {contactInfo.email && (
                      <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400">
                        <span>✉️</span> {contactInfo.email}
                      </a>
                    )}
                    {contactInfo.website && (
                      <a href={contactInfo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400">
                        <span>🌐</span> Website
                      </a>
                    )}
                    {!contactInfo.phone && !contactInfo.email && !contactInfo.website && (
                      <p className="text-neutral-500 dark:text-neutral-400 italic">Contact information not available</p>
                    )}
                  </div>
                </div>
              )}
              {/* Map & Location */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden"  >
                  {!storefrontStatus.shouldShowPanel && showsLocation && showsContact && contactInfo.address && isRetailStore && (
                    <div className="p-6" >
                      <><h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                        Visit Our Store
                      </h3><p className="text-neutral-600 dark:text-neutral-400 mb-4">
                          {contactInfo.address}
                        </p><div className="flex items-center gap-2">
                          <HoursStatusBadge status={hoursStatus} size="lg" animate={showsAnimatedHours} />
                        </div><div className="flex items-center gap-2">
                          {hoursStatus?.label}
                        </div></>
                    </div>
                  )}
                  {/* Single Map Display */}
                  {!storefrontStatus.shouldShowPanel && showsMap && showsInteractiveMaps && isRetailStore && mapLocation ? (
                    <TenantMapSection location={mapLocation} />
                  ) : !storefrontStatus.shouldShowPanel && showsMap && showsInteractiveMaps && isRetailStore && contactInfo.address ? (
                    <GoogleMapEmbed address={contactInfo.address} height="h-80" showDirections={true} />
                  ) : tenant && showsMap && showsInteractiveMaps && (
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
                          phone: tenant.metadata?.phone
                        }
                      }}
                      primaryCategory={primaryGBPCategory?.name}
                      productCount={totalItems}

                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Fulfillment Options */}
          {!storefrontStatus.shouldShowPanel && showsFulfillment && (
            <FulfillmentOptionsPane tenantId={tenantId} compact={true} />
          )}
        </div>
      </div>
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
      {faqEnabled && tenantId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <FaqStorefrontDisplay
            tenantId={tenantId}
            enabled={faqEnabled}
            feedbackEnabled={faqFeedbackEnabled}
          />
        </div>
      )}

      {/* Contact / Inquiry Form */}
      {crmInquiryStorefrontEnabled && !storefrontStatus.shouldShowPanel && tenantId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-lg mx-auto">
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Send an Inquiry</h3>
                  <p className="text-xs text-neutral-500">Ask {businessName || 'this store'} a question</p>
                </div>
              </div>
              <PublicInquiryForm tenantId={tenantId} tenantName={businessName} sourceLabel="Storefront" />
            </div>
          </div>
        </div>
      )}

      {!storefrontStatus.shouldShowPanel && showsReviews && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div id="reviews-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent" ></div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
            <StoreRatingDisplay tenantId={tenantId} showWriteReview={true} isPublic={true} />
          </div>
        </div>
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

