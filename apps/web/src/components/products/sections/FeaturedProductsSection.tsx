'use client';

import { FeaturedTypeProducts } from '@/components/products/FeaturedTypeProducts';
import { useActiveFeatured } from '@/hooks/useActiveFeatured';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';

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
  const { data: activeFeatured } = useActiveFeatured(tenantId, 'product_detail', { limit: 6 });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {activeFeatured?.hasActive && activeFeatured.products.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3">Featured</h3>
          <EnhancedProductDisplay
            products={activeFeatured.products as any}
            tenantId={tenantId}
            displayMode="carousel"
            carouselItemsVisible={4}
            variant="grid"
          />
        </div>
      )}
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
