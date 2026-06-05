/**
 * Map utilities for fetching and managing location data across the platform
 * 
 * NOTE: This file is maintained for backward compatibility.
 * New code should use MapService directly.
 */

import { mapService, MapLocation } from '../services/MapService';

// Re-export MapLocation type for backward compatibility (isolatedModules compatible)
export type { MapLocation };

/**
 * Fetch map location data for a tenant
 * Used on: Profile page, Storefront page, Product page
 * @deprecated Use mapService.getTenantMapLocation() directly
 */
export async function getTenantMapLocation(tenantId: string): Promise<MapLocation | null> {
  return await mapService.getTenantMapLocation(tenantId);
}

/**
 * Apply privacy mode to coordinates
 * @deprecated Use mapService.applyPrivacyMode() directly
 */
export function applyPrivacyMode(location: MapLocation): MapLocation {
  return mapService.applyPrivacyMode(location);
}

/**
 * Legacy privacy mode function for backward compatibility
 * @deprecated Use mapService.applyPrivacyMode() directly
 */
export function applyPrivacyModeLegacy(
  latitude: number,
  longitude: number,
  mode: 'precise' | 'neighborhood'
): { latitude: number; longitude: number } {
  if (mode === 'precise') {
    return { latitude, longitude };
  }

  // Round to 3 decimal places (~100m precision)
  // This shows the general area without revealing exact location
  return {
    latitude: Math.round(latitude * 1000) / 1000,
    longitude: Math.round(longitude * 1000) / 1000,
  };
}
