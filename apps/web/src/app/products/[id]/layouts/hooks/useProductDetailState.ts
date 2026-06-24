'use client';

/**
 * Shared hook for product detail page state management.
 *
 * Extracted from TierBasedLandingPage.tsx so that Layouts B (Showcase) and
 * C (Quick Commerce) can reuse the same business logic without duplicating
 * the 1,959-line monolith.
 *
 * Layout A (Classic) continues to use TierBasedLandingPage directly — this
 * hook is additive, not a replacement.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import {
  useCommerceCapability,
  usePaymentGatewayCapability,
  useStorefrontCapability,
  useProductOptionsCapability,
} from '@/hooks/tenant-access/useCapabilityAccess';
import { useTenantPaymentOptional } from '@/contexts/TenantPaymentContext';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { storefrontService } from '@/services/StorefrontService';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { ProductOptionFlags } from '@/services/CapabilityResolutionService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LandingPageFeatures {
  customMarketingDescription: boolean;
  imageGallery: boolean;
  maxGalleryImages: number;
  customCta: boolean;
  socialLinks: boolean;
  qrCodes: boolean;
  showBusinessLogo: boolean;
  removePlatformBranding: boolean;
  customLogo: boolean;
  customColors: boolean;
  customSections: boolean;
  maxCustomSections: number;
  customTheme: boolean;
  customDomain: boolean;
  abTesting: boolean;
  advancedAnalytics: boolean;
}

/** Minimal product shape required by the hook (subset of full Product). */
export interface ProductDetailHookProduct {
  id: string;
  tenantId: string;
  name: string;
  title: string;
  price: number;
  priceCents?: number;
  listPriceCents?: number;
  salePriceCents?: number;
  currency: string;
  sku: string;
  availability: string;
  stock?: number;
  variants?: any[];
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

/** Minimal tenant shape required by the hook. */
export interface ProductDetailHookTenant {
  id: string;
  name: string;
  slug?: string;
  subscriptionTier?: string;
  hasActivePaymentGateway?: boolean;
  metadata?: any;
  locationStatus?: string | null;
  statusInfo?: any;
  showSubscriptionPanel?: boolean;
}

export interface UseProductDetailStateProps {
  product: ProductDetailHookProduct;
  tenant: ProductDetailHookTenant;
  initialOptFlags?: StorefrontOptionFlags | null;
  currentUrl?: string;
  productOptFlags?: ProductOptionFlags | null;
}

// ---------------------------------------------------------------------------
// Default / fallback features (matches TierBasedLandingPage fallback)
// ---------------------------------------------------------------------------

const DEFAULT_FEATURES: LandingPageFeatures = {
  customMarketingDescription: true,
  imageGallery: true,
  maxGalleryImages: 10,
  customCta: true,
  socialLinks: true,
  qrCodes: true,
  showBusinessLogo: true,
  removePlatformBranding: false,
  customLogo: true,
  customColors: false,
  customSections: false,
  maxCustomSections: 0,
  customTheme: false,
  customDomain: false,
  abTesting: false,
  advancedAnalytics: false,
};

// ---------------------------------------------------------------------------
// Helper: resolve stock from various field names
// ---------------------------------------------------------------------------

function getStock(v: any): number {
  return (
    v?.inventory_quantity ??
    v?.stock ??
    v?.variant_stock ??
    v?.variant_inventory_quantity ??
    0
  );
}

// ---------------------------------------------------------------------------
// Simple responsive-layout hook (replicated from TierBasedLandingPage)
// ---------------------------------------------------------------------------

export function useResponsiveLayout() {
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.outerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screenWidth <= 475 ? 'stacked' : 'horizontal';
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useProductDetailState({
  product,
  tenant,
  initialOptFlags,
  currentUrl,
  productOptFlags: serverProductOptFlags,
}: UseProductDetailStateProps) {
  // ---- Platform settings ----
  const { settings: platformSettings } = usePlatformSettings();

  // ---- Tier features ----
  const [features, setFeatures] = useState<LandingPageFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Variant / quantity state ----
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  // ---- Store hours ----
  const { status: hoursStatus } = useStoreStatus(tenant.id, true);

  // ---- Responsive layout ----
  const layout = useResponsiveLayout();

  // ---- Payment gateway ----
  const contextPayment = useTenantPaymentOptional();
  const contextCanPurchase =
    contextPayment && !contextPayment.loading
      ? contextPayment.canPurchase
      : undefined;
  const contextGatewayType =
    contextPayment && !contextPayment.loading
      ? contextPayment.defaultGatewayType
      : undefined;
  const effectiveCanPurchaseLegacy =
    contextCanPurchase ?? tenant.hasActivePaymentGateway ?? false;
  const effectiveGatewayType =
    contextGatewayType ?? (product as any).defaultGatewayType;

  // ---- Capability flags (commerce / payment / storefront) ----
  const commerceCap = useCommerceCapability(product.tenantId);
  const paymentCap = usePaymentGatewayCapability(product.tenantId);
  const commerceEnabled = commerceCap.data?.enabled ?? true;
  const gatewayCapEnabled = paymentCap.data?.enabled ?? true;
  const commerceDisabled = !!(
    (commerceCap.data && !commerceCap.data.enabled) ||
    (paymentCap.data && !paymentCap.data.enabled)
  );
  const effectiveCanPurchase =
    effectiveCanPurchaseLegacy && commerceEnabled && gatewayCapEnabled;

  const storefrontCap = useStorefrontCapability(product.tenantId);
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
  const [optFlags] = useState<StorefrontOptionFlags | null>(
    initialOptFlags ?? null,
  );

  // ---- Product option flags (decoupled from storefront) ----
  // Use server-provided flags on public pages to avoid calling private APIs
  const productOptionsCap = useProductOptionsCapability(
    serverProductOptFlags ? null : product.tenantId
  );
  const productOptState = serverProductOptFlags ?? productOptionsCap.data;

  const showsLocation = productOptState?.showsLocationDisplay ?? optFlags?.showLocationDisplay ?? true;
  const showsMap = productOptState?.showsMapDisplay ?? optFlags?.showMapDisplay ?? true;
  const showsHours = productOptState?.showsHoursDisplay ?? optFlags?.showHoursDisplay ?? true;
  const showsRecentlyViewed = productOptState?.showsRecentlyViewed ?? optFlags?.showRecentlyViewed ?? true;
  const showsQRCodes = productOptState?.showsQRCodes ?? true;
  const showsRecommended = productOptState?.showsRecommended ?? true;
  const showsEnhancedSEO = productOptState?.showsEnhancedSEO ?? optFlags?.showEnhancedSEO ?? true;
  const showsReviews = productOptState?.showsReviews ?? true;
  const showsFulfillment = productOptState?.showsFulfillment ?? true;
  const showsCategories = productOptState?.showsCategories ?? true;
  const showsLocationAvailability = productOptState?.showsLocationAvailability ?? true;

  // ---- Resolved URL ----
  const baseUrl =
    process.env.NEXT_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' ? window.location.origin : process.env.WEB_URL) ||
    'http://localhost:3000';
  const resolvedCurrentUrl = currentUrl || `${baseUrl}/products/${product.id}`;

  // ---- Pricing derived from variant / product ----
  const currentPrice = selectedVariant?.price_cents
    ? selectedVariant.price_cents / 100
    : product.price;
  const currentPriceCents =
    selectedVariant?.price_cents || product.priceCents;
  const currentListPriceCents =
    selectedVariant?.price_cents || product.listPriceCents;
  const currentStock = getStock(selectedVariant) || product.stock;
  const currentSku = selectedVariant?.sku || product.sku;
  const currentAvailability = selectedVariant
    ? getStock(selectedVariant) > 0
      ? 'in_stock'
      : 'out_of_stock'
    : product.availability === 'in_stock' ||
        product.availability === 'limited'
      ? 'in_stock'
      : product.availability;

  // ---- Variant aggregate info ----
  const hasVariants = !!(product.variants && product.variants.length > 0);

  const variantPriceRange =
    hasVariants && !selectedVariant
      ? (() => {
          const variantPrices = product.variants!.map((v: any) =>
            v.sale_price_cents && v.sale_price_cents < v.price_cents
              ? v.sale_price_cents
              : v.price_cents,
          );
          const minPrice = Math.min(...variantPrices);
          const hasSale = product.variants!.some(
            (v: any) =>
              v.sale_price_cents && v.sale_price_cents < v.price_cents,
          );
          return { minPrice, hasSale };
        })()
      : null;

  const variantStockInfo =
    hasVariants && !selectedVariant
      ? (() => {
          const totalStock = product.variants!.reduce(
            (sum: number, v: any) => sum + getStock(v),
            0,
          );
          const inStockCount = product.variants!.filter(
            (v: any) => getStock(v) > 0,
          ).length;
          return { totalStock, inStockCount, isAvailable: totalStock > 0 };
        })()
      : null;

  // ---- Tier feature mapping (useCallback for stable reference) ----
  const mapTierToFeatures = useCallback(
    (tierData: any): LandingPageFeatures => {
      const actualTierData = tierData.data || tierData;
      const tenantTier = actualTierData.tenantTier || actualTierData;
      const featureMap = new Map(
        tenantTier.features?.map((f: any) => [f.feature_key, f.is_enabled]) ||
          [],
      );

      let maxGalleryImages = 0;
      let hasGalleryFeature = false;
      if (featureMap.get('image_gallery_10')) {
        maxGalleryImages = 10;
        hasGalleryFeature = true;
      } else if (featureMap.get('image_gallery_5')) {
        maxGalleryImages = 5;
        hasGalleryFeature = true;
      }

      return {
        customMarketingDescription: Boolean(
          featureMap.get('custom_marketing_copy'),
        ),
        imageGallery: hasGalleryFeature,
        maxGalleryImages,
        customCta: Boolean(featureMap.get('custom_cta')),
        socialLinks: Boolean(featureMap.get('social_links')),
        qrCodes: Boolean(
          featureMap.get('qr_codes_1024') || featureMap.get('qr_codes_512'),
        ),
        showBusinessLogo: Boolean(featureMap.get('business_logo')),
        removePlatformBranding: Boolean(
          featureMap.get('remove_platform_branding'),
        ),
        customLogo: Boolean(featureMap.get('custom_logo')),
        customColors: Boolean(featureMap.get('custom_colors')),
        customSections: Boolean(featureMap.get('custom_sections')),
        maxCustomSections: 0,
        customTheme: Boolean(featureMap.get('custom_theme')),
        customDomain: Boolean(featureMap.get('custom_domain')),
        abTesting: Boolean(featureMap.get('ab_testing')),
        advancedAnalytics: Boolean(featureMap.get('advanced_analytics')),
      };
    },
    [],
  );

  // ---- Load features on mount ----
  useEffect(() => {
    let cancelled = false;
    async function loadFeatures() {
      try {
        const tierData = await storefrontService.getPublicTier(tenant.id);
        if (tierData && !cancelled) {
          setFeatures(mapTierToFeatures(tierData));
        }
      } catch (error) {
        console.error(
          '[useProductDetailState] Failed to load features:',
          error,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFeatures();
    return () => {
      cancelled = true;
    };
  }, [tenant.id, mapTierToFeatures]);

  // ---- Safe features (with fallback) ----
  const safeFeatures: LandingPageFeatures = features || DEFAULT_FEATURES;
  const hasStorefront = features !== null && !loading;

  // ---- Branding resolution ----
  const branding = (product as any).customBranding;
  const metadata = tenant.metadata as any;
  const enterpriseLogo = safeFeatures.customLogo && branding?.logo;
  const businessLogo = metadata?.logo_url;
  const platformLogo = platformSettings?.logoUrl;
  const displayLogo =
    enterpriseLogo || businessLogo || (hasStorefront ? platformLogo : null);
  const displayName =
    metadata?.businessName || tenant.name || platformSettings?.platformName;
  const showLogo = !!displayLogo;

  const primaryColor =
    safeFeatures.customColors && branding?.primaryColor
      ? branding.primaryColor
      : '#3b82f6';
  const secondaryColor =
    safeFeatures.customColors && branding?.secondaryColor
      ? branding.secondaryColor
      : '#1e40af';

  // ---- Subscription / status panel ----
  let effectiveTierPart = tenant.subscriptionTier || 'discovery';
  const tierParts = effectiveTierPart.split('_');
  if (tierParts.length >= 2 && tierParts[0] === 'trial') {
    effectiveTierPart = tierParts[1];
  }

  const showStatusPanel = tenant
    ? effectiveTierPart === 'google_only' ||
      effectiveTierPart === 'discovery' ||
      (!!tenant.locationStatus && tenant.locationStatus !== 'active') ||
      (tenant.statusInfo && !tenant.statusInfo.showStorefront) ||
      tenant.showSubscriptionPanel === true
    : false;

  const tenantSlug = (tenant as any)?.slug || tenant.id;

  // ---- Hours status color helper ----
  const getStatusColor = () => {
    if (!hoursStatus) return 'bg-gray-400';
    switch (hoursStatus.status) {
      case 'open':
        return 'bg-green-500';
      case 'closed':
        return 'bg-red-500';
      case 'opening-soon':
        return 'bg-blue-500';
      case 'closing-soon':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  // ---- Return all derived state ----
  return {
    // Loading
    loading,

    // Tier features
    features,
    safeFeatures,
    hasStorefront,

    // Variant state
    selectedVariant,
    setSelectedVariant,
    quantity,
    setQuantity,
    hasVariants,

    // Pricing
    currentPrice,
    currentPriceCents,
    currentListPriceCents,
    currentStock,
    currentSku,
    currentAvailability,
    variantPriceRange,
    variantStockInfo,

    // Commerce / payment
    effectiveCanPurchase,
    effectiveGatewayType,
    commerceDisabled,

    // Storefront capabilities
    isStorefrontEnabled,
    isRetailStore,
    isOnlineStore,
    isServiceStore,

    // Storefront option flags
    optFlags,
    showsLocation,
    showsMap,
    showsHours,

    // Product option flags (decoupled from storefront)
    productOptState,
    showsRecentlyViewed,
    showsQRCodes,
    showsRecommended,
    showsEnhancedSEO,
    showsReviews,
    showsFulfillment,
    showsCategories,
    showsLocationAvailability,

    // Status panel
    showStatusPanel,
    effectiveTierPart,

    // Branding
    displayLogo,
    displayName,
    showLogo,
    businessLogo,
    primaryColor,
    secondaryColor,
    branding,

    // Layout / hours
    layout,
    hoursStatus,
    getStatusColor,

    // URLs
    resolvedCurrentUrl,
    tenantSlug,

    // Platform
    platformSettings,
  };
}
