'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { MapPin, Globe, Clock, ArrowLeft } from 'lucide-react';

import { computeStoreStatus } from '@/lib/hours-utils';
import { SubscriptionStatusPanel } from '@/components/subscription/SubscriptionStatusPanel';
import { PublicCrmOptionsFlags, type FeaturedOptionsState, type DirectoryEntryOptionsState, type DirectoryEntryLayoutKey } from '@/services/CapabilityResolutionService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import {
  DirectoryEntryClassicLayout,
  DirectoryEntryEditorialLayout,
  DirectoryEntryImmersiveLayout,
  DirectoryEntryPremiumLayout,
} from './layouts';
import PublicBotWidget from '@/components/bot/PublicBotWidget';
import { GbpReviewsSection } from '@/components/gbp/GbpReviewsSection';
import { GbpPostsSection } from '@/components/gbp/GbpPostsSection';
import { GbpPhotoGallerySection } from '@/components/gbp/GbpPhotoGallerySection';
import { SocialPixels } from '@/components/tracking/SocialPixels';
import { useActiveFeatured } from '@/hooks/useActiveFeatured';
import { externalApiService } from '@/services/ExternalApiService';
import { recommendationsService } from '@/services/RecommendationsSingletonService';
import { useMultiCart } from '@/hooks/useMultiCart';
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { usePublicStorefrontCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';
import { clientLogger } from '@/lib/client-logger';

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
    clientLogger.error('Error tracking store view:', { detail: error });
    // Don't throw - tracking failures shouldn't break the page
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
    clientLogger.warn('Geolocation failed, falling back to IP-based location');
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
      clientLogger.warn('Invalid location data received from external API');
      return null;
    }

    return {
      latitude: ipLocation.latitude,
      longitude: ipLocation.longitude,
      city: ipLocation.city || 'Unknown',
      state: ipLocation.region || 'Unknown'
    };
  } catch (error) {
    clientLogger.warn('Failed to get IP location:', { detail: error });
    return null;
  }
}

interface StoreDetailClientProps {
  identifier: string;
  consolidatedData: any;
  tenantLogo: string | null;
  businessProfile: any;
  businessHours: any;
  relatedProducts: any[];
  storefrontCategories: any;
  actualProductCount: number;
  tenantInfo: any;
  slugForRelated: string;
  featuredOptionsState: FeaturedOptionsState | null;
  faqFlags: PublicFaqOptionsFlags | null;
  crmFlags: PublicCrmOptionsFlags | null;
  directoryEntryOptions: DirectoryEntryOptionsState | null;
}

