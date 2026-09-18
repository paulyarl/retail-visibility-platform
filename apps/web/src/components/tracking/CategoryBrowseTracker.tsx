'use client';

import { useEffect, useRef } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import { useDirectoryShelfTracking } from '@/hooks/useDirectoryShelfTracking';

interface CategoryBrowseTrackerProps {
  categoryId: string;
  categorySlug: string;
  categoryName?: string;
  pageType?: 'directory_home' | 'directory_category' | 'storefront';
  surface?: 'directory' | 'place';
  city?: string;
  state?: string;
  /** Serialized filter/sort state — fires `filter_applied` when it changes. */
  filterSignature?: string;
}

export default function CategoryBrowseTracker({
  categoryId,
  categorySlug,
  categoryName,
  pageType = 'directory_home',
  surface = 'directory',
  city,
  state,
  filterSignature,
}: CategoryBrowseTrackerProps) {
  const trackedRef = useRef<string | null>(null);

  // Layer 3 — shelf engagement (shelf_viewed / heartbeat / session_end /
  // filter_applied) for the category shelf surface.
  useDirectoryShelfTracking({
    surface: surface === 'place' ? 'place_category' : 'directory_category',
    ref: categorySlug,
    filterSignature,
  });

  useEffect(() => {
    // Use a path-shaped entity_id so analytics can reconstruct the public URL.
    const entityId = pageType === 'directory_category'
      ? `${surface === 'place' ? 'place/category' : 'directory/categories'}/${categorySlug}`
      : categoryId;
    const dedupKey = `${pageType}-${surface}-${categorySlug}-${city || ''}-${state || ''}`;

    if (trackedRef.current === dedupKey) return;
    trackedRef.current = dedupKey;

    trackBehaviorClient({
      entityType: 'category',
      entityId,
      entityName: categoryName || categorySlug,
      context: {
        category_slug: categorySlug,
        category_id: categoryId,
        surface,
        city,
        state,
      },
      pageType: pageType
    });
  }, [categoryId, categorySlug, categoryName, pageType, surface, city, state]);

  return null; // This component doesn't render anything
}
