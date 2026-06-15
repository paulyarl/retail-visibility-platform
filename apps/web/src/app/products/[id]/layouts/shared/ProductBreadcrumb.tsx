'use client';

/**
 * ProductBreadcrumb — navigation trail for product detail pages.
 *
 * Renders: Store Logo · Store Name > Category > Product Title
 *
 * Used by Layout B (Showcase) and Layout C (Quick Commerce).
 * Layout A (Classic) does not use breadcrumbs.
 */

import React from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/SafeImage';

export interface ProductBreadcrumbProps {
  storeName: string;
  storeLogoUrl?: string | null;
  tenantId: string;
  tenantSlug?: string;
  categoryName?: string;
  categorySlug?: string;
  productTitle: string;
  /** 'compact' uses smaller text and no icons — suited for Quick Commerce */
  variant?: 'default' | 'compact';
}

export function ProductBreadcrumb({
  storeName,
  storeLogoUrl,
  tenantId,
  tenantSlug,
  categoryName,
  categorySlug,
  productTitle,
  variant = 'default',
}: ProductBreadcrumbProps) {
  const isCompact = variant === 'compact';
  const storeHref = `/tenant/${tenantSlug || tenantId}`;
  const categoryHref = categorySlug
    ? `${storeHref}?category=${categorySlug}`
    : undefined;

  // Truncate product title on mobile
  const truncatedTitle =
    productTitle.length > 40
      ? `${productTitle.slice(0, 37)}...`
      : productTitle;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`${isCompact ? 'py-2' : 'py-3'} text-${isCompact ? 'xs' : 'sm'}`}
    >
      <ol className="flex items-center gap-1.5 flex-wrap min-w-0">
        {/* Store */}
        <li className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
          {!isCompact && storeLogoUrl && (
            <span className="relative w-5 h-5 flex-shrink-0">
              <SafeImage
                src={storeLogoUrl}
                alt={storeName}
                fill
                className="object-contain rounded-sm"
              />
            </span>
          )}
          <Link
            href={storeHref}
            className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors truncate max-w-[10rem]"
          >
            {storeName}
          </Link>
        </li>

        {/* Category (optional) */}
        {categoryName && (
          <>
            <li
              className="text-neutral-400 dark:text-neutral-500 flex-shrink-0"
              aria-hidden="true"
            >
              <svg
                className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </li>
            <li className="min-w-0 flex-shrink-0">
              {categoryHref ? (
                <Link
                  href={categoryHref}
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors truncate max-w-[10rem] inline-block"
                >
                  {categoryName}
                </Link>
              ) : (
                <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[10rem] inline-block">
                  {categoryName}
                </span>
              )}
            </li>
          </>
        )}

        {/* Product title (current) */}
        <li
          className="text-neutral-400 dark:text-neutral-500 flex-shrink-0"
          aria-hidden="true"
        >
          <svg
            className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </li>
        <li className="min-w-0">
          <span
            className="text-neutral-900 dark:text-white font-medium truncate inline-block max-w-[16rem] sm:max-w-none"
            aria-current="page"
          >
            {truncatedTitle}
          </span>
        </li>
      </ol>
    </nav>
  );
}
