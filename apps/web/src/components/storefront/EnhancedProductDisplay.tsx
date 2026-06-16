"use client";

import { useState, useEffect } from 'react';
import EnhancedStorefrontProductCard, { EnhancedProductData } from '@/components/products/EnhancedStorefrontProductCard';

interface ProductDisplayProps {
  products: EnhancedProductData[];
  tenantId: string;
  tenantSlug?: string;
  tenantLogo?: string;
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
  useSingletonData?: boolean;
  showFeaturedBadges?: boolean;
  initialPageSize?: number;
  showPageSizeControl?: boolean;
  variant?: 'grid' | 'list' | 'compact' | 'featured';
  showGallery?: boolean;
  showVariants?: boolean;
  maxGalleryImages?: number;
  maxVariants?: number;
  className?: string;
  /** 'grid' (default) | 'carousel' — horizontal scroll with snap */
  displayMode?: 'grid' | 'carousel';
  /** Number of visible items in carousel mode (affects min-width) */
  carouselItemsVisible?: number;
  /** Only show badges for these featured types (gated types filtered out) */
  allowedFeaturedTypes?: string[];
}

export default function EnhancedProductDisplay({
  products,
  tenantId,
  tenantSlug,
  tenantLogo,
  hasActivePaymentGateway,
  defaultGatewayType,
  useSingletonData,
  showFeaturedBadges,
  initialPageSize,
  showPageSizeControl,
  variant = 'grid',
  showGallery = true,
  showVariants = true,
  maxGalleryImages = 3,
  maxVariants = 2,
  className = '',
  displayMode = 'grid',
  carouselItemsVisible = 4,
  allowedFeaturedTypes,
}: ProductDisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (displayMode === 'carousel') {
      return (
        <div className="flex gap-4 overflow-hidden">
          {products.slice(0, carouselItemsVisible).map((_, index) => (
            <div key={index} className="flex-shrink-0 w-64 h-80 bg-white rounded-lg shadow-sm animate-pulse" />
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm h-96 animate-pulse" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400">No products available</div>
      </div>
    );
  }

  // ── Carousel mode ──
  if (displayMode === 'carousel') {
    return (
      <div className={`relative ${className}`}>
        <div
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 snap-start"
              style={{ minWidth: `${100 / Math.min(carouselItemsVisible, products.length)}%`, maxWidth: '280px' }}
            >
              <EnhancedStorefrontProductCard
                product={product}
                tenantId={tenantId}
                tenantSlug={tenantSlug}
                tenantLogo={tenantLogo}
                hasActivePaymentGateway={hasActivePaymentGateway}
                defaultGatewayType={defaultGatewayType}
                useSingletonData={useSingletonData}
                showFeaturedBadges={showFeaturedBadges}
                initialPageSize={initialPageSize}
                showPageSizeControl={showPageSizeControl}
                variant={variant}
                showGallery={showGallery}
                showVariants={showVariants}
                maxGalleryImages={maxGalleryImages}
                maxVariants={maxVariants}
                allowedFeaturedTypes={allowedFeaturedTypes}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Grid mode (default) ──
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {products.map((product) => (
        <EnhancedStorefrontProductCard
          key={product.id}
          product={product}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          tenantLogo={tenantLogo}
          hasActivePaymentGateway={hasActivePaymentGateway}
          defaultGatewayType={defaultGatewayType}
          useSingletonData={useSingletonData}
          showFeaturedBadges={showFeaturedBadges}
          initialPageSize={initialPageSize}
          showPageSizeControl={showPageSizeControl}
          variant={variant}
          showGallery={showGallery}
          showVariants={showVariants}
          maxGalleryImages={maxGalleryImages}
          maxVariants={maxVariants}
          allowedFeaturedTypes={allowedFeaturedTypes}
        />
      ))}
    </div>
  );
}
