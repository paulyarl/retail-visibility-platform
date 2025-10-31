/**
 * Map utilities for fetching and managing location data across the platform
 */

export interface MapLocation {
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  displayMap: boolean;
  privacyMode: 'precise' | 'neighborhood';
}

/**
 * Fetch map location data for a tenant
 * Used on: Profile page, Storefront page, Product page
 */
export async function getTenantMapLocation(tenantId: string): Promise<MapLocation | null> {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}/profile`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    const profile = await res.json();

    // Return null if map is disabled
    if (!profile.display_map) {
      return null;
    }

    // Return null if coordinates are missing
    if (!profile.latitude || !profile.longitude) {
      return null;
    }

    return {
      businessName: profile.business_name || '',
      addressLine1: profile.address_line1 || '',
      addressLine2: profile.address_line2,
      city: profile.city || '',
      state: profile.state,
      postalCode: profile.postal_code || '',
      countryCode: profile.country_code || 'US',
      latitude: profile.latitude,
      longitude: profile.longitude,
      displayMap: profile.display_map ?? false,
      privacyMode: (profile.map_privacy_mode as 'precise' | 'neighborhood') || 'precise',
    };
  } catch (error) {
    console.error('[getTenantMapLocation] Error:', error);
    return null;
  }
}

/**
 * Apply privacy mode to coordinates
 * - precise: Return exact coordinates
 * - neighborhood: Round coordinates to ~100m precision
 */
export function applyPrivacyMode(
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
