'use client';

/**
 * ProductQuickCommerceLayout — Layout C (Quick Commerce) for the product detail page.
 *
 * Speed-to-cart layout paired with Immersive Commerce storefront.
 * Dense, conversion-optimized composition with collapsed accordions,
 * large CTA, and sticky bottom bar on mobile.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { useProductDetailState } from './layouts/hooks/useProductDetailState';
import { ProductBreadcrumb } from './layouts/shared/ProductBreadcrumb';
import { ProductTrustBar } from './layouts/shared/ProductTrustBar';
import { StickyPurchaseBar } from './layouts/shared/StickyPurchaseBar';
import { ProductDetailTabs } from './layouts/shared/ProductDetailTabs';
import { ProductImageLightbox } from './layouts/shared/ProductImageLightbox';

import ProductGallery from '@/components/products/ProductGallery';
import BasicProductGallery from '@/components/products/BasicProductGallery';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { AddToCartButton } from '@/components/products/AddToCartButton';
import ProductVariantSelector from '@/components/products/ProductVariantSelector';
import { FeaturedTypeBadges } from '@/components/products/FeaturedTypeBadges';
import { getFeaturedTypeDisplay } from '@/types/product-display';
import { SafeImage } from '@/components/SafeImage';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';
import { LocationAvailabilitySection } from '@/components/products/LocationAvailabilitySection';
import ProductActions from '@/components/products/ProductActions';
import { TenantQRCode } from '@/components/public/TenantQRCode';

import { StorefrontOptionFlags } from '@/services/PublicStorefrontOptionsService';
import { ProductOptionFlags } from '@/services/PublicProductOptionsService';
import { Package, Download, Globe, ChevronLeft, ShoppingCart, Star, ChevronDown, MapPin, Phone, Clock } from 'lucide-react';
import LastViewed from '@/components/directory/LastViewed';
import TenantMapSection from '@/components/tenant/TenantMapSection';

interface ProductQuickCommerceLayoutProps {
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
  productOptFlags?: ProductOptionFlags | null;
}

function QuickCommerceSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 animate-pulse">
      <div className="h-14 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-6">
          <div className="aspect-square bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          <div className="space-y-3">
            <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-10 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-14 w-full bg-neutral-200 dark:bg-neutral-800 rounded-lg mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductQuickCommerceLayout({
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
  productOptFlags,
}: ProductQuickCommerceLayoutProps) {
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
    isRetailStore: hookIsRetailStore,
    optFlags,
    showsLocation: hookShowsLocation,
    showsMap: hookShowsMap,
    showsHours,
    showsQRCodes,
    showsLocationAvailability: hookShowsLocationAvailability,
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

  // Use server-provided productOptFlags directly to avoid hydration mismatches
  // caused by client-side capability hooks returning undefined on initial render.
  const showsLocation = productOptFlags?.showsLocationDisplay ?? hookShowsLocation ?? true;
  const showsMap = productOptFlags?.showsMapDisplay ?? hookShowsMap ?? true;
  const showsLocationAvailability = productOptFlags?.showsLocationAvailability ?? hookShowsLocationAvailability ?? true;
  const showsRecentlyViewed = productOptFlags?.showsRecentlyViewed ?? true;
  const showsCategories = productOptFlags?.showsCategories ?? true;

  // Compute store type from tenant prop for stable SSR/client consistency
  const isOnlineStore = tenant?.storeType === 'online' || tenant?.metadata?.store_type === 'online' || false;
  const isRetailStore = !isOnlineStore && (tenant?.storeType === 'retail' || tenant?.metadata?.store_type === 'retail' || (hookIsRetailStore ?? true));

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const cartButtonRef = useRef<HTMLDivElement>(null);
  const variantSelectorRef = useRef<HTMLDivElement>(null);

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

  const handleGalleryImageClick = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

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

  const scrollToVariantSelector = useCallback(() => {
    variantSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (loading) return <QuickCommerceSkeleton />;

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

  const categoryName =
    typeof product.tenantCategory === 'string'
      ? product.tenantCategory
      : product.tenantCategory?.name || product.category?.name || undefined;
  const categorySlug =
    product.tenantCategory?.slug || product.category?.slug || undefined;

  const metadata = tenant.metadata as any;
  const storeLogoUrl = metadata?.logo_url || displayLogo;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* COMPACT STICKY HEADER */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/tenant/${product.tenantId}`}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Back to store"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </Link>
            {storeLogoUrl && (
              <div className="relative w-7 h-7 flex-shrink-0 hidden sm:block">
                <Image src={storeLogoUrl} alt={displayName || ''} fill className="object-contain rounded" sizes="28px" />
              </div>
            )}
            <Link href={`/tenant/${product.tenantId}`} className="text-sm font-medium text-neutral-900 dark:text-white truncate hover:underline">
              {displayName || tenant.name || 'Store'}
            </Link>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link
              href={`/tenant/${product.tenantId}?search=`}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Search"
            >
              <svg className="w-5 h-5 text-neutral-700 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </Link>
            <Link
              href="/carts"
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        {/* BREADCRUMB */}
        <ProductBreadcrumb
          storeName={displayName || tenant.name || 'Store'}
          storeLogoUrl={showLogo ? storeLogoUrl : null}
          tenantId={product.tenantId}
          tenantSlug={tenantSlug}
          categoryName={categoryName}
          categorySlug={categorySlug}
          productTitle={productTitle}
        />

        {/* INLINE TRUST BAR */}
        <div className="mt-2 mb-4">
          <ProductTrustBar
            productId={product.id}
            tenantId={product.tenantId}
            stock={effectiveStock}
            availability={effectiveAvailability}
            sku={currentSku}
            variant="compact"
          />
        </div>

        {/* SPLIT PANEL — Compact Gallery + Quick Buy */}
        <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-5 lg:gap-8 mb-8">
          {/* LEFT: Gallery */}
          <div className="lg:sticky lg:top-14 lg:self-start">
            <div
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden cursor-pointer"
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
              {safeFeatures.imageGallery && product.imageGallery && product.imageGallery.length > 0 ? (
                safeFeatures.maxGalleryImages >= 10 ? (
                  <ProductGallery
                    gallery={product.imageGallery.slice(0, safeFeatures.maxGalleryImages)}
                    productTitle={product.name}
                  />
                ) : (
                  <BasicProductGallery
                    gallery={product.imageGallery.slice(0, safeFeatures.maxGalleryImages)}
                    productTitle={product.name}
                  />
                )
              ) : product.imageUrl ? (
                <div className="relative w-full aspect-square">
                  <SafeImage src={product.imageUrl} alt={product.name} fill className="object-contain" priority />
                </div>
              ) : (
                <div className="w-full aspect-square bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <svg className="h-20 w-20 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            {lightboxImages.length > 0 && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-1 hidden lg:block">Click to zoom</p>
            )}
          </div>

          {/* RIGHT: Quick Buy Panel */}
          <div className="space-y-4">
            {/* Featured badges */}
            {product.featuredTypes && product.featuredTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <FeaturedTypeBadges featuredTypes={getFeaturedTypeDisplay(product.featuredTypes)} />
              </div>
            )}

            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {productTitle}
            </h1>

            {/* Brand / Condition */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {product.brand && <span>by <span className="font-medium text-neutral-800 dark:text-neutral-200">{product.brand}</span></span>}
              {conditionLabel && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {conditionLabel}
                </span>
              )}
            </div>

            {/* Category link */}
            {product.tenantCategory && (
              <Link
                href={`/tenant/${product.tenantId}?category=${categorySlug}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors no-underline"
              >
                {categoryName}
              </Link>
            )}

            {/* Price */}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              {variantPriceRange ? (
                <div>
                  <span className="text-3xl font-bold text-neutral-900 dark:text-white">
                    From ${(variantPriceRange.minPrice / 100).toFixed(2)}
                  </span>
                  {variantPriceRange.hasSale && (
                    <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">(Sale)</span>
                  )}
                </div>
              ) : (
                <PriceDisplay
                  priceCents={currentListPriceCents}
                  salePriceCents={selectedVariant?.sale_price_cents || product.salePriceCents}
                  variant="large"
                  showSavingsBadge
                  className="mb-1"
                />
              )}
            </div>

            {/* Variant selector */}
            {hasVariants && (
              <div ref={variantSelectorRef} className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">Select Option</span>
                </div>
                <ProductVariantSelector
                  variants={product.variants || []}
                  onVariantChange={setSelectedVariant}
                  selectedVariant={selectedVariant}
                />
              </div>
            )}

            {/* Stock status */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  effectiveAvailability === 'in_stock'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                }`}
              >
                {effectiveAvailability === 'in_stock' ? `In Stock` : 'Out of Stock'}
              </span>
              {effectiveAvailability === 'in_stock' && effectiveStock != null && effectiveStock > 0 && (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{effectiveStock} available</span>
              )}
            </div>

            {/* SKU / Type */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
              {currentSku && <span>SKU: <span className="font-mono">{currentSku}</span></span>}
              {product.productType && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {product.productType === 'physical' && <Package size={12} />}
                  {product.productType === 'digital' && <Download size={12} />}
                  {product.productType === 'hybrid' && <Globe size={12} />}
                  {product.productType.charAt(0).toUpperCase() + product.productType.slice(1)}
                </span>
              )}
            </div>

            {/* LARGE ADD TO CART CTA */}
            {!showStatusPanel && (effectiveCanPurchase || commerceDisabled) && (
              <div ref={cartButtonRef} className="pt-2">
                {/* Quantity */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Qty:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleQuantityDecrement}
                      disabled={quantity <= 1}
                      className="w-8 h-8 flex items-center justify-center rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={quantity}
                      onChange={handleQuantityInput}
                      className="w-14 h-8 text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      aria-label="Quantity"
                    />
                    <button
                      onClick={handleQuantityIncrement}
                      disabled={quantity >= maxQuantity}
                      className="w-8 h-8 flex items-center justify-center rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>

                <AddToCartButton
                  product={{
                    id: selectedVariant?.id || product.id,
                    name: selectedVariant?.variant_name ? `${product.title} - ${selectedVariant.variant_name}` : product.title,
                    sku: currentSku,
                    priceCents: currentPriceCents,
                    salePriceCents: selectedVariant?.sale_price_cents || product.salePriceCents,
                    imageUrl: selectedVariant?.image_url || product.imageUrl,
                    stock: currentAvailability === 'in_stock' ? currentStock || 999 : 0,
                    tenantId: product.tenantId,
                    has_variants: hasVariants,
                  }}
                  variant={selectedVariant}
                  quantity={quantity}
                  tenantName={tenant.metadata?.businessName || tenant.name}
                  tenantLogo={businessLogo}
                  hasActivePaymentGateway={effectiveCanPurchase}
                  defaultGatewayType={effectiveGatewayType}
                  commerceDisabled={commerceDisabled}
                  layout={layout as 'horizontal' | 'stacked'}
                />
              </div>
            )}

            {/* Fulfillment */}
            {!showStatusPanel && fulfillmentPane && <div className="pt-2">{fulfillmentPane}</div>}

            {/* QR Code — compact inline */}
            {resolvedCurrentUrl && showsQRCodes && (
              <div className="pt-2">
                <TenantQRCode
                  url={resolvedCurrentUrl}
                  tenantId={product.tenantId}
                  label="Scan to Share"
                  size={128}
                  showDownload={false}
                  pageType="product"
                  capabilityFlags={optFlags}
                  className="border-0 shadow-none p-0"
                />
              </div>
            )}

            {/* Location availability */}
            {isRetailStore && tenant.organizationId && showsLocationAvailability && (
              <LocationAvailabilitySection
                productSlug={productSlug || product.product_slug || product.productSlug || product.sku || product.id}
                slugType={slugType}
                productName={product.name}
                organizationId={tenant.organizationId}
                preferredTenantId={product.tenantId}
                maxDistance={50}
                maxResults={3}
                useSmartFallback
              />
            )}
          </div>
        </div>

        {/* ACCORDION DETAILS */}
        <section className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden mb-6">
          <ProductDetailTabs
            product={product}
            showMarketingDescription={safeFeatures.customMarketingDescription}
            displayMode="accordion"
          />
        </section>

        {/* PRODUCT ACTIONS */}
        <section className="mb-6">
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

        {/* STORE INFO ACCORDION */}
        {showsLocation && !isOnlineStore && tenant && !showStatusPanel && (
          <section className="mb-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <details className="group">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">Store Information</span>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                {(tenant.metadata?.businessName || tenant.name) && (
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">{tenant.metadata?.businessName || tenant.name}</p>
                )}
                {tenant.metadata?.address && (
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-400" />
                    <span>{tenant.metadata?.address}</span>
                  </p>
                )}
                {tenant.metadata?.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 flex-shrink-0 text-neutral-400" />
                    <span>{tenant.metadata?.phone}</span>
                  </p>
                )}
                {showsHours && hoursStatus && (
                  <p className="flex items-center gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0 text-neutral-400" />
                    <span className={hoursStatus.status === 'open' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {hoursStatus.status === 'open' ? 'Open now' : 'Closed'}
                    </span>
                  </p>
                )}
                <Link
                  href={`/tenant/${product.tenantId}`}
                  className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium"
                >
                  Visit store page →
                </Link>
              </div>
            </details>
          </section>
        )}

        {/* STATUS PANEL */}
        {showStatusPanel && (
          <section className="mb-6">
            <StorefrontStatusPanel tenantId={product.tenantId} tenantInfo={tenant as any} />
          </section>
        )}

        {/* MAP SECTION */}
        {showsMap && tenant?.metadata?.location && (
          <section className="mb-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <TenantMapSection
              location={tenant.metadata.location}
              className="h-48"
            />
          </section>
        )}

        {/* RECENTLY VIEWED */}
        {showsRecentlyViewed && (
          <section className="bg-white dark:bg-neutral-950 py-8 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">Recently Viewed</h2>
            <LastViewed entityType="product" limit={4} />
          </section>
        )}
      </div>

      {/* LIGHTBOX */}
      <ProductImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* STICKY BOTTOM BAR (mobile) */}
      <StickyPurchaseBar
        priceCents={currentPriceCents}
        salePriceCents={selectedVariant?.sale_price_cents || product.salePriceCents}
        availability={effectiveAvailability}
        onAddToCart={() => cartButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        hasVariants={hasVariants}
        variantSelected={!!selectedVariant}
        onSelectVariant={scrollToVariantSelector}
        cartButtonRef={cartButtonRef}
      />
    </div>
  );
}
