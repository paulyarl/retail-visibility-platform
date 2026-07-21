'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { DigitalProductBadge } from '@/components/products/DigitalProductBadge';
import { DigitalWhatYouGetCard } from './DigitalWhatYouGetCard';
import ProductVariantSelector from '@/components/products/ProductVariantSelector';
import { SocialShareButtons } from '../type-sections/SocialShareButtons';
import { StickyPurchaseBar } from '@/app/products/[id]/layouts/shared/StickyPurchaseBar';
import { useMultiCart } from '@/hooks/useMultiCart';
import { Download, ShieldCheck, Key, Zap, ShoppingCart, Check } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface DigitalPurchasePanelProps {
  product: any;
  tenant: any;
  layoutState: any;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
  storefrontType?: string;
  fulfillmentPane?: React.ReactNode;
}

export function DigitalPurchasePanel({
  product,
  tenant,
  layoutState: s,
  socialCommerceFlags,
  storefrontType,
}: DigitalPurchasePanelProps) {
  const router = useRouter();
  const { addToCart } = useMultiCart();
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState(false);

  const tenantName = tenant?.metadata?.businessName || tenant?.businessName || tenant?.name || 'Store';
  const tenantLogo = s.businessLogo;
  const productTitle = s.productTitle || product.title;

  const isOnSale = s.currentPriceCents < s.currentListPriceCents;
  const effectivePrice = s.currentPriceCents;
  const listPrice = s.currentListPriceCents;

  const canShare = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) || storefrontType === 'social';

  const needsVariantSelection = s.hasVariants && !s.selectedVariant;
  const isAvailable = s.effectiveAvailability === 'in_stock' || s.effectiveAvailability === 'available';

  const buildCartItem = () => {
    const variant = s.selectedVariant;
    const quantity = s.quantity || 1;
    const baseName = productTitle;
    const displayName = variant?.variant_name ? `${baseName} - ${variant.variant_name}` : baseName;
    const sku = variant?.sku || product.sku;
    const imageUrl = variant?.image_url || product.imageUrl || product.imageUrl;
    const listPriceCents = isOnSale ? listPrice : undefined;
    const discountCents = isOnSale ? (listPrice - effectivePrice) * quantity : undefined;

    return {
      product_id: product.id,
      product_name: displayName,
      product_sku: sku,
      quantity,
      price_cents: effectivePrice,
      list_price_cents: listPriceCents,
      discount_cents: discountCents,
      product_image: imageUrl,
      variant_id: variant?.id,
      variant_name: variant?.variant_name,
      variant_attributes: variant?.attributes,
      suggested_gateway_type: s.effectiveGatewayType,
      suggested_gateway_id: product.payment_gateway_id || undefined,
      stock: s.currentStock ?? 999,
      productType: product.productType || 'digital',
    };
  };

  const handleAddToCart = async () => {
    if (needsVariantSelection) return;
    try {
      await addToCart(product.tenantId, tenantName, buildCartItem(), tenantLogo);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      clientLogger.error('[DigitalPurchasePanel] Add to cart failed:', { detail: error });
    }
  };

  const handleBuyNow = async () => {
    if (needsVariantSelection || !s.effectiveCanPurchase) return;
    setBuying(true);
    try {
      await addToCart(product.tenantId, tenantName, buildCartItem(), tenantLogo);
      const variantId = s.selectedVariant?.id ? `&variant_id=${s.selectedVariant.id}` : '';
      router.push(`/checkout?direct_checkout=true&product_id=${product.id}${variantId}&quantity=${s.quantity || 1}`);
    } catch (error) {
      clientLogger.error('[DigitalPurchasePanel] Buy now failed:', { detail: error });
    } finally {
      setBuying(false);
    }
  };

  const trustBadges = [
    { icon: Download, label: 'Instant Access' },
    { icon: ShieldCheck, label: 'Secure Checkout' },
  ];

  if (product.digitalDeliveryMethod === 'license_key') {
    trustBadges.push({ icon: Key, label: 'License Key Provided' });
  }

  return (
    <div className="space-y-5" ref={s.cartButtonRef}>
      {/* Type + Delivery Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <DigitalProductBadge
          productType={product.productType || 'digital'}
          deliveryMethod={product.digitalDeliveryMethod}
          showDeliveryMethod
          accessDurationDays={product.accessDurationDays ?? undefined}
          downloadLimit={product.downloadLimit ?? undefined}
        />
      </div>

      {/* Product Title */}
      <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
        {productTitle}
      </h1>

      {/* Price */}
      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <PriceDisplay
          priceCents={listPrice}
          salePriceCents={isOnSale ? effectivePrice : null}
          variant="large"
          showSavingsBadge
          className="mb-1"
        />
      </div>

      {/* Availability */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            isAvailable
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
          }`}
        >
          {isAvailable ? 'Available' : 'Unavailable'}
        </span>
      </div>

      {/* Variant Selector */}
      {s.hasVariants && (
        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
            Select Option
          </div>
          <ProductVariantSelector
            variants={product.variants || []}
            onVariantChange={s.setSelectedVariant}
            selectedVariant={s.selectedVariant}
            productType={product.productType || 'digital'}
          />
        </div>
      )}

      {/* What You Get */}
      <DigitalWhatYouGetCard product={product} />

      {/* Quantity */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">Qty:</span>
        <div className="flex items-center gap-1">
          <button
            onClick={s.handleQuantityDecrement}
            disabled={s.quantity <= 1}
            className="w-8 h-8 flex items-center justify-center rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={s.quantity}
            onChange={s.handleQuantityInput}
            className="text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-14 h-8"
            aria-label="Quantity"
          />
          <button
            onClick={s.handleQuantityIncrement}
            className="w-8 h-8 flex items-center justify-center rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center gap-3">
        {trustBadges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div key={badge.label} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span>{badge.label}</span>
            </div>
          );
        })}
      </div>

      {/* Purchase Actions */}
      <div className="flex flex-col gap-2 pt-2">
        {added && (
          <div className="p-2.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
            <Check className="w-4 h-4" />
            Added to cart
          </div>
        )}
        <Button
          onClick={handleBuyNow}
          disabled={!s.effectiveCanPurchase || needsVariantSelection}
          loading={buying}
          variant="gradient"
          size="lg"
          className="w-full"
        >
          <Zap className="w-4 h-4" />
          Buy Now &rarr; Instant Access
        </Button>
        <Button
          onClick={handleAddToCart}
          disabled={!s.effectiveCanPurchase || needsVariantSelection}
          variant="outline"
          size="lg"
          className="w-full"
        >
          {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
          Add to Cart
        </Button>
      </div>

      {/* Social Share */}
      {canShare && (
        <SocialShareButtons
          product={product}
          currentUrl={s.resolvedCurrentUrl}
          layoutVariant="quick-commerce"
          storefrontType={storefrontType}
          canUseShareButtons={canShare}
        />
      )}

      {/* Mobile sticky purchase bar */}
      <StickyPurchaseBar
        priceCents={listPrice}
        salePriceCents={isOnSale ? effectivePrice : null}
        availability={s.effectiveAvailability}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        hasVariants={s.hasVariants}
        variantSelected={!!s.selectedVariant}
        onSelectVariant={s.scrollToVariantSelector}
        cartButtonRef={s.cartButtonRef}
      />
    </div>
  );
}

export default DigitalPurchasePanel;
