"use client";

import { useState } from 'react';
import EnhancedStorefrontProductCard, { EnhancedProductData } from '@/components/products/EnhancedStorefrontProductCard';

interface ProductDisplayProps {
  products: EnhancedProductData[];  // ← Direct interface match!
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
}: ProductDisplayProps) {
  const [mounted, setMounted] = useState(false);
  
  // Handle hydration
  useState(() => {
    setMounted(true);
  });

  if (!mounted) {
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
        <div className="text-gray-500">No products available</div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {products.map((product) => (
        <EnhancedStorefrontProductCard
          key={product.id}
          product={product}  // ← Direct pass-through!
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
        />
      ))}
    </div>
  );
}
