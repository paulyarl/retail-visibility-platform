'use client';

import { useEffect, useRef } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface LocationBrowseTrackerProps {
  location: string; // URL slug, e.g. "fort-wayne-in"
  city: string;
  state: string;
  locationName?: string;
}

export default function LocationBrowseTracker({
  location,
  city,
  state,
  locationName,
}: LocationBrowseTrackerProps) {
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    const entityId = `directory/location/${location}`;
    const dedupKey = `directory_location-${location}`;

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
      },
      pageType: 'directory_location',
    });
  }, [location, city, state, locationName]);

  return null;
}
