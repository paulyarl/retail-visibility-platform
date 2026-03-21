'use client';

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface StoreViewTrackerProps {
  tenantId: string;
  storeName?: string;
  categories?: Array<{ id: string; slug: string; isPrimary?: boolean }>;
}

export default function StoreViewTracker({ tenantId, storeName, categories = [] }: StoreViewTrackerProps) {
  useEffect(() => {
    // Track store view on page load
    trackBehaviorClient({
      entityType: 'store',
      entityId: tenantId,
      entityName: storeName,
      context: {
        category_id: categories.find(c => c.isPrimary)?.id,
        category_slug: categories.find(c => c.isPrimary)?.slug,
        categories: categories.map(c => ({ id: c.id, slug: c.slug })),
        page_type: 'directory_detail'
      },
      pageType: 'directory_detail'
    });
  }, [tenantId, storeName, categories]);

  return null; // This component doesn't render anything
}
