'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import { useProductLayoutState } from './layouts/hooks/useProductLayoutState';
import { ProductBreadcrumb } from './layouts/shared/ProductBreadcrumb';
import { ProductTrustBar } from './layouts/shared/ProductTrustBar';
import { StickyPurchaseBar } from './layouts/shared/StickyPurchaseBar';
import { ProductImageLightbox } from './layouts/shared/ProductImageLightbox';
import { ProductGalleryPanel } from '@/components/products/sections/ProductGalleryPanel';
import { ProductPurchasePanel } from '@/components/products/sections/ProductPurchasePanel';
import { ProductBottomSections } from '@/components/products/sections/ProductBottomSections';
import { ProductLayoutSkeleton } from '@/components/products/sections/ProductLayoutSkeleton';
import { StorefrontOptionFlags, ProductOptionFlags } from '@/services/CapabilityResolutionService';

interface ProductQuickCommerceLayoutProps {
  product: any;
  tenant: any;
  storeStatus?: any;
  gallery?: React.ReactNode;
  videoPlayer?: React.ReactNode;
  fulfillmentPane?: React.ReactNode;
  slug?: string;
  currentUrl?: string;
  productSlug?: string;
  slugType?: string;
  disableQRCode?: boolean;
  initialOptFlags?: StorefrontOptionFlags | null;
  productOptFlags?: ProductOptionFlags | null;
  storefrontType?: string;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
}

export default function ProductQuickCommerceLayout({
  product,
  tenant,
  videoPlayer,
  fulfillmentPane,
  productSlug,
  slugType,
  disableQRCode,
  initialOptFlags,
  productOptFlags,
  storefrontType,
  socialCommerceFlags,
}: ProductQuickCommerceLayoutProps) {
  const s = useProductLayoutState({ product, tenant, initialOptFlags, currentUrl: undefined, productOptFlags });

  // Use server-provided flags directly to avoid hydration mismatches
  const showsLocation = productOptFlags?.showsLocationDisplay ?? s.showsLocation ?? true;
  const showsMap = productOptFlags?.showsMapDisplay ?? s.showsMap ?? true;
  const showsHours = productOptFlags?.showsHoursDisplay ?? s.showsHours ?? true;
  const showsLocationAvailability = productOptFlags?.showsLocationAvailability ?? s.showsLocationAvailability ?? true;
  const isOnlineStore = tenant?.storeType === 'online' || tenant?.metadata?.store_type === 'online' || false;
  const isRetailStore = !isOnlineStore && (tenant?.storeType === 'retail' || tenant?.metadata?.store_type === 'retail' || (s.isRetailStore ?? true));

  if (s.loading) return <ProductLayoutSkeleton layoutVariant="quick-commerce" />;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Compact sticky header */}
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
            {s.storeLogoUrl && (
              <div className="relative w-7 h-7 flex-shrink-0 hidden sm:block">
                <Image src={s.storeLogoUrl} alt={s.displayName || ''} fill className="object-contain rounded" sizes="28px" />
              </div>
            )}
            <Link href={`/tenant/${product.tenantId}`} className="text-sm font-medium text-neutral-900 dark:text-white truncate hover:underline">
              {s.displayName || tenant.name || 'Store'}
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
        <ProductBreadcrumb
          storeName={s.displayName || tenant.name || 'Store'}
          storeLogoUrl={s.showLogo ? s.storeLogoUrl : null}
          tenantId={product.tenantId}
          tenantSlug={s.tenantSlug}
          categoryName={s.categoryName}
          categorySlug={s.categorySlug}
          productTitle={s.productTitle}
        />

        <div className="mt-2 mb-4">
          <ProductTrustBar
            productId={product.id}
            tenantId={product.tenantId}
            stock={s.effectiveStock}
            availability={s.effectiveAvailability}
            sku={s.currentSku}
            variant="compact"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-5 lg:gap-8 mb-8">
          <ProductGalleryPanel
            product={product}
            safeFeatures={s.safeFeatures}
            videoPlayer={videoPlayer}
            onGalleryClick={s.handleGalleryImageClick}
            layoutVariant="quick-commerce"
            storefrontType={storefrontType}
          />

          <ProductPurchasePanel
            product={product}
            tenant={tenant}
            layoutVariant="quick-commerce"
            safeFeatures={s.safeFeatures}
            selectedVariant={s.selectedVariant}
            setSelectedVariant={s.setSelectedVariant}
            quantity={s.quantity}
            hasVariants={s.hasVariants}
            currentPriceCents={s.currentPriceCents}
            currentListPriceCents={s.currentListPriceCents}
            currentStock={s.currentStock}
            currentSku={s.currentSku}
            currentAvailability={s.currentAvailability}
            variantPriceRange={s.variantPriceRange}
            variantStockInfo={s.variantStockInfo}
            effectiveCanPurchase={s.effectiveCanPurchase}
            effectiveGatewayType={s.effectiveGatewayType}
            commerceDisabled={s.commerceDisabled}
            showStatusPanel={s.showStatusPanel}
            showsQRCodes={s.showsQRCodes}
            showsLocationAvailability={showsLocationAvailability}
            optFlags={s.optFlags}
            resolvedCurrentUrl={s.resolvedCurrentUrl}
            businessLogo={s.businessLogo}
            layout={s.layout}
            isRetailStore={isRetailStore}
            productTitle={s.productTitle}
            conditionLabel={s.conditionLabel}
            effectiveAvailability={s.effectiveAvailability}
            effectiveStock={s.effectiveStock}
            categoryName={s.categoryName}
            categorySlug={s.categorySlug}
            cartButtonRef={s.cartButtonRef}
            variantSelectorRef={s.variantSelectorRef}
            maxQuantity={s.maxQuantity}
            handleQuantityDecrement={s.handleQuantityDecrement}
            handleQuantityIncrement={s.handleQuantityIncrement}
            handleQuantityInput={s.handleQuantityInput}
            fulfillmentPane={fulfillmentPane}
            disableQRCode={disableQRCode}
            productSlug={productSlug}
            slugType={slugType}
            storefrontType={storefrontType}
            socialCommerceFlags={socialCommerceFlags}
          />
        </div>

        <ProductBottomSections
          product={product}
          tenant={tenant}
          layoutVariant="quick-commerce"
          safeFeatures={s.safeFeatures}
          resolvedCurrentUrl={s.resolvedCurrentUrl}
          showsLocation={showsLocation}
          showsMap={showsMap}
          showsHours={showsHours}
          isRetailStore={isRetailStore}
          isOnlineStore={isOnlineStore}
          hoursStatus={s.hoursStatus}
        />
      </div>

      <ProductImageLightbox
        images={s.lightboxImages}
        initialIndex={s.lightboxIndex}
        isOpen={s.lightboxOpen}
        onClose={() => s.setLightboxOpen(false)}
      />

      <StickyPurchaseBar
        priceCents={s.currentPriceCents}
        salePriceCents={s.selectedVariant?.sale_price_cents || product.salePriceCents}
        availability={s.effectiveAvailability}
        onAddToCart={() => s.cartButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        hasVariants={s.hasVariants}
        variantSelected={!!s.selectedVariant}
        onSelectVariant={s.scrollToVariantSelector}
        cartButtonRef={s.cartButtonRef}
      />
    </div>
  );
}
