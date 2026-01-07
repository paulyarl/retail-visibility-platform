'use client';

import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';

interface StoreRatingsSectionProps {
  tenantId: string;
  showWriteReview?: boolean;
}

export default function StoreRatingsSection({ tenantId, showWriteReview = true }: StoreRatingsSectionProps) {
  return (
    <div id="reviews-section" className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <StoreRatingDisplay tenantId={tenantId} showWriteReview={showWriteReview} />
    </div>
  );
}
