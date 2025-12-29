'use client';

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface CategoryBrowseTrackerProps {
  categoryId: string;
  categorySlug: string;
  pageType?: 'directory_home' | 'storefront';
}

export default function CategoryBrowseTracker({
  categoryId,
  categorySlug,
  pageType = 'directory_home'
}: CategoryBrowseTrackerProps) {
  useEffect(() => {
    // Track category browse on page load
    trackBehaviorClient({
      entityType: 'category',
      entityId: categoryId,
      entityName: categorySlug,
      context: {
        category_slug: categorySlug
      },
      pageType: pageType
    });
  }, [categoryId, categorySlug, pageType]);

  return null; // This component doesn't render anything
}
