'use client';

/**
 * ProductShowcaseLayout — Layout B (Product Showcase) for the product detail page.
 *
 * Recomposes the same components used by TierBasedLandingPage (Layout A / Classic)
 * but in a split-panel layout: sticky gallery on the left, purchase panel on the right.
 *
 * All business logic is delegated to `useProductDetailState` — this component
 * is purely a different COMPOSITION of the same pieces.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';

// Shared hook for all business logic
import { useProductDetailState } from './layouts/hooks/useProductDetailState';

// Shared layout components
import { ProductBreadcrumb } from './layouts/shared/ProductBreadcrumb';
import { ProductTrustBar } from './layouts/shared/ProductTrustBar';
import { StickyPurchaseBar } from './layouts/shared/StickyPurchaseBar';
import { ProductDetailTabs } from './layouts/shared/ProductDetailTabs';
import { ProductImageLightbox } from './layouts/shared/ProductImageLightbox';

// Existing product components (same as TierBasedLandingPage)
import ProductGallery from '@/components/products/ProductGallery';
import BasicProductGallery from '@/components/products/BasicProductGallery';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { AddToCartButton } from '@/components/products/AddToCartButton';
import ProductVariantSelector from '@/components/products/ProductVariantSelector';
import ProductActions from '@/components/products/ProductActions';
import { FeaturedTypeBadges } from '@/components/products/FeaturedTypeBadges';
import { getFeaturedTypeDisplay } from '@/types/product-display';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { SafeImage } from '@/components/SafeImage';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';
import { LocationAvailabilitySection } from '@/components/products/LocationAvailabilitySection';

// Types
import { StorefrontOptionFlags } from '@/services/PublicStorefrontOptionsService';

// Icons
import { Package, Download, Globe } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props interface — mirrors TierBasedLandingPageProps
// ---------------------------------------------------------------------------

interface ProductShowcaseLayoutProps {
  product: any;
  tenant: any;
  storeStatus?: any;
  gallery?: React.ReactNode;
  fulfillmentPane?: React.ReactNode;
  slug?: string;
  currentUrl?: string;
  productSlug?: string;
  slugType?: string;
  disableQRCode?: boolean;
  initialOptFlags?: StorefrontOptionFlags | null;
}

// ---------------------------------------------------------------------------
// Skeleton loader (matches TierBasedLandingPage loading state)
// ---------------------------------------------------------------------------

function ShowcaseSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
        {/* Trust bar skeleton */}
        <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded mb-6" />
        {/* Split panel skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-8">
          {/* Gallery skeleton */}
          <div className="aspect-square bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          {/* Purchase panel skeleton */}
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-10 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-12 w-full bg-neutral-200 dark:bg-neutral-800 rounded-lg mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProductShowcaseLayout({
  product,
  tenant,
  storeStatus,
  gallery,
  fulfillmentPane,
  slug,
  currentUrl,
  productSlug,
  slugType,
  disableQRCode,
  initialOptFlags,
}: ProductShowcaseLayoutProps) {
  // ---- All business logic from the shared hook ----
  const {
    loading,
    safeFeatures,
    hasStorefront,
    selectedVariant,
    setSelectedVariant,
    quantity,
    setQuantity,
    hasVariants,
    currentPrice,
    currentPriceCents,
    currentListPriceCents,
    currentStock,
    currentSku,
    currentAvailability,
    variantPriceRange,
    variantStockInfo,
    effectiveCanPurchase,
    effectiveGatewayType,
    commerceDisabled,
    isStorefrontEnabled,
    isRetailStore,
    isOnlineStore,
    isServiceStore,
    optFlags,
    showsLocation,
    showsMap,
    showsHours,
    showsQRCodes,
    showsLocationAvailability,
    showStatusPanel,
    effectiveTierPart,
    displayLogo,
    displayName,
    showLogo,
    businessLogo,
    primaryColor,
    secondaryColor,
    branding,
    layout,
    hoursStatus,
    getStatusColor,
    resolvedCurrentUrl,
    tenantSlug,
    platformSettings,
  } = useProductDetailState({
    product,
    tenant,
    initialOptFlags,
    currentUrl,
  });

  // ---- Local UI state ----
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ---- Ref for StickyPurchaseBar ----
  const cartButtonRef = useRef<HTMLDivElement>(null);

  // ---- Tenant metadata for display (needed for footer useMemo hooks) ----
  const metadata = tenant.metadata as any;

  // ---- Lightbox image list ----
  const lightboxImages = useMemo(() => {
    if (product.imageGallery && product.imageGallery.length > 0) {
      return product.imageGallery.slice(0, safeFeatures.maxGalleryImages).map(
        (img: { url: string; alt?: string; caption?: string }) => ({
          url: img.url,
          alt: img.alt || product.name,
          caption: img.caption || null,
        }),
      );
    }
    if (product.imageUrl) {
      return [{ url: product.imageUrl, alt: product.name, caption: null }];
    }
    return [];
  }, [product.imageGallery, product.imageUrl, product.name, safeFeatures.maxGalleryImages]);

  // ---- Gallery click handler (opens lightbox) ----
  const handleGalleryImageClick = useCallback(
    (index: number) => {
      setLightboxIndex(index);
      setLightboxOpen(true);
    },
    [],
  );

  // ---- Quantity helpers ----
  const maxQuantity = currentStock || 999;

  const handleQuantityDecrement = useCallback(() => {
    setQuantity(Math.max(1, quantity - 1));
  }, [quantity, setQuantity]);

  const handleQuantityIncrement = useCallback(() => {
    setQuantity(Math.min(quantity + 1, maxQuantity));
  }, [quantity, maxQuantity, setQuantity]);

  const handleQuantityInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value) || 1;
      setQuantity(Math.min(Math.max(1, val), maxQuantity));
    },
    [maxQuantity, setQuantity],
  );

  // ---- Scroll to variant selector ----
  const variantSelectorRef = useRef<HTMLDivElement>(null);
  const scrollToVariantSelector = useCallback(() => {
    variantSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ---- Loading state ----
  if (loading) {
    return <ShowcaseSkeleton />;
  }

  // ---- Derived display values ----
  const productTitle = product.title || product.name;
  const conditionLabel =
    product.condition === 'brand_new' || product.condition === 'new'
      ? 'New'
      : product.condition === 'used'
        ? 'Used'
        : product.condition === 'refurbished'
          ? 'Refurbished'
          : null;

  const effectiveAvailability = hasVariants
    ? selectedVariant
      ? currentAvailability
      : variantStockInfo?.isAvailable
        ? 'in_stock'
        : 'out_of_stock'
    : currentAvailability;

  const effectiveStock = hasVariants
    ? selectedVariant
      ? currentStock
      : variantStockInfo?.totalStock
    : currentStock;

  // Category info for breadcrumb
  const categoryName =
    typeof product.tenantCategory === 'string'
      ? product.tenantCategory
      : product.tenantCategory?.name || product.category?.name || undefined;
  const categorySlug =
    product.tenantCategory?.slug || product.category?.slug || undefined;

  const storeLogoUrl = metadata?.logo_url || displayLogo;

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ─────────────────────────────────────────────────────────────────
         *  BREADCRUMB BAR
         * ───────────────────────────────────────────────────────────────── */}
        <ProductBreadcrumb
          storeName={displayName || tenant.name || 'Store'}
          storeLogoUrl={showLogo ? storeLogoUrl : null}
          tenantId={product.tenantId}
          tenantSlug={tenantSlug}
          categoryName={categoryName}
          categorySlug={categorySlug}
          productTitle={productTitle}
        />

        {/* Trust signals row */}
        <div className="mb-6">
          <ProductTrustBar
            productId={product.id}
            tenantId={product.tenantId}
            stock={effectiveStock}
            availability={effectiveAvailability}
            sku={currentSku}
            variant="default"
          />
        </div>

        {/* ─────────────────────────────────────────────────────────────────
         *  SPLIT PANEL — Gallery (left) + Purchase Panel (right)
         * ───────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-8 lg:gap-12 mb-10">
          {/* ── LEFT: Product Gallery (sticky on desktop) ── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div
              className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden cursor-pointer"
              onClick={() => handleGalleryImageClick(0)}
              role="button"
              tabIndex={0}
              aria-label="Open image viewer"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGalleryImageClick(0);
                }
              }}
            >
              {safeFeatures.imageGallery &&
              product.imageGallery &&
              product.imageGallery.length > 0 ? (
                safeFeatures.maxGalleryImages >= 10 ? (
                  <ProductGallery
                    gallery={product.imageGallery.slice(
                      0,
                      safeFeatures.maxGalleryImages,
                    )}
                    productTitle={product.name}
                  />
                ) : (
                  <BasicProductGallery
                    gallery={product.imageGallery.slice(
                      0,
                      safeFeatures.maxGalleryImages,
                    )}
                    productTitle={product.name}
                  />
                )
              ) : product.imageUrl ? (
                <div className="relative w-full aspect-square">
                  <SafeImage
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              ) : (
                <div className="w-full aspect-square bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <svg
                    className="h-24 w-24 text-neutral-300 dark:text-neutral-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Tap-to-zoom hint (desktop) */}
            {lightboxImages.length > 0 && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-2 hidden lg:block">
                Click image to zoom
              </p>
            )}
          </div>

          {/* ── RIGHT: Purchase Panel ── */}
          <div className="space-y-6">
            {/* Featured Type Badges */}
            {product.featuredTypes && product.featuredTypes.length > 0 && (
              <FeaturedTypeBadges
                featuredTypes={getFeaturedTypeDisplay(product.featuredTypes)}
              />
            )}

            {/* Product Title */}
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {productTitle}
            </h1>

            {/* Brand · Manufacturer · Condition */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {product.brand && (
                <span>
                  by{' '}
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {product.brand}
                  </span>
                </span>
              )}
              {product.manufacturer && (
                <>
                  {product.brand && (
                    <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span>Manufacturer: {product.manufacturer}</span>
                </>
              )}
              {conditionLabel && (
                <>
                  {(product.brand || product.manufacturer) && (
                    <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {conditionLabel}
                  </span>
                </>
              )}
            </div>

            {/* Category badge link */}
            {product.tenantCategory && (
              <div>
                <Link
                  title={`Browse to store's ${categoryName} products`}
                  href={`/tenant/${product.tenantId}?category=${categorySlug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors no-underline"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  {categoryName}
                </Link>
              </div>
            )}

            {/* ── Price Display ── */}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
              {variantPriceRange ? (
                <div className="mb-1">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    From ${(variantPriceRange.minPrice / 100).toFixed(2)}
                  </span>
                  {variantPriceRange.hasSale && (
                    <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                      (Sale available)
                    </span>
                  )}
                </div>
              ) : (
                <PriceDisplay
                  priceCents={currentListPriceCents}
                  salePriceCents={
                    selectedVariant?.sale_price_cents ||
                    product.salePriceCents
                  }
                  variant="large"
                  showSavingsBadge={true}
                  className="mb-1"
                />
              )}
            </div>

            {/* ── Variant Selector ── */}
            {hasVariants && (
              <div
                ref={variantSelectorRef}
                className="p-4 bg-gradient-to-r from-rose-50 to-indigo-50 dark:from-rose-950/30 dark:to-indigo-950/30 border border-rose-200 dark:border-rose-800 rounded-lg shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-sm font-semibold text-rose-900 dark:text-rose-300">
                    Select Options
                  </span>
                </div>
                <ProductVariantSelector
                  variants={product.variants || []}
                  onVariantChange={setSelectedVariant}
                  selectedVariant={selectedVariant}
                />
              </div>
            )}

            {/* ── Availability Status ── */}
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  effectiveAvailability === 'in_stock'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                }`}
              >
                {effectiveAvailability === 'in_stock'
                  ? `✓ In Stock${!hasVariants && effectiveStock ? ` (${effectiveStock} available)` : ''}`
                  : '✗ Out of Stock'}
              </span>
              {hasVariants && effectiveAvailability === 'in_stock' && !selectedVariant && variantStockInfo && (
                <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {variantStockInfo.totalStock} units across{' '}
                  {variantStockInfo.inStockCount} variant(s)
                </span>
              )}
              {hasVariants && selectedVariant && effectiveAvailability === 'in_stock' && effectiveStock != null && effectiveStock > 0 && (
                <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {effectiveStock} units available
                </span>
              )}
            </div>

            {/* ── Quantity + Add to Cart ── */}
            {!showStatusPanel && (effectiveCanPurchase || commerceDisabled) && (
              <div
                ref={cartButtonRef}
                className="p-5 bg-gradient-to-br from-green-50 to-indigo-50 dark:from-green-950/50 dark:to-indigo-950/50 rounded-xl border-2 border-green-200 dark:border-green-800 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Package className="flex items-center justify-center h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                    Add to Cart
                  </span>
                </div>

                {/* Quantity Selector */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Quantity:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleQuantityDecrement}
                      disabled={quantity <= 1}
                      className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={quantity}
                      onChange={handleQuantityInput}
                      className="w-16 h-8 text-center border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Quantity"
                    />
                    <button
                      onClick={handleQuantityIncrement}
                      disabled={quantity >= maxQuantity}
                      className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  {currentStock != null && currentStock > 0 && (
                    <span className="text-xs text-gray-400 dark:text-neutral-500">
                      max {currentStock}
                    </span>
                  )}
                </div>

                <AddToCartButton
                  product={{
                    id: selectedVariant?.id || product.id,
                    name: selectedVariant?.variant_name
                      ? `${product.title} - ${selectedVariant.variant_name}`
                      : product.title,
                    sku: currentSku,
                    priceCents: currentPriceCents,
                    salePriceCents:
                      selectedVariant?.sale_price_cents ||
                      product.salePriceCents,
                    imageUrl:
                      selectedVariant?.image_url || product.imageUrl,
                    stock:
                      currentAvailability === 'in_stock'
                        ? currentStock || 999
                        : 0,
                    tenantId: product.tenantId,
                    has_variants: hasVariants,
                  }}
                  variant={selectedVariant}
                  quantity={quantity}
                  tenantName={
                    tenant.metadata?.businessName || tenant.name
                  }
                  tenantLogo={businessLogo}
                  hasActivePaymentGateway={effectiveCanPurchase}
                  defaultGatewayType={effectiveGatewayType}
                  commerceDisabled={commerceDisabled}
                  layout={layout as 'horizontal' | 'stacked'}
                />
              </div>
            )}

            {/* ── Quick Info: SKU · Product Type ── */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              {currentSku && (
                <span>
                  SKU: <span className="font-mono">{currentSku}</span>
                </span>
              )}
              {product.productType && (
                <>
                  {currentSku && (
                    <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-neutral-300">
                    {product.productType === 'physical' && (
                      <Package size={14} />
                    )}
                    {product.productType === 'digital' && (
                      <Download size={14} />
                    )}
                    {product.productType === 'hybrid' && (
                      <Globe size={14} />
                    )}
                    {product.productType.charAt(0).toUpperCase() +
                      product.productType.slice(1)}
                  </span>
                </>
              )}
            </div>

            {/* ── Fulfillment Options ── */}
            {!showStatusPanel && fulfillmentPane && (
              <div>{fulfillmentPane}</div>
            )}

            {/* ── QR Code (compact) ── */}
            {!showStatusPanel && !disableQRCode && showsQRCodes && (
              <div className="py-2">
                <TenantQRCode
                  url={resolvedCurrentUrl}
                  tenantId={product.tenantId}
                  label="Scan to Share"
                  pageType="product"
                  capabilityFlags={optFlags}
                  size={128}
                  showDownload={false}
                />
              </div>
            )}

            {/* ── Custom CTA ── */}
            {!showStatusPanel &&
              safeFeatures.customCta &&
              product.customCta && (
                <div>
                  <a
                    href={product.customCta.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    {product.customCta.text || 'Learn More'}
                  </a>
                </div>
              )}

            {/* ── Multi-Location Availability ── */}
            {isRetailStore && tenant.organizationId && showsLocationAvailability && (
              <LocationAvailabilitySection
                productSlug={
                  productSlug ||
                  product.product_slug ||
                  product.productSlug ||
                  product.sku ||
                  product.id
                }
                slugType={slugType}
                productName={product.name}
                organizationId={tenant.organizationId}
                preferredTenantId={product.tenantId}
                maxDistance={50}
                maxResults={5}
                useSmartFallback={true}
              />
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
         *  PRODUCT DETAIL TABS (full-width)
         * ───────────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden mb-8">
          <ProductDetailTabs
            product={product}
            showMarketingDescription={safeFeatures.customMarketingDescription}
            displayMode="tabs"
          />
        </section>

        {/* ─────────────────────────────────────────────────────────────────
         *  PRODUCT ACTIONS BAR
         * ───────────────────────────────────────────────────────────────── */}
        <section className="mb-8">
          <ProductActions
            product={product}
            tenant={tenant}
            productUrl={resolvedCurrentUrl}
            variant="product"
            showHours={showsHours}
            showLocation={showsLocation}
            showMap={showsMap}
            isRetailStore={isRetailStore}
          />
        </section>

        {/* ─────────────────────────────────────────────────────────────────
         *  STATUS PANEL (if tenant requires it)
         * ───────────────────────────────────────────────────────────────── */}
        {showStatusPanel && (
          <section className="mb-8">
            <StorefrontStatusPanel
              tenantId={product.tenantId}
              tenantInfo={tenant as any}
            />
          </section>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
       *  LIGHTBOX
       * ───────────────────────────────────────────────────────────────── */}
      <ProductImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* ─────────────────────────────────────────────────────────────────
       *  STICKY PURCHASE BAR (mobile)
       * ───────────────────────────────────────────────────────────────── */}
      <StickyPurchaseBar
        priceCents={currentPriceCents}
        salePriceCents={
          selectedVariant?.sale_price_cents || product.salePriceCents
        }
        availability={effectiveAvailability}
        onAddToCart={() => {
          // The AddToCartButton handles its own click — scroll to it on mobile
          cartButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        hasVariants={hasVariants}
        variantSelected={!!selectedVariant}
        onSelectVariant={scrollToVariantSelector}
        cartButtonRef={cartButtonRef}
      />

    </div>
  );
}

export default ProductShowcaseLayout;
