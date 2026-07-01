'use client';

import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import type { ActiveFeaturedResult } from '@/services/ActiveFeaturedService';

interface ActiveFeaturedSectionProps {
  activeFeatured?: ActiveFeaturedResult;
}

export function ActiveFeaturedSection({ activeFeatured }: ActiveFeaturedSectionProps) {
  if (!activeFeatured?.hasActive || activeFeatured.products.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Featured Products
        </h2>
      </div>
      <EnhancedProductDisplay
        products={activeFeatured.products as any}
        tenantId={activeFeatured.products[0]?.tenant_id || ''}
        displayMode="carousel"
        carouselItemsVisible={4}
        variant="grid"
      />
    </section>
  );
}