export default function StoreDetailClient({
  identifier,
  consolidatedData,
  tenantLogo,
  businessProfile,
  businessHours,
  relatedProducts,
  storefrontCategories,
  actualProductCount,
  tenantInfo,
  slugForRelated,
  featuredOptionsState,
  faqFlags,
  crmFlags,
  directoryEntryOptions,
}: StoreDetailClientProps) {
  const [layoutPreview, setLayoutPreview] = useState<DirectoryEntryLayoutKey | null>(null);

  const { totalItems } = useMultiCart(); // Show total items across ALL carts, not just this tenant
  const listing = consolidatedData.listing;
  const { status: hoursStatus } = useStoreStatus(listing?.tenantId || '', true); // Public scope

  // Storefront capability is only for shopping CTAs / product chrome — not directory sections.
  const storefrontCap = usePublicStorefrontCapability(listing?.tenantId || null);
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? false;

  // Active featured products (from ActiveFeaturedResolver)
  const { data: activeFeatured } = useActiveFeatured(
    listing?.tenantId || null,
    'directory_entry',
    { limit: 6 }
  );
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'flexible';
  const isOnlineStore = storefrontCap.data?.type === 'online' || storefrontCap.data?.type === 'flexible';
  const isServiceStore = storefrontCap.data?.type === 'service' || storefrontCap.data?.type === 'flexible';

  // Directory listing sections are owned by directory_entry, not storefront_options.
  const showsHours = directoryEntryOptions?.hoursEnabled ?? true;
  const showsMap = directoryEntryOptions?.mapEnabled ?? true;
  const showsLocation = directoryEntryOptions?.mapEnabled ?? true;

  useEffect(() => {
    // Read layout preview from query param
    if (typeof window !== 'undefined') {
      const paramsUrl = new URLSearchParams(window.location.search);
      const preview = paramsUrl.get('layout_preview');
      if (preview === 'classic' || preview === 'editorial' || preview === 'immersive' || preview === 'premium') {
        setLayoutPreview(preview);
      }
    }

    // Track user behavior for recommendations (fire and forget, don't await)
    if (listing?.tenantId) {
      trackStoreView(listing.tenantId, listing.categories).catch(err =>
        clientLogger.error('Failed to track store view:', { detail: err })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.tenantId]);

  const featuredProductsRaw = consolidatedData.featuredProducts || [];
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

  // Use NEXT_PUBLIC_ prefixed var for client-side access, fallback to window.location.origin
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : process.env.WEB_URL) || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/directory/${identifier}`;

  if (listing.listingOrigin === 'directory_seed' || !directoryEntryOptions?.enabled) {
    return <DirectoryNotAvailable listing={listing} identifier={identifier} />;
  }

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
    activeFeatured: activeFeatured ?? undefined,
    relatedProducts,
    tenantInfo,
    slugForRelated,
    showStatusPanel: false,
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
    isDemo: tenantInfo?.isDemo,
    demoExpiresAt: tenantInfo?.demoExpiresAt,
    directoryEntryOptions,
    isStorefrontEnabled,
  };

  switch (effectiveLayout) {
    case 'editorial':
      return (
        <>
          <SocialPixels tenantId={listing.tenantId} usePublic />
          <SubscriptionStatusPanel
            subscriptionStatus={tenantInfo?.subscriptionStatus || 'active'}
            subscriptionTier={tenantInfo?.subscriptionTier || 'starter'}
            trialEndsAt={tenantInfo?.trialEndsAt ?? null}
            subscriptionEndsAt={tenantInfo?.subscriptionEndsAt ?? null}
          />
          <DirectoryEntryEditorialLayout {...layoutProps} />
          <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <GbpReviewsSection slug={identifier} />
            <GbpPostsSection slug={identifier} />
            <GbpPhotoGallerySection slug={identifier} />
          </div>
          <PublicBotWidget
            tenantId={listing.tenantId}
            pageContext="directory"
            hasActivePaymentGateway={paymentGatewayStatus?.hasActiveGateway ?? false}
          />
        </>
      );
    case 'immersive':
      return (
        <>
          <SocialPixels tenantId={listing.tenantId} usePublic />
          <SubscriptionStatusPanel
            subscriptionStatus={tenantInfo?.subscriptionStatus || 'active'}
            subscriptionTier={tenantInfo?.subscriptionTier || 'starter'}
            trialEndsAt={tenantInfo?.trialEndsAt ?? null}
            subscriptionEndsAt={tenantInfo?.subscriptionEndsAt ?? null}
          />
          <DirectoryEntryImmersiveLayout {...layoutProps} />
          <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <GbpReviewsSection slug={identifier} />
            <GbpPostsSection slug={identifier} />
            <GbpPhotoGallerySection slug={identifier} />
          </div>
          <PublicBotWidget
            tenantId={listing.tenantId}
            pageContext="directory"
            hasActivePaymentGateway={paymentGatewayStatus?.hasActiveGateway ?? false}
          />
        </>
      );
    case 'premium':
      return (
        <>
          <SocialPixels tenantId={listing.tenantId} usePublic />
          <SubscriptionStatusPanel
            subscriptionStatus={tenantInfo?.subscriptionStatus || 'active'}
            subscriptionTier={tenantInfo?.subscriptionTier || 'starter'}
            trialEndsAt={tenantInfo?.trialEndsAt ?? null}
            subscriptionEndsAt={tenantInfo?.subscriptionEndsAt ?? null}
          />
          <DirectoryEntryPremiumLayout {...layoutProps} />
          <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <GbpReviewsSection slug={identifier} />
            <GbpPostsSection slug={identifier} />
            <GbpPhotoGallerySection slug={identifier} />
          </div>
          <PublicBotWidget
            tenantId={listing.tenantId}
            pageContext="directory"
            hasActivePaymentGateway={paymentGatewayStatus?.hasActiveGateway ?? false}
          />
        </>
      );
    case 'classic':
    default:
      return (
        <>
          <SocialPixels tenantId={listing.tenantId} usePublic />
          <SubscriptionStatusPanel
            subscriptionStatus={tenantInfo?.subscriptionStatus || 'active'}
            subscriptionTier={tenantInfo?.subscriptionTier || 'starter'}
            trialEndsAt={tenantInfo?.trialEndsAt ?? null}
            subscriptionEndsAt={tenantInfo?.subscriptionEndsAt ?? null}
          />
          <DirectoryEntryClassicLayout {...layoutProps} />
          <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <GbpReviewsSection slug={identifier} />
            <GbpPostsSection slug={identifier} />
            <GbpPhotoGallerySection slug={identifier} />
          </div>
          <PublicBotWidget
            tenantId={listing.tenantId}
            pageContext="directory"
            hasActivePaymentGateway={paymentGatewayStatus?.hasActiveGateway ?? false}
          />
        </>
      );
  }
}

function DirectoryNotAvailable({ listing, identifier }: { listing: any; identifier: string }) {
  const isSeed = listing.listingOrigin === 'directory_seed';

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
          <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {listing.businessName}
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          {isSeed
            ? 'This listing is not yet in the directory. View the place page for public listing details.'
            : 'This directory entry is not currently published.'}
        </p>

        {isSeed && (
          <Link
            href={`/place/${identifier}`}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors mb-4"
          >
            <MapPin className="w-5 h-5 mr-2" />
            View Place Page
          </Link>
        )}

        <Link
          href="/directory"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-neutral-600 hover:bg-neutral-700 text-white font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Browse Directory
        </Link>
      </div>
    </div>
  );
}

export function StoreComingSoon({ tenantId }: { tenantId: string }) {
  const { data: storefrontCapability } = usePublicStorefrontCapability(tenantId);
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
