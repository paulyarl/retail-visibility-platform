import { PrismaClient } from '@prisma/client';

/**
 * GeocodingService - Converts addresses to coordinates
 * Phase 5C: Location Scope
 * 
 * Current implementation uses database lookup of existing tenant locations
 * Future: Can be enhanced with Google Maps Geocoding API or OpenStreetMap Nominatim
 */
export class GeocodingService {
  private static instance: GeocodingService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): GeocodingService {
    if (!this.instance) {
      this.instance = new GeocodingService();
    }
    return this.instance;
  }

  /**
   * Geocode an address to coordinates
   * Currently uses database lookup of existing tenant locations
   * 
   * @param address - Can be city/state, zip code, or full address
   * @returns Coordinates or null if not found
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      // Try to parse the address
      const normalized = address.toLowerCase().trim();

      // Check if it's a ZIP code (5 digits)
      const zipMatch = normalized.match(/\b(\d{5})\b/);
      if (zipMatch) {
        return this.geocodeByZip(zipMatch[1]);
      }

      // Try to extract city and state
      const cityStateMatch = normalized.match(/([^,]+),\s*([a-z]{2})/i);
      if (cityStateMatch) {
        const city = cityStateMatch[1].trim();
        const state = cityStateMatch[2].trim().toUpperCase();
        return this.geocodeByCityState(city, state);
      }

      // Try just city name
      return this.geocodeByCity(normalized);
    } catch (error) {
      console.error('[GEOCODING] Error geocoding address:', error);
      return null;
    }
  }

  /**
   * Geocode by ZIP code
   */
  private async geocodeByZip(zip: string): Promise<{ lat: number; lng: number } | null> {
    const result = await this.prisma.$queryRaw<Array<{ latitude: number; longitude: number }>>`
      SELECT latitude, longitude
      FROM tenant_business_profiles_list
      WHERE postal_code = ${zip}
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      LIMIT 1
    `;

    if (result.length > 0) {
      return {
        lat: Number(result[0].latitude),
        lng: Number(result[0].longitude)
      };
    }

    return null;
  }

  /**
   * Geocode by city and state
   */
  private async geocodeByCityState(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
    const result = await this.prisma.$queryRaw<Array<{ latitude: number; longitude: number }>>`
      SELECT latitude, longitude
      FROM tenant_business_profiles_list
      WHERE LOWER(city) = LOWER(${city})
        AND UPPER(state) = UPPER(${state})
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      LIMIT 1
    `;

    if (result.length > 0) {
      return {
        lat: Number(result[0].latitude),
        lng: Number(result[0].longitude)
      };
    }

    return null;
  }

  /**
   * Geocode by city name only
   */
  private async geocodeByCity(city: string): Promise<{ lat: number; lng: number } | null> {
    const result = await this.prisma.$queryRaw<Array<{ latitude: number; longitude: number }>>`
      SELECT latitude, longitude
      FROM tenant_business_profiles_list
      WHERE LOWER(city) = LOWER(${city})
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      LIMIT 1
    `;

    if (result.length > 0) {
      return {
        lat: Number(result[0].latitude),
        lng: Number(result[0].longitude)
      };
    }

    return null;
  }

  /**
   * Get known cities with coordinates
   * Useful for autocomplete or suggestions
   */
  async getKnownCities(limit: number = 50): Promise<Array<{ city: string; state: string; latitude: number; longitude: number }>> {
    const results = await this.prisma.$queryRaw<Array<{ city: string; state: string; latitude: number; longitude: number }>>`
      SELECT DISTINCT city, state, latitude, longitude
      FROM tenant_business_profiles_list
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND city IS NOT NULL
        AND state IS NOT NULL
      ORDER BY city
      LIMIT ${limit}
    `;

    return results.map(r => ({
      city: r.city,
      state: r.state,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude)
    }));
  }
}

export default GeocodingService;
