'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { ProductFunnelStep } from '@/services/ProductFunnelService';
import { Download, Package, Globe, Tag, Clock, Zap, ShoppingCart } from 'lucide-react';

interface FunnelOfferCardProps {
  step: ProductFunnelStep;
  productType: 'physical' | 'digital' | 'hybrid';
  onClick?: () => void;
  onBuyNow?: () => void;
}

const STEP_TIMING: Record<string, string> = {
  order_bump: 'Available at checkout',
  upsell: 'Offered after purchase',
  downsell: 'Offered after purchase',
  oto: 'Limited time',
  coupon_offer: 'Applied at checkout',
};

const STEP_BADGE_COLORS: Record<string, string> = {
  order_bump: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  upsell: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  downsell: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  oto: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  coupon_offer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

function formatCouponDiscount(coupon: NonNullable<ProductFunnelStep['coupon']>) {
  if (coupon.discount_type === 'percentage') {
    return `${coupon.discount_value}% OFF`;
  }
  if (coupon.discount_type === 'fixed_amount') {
    return `$${(coupon.discount_value / 100).toFixed(2)} OFF`;
  }
  return `${coupon.discount_value} OFF`;
}

export function FunnelOfferCard({ step, productType, onClick, onBuyNow }: FunnelOfferCardProps) {
  const offer = step.offer_item;
  const offerType = offer?.product_type || 'physical';
  const isCoupon = step.step_type === 'coupon_offer';
  const isUnavailable = !isCoupon && (!offer || !offer.name || offer.is_active === false ||
    offer.status === 'inactive' || offer.status === 'archived' || offer.status === 'trashed');
  const isCouponExpired = isCoupon && (!step.coupon || step.coupon.is_expired === true || step.coupon.is_active === false);

  const listPrice = isCoupon || isUnavailable ? null : (step.price_cents ?? offer?.price_cents ?? 0);
  const salePrice = isCoupon || isUnavailable
    ? null
    : step.discount_cents && listPrice
      ? Math.max(0, listPrice - step.discount_cents)
      : null;

  const productTypeLabel = (() => {
    if (isUnavailable) {
      return { icon: Package, text: 'Offer unavailable', className: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400' };
    }
    if (isCouponExpired) {
      return { icon: Tag, text: 'Coupon expired', className: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400' };
    }
    if (isCoupon) {
      return productType === 'physical'
        ? { icon: Tag, text: 'Use on next purchase', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' }
        : { icon: Tag, text: 'Apply to this purchase', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
    }
    if (offerType === 'digital') {
      return { icon: Download, text: 'Instant access', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    }
    if (offerType === 'hybrid') {
      return { icon: Globe, text: 'Instant + shipped', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' };
    }
    return { icon: Package, text: 'Ships with order', className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' };
  })();

  const stockUrgency =
    offerType === 'physical' && offer?.stock != null && offer.stock < 5 && offer.stock > 1
      ? `Only ${offer.stock} left`
      : offerType === 'physical' && offer?.stock === 1
        ? 'Only 1 left!'
        : null;

  const timing = STEP_TIMING[step.step_type] || 'Offer';
  const badgeClass = STEP_BADGE_COLORS[step.step_type] || 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';

  const isInteractive = !isUnavailable && !isCouponExpired;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isInteractive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      aria-disabled={!isInteractive}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        isInteractive ? 'hover:shadow-md cursor-pointer' : 'opacity-70 cursor-not-allowed'
      }`}
    >
      {/* Image / Coupon Icon */}
      <div className="relative mb-3 aspect-video rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        {isCoupon ? (
          <div className="flex flex-col items-center text-purple-600 dark:text-purple-400">
            <Tag className="w-10 h-10 mb-1" />
            <span className="text-xs font-semibold">COUPON</span>
          </div>
        ) : offer?.image_url ? (
          <Image
            src={offer.image_url}
            alt={step.display_title || 'Offer'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <Package className="w-10 h-10 text-neutral-400" />
        )}
      </div>

      {/* Step type badge */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
          {step.step_type === 'oto' ? <Clock className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
          {timing}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white line-clamp-1">
        {step.display_title || (isCoupon ? `Coupon: ${step.coupon?.code || ''}` : offer?.name || 'Offer')}
      </h3>
      {step.display_description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-1">
          {step.display_description}
        </p>
      )}

      {/* Coupon code and discount */}
      {isCoupon && step.coupon && (
        <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <p className="text-sm font-mono font-semibold text-purple-900 dark:text-purple-200">{step.coupon.code}</p>
          <p className="text-xs text-purple-700 dark:text-purple-300">{formatCouponDiscount(step.coupon)}</p>
        </div>
      )}

      {/* Price */}
      {!isUnavailable && !isCouponExpired && !isCoupon && listPrice != null && (
        <div className="mt-3">
          <PriceDisplay
            priceCents={listPrice}
            salePriceCents={salePrice && salePrice < listPrice ? salePrice : null}
            variant="default"
            showSavingsBadge
          />
        </div>
      )}

      {/* Product type label + stock urgency */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${productTypeLabel.className}`}>
          <productTypeLabel.icon className="w-3 h-3" />
          {productTypeLabel.text}
        </span>
        {stockUrgency && (
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {stockUrgency}
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="mt-auto pt-4">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onBuyNow ? onBuyNow() : onClick?.();
          }}
          variant="outline"
          size="sm"
          disabled={!isInteractive}
          className="w-full"
        >
          <ShoppingCart className="w-4 h-4" />
          {isUnavailable ? 'Unavailable' : isCouponExpired ? 'Expired' : isCoupon ? 'Copy Code' : 'Buy Now'}
        </Button>
      </div>
    </div>
  );
}

export default FunnelOfferCard;
