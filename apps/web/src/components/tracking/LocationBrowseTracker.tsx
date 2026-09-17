'use client';

import { useEffect, useRef } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface LocationBrowseTrackerProps {
  location: string; // URL slug, e.g. "fort-wayne-in" (/directory) or "madison" (/place)
  city: string;
  state: string;
  locationName?: string;
  /** Ecosystem surface axis — 'place' (/place/city) | 'directory'
   *  (/directory/location). Defaults to 'directory'. */
  surface?: 'place' | 'directory';
}

export default function LocationBrowseTracker({
  location,
  city,
  state,
  locationName,
  surface = 'directory',
}: LocationBrowseTrackerProps) {
  const trackedRef = useRef<string | null>(null);

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
