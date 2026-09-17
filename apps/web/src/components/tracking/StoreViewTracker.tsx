'use client';

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface StoreViewTrackerProps {
  tenantId: string;
  storeName?: string;
  categories?: Array<{ id: string; slug: string; isPrimary?: boolean }>;
  /** Tags the event context with the listing origin so the traffic readout can
   *  split unclaimed-seed traffic from claimed-tenant traffic (Layer 2).
   *  'directory_seed' | 'directory_claimed'. */
  listingOrigin?: string;
  /** Tags the event context with the surface that produced it.
   *  'directory_seed' (from /place) | 'directory_claimed' (from /directory). */
  surface?: string;
}

export default function StoreViewTracker({
  tenantId,
  storeName,
  categories = [],
  listingOrigin,
  surface,
}: StoreViewTrackerProps) {
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
        page_type: 'directory_detail',
        ...(listingOrigin ? { listing_origin: listingOrigin } : {}),
        ...(surface ? { surface } : {}),
      },
      pageType: 'directory_detail'
    });
  }, [tenantId, storeName, categories, listingOrigin, surface]);

  return null; // This component doesn't render anything
}
