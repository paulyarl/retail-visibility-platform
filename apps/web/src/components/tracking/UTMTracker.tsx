'use client';

import { useEffect } from 'react';
import { captureAndStoreUTMParams } from '@/lib/utm';

/**
 * Invisible client component that captures UTM / ref params from the URL on mount
 * and persists them in sessionStorage for later CTA attribution.
 */
export function UTMTracker() {
  useEffect(() => {
    captureAndStoreUTMParams();
  }, []);

  return null;
}
