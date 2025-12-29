'use client';

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface StoreViewTrackerProps {
  tenantId: string;
  categories?: Array<{ id: string; slug: string; isPrimary?: boolean }>;
}

export default function StoreViewTracker({ tenantId, categories = [] }: StoreViewTrackerProps) {
  useEffect(() => {
    // Track store view on page load
    trackBehaviorClient({
      entityType: 'store',
      entityId: tenantId,
      entityName: '', // API will fetch store name
      context: {
        category_id: categories.find(c => c.isPrimary)?.id,
        category_slug: categories.find(c => c.isPrimary)?.slug,
        categories: categories.map(c => ({ id: c.id, slug: c.slug })),
        page_type: 'directory_detail'
      },
      pageType: 'directory_detail'
    });
  }, [tenantId, categories]);

  return null; // This component doesn't render anything
}
