'use client';

import React from 'react';
import ProductGallery from '@/components/products/ProductGallery';
import BasicProductGallery from '@/components/products/BasicProductGallery';
import MagazineGallery from '@/components/products/MagazineGallery';
import { SafeImage } from '@/components/SafeImage';
import { ShoppableEmbeds } from '../type-sections/ShoppableEmbeds';

type LayoutVariant = 'classic' | 'showcase' | 'quick-commerce';

interface ProductGalleryPanelProps {
  product: any;
  safeFeatures: any;
  videoPlayer?: React.ReactNode;
  onGalleryClick: (index: number) => void;
  layoutVariant?: LayoutVariant;
  storefrontType?: string;
}

export function ProductGalleryPanel({
  product,
  safeFeatures,
  videoPlayer,
  onGalleryClick,
  layoutVariant = 'showcase',
  storefrontType,
}: ProductGalleryPanelProps) {
  const isQuickCommerce = layoutVariant === 'quick-commerce';
  const roundedClass = isQuickCommerce ? 'rounded-xl' : 'rounded-xl';
  const borderClass = isQuickCommerce ? 'border border-neutral-200 dark:border-neutral-800' : '';
  const hintClass = isQuickCommerce ? 'mt-1' : 'mt-2';
  const videoClass = isQuickCommerce ? 'mt-3' : 'mt-4';

  return (
    <div className="lg:sticky lg:self-start" style={{ top: isQuickCommerce ? '3.5rem' : '6rem' }}>
      <div
        className={`bg-white dark:bg-neutral-900 ${roundedClass} shadow-sm ${borderClass} overflow-hidden cursor-pointer`}
        onClick={() => onGalleryClick(0)}
        role="button"
        tabIndex={0}
        aria-label="Open image viewer"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onGalleryClick(0);
          }
        }}
      >
        {safeFeatures.imageGallery &&
        product.imageGallery &&
        product.imageGallery.length > 0 ? (
          safeFeatures.canUseMagazineGallery && safeFeatures.galleryDisplayMode === 'magazine' ? (
            <MagazineGallery
              gallery={product.imageGallery.slice(0, safeFeatures.maxGalleryImages).map((img: { url: string; alt?: string; caption?: string }, idx: number) => ({
                url: img.url,
                alt: img.alt || product.name,
                caption: img.caption || null,
                position: idx,
              }))}
              productTitle={product.name}
            />
          ) : safeFeatures.maxGalleryImages >= 10 ? (
            <ProductGallery
              gallery={product.imageGallery.slice(0, safeFeatures.maxGalleryImages)}
              productTitle={product.name}
            />
          ) : (
            <BasicProductGallery
              gallery={product.imageGallery.slice(0, safeFeatures.maxGalleryImages)}
              productTitle={product.name}
            />
          )
        ) : product.imageUrl ? (
          <div className="relative w-full aspect-square">
            <SafeImage
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-contain"
              priority
            />
          </div>
        ) : (
          <div className="w-full aspect-square bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <svg
              className={isQuickCommerce ? 'h-20 w-20' : 'h-24 w-24'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {videoPlayer && <div className={videoClass}>{videoPlayer}</div>}

      {storefrontType === 'social' && (
        <ShoppableEmbeds
          product={product}
          layoutVariant={layoutVariant}
          storefrontType={storefrontType}
          socialPlatformFlags={{
            tiktok: true,
            instagram: true,
          }}
        />
      )}
    </div>
  );
}
