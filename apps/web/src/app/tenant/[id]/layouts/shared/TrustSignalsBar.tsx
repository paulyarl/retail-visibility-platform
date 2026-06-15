'use client';

import React from 'react';
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import { useStoreStatus } from '@/hooks/useStoreStatus';

interface TrustSignalsBarProps {
  tenantId: string;
  /** Custom shipping/free-shipping threshold text, e.g. "Free shipping over $50" */
  shippingText?: string;
  /** Whether to show hours status */
  showHours?: boolean;
  /** Whether to show rating */
  showRating?: boolean;
  /** Whether to show shipping text */
  showShipping?: boolean;
  /** Additional items to append */
  extraItems?: React.ReactNode[];
  className?: string;
}

/**
 * Compact, single-line trust bar for storefront layouts.
 *
 * Composes StoreRatingDisplay (inline), HoursStatusBadge, and merchant metadata
 * into a single unobtrusive line:
 *
 *   ★ 4.8 (127 reviews) · Open until 9pm · Free shipping over $50
 */
export default function TrustSignalsBar({
  tenantId,
  shippingText,
  showHours = true,
  showRating = true,
  showShipping = false,
  extraItems,
  className = '',
}: TrustSignalsBarProps) {
  const { status: hoursStatus } = useStoreStatus(tenantId, true);

  const items: React.ReactNode[] = [];

  if (showRating) {
    items.push(
      <span key="rating" className="inline-flex items-center">
        <StoreRatingDisplay tenantId={tenantId} compact={true} showWriteReview={false} isPublic={true} />
      </span>
    );
  }

  if (showHours && hoursStatus) {
    items.push(
      <span key="hours" className="inline-flex items-center">
        <HoursStatusBadge status={hoursStatus} size="sm" />
      </span>
    );
  }

  if (showShipping && shippingText) {
    items.push(
      <span key="shipping" className="text-sm text-neutral-500 dark:text-neutral-400">
        {shippingText}
      </span>
    );
  }

  if (extraItems) {
    extraItems.forEach((item, i) => {
      items.push(<span key={`extra-${i}`}>{item}</span>);
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 ${className}`}
      aria-label="Store trust signals"
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">·</span>
          )}
          {item}
        </React.Fragment>
      ))}
    </div>
  );
}
