'use client';

/**
 * StickyPurchaseBar — mobile sticky bottom bar for product purchase.
 *
 * Appears when the main "Add to Cart" button scrolls out of view.
 * Shows price + a prominent Add to Cart CTA.
 *
 * Used by Layout B (Showcase) and Layout C (Quick Commerce).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface StickyPurchaseBarProps {
  /** Price in cents */
  priceCents: number;
  /** Sale price in cents (optional) */
  salePriceCents?: number | null;
  /** Current availability status */
  availability: string;
  /** Handler when user taps Add to Cart */
  onAddToCart: () => void;
  /** Handler when user taps Buy Now */
  onBuyNow?: () => void;
  /** Whether the product has variants that must be selected */
  hasVariants: boolean;
  /** Whether a variant has been selected */
  variantSelected: boolean;
  /** Scrolls to the variant selector section */
  onSelectVariant?: () => void;
  /** Ref to the main Add to Cart button — bar hides when this is visible */
  cartButtonRef?: React.RefObject<HTMLElement | null>;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StickyPurchaseBar({
  priceCents,
  salePriceCents,
  availability,
  onAddToCart,
  onBuyNow,
  hasVariants,
  variantSelected,
  onSelectVariant,
  cartButtonRef,
}: StickyPurchaseBarProps) {
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Use IntersectionObserver to track when the main cart button leaves viewport
  const observeTarget = useCallback(() => {
    const target = cartButtonRef?.current || sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar when the target is NOT intersecting (scrolled past)
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [cartButtonRef]);

  useEffect(() => {
    const cleanup = observeTarget();
    return cleanup;
  }, [observeTarget]);

  const isInStock =
    availability === 'in_stock' || availability === 'limited';
  const needsVariant = hasVariants && !variantSelected;
  const canAdd = isInStock && !needsVariant;

  const effectivePrice = salePriceCents && salePriceCents < priceCents
    ? salePriceCents
    : priceCents;
  const isOnSale = !!(salePriceCents && salePriceCents < priceCents);

  // Respect prefers-reduced-motion
  const motionClass =
    'transition-transform duration-200 ease-out';

  if (!visible) {
    return (
      <>
        {/* Invisible sentinel — placed near the main Add to Cart button */}
        {!cartButtonRef && (
          <div ref={sentinelRef} className="h-0 w-0" aria-hidden="true" />
        )}
      </>
    );
  }

  return (
    <>
      {/* Invisible sentinel */}
      {!cartButtonRef && (
        <div ref={sentinelRef} className="h-0 w-0" aria-hidden="true" />
      )}

      {/* Sticky bar */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 lg:hidden ${motionClass}`}
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.08)',
        }}
        role="region"
        aria-label="Purchase actions"
      >
        <div className="bg-white/95 dark:bg-neutral-900/95 border-t border-neutral-200 dark:border-neutral-700 px-4 py-3">
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            {/* Price */}
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                {formatPrice(effectivePrice)}
              </span>
              {isOnSale && (
                <span className="text-xs text-neutral-500 line-through">
                  {formatPrice(priceCents)}
                </span>
              )}
            </div>

            {/* CTA Button */}
            {!isInStock ? (
              <button
                disabled
                className="flex-1 max-w-[14rem] px-4 py-2.5 rounded-lg text-sm font-semibold bg-neutral-200 text-neutral-500 cursor-not-allowed"
              >
                Out of Stock
              </button>
            ) : needsVariant ? (
              <button
                onClick={onSelectVariant}
                className="flex-1 max-w-[14rem] px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                Select Options
              </button>
            ) : (
              <button
                onClick={onAddToCart}
                className="flex-1 max-w-[14rem] px-4 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
                Add to Cart
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
