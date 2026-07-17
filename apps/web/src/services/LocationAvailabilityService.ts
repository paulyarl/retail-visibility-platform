/**
 * Location Availability Service
 * 
 * Manages multi-location product availability queries with geographic distance calculations.
 * Supports organization-centric location queries and caching.
 */

import {  RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingleton';
import { PublicApiSingleton} from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  postalCode?: string;
}

export interface TenantLocation {
  tenantId: string;
  tenantName: string;
  locationId?: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
}

export interface LocationAvailability {
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  tenantLogo?: string | null;
  locationId?: string;
  address: string;
  city: string;
  distance: number;
  stock: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited' | 'backordered';
  priceCents: number;
  price: number;
  currency: string;
  sku: string;
  productName: string;
  productSlug?: string;
  universalSku?: string;
  isPreferred?: boolean;
  isNearest?: boolean;
  hasLowStock?: boolean;
  estimatedPickupTime?: string;
}

export interface MultiLocationAvailability {
  productSlug: string;
  universalSku?: string;
  productName: string;
  totalLocations: number;
  inStockLocations: number;
  nearestAvailable?: LocationAvailability;
  locations: LocationAvailability[];
  userLocation?: UserLocation;
}

export interface LocationQueryOptions {
  maxDistance?: number; // in miles
  maxResults?: number;
  includeOutOfStock?: boolean;
  preferredTenantId?: string;
  organizationId?: string;
  sortBy?: 'distance' | 'price' | 'stock';
}

/**
 * LocationAvailabilityService
 * 
 * Provides location-aware product availability queries
 */
class LocationAvailabilityService extends PublicApiSingleton {
  private static instance: LocationAvailabilityService;

  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;
  protected defaultContext = AppContext.STORE;
  protected defaultIsolation = CacheIsolation.GLOBAL;

  // Cache TTLs
  private readonly AVAILABILITY_TTL = 20 * 60 * 1000; // 20 minutes
  private readonly DISTANCE_TTL = 60 * 60 * 1000; // 1 hour

  protected constructor() {
    super('location-availability-service', {
      ttl: 20 * 60 * 1000 // 20 minutes
    });
  }

  /**
   * Check if identifier is a valid product_slug format
   * Product slugs must have lpc_ or upc_ prefix
   */
  isValidProductSlug(identifier: string): boolean {
    return /^(lpc_|upc_)/i.test(identifier);
  }

  /**
   * Detect the type of identifier
   */
  getIdentifierType(identifier: string): 'product_slug' | 'sku' | 'unknown' {
    if (this.isValidProductSlug(identifier)) {
      return 'product_slug';
    }
    // SKUs typically don't have the lpc_/upc_ prefix
    // They could be universal_sku (UPC code) or original_sku (tenant-scoped)
    if (identifier && identifier.length > 0) {
      return 'sku';
    }
    return 'unknown';
  }

  public static getInstance(): LocationAvailabilityService {
    if (!LocationAvailabilityService.instance) {
      LocationAvailabilityService.instance = new LocationAvailabilityService();
    }
    return LocationAvailabilityService.instance;
  }

  /**
   * Get product availability across multiple locations
   * Requires a valid product_slug (lpc_* or upc_* prefix)
   */
  async getProductAvailability(
    productSlug: string,
    userLocation?: UserLocation,
    options: LocationQueryOptions = {}
  ): Promise<MultiLocationAvailability | null> {
    // Validate slug format before making API call
    if (!this.isValidProductSlug(productSlug)) {
      clientLogger.warn(`[LocationAvailabilityService] Invalid product_slug format: ${productSlug}. Expected lpc_* or upc_* prefix. Use getAvailabilityBySku() for SKU lookups.`);
      return null;
    }

    try {
      const {
        maxDistance = 50,
        maxResults = 10,
        includeOutOfStock = true,
        preferredTenantId,
        organizationId,
        sortBy = 'distance'
      } = options;

      const params = new URLSearchParams({
        slug: productSlug,
        maxDistance: String(maxDistance),
        maxResults: String(maxResults),
        includeOutOfStock: String(includeOutOfStock),
        sortBy,
        ...(userLocation && {
          lat: String(userLocation.latitude),
          lng: String(userLocation.longitude)
        }),
        ...(preferredTenantId && { preferredTenantId }),
        ...(organizationId && { organizationId })
      });

      const result = await this.makeDefaultRequest<MultiLocationAvailability>(
        `/api/catalog/availability?${params.toString()}`,
        { method: 'GET' },
        `product-availability:${productSlug}:${userLocation?.latitude}:${userLocation?.longitude}:${maxDistance}`,
        this.AVAILABILITY_TTL
      );
      if (!result.success){
        return null;
      }

      return result.data || null;
    } catch (error) {
      clientLogger.error('[LocationAvailabilityService] Error fetching product availability:', { detail: error });
      return null;
    }
  }

