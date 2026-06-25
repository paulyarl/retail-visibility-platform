'use client';

import React from 'react';
import Link from 'next/link';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { AddToCartButton } from '@/components/products/AddToCartButton';
import ProductVariantSelector from '@/components/products/ProductVariantSelector';
import { FeaturedTypeBadges } from '@/components/products/FeaturedTypeBadges';
import { getFeaturedTypeDisplay } from '@/types/product-display';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { LocationAvailabilitySection } from '@/components/products/LocationAvailabilitySection';
import { Package, Download, Globe, Calendar } from 'lucide-react';
import { SocialShareButtons } from '../type-sections/SocialShareButtons';

type LayoutVariant = 'classic' | 'showcase' | 'quick-commerce';

interface ProductPurchasePanelProps {
  product: any;
  tenant: any;
  layoutVariant?: LayoutVariant;
  // From useProductLayoutState
  safeFeatures: any;
  selectedVariant: any;
  setSelectedVariant: (v: any) => void;
  quantity: number;
  hasVariants: boolean;
  currentPriceCents: number;
  currentListPriceCents: number;
  currentStock: number | undefined;
  currentSku: string;
  currentAvailability: string;
  variantPriceRange: any;
  variantStockInfo: any;
  effectiveCanPurchase: boolean;
  effectiveGatewayType: string | undefined;
  commerceDisabled: boolean;
  showStatusPanel: boolean;
  showsQRCodes: boolean;
  showsLocationAvailability: boolean;
  optFlags: any;
  resolvedCurrentUrl: string;
  businessLogo: string | undefined;
  layout: string;
  isRetailStore: boolean;
  // Derived values
  productTitle: string;
  conditionLabel: string | null;
  effectiveAvailability: string;
  effectiveStock: number | undefined;
  categoryName: string | undefined;
  categorySlug: string | undefined;
  // Refs + handlers
  cartButtonRef: React.RefObject<HTMLDivElement | null>;
  variantSelectorRef: React.RefObject<HTMLDivElement | null>;
  maxQuantity: number;
  handleQuantityDecrement: () => void;
  handleQuantityIncrement: () => void;
  handleQuantityInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Optional props
  fulfillmentPane?: React.ReactNode;
  disableQRCode?: boolean;
  productSlug?: string;
  slugType?: string;
  storefrontType?: string;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
}

