'use client';

import ProductReviewsSection from '@/components/products/ProductReviewsSection';
import { ProductOptionFlags } from '@/services/CapabilityResolutionService';

interface ProductReviewsSectionWrapperProps {
  productId: string;
  tenantId: string;
  productOptFlags?: ProductOptionFlags | null;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ProductReviewsSectionWrapper({
  productId,
  tenantId,
  productOptFlags,
  layoutVariant = 'classic',
}: ProductReviewsSectionWrapperProps) {
  if (productOptFlags?.showsReviews === false) return null;

  return (
    <>
      <div id="reviews-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
      <div className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ProductReviewsSection productId={productId} tenantId={tenantId} />
        </div>
      </div>
    </>
  );
}
