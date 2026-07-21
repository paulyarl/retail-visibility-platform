'use client';

import React from 'react';
import { useProductLayoutState } from './layouts/hooks/useProductLayoutState';
import { useQrScanTracking } from '@/hooks/useQrScanTracking';
import { ProductBreadcrumb } from './layouts/shared/ProductBreadcrumb';
import { ProductTrustBar } from './layouts/shared/ProductTrustBar';
import { StickyPurchaseBar } from './layouts/shared/StickyPurchaseBar';
import { ProductImageLightbox } from './layouts/shared/ProductImageLightbox';
import { ProductGalleryPanel } from '@/components/products/sections/ProductGalleryPanel';
import { ProductPurchasePanel } from '@/components/products/sections/ProductPurchasePanel';
import { ProductBottomSections } from '@/components/products/sections/ProductBottomSections';
import { ProductLayoutSkeleton } from '@/components/products/sections/ProductLayoutSkeleton';
import CouponSpotlight from '@/components/storefront/CouponSpotlight';
import { StorefrontOptionFlags, ProductOptionFlags } from '@/services/CapabilityResolutionService';

interface ProductShowcaseLayoutProps {
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
  funnelPreview?: React.ReactNode;
}

export function ProductShowcaseLayout({
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
  funnelPreview,
}: ProductShowcaseLayoutProps) {
  const s = useProductLayoutState({ product, tenant, initialOptFlags, currentUrl: undefined, productOptFlags });

  // Track QR code scans when visitor arrives via QR code
  useQrScanTracking(product.tenantId, 'product', { productId: product.id });

  if (s.loading) return <ProductLayoutSkeleton layoutVariant="showcase" />;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ProductBreadcrumb
          storeName={s.displayName || tenant.name || 'Store'}
          storeLogoUrl={s.showLogo ? s.storeLogoUrl : null}
          tenantId={product.tenantId}
          tenantSlug={s.tenantSlug}
          categoryName={s.categoryName}
          categorySlug={s.categorySlug}
          productTitle={s.productTitle}
        />

        <div className="mb-6">
          <ProductTrustBar
            productId={product.id}
            tenantId={product.tenantId}
            stock={s.effectiveStock}
            availability={s.effectiveAvailability}
            sku={s.currentSku}
            variant="default"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-8 lg:gap-12 mb-10">
          <ProductGalleryPanel
            product={product}
            safeFeatures={s.safeFeatures}
            videoPlayer={videoPlayer}
            onGalleryClick={s.handleGalleryImageClick}
            layoutVariant="showcase"
            storefrontType={storefrontType}
          />

          <ProductPurchasePanel
            product={product}
            tenant={tenant}
            layoutVariant="showcase"
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
            showsLocationAvailability={s.showsLocationAvailability}
            optFlags={s.optFlags}
            resolvedCurrentUrl={s.resolvedCurrentUrl}
            businessLogo={s.businessLogo}
            layout={s.layout}
            isRetailStore={s.isRetailStore}
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

        {funnelPreview}

        <ProductBottomSections
          product={product}
          tenant={tenant}
          layoutVariant="showcase"
          safeFeatures={s.safeFeatures}
          resolvedCurrentUrl={s.resolvedCurrentUrl}
          showsLocation={s.showsLocation}
          showsMap={s.showsMap}
          showsHours={s.showsHours}
          isRetailStore={s.isRetailStore}
          isOnlineStore={s.isOnlineStore}
          hoursStatus={s.hoursStatus}
        />
      </div>

      <ProductImageLightbox
        images={s.lightboxImages}
        initialIndex={s.lightboxIndex}
        isOpen={s.lightboxOpen}
        onClose={() => s.setLightboxOpen(false)}
      />

      <div className="hidden lg:block lg:w-72 shrink-0 mb-4">
        <CouponSpotlight tenantId={tenant?.id || ''} coupon={null} variant="card" />
      </div>

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

export default ProductShowcaseLayout;
