'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import { useProductLayoutState } from './layouts/hooks/useProductLayoutState';
import { useQrScanTracking } from '@/hooks/useQrScanTracking';
import { ProductBreadcrumb } from './layouts/shared/ProductBreadcrumb';
import { ProductGalleryPanel } from '@/components/products/sections/ProductGalleryPanel';
import { ProductBottomSections } from '@/components/products/sections/ProductBottomSections';
import { ProductLayoutSkeleton } from '@/components/products/sections/ProductLayoutSkeleton';
import DigitalPurchasePanel from '@/components/products/sections/DigitalPurchasePanel';
import CouponSpotlight from '@/components/storefront/CouponSpotlight';
import { StorefrontOptionFlags, ProductOptionFlags } from '@/services/CapabilityResolutionService';

interface ProductDigitalLayoutProps {
  product: any;
  tenant: any;
  videoPlayer?: React.ReactNode;
  fulfillmentPane?: React.ReactNode;
  productSlug?: string;
  slugType?: string;
  disableQRCode?: boolean;
  initialOptFlags?: StorefrontOptionFlags | null;
  productOptFlags?: ProductOptionFlags | null;
  currentUrl?: string;
  storefrontType?: string;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
  funnelPreview?: React.ReactNode;
}

export default function ProductDigitalLayout({
  product,
  tenant,
  videoPlayer,
  fulfillmentPane,
  productSlug,
  slugType,
  disableQRCode,
  initialOptFlags,
  productOptFlags,
  currentUrl,
  storefrontType,
  socialCommerceFlags,
  funnelPreview,
}: ProductDigitalLayoutProps) {
  const s = useProductLayoutState({ product, tenant, initialOptFlags, currentUrl, productOptFlags });

  // Track QR code scans when visitor arrives via QR code
  useQrScanTracking(product.tenantId, 'product', { productId: product.id });

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

        <div className="mb-4">
          <CouponSpotlight tenantId={product.tenantId} coupon={null} variant="strip" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-5 lg:gap-8 mb-8">
          <ProductGalleryPanel
            product={product}
            safeFeatures={s.safeFeatures}
            videoPlayer={videoPlayer}
            onGalleryClick={s.handleGalleryImageClick}
            layoutVariant="quick-commerce"
            storefrontType={storefrontType}
          />

          <DigitalPurchasePanel
            product={product}
            tenant={tenant}
            layoutState={s}
            socialCommerceFlags={socialCommerceFlags}
            storefrontType={storefrontType}
            fulfillmentPane={fulfillmentPane}
          />
        </div>

        {funnelPreview}

        <ProductBottomSections
          product={product}
          tenant={tenant}
          layoutVariant="quick-commerce"
          safeFeatures={s.safeFeatures}
          resolvedCurrentUrl={s.resolvedCurrentUrl}
          showsLocation={false}
          showsMap={false}
          showsHours={false}
          isRetailStore={false}
          isOnlineStore={true}
          hoursStatus={null}
        />
      </div>
    </div>
  );
}
