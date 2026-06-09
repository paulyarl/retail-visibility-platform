'use client';

import Link from 'next/link';
import { useState, useEffect, use } from 'react';
import { MapPin, Phone, Mail, Globe, Clock, Share2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';

import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import DirectoryActions from '@/components/directory/DirectoryActions';
import StoreRatingsSection from '@/components/directory/StoreRatingsSection';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import { computeStoreStatus } from '@/lib/hours-utils';
import StoreDirectoryCategories from '@/components/directory/StoreDirectoryCategories';
import DirectoryKeywordTags from '@/components/directory/DirectoryKeywordTags';
import StoreViewTracker from '@/components/tracking/StoreViewTracker';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import ContactInformationCollapsible from '@/components/directory/ContactInformationCollapsible';
import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';
import ProductCategoriesCollapsible from '@/components/directory/ProductCategoriesCollapsible';
import SmartProductCard from '@/components/products/SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { externalApiService } from '@/services/ExternalApiService';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';
import { tenantPublicService } from '@/services/TenantPublicService';

// tenant public data
import { directoryService } from '@/services/DirectorySingletonService';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';

// recommendation data
import { recommendationsService } from '@/services/RecommendationsSingletonService';
// import StorefrontFeaturedProducts from '@/components/storefront/StorefrontFeaturedProducts';
import LastViewed from '@/components/directory/LastViewed';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { publicStorefrontOptionsService, StorefrontOptionFlags } from '@/services/PublicStorefrontOptionsService';
import { publicFaqService, PublicFaqOptionsFlags } from '@/services/PublicFaqService';
import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import { publicFeaturedOptionsService, FeaturedOptionsSettings } from '@/services/PublicFeaturedOptionsService';

// Merchant gate helper for client-side filtering
function filterFeaturedProductsByMerchantPreferences(
  products: any[],
  prefs: FeaturedOptionsSettings | null
): any[] {
  if (!prefs || !prefs.featured_enabled) return [];
  return products.filter(product => {
    const type = product.featuredType || 'store_selection';
    const key = `featured_${type}` as keyof FeaturedOptionsSettings;
    return prefs[key] === true;
  });
}

// tenant private data
import { tenantDirectoryService } from '@/services/TenantDirectorySingletonService';

// platform branding
import { PoweredByFooter } from '@/components/PoweredByFooter';

// shopping cart
import { useMultiCart } from '@/hooks/useMultiCart';
import { useRouter } from 'next/navigation';

// store status
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { useStorefrontCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface StoreDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

type DirectoryResult =
  | { type: 'listing'; data: any }
  | { type: 'pending'; tenantId: string }
  | null;

async function getConsolidatedDirectoryData(identifier: string): Promise<DirectoryResult> {
  try {
    // First, try to load as a slug (most common case)
    const data = await directoryService.getDirectoryConsolidated(identifier);

    if (data?.listing) {
      return { type: 'listing', data };
    }

    // No listing — try resolving identifier (slug or tenantId) to a tenant
    const status = await tenantDirectoryService.getTenantDirectoryStatus(identifier);

    if (!status) {
      return null; // Identifier not found anywhere — true 404
    }

    if (!status.hasDirectoryListing || !status.slug) {
      // Tenant exists but directory listing is not published
      return { type: 'pending', tenantId: status.tenantId || identifier };
    }

    // Has published slug — fetch by slug
    const resolvedData = await directoryService.getDirectoryConsolidated(status.slug);
    if (resolvedData?.listing) {
      return { type: 'listing', data: resolvedData };
    }

    return null;
  } catch (error) {
    console.error(`[Directory] Error fetching consolidated directory data for ${identifier}:`, error);
    return null;
  }
}

async function getStorefrontCategories(tenantId: string) {
  try {
    const data = await directoryService.getStorefrontCategories(tenantId);
    return data;
  } catch (error) {
    console.error('Error fetching storefront categories:', error);
    return { categories: [], uncategorizedCount: 0 };
  }
}

async function getActualProductCount(tenantId: string) {
  try {
    const count = await directoryService.getStorefrontProductCount(tenantId);
    return count;
  } catch (error) {
    console.error('Error fetching actual product count:', error);
    return 0;
  }
}

async function getBusinessProfile(tenantId: string) {
  try {
    const profile = await directoryService.getBusinessProfile(tenantId);
    return profile;
  } catch (error) {
    console.error('Error fetching business profile:', error);
    return null;
  }
}

async function getBusinessHours(tenantId: string) {
  try {
    const data = await directoryService.getBusinessHours(tenantId);
    if (!data || !data.success || !data.data) return null;

    const hoursData = data.data;

    // Handle both response formats: periods array or day-based object
    if (hoursData.periods && Array.isArray(hoursData.periods)) {
      const { periods, timezone } = hoursData;
      const hours: any = { timezone };

      // Convert periods to day-based format for BusinessHoursDisplay
      periods.forEach((period: any) => {
        const dayName = period.day?.toUpperCase(); // Keep uppercase for BusinessHoursDisplay
        if (dayName && !hours[dayName]) {
          hours[dayName] = {
            open: period.open,
            close: period.close
          };
        }
      });

      // Include periods array for BusinessHoursDisplay to handle multiple periods
      if (periods.length > 0) {
        hours.periods = periods;
      }

      return hours;
    } else {
      // Assume data is already in day-based format
      return hoursData;
    }
  } catch (error) {
    console.error('Error fetching business hours:', error);
    return null;
  }
}

async function getFeaturedProducts(tenantId: string, limit: number = 6) {
  try {
    // Use the featured products endpoint with store_selection type for directory
    const items = await directoryService.getFeaturedProducts(tenantId, limit);
    return items;
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return [];
  }
}

async function getRelatedProducts(categorySlug: string, excludeTenantId: string, limit: number = 6) {
  try {
    // First, get stores in the same category (from directory MV)
    const storesData = await directoryService.getStoresByCategoryForProducts(categorySlug, 10);
    const otherStores = storesData
      .filter((l: any) => l.tenant_id !== excludeTenantId)
      .slice(0, 3); // Get 3 other stores

    // Now fetch products from those stores using storefront_products MV
    const productPromises = otherStores.map(async (store: any) => {
      try {
        const productsData = await directoryService.getStorefrontProducts(store.tenant_id, 2);
        return productsData.map((p: any) => ({
          ...p,
          storeName: store.business_name,
          storeSlug: store.slug,
        }));
      } catch (error) {
        return [];
      }
    });

    const allProducts = (await Promise.all(productPromises)).flat();
    return allProducts.slice(0, limit);
  } catch (error) {
    console.error('Error fetching related products:', error);
    return [];
  }
}

// NEW: Track store view for recommendations
async function trackStoreView(tenantId: string, categories: any[] = []) {
  try {
    // Get user location (reuse existing logic)
    const location = await getUserLocation();

    // Get primary category for context
    const primaryCategory = categories.find((c: any) => c.isPrimary) || categories[0];

    await recommendationsService.trackRecommendations({
      entityType: 'store',
      entityId: tenantId,
      entityName: '', // Will be populated by API
      context: {
        category_id: primaryCategory?.id,
        category_slug: primaryCategory?.slug,
        categories: categories.map((c: any) => ({ id: c.id, slug: c.slug }))
      },
      locationLat: location?.latitude,
      locationLng: location?.longitude,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      pageType: 'directory_detail'
    });
  } catch (error) {
    console.error('Error tracking store view:', error);
    // Don't throw - tracking failures shouldn't break the page
  }
}

// NEW: Get store recommendations
async function getStoreRecommendations(tenantId: string, categorySlug?: string) {
  try {
    // Get user location
    const location = await getUserLocation();

    const params: any = {};
    if (categorySlug) params.category = categorySlug;
    if (location) {
      params.lat = location.latitude.toString();
      params.lng = location.longitude.toString();
    }

    const response = await recommendationsService.getStorefrontRecommendations(tenantId, params);

    if (!response) return { recommendations: [] };

    return response;
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return { recommendations: [] };
  }
}

// NEW: Get user location (reuse from DirectoryClient)
async function getUserLocation(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  state: string;
} | null> {
  try {
    // Try browser geolocation first
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocoding to get city/state using service
      const data = await externalApiService.reverseGeocode(latitude, longitude, { usePublicContext: true });

      if (data && data.address) {
        const address = data.address;
        const city = address.city || address.town || address.village || 'Unknown';
        const state = address.state || 'Unknown';
        return { latitude, longitude, city, state };
      }

      return { latitude, longitude, city: 'Unknown', state: 'Unknown' };
    }
  } catch (error) {
    console.warn('Geolocation failed, falling back to IP-based location');
  }

  // Fallback to IP-based location
  try {
    // Get user context for unique cache key to prevent cross-contamination
    const getUserIdFromContext = () => {
      if (typeof window !== 'undefined') {
        const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
        if (userId) return userId;

        const cookies = document.cookie.split(';');
        const userIdCookie = cookies.find(cookie => cookie.trim().startsWith('userId='));
        if (userIdCookie) return userIdCookie.split('=')[1]?.trim();
      }
      return null;
    };

    const getSessionIdFromContext = () => {
      if (typeof window !== 'undefined') {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
          sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
      }
      return null;
    };

    const userId = getUserIdFromContext();
    const sessionId = getSessionIdFromContext();
    const userContext = userId || sessionId || 'anonymous';
    const cacheKey = `ip-geolocation-${userContext}`;

    const ipLocation = await externalApiService.getIpGeolocation(cacheKey);

    if (!ipLocation || !ipLocation.latitude || !ipLocation.longitude) {
      console.warn('Invalid location data received from external API');
      return null;
    }

    return {
      latitude: ipLocation.latitude,
      longitude: ipLocation.longitude,
      city: ipLocation.city || 'Unknown',
      state: ipLocation.region || 'Unknown'
    };
  } catch (error) {
    console.warn('Failed to get IP location:', error);
    return null;
  }
}

export default function StoreDetailPage({ params }: StoreDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [consolidatedData, setConsolidatedData] = useState<any>(null);
  // console.log(`[Directory] consolidatedData:`, consolidatedData);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  // const businessProfile = tempbusinessProfile?.data;
  // console.log(`[Directory] tempbusinessProfile:`, tempbusinessProfile);
  // console.log(`[Directory] businessProfile:`, businessProfile);
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [storefrontCategories, setStorefrontCategories] = useState<any>({ categories: [], uncategorizedCount: 0 });
  // console.log(`[Directory] storefrontCategories:`, storefrontCategories);
  const [actualProductCount, setActualProductCount] = useState<number>(0);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  // console.log(`[Directory] tenantInfo:`, tenantInfo);
  const [slugForRelated, setSlugForRelated] = useState<string>('');
  const [featuredOptionsSettings, setFeaturedOptionsSettings] = useState<FeaturedOptionsSettings | null>(null);
  const [faqFlags, setFaqFlags] = useState<PublicFaqOptionsFlags | null>(null);

  const router = useRouter();
  const { totalItems } = useMultiCart(); // Show total items across ALL carts, not just this tenant
  const { status: hoursStatus } = useStoreStatus(consolidatedData?.listing?.tenantId || '', true); // Public scope

  // Storefront capability-driven content control
  const storefrontCap = useStorefrontCapability(consolidatedData?.listing?.tenantId || null);
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? true;
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'both';
  const isOnlineStore = storefrontCap.data?.type === 'online' || storefrontCap.data?.type === 'both';
  const isServiceStore = storefrontCap.data?.type === 'service' || storefrontCap.data?.type === 'both';
  // showsHours/showsMap/showsLocation now come from storefront_options (merchant-controlled)
  // storefront_type (platform-controlled) still determines isRetailStore/isOnlineStore/isServiceStore

  // Storefront options capability flags (fetched in parallel with other data below)
  const [optFlags, setOptFlags] = useState<StorefrontOptionFlags | null>(null);

  // Derived visibility flags from optFlags (merchant-controlled)
  const showsHours = optFlags?.showHoursDisplay ?? true;
  const showsMap = optFlags?.showMapDisplay ?? true;
  const showsLocation = optFlags?.showLocationDisplay ?? true;

  // Pending publication state (tenant exists but no directory listing)
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);

  // Explicit not-found state (notFound() inside useEffect is unreliable in client components)
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { slug: identifier } = await params;
        const result = await getConsolidatedDirectoryData(identifier);

        if (result === null) {
          setIsNotFound(true);
          setLoading(false);
          return;
        }

        if (result.type === 'pending') {
          setPendingTenantId(result.tenantId);
          setLoading(false);
          return;
        }

        // result.type === 'listing'
        const data = result.data;
        setConsolidatedData(data);

        // Fetch tenant logo
        const logo = await publicTenantInfoService.getTenantLogoFromDiscovery(data.listing.tenantId);
        setTenantLogo(logo);

        // Get primary category for additional data fetching
        const primaryCategory = data.listing.categories?.find((c: any) => c.isPrimary) || data.listing.categories?.[0];

        // Fetch remaining data that's not in the consolidated endpoint
        const [
          profile,
          hours,
          related,
          categories,
          productCount,
          optionFlags,
          featuredPrefs,
          faqOptionFlags
        ] = await Promise.all([
          getBusinessProfile(data.listing.tenantId),
          getBusinessHours(data.listing.tenantId),
          primaryCategory ? getRelatedProducts(primaryCategory.slug, data.listing.tenantId, 6) : Promise.resolve([]),
          getStorefrontCategories(data.listing.tenantId),
          getActualProductCount(data.listing.tenantId),
          publicStorefrontOptionsService.getStorefrontOptionFlags(data.listing.tenantId),
          publicFeaturedOptionsService.getFeaturedOptionsSettings(data.listing.tenantId),
          publicFaqService.getFaqOptionsFlags(data.listing.tenantId)
        ]);

        setBusinessProfile(profile?.data);
        setBusinessHours(hours);
        setRelatedProducts(related);
        setStorefrontCategories(categories);
        setActualProductCount(productCount);
        if (optionFlags) setOptFlags(optionFlags);
        if (featuredPrefs) setFeaturedOptionsSettings(featuredPrefs);
        if (faqOptionFlags) setFaqFlags(faqOptionFlags);

        // Fetch tenant info for status panel
        const info = await tenantPublicService.getPublicTenantInfo(data.listing.tenantId);
        setTenantInfo(info);

        // Resolve slug for RelatedStores using publicDirectoryService
        const idResolvedBySlug = await publicDirectoryService.resolveBySlug(identifier);
        setSlugForRelated(idResolvedBySlug || identifier);

        // Track user behavior for recommendations (fire and forget, don't await)
        trackStoreView(data.listing.tenantId, data.listing.categories).catch(err =>
          console.error('Failed to track store view:', err)
        );

      } catch (error) {
        console.error('Error fetching store data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params]);

  if (isNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Store Not Found</h1>
          <p className="text-gray-600 mb-6">
            We couldn&apos;t find a store with that name. It may have been removed or the URL might be incorrect.
          </p>
          <Link
            href="/directory"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Directory
          </Link>
        </div>
      </div>
    );
  }

  if (pendingTenantId) {
    return <StoreComingSoon tenantId={pendingTenantId} />;
  }

  if (loading || !consolidatedData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const listing = consolidatedData.listing;
  const featuredProductsRaw = consolidatedData.featuredProducts || [];
  // TODO: Remove this temporary logging once we confirm the data is being fetched correctly
  // console.log('[Directory Page] Featured products raw data:', featuredProductsRaw);
  const storeTypes = consolidatedData.storeTypes || [];
  const categoryCounts = consolidatedData.categoryCounts || [];
  const recommendations = consolidatedData.recommendations || [];
  const paymentGatewayStatus = consolidatedData.paymentGatewayStatus || { hasActiveGateway: false, defaultGatewayType: null };

  // Deduplicate featured products by ID to prevent React key conflicts
  const dedupedFeaturedProducts = featuredProductsRaw.filter((product: any, index: number, arr: any[]) => {
    const productId = product.id || product.inventory_item_id;
    return arr.findIndex((p: any) => (p.id || p.inventory_item_id) === productId) === index;
  });

  // Apply merchant gate filtering to featured products
  const featuredProducts = filterFeaturedProductsByMerchantPreferences(dedupedFeaturedProducts, featuredOptionsSettings);

  // Compute store status from business hours data
  const storeStatus = businessHours ? computeStoreStatus(businessHours) : null;

  const fullAddress = [
    listing.address,
    listing.city,
    listing.state,
    listing.zipCode,
  ].filter(Boolean).join(', ');

  const resolvedParams = use(params);
  const { slug: identifier } = resolvedParams;
  // Use NEXT_PUBLIC_ prefixed var for client-side access, fallback to window.location.origin
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : process.env.WEB_URL) || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/directory/${identifier}`;

  // Server-side check: show panel for google_only tier, non-active status, or subscription issues
  const showStatusPanel = tenantInfo ? (
    tenantInfo.subscriptionTier === 'google_only' ||
    tenantInfo.subscriptionTier === 'discovery' ||
    (tenantInfo.locationStatus && tenantInfo.locationStatus !== 'active') ||
    (tenantInfo.statusInfo && !tenantInfo.statusInfo.showStorefront) ||
    tenantInfo.showSubscriptionPanel === true
  ) : false;

  // Handle view cart
  const handleViewCart = () => {
    router.push('/carts');
  };

  return (
    <>
      {/* Structured Data for SEO */}
      <LocalBusinessStructuredData listing={listing} url={currentUrl} />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: baseUrl },
          { name: 'Directory', url: `${baseUrl}/directory` },
          { name: listing.businessName, url: currentUrl },
        ]}
      />

      {/* Client-side store tracking */}
      <StoreViewTracker tenantId={listing.tenantId} storeName={listing.businessName} categories={listing.categories} />

      <div className="min-h-screen bg-gray-50">
        {/* Header with Visit Storefront Banner */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/directory"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Directory
            </Link>


            {/* Status Panel or Visit Storefront Hero Banner */}
            {showStatusPanel && tenantInfo ? (
              <div className="mt-4">
                <StorefrontStatusPanel tenantInfo={tenantInfo} />
              </div>
            ) : (
              <div className="mt-4 bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 border-2 border-blue-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-8 sm:px-8 sm:py-10 text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                    Shop {listing.businessName}
                  </h2>
                  <p className="text-gray-700 mb-6 text-sm sm:text-base max-w-2xl mx-auto">
                    Browse {actualProductCount > 0 ? actualProductCount : (listing.productCount ?? 0)} products and shop directly from their online storefront
                  </p>
                  <Link
                    href={`${slugForRelated ? `/tenant/${slugForRelated}` : `/tenant/${listing.tenantId}`}`}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-md"
                  >
                    <Globe className="w-5 h-5" />
                    Visit Storefront
                  </Link>
                  {storefrontCategories.categories.length > 0 && (
                    <div className="mt-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                        <svg className="w-4 h-4 mr-1.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {actualProductCount > 0 ? actualProductCount : (listing.productCount || 0)} products available
                      </span>
                    </div>
                  )}
                </div>

                <div className="px-4 py-4 lg:px-4 lg:py-4 text-center">


                  {/* Hours Badge - Status */}
                  {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && isRetailStore && (
                    <HoursStatusBadge status={hoursStatus} size='lg' animate={optFlags?.showAnimatedHours !== false} />
                  )}

                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {/* Main Content Column */}
            <div className="space-y-6">
              {/* Store Header */}
              {tenantLogo && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start gap-6">
                    {listing.logoUrl && (
                      <img
                        src={listing.logoUrl}
                        alt={listing.businessName}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold text-gray-900">
                        {listing.businessName}
                      </h1>

                      {/* GBP Categories - Clean badges below store name */}
                      {tenantInfo && listing.categories && listing.categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {listing.categories && (
                            listing.categories
                              .sort((a: any, b: any) => {
                                if (a.isPrimary && !b.isPrimary) return -1;
                                if (!a.isPrimary && b.isPrimary) return 1;
                                return a.name.localeCompare(b.name);
                              }).map((category: any, index: number) => (
                                <Link
                                  key={category.id || index}
                                  href={`/directory/categories/${category.slug}`}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category.isPrimary
                                    ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                    }`}
                                  title={`Browse all ${category.name} stores`}>
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
                                    {category.name === 'Specialty food store' && '🍱'}
                                    {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store', 'Specialty food store'].includes(category.name) && '🏢'}
                                  </span>
                                  <span>{category.name}</span>
                                </Link>
                              ))
                          )
                          }
                        </div>
                      )}
                      <div id="gallery-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

                      {/* Keywords */}
                      {listing.keywords && listing.keywords.length > 0 && (
                        <div className="mt-3">
                          <DirectoryKeywordTags keywords={listing.keywords} />
                        </div>
                      )}
                    </div>
                  </div>
                  {!showStatusPanel && showsHours && isRetailStore && (
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <a href={`/tenant/${slugForRelated ? slugForRelated : listing.tenantId}`}
                        className="flex items-left gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                        title="View Store Products">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <span className="hidden lg:inline">Products</span>
                      </a>
                      <a href={`/shops/${slugForRelated ? slugForRelated : listing.tenantId}`}
                        className="flex items-left gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                        title="View Store in Shops">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4zm0 0v10a2 2 0 002 2h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" />
                        </svg>
                        <span className="hidden lg:inline">Shop</span>
                      </a>

                      <a onClick={() => {
                        const reviewsSection = document.getElementById('hours-section');
                        if (reviewsSection) {
                          reviewsSection.scrollIntoView({ behavior: 'smooth' });
                        }
                      }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                        title="View Store Hours">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden lg:inline">Hours</span>
                      </a>
                      {/* Share/Print Actions - Right side */}
                      {!showStatusPanel && optFlags?.showStorefrontActions !== false && (
                        <DirectoryActions
                          listing={{
                            business_name: listing.businessName,
                            slug: listing.slug,
                            tenantId: listing.tenantId,
                            id: listing.id
                          }}
                          currentUrl={currentUrl}
                        />
                      )}
                    </div>
                  )}

                </div>
              )}

              {/* Featured Products - hidden when status panel shows */}
              {!showStatusPanel && featuredProducts.length > 0 && (
                <TenantPaymentProvider tenantId={listing.tenantId}>
                  <div id="products-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-green-500 to-transparent" />
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Store Selections</h2>
                      <Link
                        href={`/tenant/${slugForRelated ? slugForRelated : listing.tenantId}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All Products →
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(() => {
                        // console.log('[Directory Page] Mapping featured products:', featuredProducts.map((p: any) => ({
                        //   id: p.id,
                        //   name: p.name,
                        //   priceCents: p.priceCents,
                        //   salePriceCents: p.salePriceCents,
                        //   hasSale: !!p.salePriceCents
                        // })));
                        return featuredProducts.map((product: any) => (
                          <SmartProductCard
                            key={`directory-featured-${product.id}`}
                            tenantId={listing.tenantId}
                            product={{
                              id: product.id,
                              sku: product.sku || product.id,
                              name: product.name || product.title,
                              title: product.title || product.name,
                              brand: product.brand,
                              description: product.description,
                              priceCents: product.priceCents || Math.round((product.price || 0) * 100),
                              salePriceCents: product.salePriceCents,
                              stock: product.stock || 999,
                              imageUrl: product.imageUrl || product.image_url,
                              tenantId: listing.tenantId,
                              availability: product.availability || 'in_stock',
                              tenantCategory: product.tenantCategory,
                              productCategory: product.category_name,
                              has_variants: product.has_variants,
                              // Use fresh payment gateway status from consolidated data instead of inconsistent context
                              payment_gateway_type: paymentGatewayStatus.defaultGatewayType,
                              featuredType: product.featuredType,
                              featuredTypes: product.featuredTypes || (product.featuredType ? [product.featuredType] : []),
                            }}
                            tenantName={listing.businessName}
                            tenantLogo={tenantLogo?.toString() || listing.logoUrl}
                            defaultGatewayType={paymentGatewayStatus.defaultGatewayType}
                            variant="featured"
                            showCategory={true}
                            showDescription={true}                            
                          />
                        ))
                      })()}
                    </div>
                  </div>
                </TenantPaymentProvider>
              )}

              {/* Business Description - Brief Trust Building */}
              {(!showStatusPanel && (businessProfile?.business_description || businessProfile?.businessDescription)) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">About {listing.businessName}</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">
                      {((businessProfile.business_description || businessProfile.businessDescription)?.length || 0) > 200
                        ? `${(businessProfile.business_description || businessProfile.businessDescription)?.substring(0, 200)}...`
                        : (businessProfile.business_description || businessProfile.businessDescription)
                      }
                    </p>
                  </div>
                </div>
              )}


              {/* Photo Gallery - Visual Proof */}
              {!showStatusPanel && (
                <DirectoryPhotoGalleryDisplay listing={listing} {...businessProfile} isPublished={true} />
              )}


              {/* Product Categories - Browse More */}
              {!showStatusPanel && storefrontCategories.categories.length > 0 && (
                <div className="space-y-4">
                  <ProductCategoriesCollapsible
                    categories={storefrontCategories.categories}
                    tenantId={listing.tenantId}
                    uncategorizedCount={storefrontCategories.uncategorizedCount}
                  />
                  {/* QR Code - under categories */}
                  <TenantQRCode
                    url={currentUrl}
                    tenantId={listing.tenantId}
                    label="Scan to Share"
                    downloadName={listing.businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                    size={200}
                    showDownload={true}
                    className="mt-4"
                    pageType="directory"
                    capabilityFlags={optFlags}
                  />
                </div>
              )}


              {/* FAQ Section */}
              {faqFlags?.faq_enabled && faqFlags?.faq_display_storefront_accordion && consolidatedData?.listing?.tenantId && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <FaqStorefrontDisplay
                    tenantId={consolidatedData.listing.tenantId}
                    enabled={faqFlags.faq_enabled && faqFlags.faq_display_storefront_accordion}
                    feedbackEnabled={faqFlags.faq_enabled && faqFlags.faq_display_feedback}
                    defaultExpanded={false}
                  />
                </div>
              )}

              {/* Store Ratings and Reviews - Social Proof */}
              {!showStatusPanel && (
                <div id="reviews-section" className="flex w-full">
                  <StoreRatingsSection tenantId={listing.tenantId} showWriteReview={true} />
                </div>
              )}
            </div>

            {/* Right Column - Contact Info */}
            {!showStatusPanel && showsHours && optFlags?.showContact !== false && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Contact
                  </h2>
                  <div>
                    <ContactInformationCollapsible tenant={listing} fullAddress={showsLocation ? fullAddress : ''} initialExpanded={true} isRetailStore={isRetailStore} />
                    <div id="contact-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                  </div>


                  {/* Social Links */}
                  {optFlags?.showSocialMedia !== false && (businessProfile?.social_links || businessProfile?.socialLinks) && Object.keys(businessProfile.social_links || businessProfile.socialLinks).length > 0 && (
                    <div className="pt-3 border-t border-neutral-200 dark:border-neutral-600 mt-3">
                      <h2 className="text-lg font-semibold text-neutral-500 dark:text-neutral-400 mb-3">Follow Us</h2>
                      <div className="flex flex-wrap gap-4">
                        {businessProfile.social_links?.facebook || businessProfile.socialLinks?.facebook && (
                          <a
                            href={businessProfile.social_links?.facebook || businessProfile.socialLinks?.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                            title="Facebook"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links?.instagram || businessProfile.socialLinks?.instagram && (
                          <a
                            href={businessProfile.social_links?.instagram || businessProfile.socialLinks?.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-pink-600 hover:text-pink-700 transition-colors"
                            title="Instagram"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.162c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links?.twitter || businessProfile.socialLinks?.twitter && (
                          <a
                            href={businessProfile.social_links?.twitter || businessProfile.socialLinks?.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-500 transition-colors"
                            title="Twitter/X"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links?.linkedin || businessProfile.socialLinks?.linkedin && (
                          <a
                            href={businessProfile.social_links?.linkedin || businessProfile.socialLinks?.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-700 hover:text-blue-800 transition-colors"
                            title="LinkedIn"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0C9.958 0 0 9.958 0 22.225c0 12.268 9.958 22.225 22.225 22.225s22.225-9.958 22.225-22.225C44.45 9.958 34.492 0 22.225 0zM14.818 30.055a.5.5 0 01-.5.5h-4.263a.5.5 0 01-.5-.5V14.218a.5.5 0 01.5-.5h4.263a.5.5 0 01.5.5v15.837zM10.555 11.685a2.555 2.555 0 11-5.11 0 2.555 2.555 0 015.11 0zM32.408 30.055a.5.5 0 01-.5.5h-4.263a.5.5 0 01-.5-.5V20.218a4.894 4.894 0 00-1.685-.578 4.685 4.685 0 00-1.938.245 3.654 3.654 0 00-1.563 1.5 3.654 3.654 0 00-.245 1.563v7.107a.5.5 0 01-.5.5h-4.263a.5.5 0 01-.5-.5v-15.837a.5.5 0 01.5-.5h4.263a.5.5 0 01.5.5v.5c1.5-1.5 3.5-2 5.5-1.5 2 0 4 .5 5.5 2v-.5a.5.5 0 01.5-.5h4.263a.5.5 0 01.5.5v10.837z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links?.youtube || businessProfile.socialLinks?.youtube && (
                          <a
                            href={businessProfile.social_links?.youtube || businessProfile.socialLinks?.youtube}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors"
                            title="YouTube"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M23.498 6.186c-.885-1.76-3.11-1.76-3.996 0L9.84 19.91c-.78 1.552.195 3.496 1.998 3.496h18.324c1.803 0 2.777-1.944 1.998-3.496L23.498 6.186zM24 29.5c-5.247 0-9.5-4.253-9.5-9.5s4.253-9.5 9.5-9.5 9.5 4.253 9.5 9.5-4.253 9.5-9.5 9.5zm0-15c-3.038 0-5.5 2.462-5.5 5.5s2.462 5.5 5.5 5.5 5.5-2.462 5.5-5.5-2.462-5.5-5.5-5.5z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links?.tiktok || businessProfile.socialLinks?.tiktok && (
                          <a
                            href={businessProfile.social_links?.tiktok || businessProfile.socialLinks?.tiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-700 hover:text-gray-800 transition-colors"
                            title="TikTok"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M24 4.5c11.046 0 20 8.954 20 20s-8.954 20-20 20S4 35.546 4 24.5 12.954 4.5 24 4.5zm0 36c8.837 0 16-7.163 16-16s-7.163-16-16-16-16 7.163-16 16 7.163 16 16 16zm-4.5-22.5v15c0 .414.336.75.75.75s.75-.336.75-.75v-5.25h3c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-3V18h3c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-3.75c-.414 0-.75.336-.75.75v7.5h-1.5V18zm7.5 0v15c0 .414.336.75.75.75s.75-.336.75-.75V18h3.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H27zm-15-3v15c0 .414.336.75.75.75s.75-.336.75-.75V15h3.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H12zm30 0v15c0 .414.336.75.75.75s.75-.336.75-.75V15h3.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H42z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Business Hours - Collapsible */}
            {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && businessHours && isRetailStore && (
              <>
                <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                <div id="hours-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              </>
            )}

            {/* Map Location */}
            {!showStatusPanel && showsMap && optFlags?.showInteractiveMaps !== false && listing.address && isRetailStore && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div id="map-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Our Location
                </h2>
                <GoogleMapEmbed address={listing.address} />
              </div>
            )}
          </div>
        </div>
      </div >

      {/* Related Stores */}
      {
        !showStatusPanel && (
          <RelatedStores
            currentSlug={slugForRelated}
            limit={3}
            title="Similar Stores"
          />
        )
      }

      {/* Recently Viewed */}
      {optFlags?.showRecentlyViewed !== false && <LastViewed />}

      {/* Platform Branding Footer */}
      <PoweredByFooter />
    </>
  );
}

function StoreComingSoon({ tenantId }: { tenantId: string }) {
  const { data: storefrontCapability } = useStorefrontCapability(tenantId);
  const storefrontEnabled = storefrontCapability?.enabled ?? false;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Store Coming Soon
        </h1>

        <p className="text-gray-600 mb-6 leading-relaxed">
          This store&apos;s directory listing is pending publication.
          Please check back soon to see their full storefront and product catalog.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-yellow-800">
            Awaiting publication
          </span>
        </div>

        {storefrontEnabled && (
          <Link
            href={`/tenant/${tenantId}`}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors mb-4"
          >
            <Globe className="w-5 h-5 mr-2" />
            Visit Storefront
          </Link>
        )}

        <Link
          href="/directory"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Browse Directory
        </Link>
      </div>
    </div>
  );
}

