'use client';

import Link from 'next/link';
import { useState, useEffect, use } from 'react';
import { MapPin, Phone, Mail, Globe, Clock, Share2, ArrowLeft, ChevronDown, ChevronUp, XCircle } from 'lucide-react';

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
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import { StorefrontOptionFlags, PublicCrmOptionsFlags, type FeaturedOptionsState, type DirectoryEntryOptionsState, type DirectoryEntryLayoutKey } from '@/services/CapabilityResolutionService';
import { publicFaqService } from '@/services/PublicFaqService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';
import {
  DirectoryEntryClassicLayout,
  DirectoryEntryEditorialLayout,
  DirectoryEntryImmersiveLayout,
  DirectoryEntryPremiumLayout,
} from './layouts';

// Merchant gate helper for client-side filtering
function filterFeaturedProductsByMerchantPreferences(
  products: any[],
  state: FeaturedOptionsState | null
): any[] {
  const prefs = state?.merchantPreferences;
  if (!prefs || !prefs.featured_enabled) return [];
  return products.filter(product => {
    const type = product.featuredType || 'store_selection';
    const key = `featured_${type}` as keyof FeaturedOptionsState['merchantPreferences'];
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
  const [featuredOptionsState, setFeaturedOptionsState] = useState<FeaturedOptionsState | null>(null);
  const [faqFlags, setFaqFlags] = useState<PublicFaqOptionsFlags | null>(null);
  const [crmFlags, setCrmFlags] = useState<PublicCrmOptionsFlags | null>(null);
  const [directoryEntryOptions, setDirectoryEntryOptions] = useState<DirectoryEntryOptionsState | null>(null);
  const [layoutPreview, setLayoutPreview] = useState<DirectoryEntryLayoutKey | null>(null);

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
        // Read layout preview from query param
        if (typeof window !== 'undefined') {
          const paramsUrl = new URLSearchParams(window.location.search);
          const preview = paramsUrl.get('layout_preview');
          if (preview === 'classic' || preview === 'editorial' || preview === 'immersive' || preview === 'premium') {
            setLayoutPreview(preview);
          }
        }

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
          faqOptionFlags,
          crmOptionFlags,
          dirEntryOptions
        ] = await Promise.all([
          getBusinessProfile(data.listing.tenantId),
          getBusinessHours(data.listing.tenantId),
          primaryCategory ? getRelatedProducts(primaryCategory.slug, data.listing.tenantId, 6) : Promise.resolve([]),
          getStorefrontCategories(data.listing.tenantId),
          getActualProductCount(data.listing.tenantId),
          unifiedCapabilityService.getStorefrontOptionFlags(data.listing.tenantId),
          unifiedCapabilityService.getFeaturedOptionsState(data.listing.tenantId),
          unifiedCapabilityService.getFaqOptionsFlags(data.listing.tenantId),
          unifiedCapabilityService.getCrmOptionsFlags(data.listing.tenantId),
          unifiedCapabilityService.getDirectoryEntryOptionsState(data.listing.tenantId)
        ]);

        setBusinessProfile(profile?.data);
        setBusinessHours(hours);
        setRelatedProducts(related);
        setStorefrontCategories(categories);
        setActualProductCount(productCount);
        if (optionFlags) setOptFlags(optionFlags);
        if (featuredPrefs) setFeaturedOptionsState(featuredPrefs);
        if (faqOptionFlags) setFaqFlags(faqOptionFlags);
        if (crmOptionFlags) setCrmFlags(crmOptionFlags);
        if (dirEntryOptions) setDirectoryEntryOptions(dirEntryOptions);

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
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Store Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            We couldn&apos;t find a store with that name. It may have been removed or the URL might be incorrect.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-8">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-sm font-medium text-red-800 dark:text-red-300">
              No Listing Found
            </span>
          </div>
          <Link
            href="/directory"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
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
  const featuredProducts = filterFeaturedProductsByMerchantPreferences(dedupedFeaturedProducts, featuredOptionsState);

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

  const effectiveLayout: DirectoryEntryLayoutKey = layoutPreview
    ?? directoryEntryOptions?.effectiveLayout
    ?? 'classic';

  const layoutProps = {
    tenantId: listing.tenantId,
    listing,
    tenantLogo,
    businessProfile,
    businessHours,
    storefrontCategories,
    featuredProducts,
    relatedProducts,
    tenantInfo,
    slugForRelated,
    optFlags,
    showStatusPanel,
    hoursStatus,
    isRetailStore,
    isOnlineStore,
    isServiceStore,
    showsHours,
    showsMap,
    showsLocation,
    currentUrl,
    baseUrl,
    faqFlags,
    crmFlags,
    paymentGatewayStatus,
    featuredOptionsState,
    actualProductCount,
    storeStatus,
    fullAddress,
  };

  switch (effectiveLayout) {
    case 'editorial':
      return <DirectoryEntryEditorialLayout {...layoutProps} />;
    case 'immersive':
      return <DirectoryEntryImmersiveLayout {...layoutProps} />;
    case 'premium':
      return <DirectoryEntryPremiumLayout {...layoutProps} />;
    case 'classic':
    default:
      return <DirectoryEntryClassicLayout {...layoutProps} />;
  }

  /* === OLD JSX REMOVED === */
}

function StoreComingSoon({ tenantId }: { tenantId: string }) {
  const { data: storefrontCapability } = useStorefrontCapability(tenantId);
  const storefrontEnabled = storefrontCapability?.enabled ?? false;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Store Coming Soon
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          This store&apos;s directory listing is pending publication.
          Please check back soon to see their full storefront and product catalog.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-8">
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Awaiting publication
          </span>
        </div>

        {storefrontEnabled && (
          <Link
            href={`/tenant/${tenantId}`}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors mb-4"
          >
            <Globe className="w-5 h-5 mr-2" />
            Visit Storefront
          </Link>
        )}

        <Link
          href="/directory"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Browse Directory
        </Link>
      </div>
    </div>
  );
}

