'use client';

import { useEffect, useRef } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import { useDirectoryShelfTracking } from '@/hooks/useDirectoryShelfTracking';

interface LocationBrowseTrackerProps {
  location: string; // URL slug, e.g. "fort-wayne-in" (/directory) or "madison" (/place)
  city: string;
  state: string;
  locationName?: string;
  /** Ecosystem surface axis — 'place' (/place/city) | 'directory'
   *  (/directory/location). Defaults to 'directory'. */
  surface?: 'place' | 'directory';
  /** Serialized filter/sort state — fires `filter_applied` when it changes. */
  filterSignature?: string;
}

export default function LocationBrowseTracker({
  location,
  city,
  state,
  locationName,
  surface = 'directory',
  filterSignature,
}: LocationBrowseTrackerProps) {
  const trackedRef = useRef<string | null>(null);

  // Layer 3 — shelf engagement for the city/location shelf surface.
  useDirectoryShelfTracking({
    surface: surface === 'place' ? 'place_city' : 'directory_location',
    ref: location,
    filterSignature,
  });

  useEffect(() => {
    // Use a path-shaped entity_id so analytics can reconstruct the public URL.
    const entityId = surface === 'place'
      ? `place/city/${location}`
      : `directory/location/${location}`;
    const dedupKey = `${surface}-${location}`;

    if (trackedRef.current === dedupKey) return;
    trackedRef.current = dedupKey;

    trackBehaviorClient({
      entityType: 'location',
      entityId,
      entityName: locationName || `${city}, ${state}`,
      context: {
        location_slug: location,
        city,
        state,
        surface,
      },
      pageType: 'directory_location',
    });
  }, [location, city, state, locationName, surface]);

  return null;
}
