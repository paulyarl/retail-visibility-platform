'use client';

import ProductRatingDisplay from '@/components/reviews/ProductRatingDisplay';

interface ProductReviewsSectionProps {
  productId: string;
  tenantId: string;
}

export default function ProductReviewsSection({ productId, tenantId }: ProductReviewsSectionProps) {
  return (
    <div id="product-reviews-section" className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <ProductRatingDisplay productId={productId} tenantId={tenantId} showWriteReview={true} />
    </div>
  );
}
