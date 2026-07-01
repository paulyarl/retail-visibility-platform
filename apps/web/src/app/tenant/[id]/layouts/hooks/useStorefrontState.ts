'use client';

/**
 * Shared hook for storefront page state management.
 *
 * Extracted from StorefrontClientWrapper.tsx so that Layouts B (Editorial) and
 * C (Immersive) can reuse the same business logic without duplicating
 * the 1,226-line monolith.
 *
 * Layout A (Classic) continues to use StorefrontClientWrapper directly — this
 * hook is additive, not a replacement.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { useMultiCart } from '@/hooks/useMultiCart';
import { useStorefrontStatus } from '@/components/storefront/StorefrontStatusPanel';
import { featuredProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import { PublicCrmOptionsFlags } from '@/services/CapabilityResolutionService';
import { ProductOptionFlags } from '@/services/CapabilityResolutionService';
import { useFeaturedOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { useActiveFeatured } from '@/hooks/useActiveFeatured';
import type { ActiveFeaturedResult } from '@/services/ActiveFeaturedService';

export interface SocialCommerceFlags {
  enabled?: boolean;
  canUseShareButtons?: boolean;
  canUseSocialProof?: boolean;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseStorefrontStateProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  tenantSlug: string;
  tier: string;
  directoryPublished: boolean;
  locationStatus?: string | null;
  statusInfo?: any;
  initialStorefrontOptionFlags?: StorefrontOptionFlags | null;
  initialStorefrontTypeSettings?: {
    settings?: {
      storefront_type_enabled?: boolean;
      selected_storefront_type?: string | null;
    };
    tierState?: {
      enabled?: boolean;
      type?: string;
      effectiveType?: string;
    };
  } | null;
  initialFaqFlags?: PublicFaqOptionsFlags | null;
  initialCrmFlags?: PublicCrmOptionsFlags | null;
  initialProductOptionFlags?: ProductOptionFlags | null;
  initialSocialCommerceFlags?: SocialCommerceFlags | null;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useStorefrontState({
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
}: UseStorefrontStateProps) {
  // ---- Navigation ----
  const router = useRouter();
  const handleViewCart = () => router.push('/carts');

  // ---- Cart ----
  const { totalItems: cartTotalItems } = useMultiCart();

  // ---- Store hours ----
  const { status: hoursStatus } = useStoreStatus(tenantId, true);

  // ---- Logo URL (multiple fallbacks) ----
  const logoUrl =
    tenant?.metadata?.logo_url ||
    tenant?.logo_url ||
    tenant?.branding?.logoUrl ||
    null;

  // ---- Resolved URL ----
  const baseUrl =
    process.env.NEXT_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : process.env.WEB_URL) ||
    'http://localhost:3000';
  const currentUrl = `${baseUrl}/tenant/${tenantId}`;

  // ---- Tenant info for status panel (memoized) ----
  const tenantInfoForStatus = useMemo(
    () => ({
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
    }),
    [
      tenantId,
      businessName,
      tenantSlug,
      tenant?.subscriptionStatus,
      tier,
      locationStatus,
      statusInfo,
      directoryPublished,
    ],
  );

  // ---- Storefront status panel ----
  const storefrontStatus = useStorefrontStatus(
    tenantId,
    tenantInfoForStatus as any,
  );

  // ---- Storefront capability (from server props) ----
  const storefrontCap = {
    data: {
      enabled:
        initialStorefrontTypeSettings?.settings?.storefront_type_enabled ??
        true,
      type:
        initialStorefrontTypeSettings?.tierState?.effectiveType ??
        initialStorefrontTypeSettings?.tierState?.type ??
        'flexible',
    },
    loading: false,
  };
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? true;
  const isRetailStore =
    storefrontCap.data?.type === 'retail' ||
    storefrontCap.data?.type === 'flexible';
  const isOnlineStore =
    storefrontCap.data?.type === 'online' ||
    storefrontCap.data?.type === 'flexible';
  const isServiceStore =
    storefrontCap.data?.type === 'service' ||
    storefrontCap.data?.type === 'flexible';
  const isSocialStore =
    storefrontCap.data?.type === 'social' ||
    storefrontCap.data?.type === 'flexible';

  // ---- Storefront option flags ----
  const [storefrontOptionFlags] = useState<StorefrontOptionFlags | null>(
    initialStorefrontOptionFlags ?? null,
  );
  const optFlags = storefrontOptionFlags;
  // Storefront-only flag derivation (decoupled from product options)
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
  // Product-option concepts default to enabled on the storefront since there are
  // no equivalent storefront option fields; product pages use ProductOptionFlags directly.
  const showsReviews = true;
  const showsFulfillment = true;
  const showsLocationAvailability = true;
  const showsGallery = true;
  const showsVideo = false;
  const showsVariants = true;
  const showsQRCodes = optFlags?.showQRCodes ?? true;

  // ---- Featured options (capability-gated allowed types) ----
  const featuredCap = useFeaturedOptionsCapability(tenantId);
  const allowedFeaturedTypes = useMemo(() => {
    if (featuredCap.data?.enabled && featuredCap.data.effectiveTypes) {
      return featuredCap.data.effectiveTypes as string[];
    }
    console.log('[useStorefrontState] allowedFeaturedTypes FALLBACK (empty = show all)');
    return []; // empty = show all (graceful fallback)
  }, [featuredCap.data]);

  // ---- FAQ flags ----
  const [faqFlags] = useState<PublicFaqOptionsFlags | null>(
    initialFaqFlags ?? null,
  );
  const faqEnabled =
    faqFlags?.faq_enabled && faqFlags?.faq_display_storefront_accordion;
  const faqFeedbackEnabled =
    faqFlags?.faq_enabled && faqFlags?.faq_display_feedback;

  // ---- CRM flags ----
  const [crmFlags] = useState<PublicCrmOptionsFlags | null>(
    initialCrmFlags ?? null,
  );
  const crmInquiryStorefrontEnabled =
    crmFlags?.crm_enabled && crmFlags?.crm_inquiry_storefront_enabled;

  // ---- Product option flags ----
  const [productOptionFlags] = useState<ProductOptionFlags | null>(
    initialProductOptionFlags ?? null,
  );
  const showServices = !!(productOptionFlags?.merchantPreferences?.product_service_enabled) || isServiceStore;
  const showDigital = !!(productOptionFlags?.merchantPreferences?.product_digital_enabled);
  const showHybrid = !!(productOptionFlags?.merchantPreferences?.product_hybrid_enabled);

  // ---- Social commerce flags ----
  const [socialCommerceFlags] = useState<SocialCommerceFlags | null>(
    initialSocialCommerceFlags ?? null,
  );
  const showSocialProof =
    !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseSocialProof) || isSocialStore;

  // ---- Contact info (memoized) ----
  const contactInfo = useMemo(() => {
    if (storefrontCap.loading)
      return { phone: null, email: null, address: null, website: null };
    return {
      phone: tenant?.metadata?.phone || tenant?.phone || null,
      email: tenant?.metadata?.email || tenant?.email || null,
      address:
        tenant?.metadata?.address ||
        (tenant?.metadata?.state == null
          ? ''
          : `${tenant?.metadata?.address_line1 || ''}, ${tenant?.metadata?.city || ''}, ${tenant?.metadata?.state || ''} ${tenant?.metadata?.postal_code || ''}`),
      website: tenant?.metadata?.website || tenant?.website || null,
    };
  }, [storefrontCap.loading, tenant]);

  // ---- Featured data ----
  const [featuredCounts, setFeaturedCounts] = useState<
    Record<string, number>
  >({});
  const [featuredData, setFeaturedData] = useState<any>(null);

  // ---- Active featured (from ActiveFeaturedResolver) ----
  const { data: activeFeatured } = useActiveFeatured(tenantId, 'storefront_spotlight', { limit: 8 });

  useEffect(() => {
    let cancelled = false;
    const loadFeaturedCounts = async () => {
      try {
        let data = await featuredProductsSingleton.getAllFeaturedProducts(
          tenantId,
          20,
        );

        // Validate cache: if data is empty, force a fresh fetch
        if (
          data &&
          data.totalCount === 0 &&
          (!data.buckets || data.buckets.length === 0)
        ) {
          await featuredProductsSingleton.clearCache();
          data = await featuredProductsSingleton.getAllFeaturedProducts(
            tenantId,
            20,
          );
        }

        if (data && !cancelled) {
          const transformedData = {
            totalCount: data.totalCount,
            buckets: data.buckets || [],
            bucketCounts: data.bucketCounts || {},
          };
          setFeaturedData(transformedData);
          setFeaturedCounts(transformedData.bucketCounts || {});
        }
      } catch (err) {
        console.error('[useStorefrontState] Failed to load featured counts:', err);
      }
    };

    if (tenantId) {
      loadFeaturedCounts();
    }
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // ---- Helper: featured type display name ----
  const getFeaturedTypeName = (type: string) => {
    switch (type) {
      case 'store_selection':
        return 'Featured Products';
      case 'new_arrival':
        return 'New Arrivals';
      case 'seasonal':
        return 'Seasonal Specials';
      case 'sale':
        return 'Sale Items';
      case 'staff_pick':
        return 'Staff Picks';
      default:
        return 'Products';
    }
  };

  // ---- Helper: category URL ----
  const getCategoryUrl = (category: any, basePath: string) => {
    if (!category) return basePath;
    const categoryName =
      category.name
        ?.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-') || 'uncategorized';
    return `${basePath}?category=${encodeURIComponent(category.slug || categoryName)}`;
  };

  // ---- Return all derived state ----
  return {
    // Navigation
    router,
    handleViewCart,

    // Cart
    cartTotalItems,

    // Store hours
    hoursStatus,

    // Branding
    logoUrl,

    // URLs
    currentUrl,
    baseUrl,

    // Status
    tenantInfoForStatus,
    storefrontStatus,

    // Storefront capabilities
    storefrontCap,
    isStorefrontEnabled,
    isRetailStore,
    isOnlineStore,
    isServiceStore,
    isSocialStore,

    // Option flags
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
    // Product option flags
    showsReviews,
    showsFulfillment,
    showsLocationAvailability,
    showsGallery,
    showsVideo,
    showsVariants,
    showsQRCodes,

    // Featured options
    allowedFeaturedTypes,

    // FAQ
    faqFlags,
    faqEnabled,
    faqFeedbackEnabled,

    // CRM
    crmFlags,
    crmInquiryStorefrontEnabled,

    // Product options
    productOptionFlags,
    showServices,
    showDigital,
    showHybrid,

    // Social commerce
    socialCommerceFlags,
    showSocialProof,

    // Contact
    contactInfo,

    // Featured
    featuredCounts,
    featuredData,
    activeFeatured: activeFeatured ?? undefined,
    getFeaturedTypeName,
    getCategoryUrl,
  };
}
