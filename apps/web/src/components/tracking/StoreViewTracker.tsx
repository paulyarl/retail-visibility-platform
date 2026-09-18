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
    // Entry attribution — two independent dimensions, both read from the URL:
    //  - `?shelf=<surface>/<type>/<slug>` → which SHELF referred this view.
    //  - `?utm_source=` / `?source=` → which SOURCE/channel (e.g. `qr`).
    //    A QR code printed for this listing encodes `?source=qr`, so the entry
    //    view is attributed to QR even though the scan itself is recorded in
    //    `qr_scan_events` (channel metrics) rather than here.
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const referrerShelf = params?.get('shelf') ?? null;
    const rawSource = (params?.get('utm_source') || params?.get('source') || '').trim();
    const entrySource = rawSource
      ? rawSource.toLowerCase().slice(0, 40)
      : referrerShelf
        ? 'shelf'
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
        ...(entrySource ? { entry_source: entrySource } : {}),
      },
      pageType: 'directory_detail'
    });
  }, [tenantId, storeName, categories, listingOrigin, surface]);

  return null; // This component doesn't render anything
}
