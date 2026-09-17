'use client';

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface StoreViewTrackerProps {
  tenantId: string;
  storeName?: string;
  categories?: Array<{ id: string; slug: string; isPrimary?: boolean }>;
  /** Mirrors `directory_listings_list.listing_origin` so the traffic readout can
   *  split unclaimed-seed traffic from claimed-tenant traffic (Layer 2).
   *  'directory_seed' | 'claimed'. */
  listingOrigin?: string;
  /** Ecosystem surface axis — 'place' (from /place) | 'directory' (from
   *  /directory). Matches the `surface` vocabulary used by
   *  CategoryBrowseTracker / LocationBrowseTracker. */
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
    // Shelf→entry attribution — category / location / store-type shelf pages
    // append `?shelf=<surface>/<type>/<slug>` to their entry links. Recorded on
    // the Layer 1 entry view so the readout can rank referring shelves.
    const referrerShelf =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('shelf')
        : null;

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
        ...(referrerShelf ? { referrer_shelf: referrerShelf } : {}),
      },
      pageType: 'directory_detail'
    });
  }, [tenantId, storeName, categories, listingOrigin, surface]);

  return null; // This component doesn't render anything
}
