'use client';

/**
 * ProductTrustBar — a single-line trust reinforcement strip.
 *
 * Renders: ★ 4.8 (127 reviews) · ✓ In Stock (24 units) · SKU: XYZ
 *
 * Used by Layout B (Showcase) and Layout C (Quick Commerce) to surface
 * trust signals near the breadcrumb / product header area.
 */

import React, { useState, useEffect } from 'react';
import { productReviewsService } from '@/services/ProductReviewsSingletonService';

export interface ProductTrustBarProps {
  productId: string;
  tenantId: string;
  stock?: number;
  availability: string;
  sku?: string;
  /** 'inline' renders as inline text (for Quick Commerce title row) */
  variant?: 'default' | 'compact' | 'inline';
}

interface RatingSummary {
  averageRating: number;
  totalReviews: number;
}

export function ProductTrustBar({
  productId,
  tenantId,
  stock,
  availability,
  sku,
  variant = 'default',
}: ProductTrustBarProps) {
  const [rating, setRating] = useState<RatingSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRating() {
      try {
        const data = await productReviewsService.getProductReviewSummary(tenantId, productId);
        if (!cancelled && data) {
          setRating({
            averageRating: data.rating_avg ?? 0,
            totalReviews: data.rating_count ?? 0,
          });
        }
      } catch {
        // Silently fail — trust bar is non-critical
      }
    }
    fetchRating();
    return () => {
      cancelled = true;
    };
  }, [tenantId, productId]);

  const isInStock =
    availability === 'in_stock' || availability === 'limited';
  const isCompact = variant === 'compact';
  const isInline = variant === 'inline';

  const textSize = isInline ? 'text-xs' : isCompact ? 'text-xs' : 'text-sm';
  const gap = isInline ? 'gap-2' : 'gap-3';

  return (
    <div
      className={`flex items-center ${gap} flex-wrap ${textSize} text-neutral-500 dark:text-neutral-400`}
    >
      {/* Rating */}
      {rating && rating.totalReviews > 0 && (
        <span className="flex items-center gap-1">
          <span className="text-amber-500" aria-hidden="true">
            ★
          </span>
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {rating.averageRating.toFixed(1)}
          </span>
          <span>({rating.totalReviews})</span>
        </span>
      )}

      {/* Separator */}
      {rating && rating.totalReviews > 0 && (
        <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">
          ·
        </span>
      )}

      {/* Stock status */}
      <span className="flex items-center gap-1">
        {isInStock ? (
          <>
            <span className="text-green-600 dark:text-green-400 font-medium">
              ✓ In Stock
            </span>
            {stock !== undefined && stock > 0 && !isInline && (
              <span>({stock})</span>
            )}
          </>
        ) : (
          <span className="text-red-600 dark:text-red-400 font-medium">
            Out of Stock
          </span>
        )}
      </span>

      {/* SKU */}
      {sku && !isInline && (
        <>
          <span
            className="text-neutral-300 dark:text-neutral-600"
            aria-hidden="true"
          >
            ·
          </span>
          <span className="text-neutral-400 dark:text-neutral-500">
            SKU: {sku}
          </span>
        </>
      )}
    </div>
  );
}