export function ProductPurchasePanel({
  product,
  tenant,
  layoutVariant = 'showcase',
  safeFeatures,
  selectedVariant,
  setSelectedVariant,
  quantity,
  hasVariants,
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
  showStatusPanel,
  showsQRCodes,
  showsLocationAvailability,
  optFlags,
  resolvedCurrentUrl,
  businessLogo,
  layout,
  isRetailStore,
  productTitle,
  conditionLabel,
  effectiveAvailability,
  effectiveStock,
  categoryName,
  categorySlug,
  cartButtonRef,
  variantSelectorRef,
  maxQuantity,
  handleQuantityDecrement,
  handleQuantityIncrement,
  handleQuantityInput,
  fulfillmentPane,
  disableQRCode,
  productSlug,
  slugType,
  storefrontType,
  socialCommerceFlags,
}: ProductPurchasePanelProps) {
  const isQuickCommerce = layoutVariant === 'quick-commerce';
  const isServiceProduct = product.productType === 'service';
  const isHybridProduct = product.productType === 'hybrid';
  const isSocialStorefront = storefrontType === 'social';
  const canShare = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) || isSocialStorefront;
  const spaceY = isQuickCommerce ? 'space-y-4' : 'space-y-6';
  const titleClass = isQuickCommerce
    ? 'text-2xl lg:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white'
    : 'text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white';

  return (
    <div className={spaceY}>
      {/* Featured Type Badges */}
      {product.featuredTypes && product.featuredTypes.length > 0 && (
        <div className={isQuickCommerce ? 'flex flex-wrap gap-1.5' : ''}>
          <FeaturedTypeBadges
            featuredTypes={getFeaturedTypeDisplay(product.featuredTypes)}
            clickable
            showAll
          />
        </div>
      )}

      {/* Product Title */}
      <h1 className={titleClass}>{productTitle}</h1>

      {/* Brand · Manufacturer · Condition */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        {product.brand && (
          <span>
            by{' '}
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              {product.brand}
            </span>
          </span>
        )}
        {product.manufacturer && !isQuickCommerce && (
          <>
            {product.brand && (
              <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">·</span>
            )}
            <span>Manufacturer: {product.manufacturer}</span>
          </>
        )}
        {conditionLabel && (
          <>
            {(product.brand || (product.manufacturer && !isQuickCommerce)) && (
              <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">·</span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {conditionLabel}
            </span>
          </>
        )}
      </div>

      {/* Category badge link */}
      {product.tenantCategory && (
        <Link
          title={`Browse to store's ${categoryName} products`}
          href={`/tenant/${product.tenantId}?category=${categorySlug}`}
          className={
            isQuickCommerce
              ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors no-underline'
              : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors no-underline'
          }
        >
          {!isQuickCommerce && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )}
          {categoryName}
        </Link>
      )}

      {/* Price Display */}
      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
        {variantPriceRange ? (
          <div className={isQuickCommerce ? '' : 'mb-1'}>
            <span className={isQuickCommerce ? 'text-3xl font-bold text-neutral-900 dark:text-white' : 'text-2xl font-bold text-gray-900 dark:text-white'}>
              From ${(variantPriceRange.minPrice / 100).toFixed(2)}
            </span>
            {variantPriceRange.hasSale && (
              <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                {isQuickCommerce ? '(Sale)' : '(Sale available)'}
              </span>
            )}
          </div>
        ) : (
          <PriceDisplay
            priceCents={currentListPriceCents}
            salePriceCents={selectedVariant?.sale_price_cents || product.salePriceCents}
            variant="large"
            showSavingsBadge={true}
            className="mb-1"
          />
        )}
      </div>

      {/* Variant Selector */}
      {hasVariants && (
        <div
          ref={variantSelectorRef}
          className={
            isQuickCommerce
              ? 'p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg'
              : 'p-4 bg-gradient-to-r from-rose-50 to-indigo-50 dark:from-rose-950/30 dark:to-indigo-950/30 border border-rose-200 dark:border-rose-800 rounded-lg shadow-sm'
          }
        >
          <div className="flex items-center gap-2 mb-2">
            <Package className={isQuickCommerce ? 'w-4 h-4 text-primary-600 dark:text-primary-400' : 'w-4 h-4 text-rose-600 dark:text-rose-400'} />
            <span className={isQuickCommerce ? 'text-sm font-semibold text-neutral-900 dark:text-white' : 'text-sm font-semibold text-rose-900 dark:text-rose-300'}>
              {isQuickCommerce ? 'Select Option' : 'Select Options'}
            </span>
          </div>
          <ProductVariantSelector
            variants={product.variants || []}
            onVariantChange={setSelectedVariant}
            selectedVariant={selectedVariant}
          />
        </div>
      )}

      {/* Availability Status */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            effectiveAvailability === 'in_stock'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
          }`}
        >
          {effectiveAvailability === 'in_stock'
            ? isQuickCommerce
              ? 'In Stock'
              : `✓ In Stock${!hasVariants && effectiveStock ? ` (${effectiveStock} available)` : ''}`
            : isQuickCommerce
              ? 'Out of Stock'
              : '✗ Out of Stock'}
        </span>
        {hasVariants && effectiveAvailability === 'in_stock' && !selectedVariant && variantStockInfo && !isQuickCommerce && (
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
        {isQuickCommerce && effectiveAvailability === 'in_stock' && effectiveStock != null && effectiveStock > 0 && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{effectiveStock} available</span>
        )}
      </div>

      {/* SKU / Product Type */}
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${isQuickCommerce ? 'text-xs' : 'text-sm'} text-neutral-500 dark:text-neutral-400`}>
        {currentSku && (
          <span>SKU: <span className="font-mono">{currentSku}</span></span>
        )}
        {product.productType && (
          <>
            {currentSku && <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">·</span>}
            <span className={`inline-flex items-center gap-1 ${isQuickCommerce ? 'px-2 py-0.5 rounded' : 'px-2 py-0.5 rounded-full'} text-xs font-medium bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-neutral-300`}>
              {product.productType === 'physical' && <Package size={isQuickCommerce ? 12 : 14} />}
              {product.productType === 'digital' && <Download size={isQuickCommerce ? 12 : 14} />}
              {product.productType === 'hybrid' && <Globe size={isQuickCommerce ? 12 : 14} />}
              {product.productType === 'service' && <Calendar size={isQuickCommerce ? 12 : 14} />}
              {product.productType.charAt(0).toUpperCase() + product.productType.slice(1)}
            </span>
          </>
        )}
      </div>

      {/* Quantity + Add to Cart / Book Now */}
      {!showStatusPanel && (effectiveCanPurchase || commerceDisabled) && (
        isServiceProduct ? (
          <div
            ref={cartButtonRef}
            className={
              isQuickCommerce
                ? 'pt-2'
                : 'p-5 bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-950/50 dark:to-indigo-950/50 rounded-xl border-2 border-primary-200 dark:border-primary-800 shadow-sm'
            }
          >
            {!isQuickCommerce && (
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="flex items-center justify-center h-5 text-primary-600 dark:text-primary-400" />
                <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">Book This Service</span>
              </div>
            )}
            {(() => {
              const bookingUrl = product.metadata?.bookingUrl || product.metadata?.booking_url;
              const bookingPhone = product.metadata?.bookingPhone || product.metadata?.booking_phone;
              if (bookingUrl) {
                return (
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors ${isQuickCommerce ? 'text-sm' : 'text-base'}`}
                  >
                    <Calendar size={isQuickCommerce ? 16 : 20} />
                    Book Now
                  </a>
                );
              }
              if (bookingPhone) {
                return (
                  <a
                    href={`tel:${bookingPhone}`}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors ${isQuickCommerce ? 'text-sm' : 'text-base'}`}
                  >
                    <Calendar size={isQuickCommerce ? 16 : 20} />
                    Call to Book: {bookingPhone}
                  </a>
                );
              }
              return (
                <p className={`text-neutral-600 dark:text-neutral-400 ${isQuickCommerce ? 'text-xs' : 'text-sm'}`}>
                  Contact the store to schedule this service.
                </p>
              );
            })()}
          </div>
        ) : (
        <div
          ref={cartButtonRef}
          className={
            isQuickCommerce
              ? 'pt-2'
              : 'p-5 bg-gradient-to-br from-green-50 to-indigo-50 dark:from-green-950/50 dark:to-indigo-950/50 rounded-xl border-2 border-green-200 dark:border-green-800 shadow-sm'
          }
        >
          {!isQuickCommerce && (
            <div className="flex items-center gap-2 mb-3">
              <Package className="flex items-center justify-center h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-300">Add to Cart</span>
            </div>
          )}

          {/* Quantity Selector */}
          <div className={`flex items-center gap-3 ${isQuickCommerce ? '' : 'mb-3'}`}>
            <span className="text-sm text-gray-600 dark:text-neutral-400">
              {isQuickCommerce ? 'Qty:' : 'Quantity:'}
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
                className={`text-center border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 ${isQuickCommerce ? 'focus:ring-primary-500 w-14 h-8' : 'focus:ring-blue-500 w-16 h-8'}`}
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
            {currentStock != null && currentStock > 0 && !isQuickCommerce && (
              <span className="text-xs text-gray-400 dark:text-neutral-500">max {currentStock}</span>
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
        )
      )}

      {/* Hybrid: Digital Download Companion Hint */}
      {isHybridProduct && !showStatusPanel && (effectiveCanPurchase || commerceDisabled) && (
        <div className={`flex items-center gap-2 ${isQuickCommerce ? 'text-xs' : 'text-sm'} text-neutral-600 dark:text-neutral-400`}>
          <Download size={isQuickCommerce ? 14 : 16} className="text-indigo-500 dark:text-indigo-400" />
          <span>Includes digital download — access link provided after checkout</span>
        </div>
      )}

      {/* Fulfillment Options */}
      {!showStatusPanel && fulfillmentPane && (
        <div className={isQuickCommerce ? 'pt-2' : ''}>{fulfillmentPane}</div>
      )}

      {/* QR Code */}
      {!showStatusPanel && !disableQRCode && showsQRCodes && (
        <div className={isQuickCommerce ? 'pt-2' : 'py-2'}>
          <TenantQRCode
            url={resolvedCurrentUrl}
            tenantId={product.tenantId}
            label="Scan to Share"
            pageType="product"
            capabilityFlags={optFlags}
            size={128}
            showDownload={false}
            className={isQuickCommerce ? 'border-0 shadow-none p-0' : undefined}
          />
        </div>
      )}

      {/* Custom CTA (showcase only) */}
      {!isQuickCommerce && !showStatusPanel && safeFeatures.customCta && product.customCta && (
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

      {/* Multi-Location Availability */}
      {isRetailStore && tenant.organizationId && showsLocationAvailability && (
        <LocationAvailabilitySection
          productSlug={productSlug || product.product_slug || product.productSlug || product.sku || product.id}
          slugType={slugType}
          productName={product.name}
          organizationId={tenant.organizationId}
          preferredTenantId={product.tenantId}
          maxDistance={50}
          maxResults={isQuickCommerce ? 3 : 5}
          useSmartFallback={true}
        />
      )}

      {/* Social Share Buttons — gated by storefrontType='social' or socialCommerceFlags */}
      {canShare && (
        <SocialShareButtons
          product={product}
          currentUrl={resolvedCurrentUrl}
          layoutVariant={layoutVariant}
          storefrontType={storefrontType}
          canUseShareButtons={canShare}
        />
      )}
    </div>
  );
}
