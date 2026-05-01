/**
 * Checkout Location Service (Frontend)
 * 
 * Handles multi-location checkout for organizations with multiple stores.
 * Integrates with checkout flow to provide nearest location selection.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import HeroLocationService from './HeroLocationService';


export interface CartItem {
  productSlug?: string;
  inventoryItemId?: string;
  sku?: string;
  quantity: number;
}

export interface CheckoutLocation {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  address: string;
  city: string;
  state?: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  distance: number;
  stock: number;
  availability: string;
  priceCents: number;
  price: number;
  currency: string;
  sku: string;
  productName: string;
  productSlug?: string;
  inventoryItemId: string;
  isNearest: boolean;
  hasLowStock: boolean;
  isPreferred: boolean;
}

export interface CheckoutLocationResult {
  success: boolean;
  error?: string;
  organizationId?: string;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  items: Array<{
    productSlug?: string;
    inventoryItemId?: string;
    sku?: string;
    quantity: number;
    available: boolean;
    nearestLocation?: CheckoutLocation;
    allLocations: CheckoutLocation[];
  }>;
  nearestPickupLocation?: CheckoutLocation;
  allLocationsAvailable: boolean;
  totalLocations: number;
}

export interface LocationValidationResult {
  tenantId: string;
  valid: boolean;
  missingItems: string[];
}

class CheckoutLocationService extends PublicApiSingleton {
  private static instance: CheckoutLocationService;

  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;
  protected defaultContext = AppContext.PUBLIC;
  protected defaultIsolation = CacheIsolation.PUBLIC;

  // Cache TTLs
  private readonly LOCATION_TTL = 5 * 60 * 1000; // 5 minutes

  protected constructor() {
    super('checkout-location-service', {
      ttl: 5 * 60 * 1000
    });
  }

  public static getInstance(): CheckoutLocationService {
    if (!CheckoutLocationService.instance) {
      CheckoutLocationService.instance = new CheckoutLocationService();
    }
    return CheckoutLocationService.instance;
  }

  /**
   * Find nearest locations for all cart items
   * Used in checkout to suggest pickup location
   */
  async findLocationsForCart(
    items: CartItem[],
    userLocation?: { latitude: number; longitude: number },
    options?: {
      organizationId?: string;
      preferredTenantId?: string;
      maxDistance?: number;
    }
  ): Promise<CheckoutLocationResult> {
    try {
      const body: Record<string, any> = {
        items,
        ...(userLocation && { lat: userLocation.latitude, lng: userLocation.longitude }),
        ...options,
      };

      const result = await this.makeDefaultRequest<CheckoutLocationResult>(
        '/api/catalog/checkout/locations',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
        `checkout-locations:${JSON.stringify(items)}:${userLocation?.latitude}:${userLocation?.longitude}`,
        this.LOCATION_TTL
      );

      if (!result.success) {
        return {
          success: false,
          error: result?.error?.toString() || 'Failed to find locations',
          items: [],
          allLocationsAvailable: false,
          totalLocations: 0,
        };
      }

      return result.data;
    } catch (error) {
      console.error('[CheckoutLocationService] Error finding locations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find locations',
        items: [],
        allLocationsAvailable: false,
        totalLocations: 0,
      };
    }
  }

  /**
   * Get all organization locations for a product
   * Used for location picker in checkout UI
   */
  async getOrganizationLocations(
    productSlug: string,
    organizationId: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{
    productSlug: string;
    organizationId: string;
    totalLocations: number;
    locations: CheckoutLocation[];
  }> {
    try {
      const params = new URLSearchParams();
      if (userLocation) {
        params.append('lat', userLocation.latitude.toString());
        params.append('lng', userLocation.longitude.toString());
      }

      const url = `/api/catalog/checkout/locations/${organizationId}/${encodeURIComponent(productSlug)}${params.toString() ? '?' + params.toString() : ''}`;

      const result = await this.makeDefaultRequest<{
        productSlug: string;
        organizationId: string;
        totalLocations: number;
        locations: CheckoutLocation[];
      }>(url, { method: 'GET' }, `org-locations:${productSlug}:${organizationId}`, this.LOCATION_TTL);

      if (!result.success) {
        return {
          productSlug,
          organizationId,
          totalLocations: 0,
          locations: [],
        };
      }

      return result.data;
    } catch (error) {
      console.error('[CheckoutLocationService] Error getting organization locations:', error);
      return {
        productSlug,
        organizationId,
        totalLocations: 0,
        locations: [],
      };
    }
  }

  /**
   * Validate that a location has all cart items in stock
   * Call before finalizing checkout
   */
  async validateLocationForCart(
    tenantId: string,
    items: CartItem[]
  ): Promise<LocationValidationResult> {
    try {
      const result = await this.makeDefaultRequest<LocationValidationResult>(
        '/api/catalog/checkout/validate-location',
        {
          method: 'POST',
          body: JSON.stringify({ tenantId, items }),
        },
        `validate-location:${tenantId}`,
        this.LOCATION_TTL
      );

      if (!result.success) {
        return {
          tenantId,
          valid: false,
          missingItems: items.map(i => i.productSlug || i.sku || i.inventoryItemId || 'Unknown'),
        };
      }

      return result.data;
    } catch (error) {
      console.error('[CheckoutLocationService] Error validating location:', error);
      return {
        tenantId,
        valid: false,
        missingItems: items.map(i => i.productSlug || i.sku || i.inventoryItemId || 'Unknown'),
      };
    }
  }

  /**
   * Get user's current location using browser geolocation API
   */
  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000, // 5 minutes cache
        }
      );
    });
  }

  /**
   * Format location address for display
   */
  formatAddress(location: CheckoutLocation): string {
    const parts = [location.address, location.city];
    if (location.state) {
      parts.push(location.state);
    }
    parts.push(location.postalCode);
    return parts.filter(Boolean).join(', ');
  }

  /**
   * Format distance for display
   */
  formatDistance(distance: number): string {
    if (distance >= 999) {
      return 'Distance unavailable';
    }
    if (distance < 1) {
      return `${Math.round(distance * 5280)} ft`;
    }
    return `${distance.toFixed(1)} mi`;
  }

  /**
   * Get payment routing for a pickup location (uses hero location if available)
   */
  async getPaymentRouting(pickupTenantId: string): Promise<{
    paymentTenantId: string;
    isHeroPayment: boolean;
    paymentConfig?: {
      paymentGatewayId?: string;
      paymentGatewayType?: string;
    };
  }> {
    try {
      // const { HeroLocationService } = await import('./HeroLocationService');
      const heroLocationService = HeroLocationService;
      
      return await heroLocationService.getPaymentConfig(pickupTenantId);
    } catch (error) {
      console.error('[CheckoutLocationService] Error getting payment routing:', error);
      // Fallback to pickup tenant
      return {
        paymentTenantId: pickupTenantId,
        isHeroPayment: false,
      };
    }
  }

  /**
   * Check if pickup location uses hero location for payments
   */
  async usesHeroPayment(pickupTenantId: string): Promise<boolean> {
    try {
      const routing = await this.getPaymentRouting(pickupTenantId);
      return routing.isHeroPayment;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const checkoutLocationService = CheckoutLocationService.getInstance();
