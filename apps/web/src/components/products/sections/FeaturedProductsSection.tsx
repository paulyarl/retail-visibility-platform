'use client';

import { FeaturedTypeProducts } from '@/components/products/FeaturedTypeProducts';

interface FeaturedProductsSectionProps {
  currentProductId: string;
  tenantId: string;
  featuredTypes: string[];
  groupedProducts: Record<string, any[]>;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function FeaturedProductsSection({
  currentProductId,
  tenantId,
  featuredTypes,
  groupedProducts,
  layoutVariant = 'classic',
}: FeaturedProductsSectionProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <FeaturedTypeProducts
        currentProductId={currentProductId}
        tenantId={tenantId}
        featuredTypes={featuredTypes}
        groupedProducts={groupedProducts}
        allowedFeaturedTypes={featuredTypes.length > 0 ? featuredTypes : undefined}
      />
    </div>
  );
}