  /**
   * Get availability by universal SKU
   */
  async getAvailabilityBySku(
    universalSku: string,
    userLocation?: UserLocation,
    options: LocationQueryOptions = {}
  ): Promise<MultiLocationAvailability | null> {
    try {
      const {
        maxDistance = 50,
        maxResults = 10,
        includeOutOfStock = true,
        organizationId,
        sortBy = 'distance'
      } = options;

      const params = new URLSearchParams({
        sku: universalSku,
        maxDistance: String(maxDistance),
        maxResults: String(maxResults),
        includeOutOfStock: String(includeOutOfStock),
        sortBy,
        ...(userLocation && {
          lat: String(userLocation.latitude),
          lng: String(userLocation.longitude)
        }),
        ...(organizationId && { organizationId })
      });

      const result = await this.makeDefaultRequest<MultiLocationAvailability>(
        `/api/catalog/availability/sku?${params.toString()}`,
        { method: 'GET' },
        `sku-availability:${universalSku}:${userLocation?.latitude}:${userLocation?.longitude}:${maxDistance}`,
        this.AVAILABILITY_TTL
      );
      if (!result.success){
        return null;
      }

      return result.data || null;
    } catch (error) {
      clientLogger.error('[LocationAvailabilityService] Error fetching SKU availability:', { detail: error });
      return null;
    }
  }

  /**
   * Get availability for organization locations only
   */
  async getOrganizationAvailability(
    productSlug: string,
    organizationId: string,
    userLocation?: UserLocation,
    options: LocationQueryOptions = {}
  ): Promise<MultiLocationAvailability | null> {
    return this.getProductAvailability(productSlug, userLocation, {
      ...options,
      organizationId
    });
  }

  /**
   * Get multi-location availability for cart items
   */
  async getCartAvailability(
    items: Array<{ productSlug: string; quantity: number }>,
    userLocation?: UserLocation,
    organizationId?: string
  ): Promise<Map<string, MultiLocationAvailability>> {
    const results = new Map<string, MultiLocationAvailability>();

    // Query availability for each item in parallel
    const queries = items.map(async (item) => {
      const availability = await this.getProductAvailability(
        item.productSlug,
        userLocation,
        { organizationId, includeOutOfStock: false }
      );
      if (availability) {
        results.set(item.productSlug, availability);
      }
    });

    await Promise.all(queries);
    return results;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Find nearest location with stock
   */
  findNearestAvailable(
    locations: LocationAvailability[]
  ): LocationAvailability | undefined {
    const inStock = locations.filter(
      l => l.availability === 'in_stock' || l.availability === 'limited'
    );
    
    if (inStock.length === 0) return undefined;
    
    return inStock.reduce((nearest, current) =>
      current.distance < nearest.distance ? current : nearest
    );
  }

  /**
   * Check if product is available at preferred location
   */
  isAvailableAtPreferred(
    locations: LocationAvailability[],
    preferredTenantId: string
  ): boolean {
    const preferred = locations.find(l => l.tenantId === preferredTenantId);
    return preferred?.availability === 'in_stock' || preferred?.availability === 'limited';
  }

  /**
   * Get availability summary for display
   */
  getAvailabilitySummary(locations: LocationAvailability[]): {
    total: number;
    inStock: number;
    limited: number;
    outOfStock: number;
  } {
    return {
      total: locations.length,
      inStock: locations.filter(l => l.availability === 'in_stock').length,
      limited: locations.filter(l => l.availability === 'limited').length,
      outOfStock: locations.filter(l => l.availability === 'out_of_stock').length
    };
  }

  // /**
  //  * Smart availability lookup - detects identifier type and routes to correct endpoint
  //  * Product slugs (lpc_*/upc_*) go to /slug endpoint, SKUs go to /sku endpoint
  //  */
  
  async getAvailabilityWithFallback(
    identifier: string, // Can be slug or SKU
    userLocation?: UserLocation,
    options: LocationQueryOptions = {}
  ): Promise<MultiLocationAvailability | null> {
    const identifierType = this.getIdentifierType(identifier);
    // console.log(`[LocationAvailabilityService] Identifier type: ${identifierType}`);
    
    if (identifierType === 'product_slug') {
      // Use slug endpoint for product_slug format
      // console.log(`[LocationAvailabilityService] Using slug endpoint for: ${identifier}`);
      return this.getProductAvailability(identifier, userLocation, options);
    } else if (identifierType === 'sku') {
      // Use SKU endpoint for SKU format
      // console.log(`[LocationAvailabilityService] Using SKU endpoint for: ${identifier}`);
      return this.getAvailabilityBySku(identifier, userLocation, options);
    }

    // console.log(`[LocationAvailabilityService] Unknown identifier type: ${identifier}`);
    return null;
  }
}

// Export singleton instance
export const locationAvailabilityService = LocationAvailabilityService.getInstance();
export default locationAvailabilityService;
