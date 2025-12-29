'use client';

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface StorefrontViewTrackerProps {
  tenantId: string;
  categoriesViewed?: string[];
}

export default function StorefrontViewTracker({ tenantId, categoriesViewed = [] }: StorefrontViewTrackerProps) {
  useEffect(() => {
    // Track storefront view on page load
    trackBehaviorClient({
      entityType: 'store',
      entityId: tenantId,
      entityName: '', // API will fetch store name
      context: {
        categories_viewed: categoriesViewed,
        is_storefront: true,
        page_type: 'storefront'
      },
      pageType: 'storefront'
    });
  }, [tenantId, categoriesViewed]);

  return null; // This component doesn't render anything
}
