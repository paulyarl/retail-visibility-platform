/**
 * Geocoding utilities using Google Geocoding API
 * Converts addresses to latitude/longitude coordinates
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
}

export interface GeocodeError {
  status: string;
  message: string;
}

/**
 * Geocode an address using Google Geocoding API
 */
export async function geocodeAddress(
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): Promise<GeocodeResult | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Build full address string
    const fullAddress = [address, city, state, zipCode]
      .filter(Boolean)
      .join(', ');

    if (!fullAddress.trim()) {
      throw new Error('No address provided for geocoding');
    }

    const encodedAddress = encodeURIComponent(fullAddress);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.warn(`[Geocoding] Failed for "${fullAddress}": ${data.status}`);
      return null;
    }

    if (!data.results || data.results.length === 0) {
      console.warn(`[Geocoding] No results for "${fullAddress}"`);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;

    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (error) {
    console.error('[Geocoding] Error:', error);
    return null;
  }
}

/**
 * Batch geocode multiple addresses with rate limiting
 */
export async function batchGeocodeAddresses(
  addresses: Array<{
    id: string;
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<Record<string, GeocodeResult | null>> {
  const results: Record<string, GeocodeResult | null> = {};

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const result = await geocodeAddress(addr.address, addr.city, addr.state, addr.zipCode);
    results[addr.id] = result;

    // Rate limiting: 10 requests per second for Geocoding API
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (onProgress) {
      onProgress(i + 1, addresses.length);
    }
  }

  return results;
}

/**
 * Validate if coordinates are reasonable (within US bounds)
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  // US approximate bounds
  const minLat = 24.396308;
  const maxLat = 49.384358;
  const minLng = -125.000000;
  const maxLng = -66.934570;

  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
