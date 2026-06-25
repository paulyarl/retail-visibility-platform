'use client';

import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';

interface ReviewsSectionProps {
  tenantId: string;
  layoutVariant: StorefrontLayoutKey;
  showGradientBorder?: boolean;
}

export function ReviewsSection({
  tenantId,
  layoutVariant,
  showGradientBorder = true,
}: ReviewsSectionProps) {
  if (layoutVariant === 'immersive') {
    return null;
  }

  if (layoutVariant === 'editorial') {
    return (
      <section className="bg-white dark:bg-neutral-900" aria-label="Store reviews">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div id="reviews-section" />
          <div className="max-w-2xl mx-auto">
            <StoreRatingDisplay tenantId={tenantId} showWriteReview={true} isPublic={true} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {showGradientBorder && (
        <div id="reviews-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
      )}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
        <StoreRatingDisplay tenantId={tenantId} showWriteReview={true} isPublic={true} />
      </div>
    </div>
  );
}
