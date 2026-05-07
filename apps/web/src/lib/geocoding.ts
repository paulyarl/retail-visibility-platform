/**
 * Geocoding utilities using Google Geocoding API
 * Converts addresses to latitude/longitude coordinates
 */

import { externalApiService } from '@/services/ExternalApiService';

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
 * Geocode an address using Google Geocoding API via ExternalApiService for platform caching
 */
export async function geocodeAddress(
  address: string,
  city?: string,
  state?: string,
  zipCode?: string,
  countryCode: string = 'US'
): Promise<GeocodeResult | null> {
  try {
    // Build full address string
    const fullAddress = [address, city, state, zipCode]
      .filter(Boolean)
      .join(', ');

    if (!address.trim()) {
      throw new Error('No address provided for geocoding');
    }

    // Use ExternalApiService for platform caching
    const result = await externalApiService.geocodeAddress({
      address_line1: address,
      city: city || '',
      state: state || '',
      postal_code: zipCode || '',
      country_code: countryCode
    });

    if (!result) {
      console.warn(`[Geocoding] Failed for "${fullAddress}"`);
      return null;
    }

    // Get formatted address by making a reverse geocoding call
    const reverseResult = await externalApiService.reverseGeocode(result.latitude, result.longitude, {
      usePublicContext: true,
      cacheKey: `geocode-formatted-${result.latitude}-${result.longitude}`
    });

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: reverseResult?.display_name || fullAddress,
      placeId: reverseResult?.place_id?.toString(),
    };
  } catch (error) {
    console.error('[Geocoding] Error:', error);
    return null;
  }
}

/**
 * Batch geocode multiple addresses using ExternalApiService with platform caching
 * Processes requests in parallel with proper error handling
 */
export async function batchGeocodeAddresses(
  addresses: Array<{
    id: string;
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
    countryCode?: string;
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<Record<string, GeocodeResult | null>> {
  const results: Record<string, GeocodeResult | null> = {};

  // Process all addresses in parallel using ExternalApiService's batch capabilities
  const requests = addresses.map(addr => ({
    url: `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ')
    )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
    options: {
      cacheKey: `geocode-${addr.id}-${encodeURIComponent([addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '))}`,
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days cache
      signal: AbortSignal.timeout(10000)
    }
  }));

  try {
    // Use ExternalApiService batch request for parallel processing
    const batchResults = await externalApiService.batchRequest<any>(requests);
    
    // Process results
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const batchResult = batchResults[i];
      
      if (batchResult.success && batchResult.data?.status === 'OK' && batchResult.data?.results?.length > 0) {
        const location = batchResult.data.results[0].geometry.location;
        
        // Get formatted address via reverse geocoding
        const reverseResult = await externalApiService.reverseGeocode(location.lat, location.lng, {
          usePublicContext: true,
          cacheKey: `geocode-formatted-${location.lat}-${location.lng}`
        });
        
        results[addr.id] = {
          latitude: location.lat,
          longitude: location.lng,
          formattedAddress: reverseResult?.display_name || [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '),
          placeId: batchResult.data.results[0].place_id,
        };
      } else {
        const errorMessage = typeof batchResult.error === 'string' 
          ? batchResult.error 
          : batchResult.error?.message || 'Unknown error';
        console.warn(`[Geocoding] Failed for address ${addr.id}:`, errorMessage);
        results[addr.id] = null;
      }

      // Report progress
      if (onProgress) {
        onProgress(i + 1, addresses.length);
      }
    }
  } catch (error) {
    console.error('[Geocoding] Batch request failed:', error);
    
    // Fallback to individual requests if batch fails
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const result = await geocodeAddress(addr.address, addr.city, addr.state, addr.zipCode, addr.countryCode);
      results[addr.id] = result;

      if (onProgress) {
        onProgress(i + 1, addresses.length);
      }
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
