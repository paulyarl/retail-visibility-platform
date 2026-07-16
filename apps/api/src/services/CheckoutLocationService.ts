/**
 * Checkout Location Service
 * 
 * Handles multi-location checkout for organizations with multiple stores.
 * Finds nearest available locations for cart items, supporting both:
 * - Deposit checkout (Tier 3): deposit based on commerce settings, pickup at nearest location
 * - Full checkout (Tier 4): Full payment, pickup at nearest location
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

// Earth's radius in miles
const EARTH_RADIUS_MILES = 3959;

export interface CartItem {
  productSlug?: string;
  inventoryItemId?: string;
  sku?: string;
  quantity: number;
}

export interface LocationAvailability {
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
  universalSku?: string;
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
    nearestLocation?: LocationAvailability;
    allLocations: LocationAvailability[];
  }>;
  nearestPickupLocation?: LocationAvailability;
  allLocationsAvailable: boolean;
  totalLocations: number;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * Checkout Location Service
 * Finds nearest available locations for multi-location checkout
 */
export class CheckoutLocationService {
  /**
   * Find available locations for all cart items
   * Returns nearest location for each item and overall nearest pickup location
   */
  async findLocationsForCart(
    items: CartItem[],
    userLat: number | null,
    userLng: number | null,
    organizationId?: string,
    preferredTenantId?: string,
    maxDistance: number = 100
  ): Promise<CheckoutLocationResult> {
    try {
      const result: CheckoutLocationResult = {
        success: true,
        items: [],
        allLocationsAvailable: true,
        totalLocations: 0,
      };

      if (userLat !== null && userLng !== null) {
        result.userLocation = { latitude: userLat, longitude: userLng };
      }

      // Track all locations to find the best pickup location
      const allLocations: Map<string, LocationAvailability> = new Map();
      const locationProductCounts: Map<string, number> = new Map();

      for (const item of items) {
        const itemResult = {
          ...item,
          available: false,
          nearestLocation: undefined as LocationAvailability | undefined,
          allLocations: [] as LocationAvailability[],
        };

        // Find inventory items matching this cart item
        let inventoryItems: any[] = [];

        if (item.inventoryItemId) {
          // Direct inventory item ID lookup
          const invItem = await prisma.inventory_items.findUnique({
            where: { id: item.inventoryItemId },
            include: {
              tenants: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  organization_id: true,
                  tenant_business_profiles_list: {
                    select: {
                      business_name: true,
                      address_line1: true,
                      city: true,
                      state: true,
                      postal_code: true,
                      latitude: true,
                      longitude: true,
                    },
                  },
                },
              },
            },
          });
          if (invItem) {
            inventoryItems = [invItem];
          }
        } else if (item.productSlug) {
          // Lookup by product slug in global catalog
          const globalProduct = await prisma.global_product_catalog.findFirst({
            where: { product_slug: item.productSlug },
          });

          if (globalProduct) {
            const whereClause: any = {
              item_status: 'active',
              visibility: 'public',
              stock: { gte: item.quantity },
              availability: 'in_stock',
            };

            if (organizationId) {
              whereClause.tenants = { organization_id: organizationId };
            }

            if (globalProduct.gtin_upc) {
              whereClause.gtin = globalProduct.gtin_upc;
            }

            inventoryItems = await prisma.inventory_items.findMany({
              where: whereClause,
              include: {
                tenants: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    organization_id: true,
                    tenant_business_profiles_list: {
                      select: {
                        business_name: true,
                        address_line1: true,
                        city: true,
                        state: true,
                        postal_code: true,
                        latitude: true,
                        longitude: true,
                      },
                    },
                  },
                },
              },
            });
          }
        } else if (item.sku) {
          // Lookup by SKU
          inventoryItems = await prisma.inventory_items.findMany({
            where: {
              sku: item.sku,
              item_status: 'active',
              visibility: 'public',
              stock: { gte: item.quantity },
              availability: 'in_stock',
              ...(organizationId && {
                tenants: { organization_id: organizationId },
              }),
            },
            include: {
              tenants: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  organization_id: true,
                  tenant_business_profiles_list: {
                    select: {
                      business_name: true,
                      address_line1: true,
                      city: true,
                      state: true,
                      postal_code: true,
                      latitude: true,
                      longitude: true,
                    },
                  },
                },
              },
            },
          });
        }

        // Transform inventory items to location availability
        const locations: LocationAvailability[] = inventoryItems
          .filter(inv => inv.tenants && inv.stock >= item.quantity)
          .map(inv => {
            const tenant = inv.tenants;
            const profile = tenant.tenant_business_profiles_list;

            let distance = 999;
            if (userLat !== null && userLng !== null && profile?.latitude && profile?.longitude) {
              const lat = typeof profile.latitude === 'object' && 'toNumber' in profile.latitude
                ? profile.latitude.toNumber()
                : Number(profile.latitude);
              const lng = typeof profile.longitude === 'object' && 'toNumber' in profile.longitude
                ? profile.longitude.toNumber()
                : Number(profile.longitude);
              distance = calculateDistance(userLat, userLng, lat, lng);
            }

            return {
              tenantId: tenant.id,
              tenantName: profile?.business_name || tenant.name,
              tenantSlug: tenant.slug || '',
              address: profile?.address_line1 || '',
              city: profile?.city || '',
              state: profile?.state || undefined,
              postalCode: profile?.postal_code || '',
              latitude: profile?.latitude ? Number(profile.latitude) : null,
              longitude: profile?.longitude ? Number(profile.longitude) : null,
              distance,
              stock: inv.stock,
              availability: inv.availability,
              priceCents: inv.price_cents,
              price: Number(inv.price),
              currency: inv.currency || 'USD',
              sku: inv.sku || '',
              productName: inv.name,
              productSlug: item.productSlug,
              inventoryItemId: inv.id,
              isNearest: false,
              hasLowStock: inv.stock > 0 && inv.stock <= 5,
              isPreferred: preferredTenantId === tenant.id,
            };
          });

        // Filter by distance if user location provided
        let filteredLocations = locations;
        if (userLat !== null && userLng !== null) {
          filteredLocations = locations.filter(l => l.distance <= maxDistance);
        }

        // Sort by distance
        filteredLocations.sort((a, b) => a.distance - b.distance);

        // Mark nearest
        if (filteredLocations.length > 0) {
          filteredLocations[0].isNearest = true;
          itemResult.available = true;
          itemResult.nearestLocation = filteredLocations[0];
          itemResult.allLocations = filteredLocations;

          // Track for overall pickup location
          for (const loc of filteredLocations) {
            const key = loc.tenantId;
            allLocations.set(key, loc);
            locationProductCounts.set(key, (locationProductCounts.get(key) || 0) + 1);
          }
        } else {
          result.allLocationsAvailable = false;
        }

        result.items.push(itemResult);
      }

      // Find the best pickup location (location with most products available)
      if (allLocations.size > 0) {
        let bestLocation: LocationAvailability | undefined;
        let maxProducts = 0;

        for (const [tenantId, location] of allLocations) {
          const productCount = locationProductCounts.get(tenantId) || 0;
          if (productCount > maxProducts || 
              (productCount === maxProducts && (!bestLocation || location.distance < bestLocation.distance))) {
            maxProducts = productCount;
            bestLocation = location;
          }
        }

        if (bestLocation) {
          result.nearestPickupLocation = {
            ...bestLocation,
            isNearest: true,
          };
        }

        result.totalLocations = allLocations.size;

        // Extract organization ID from first location
        const firstItem = result.items[0];
        if (firstItem?.nearestLocation) {
          const tenant = await prisma.tenants.findUnique({
            where: { id: firstItem.nearestLocation.tenantId },
            select: { organization_id: true },
          });
          result.organizationId = tenant?.organization_id || undefined;
        }
      }

      return result;
    } catch (error: any) {
      logger.error('[CheckoutLocationService] Error finding locations:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: error.message || 'Failed to find locations',
        items: [],
        allLocationsAvailable: false,
        totalLocations: 0,
      };
    }
  }

  /**
   * Get all organization locations for a product
   * Used to display location picker in checkout UI
   */
  async getOrganizationLocations(
    productSlug: string,
    organizationId: string,
    userLat?: number,
    userLng?: number
  ): Promise<LocationAvailability[]> {
    const globalProduct = await prisma.global_product_catalog.findFirst({
      where: { product_slug: productSlug },
    });

    if (!globalProduct) {
      return [];
    }

    const whereClause: any = {
      item_status: 'active',
      visibility: 'public',
      tenants: { organization_id: organizationId },
    };

    if (globalProduct.gtin_upc) {
      whereClause.gtin = globalProduct.gtin_upc;
    }

    const inventoryItems = await prisma.inventory_items.findMany({
      where: whereClause,
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true,
            tenant_business_profiles_list: {
              select: {
                business_name: true,
                address_line1: true,
                city: true,
                state: true,
                postal_code: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    });

    return inventoryItems
      .filter(item => item.tenants)
      .map(item => {
        const tenant = item.tenants;
        const profile = tenant.tenant_business_profiles_list;

        let distance = 999;
        if (userLat !== undefined && userLng !== undefined && profile?.latitude && profile?.longitude) {
          const lat = typeof profile.latitude === 'object' && 'toNumber' in profile.latitude
            ? profile.latitude.toNumber()
            : Number(profile.latitude);
          const lng = typeof profile.longitude === 'object' && 'toNumber' in profile.longitude
            ? profile.longitude.toNumber()
            : Number(profile.longitude);
          distance = calculateDistance(userLat, userLng, lat, lng);
        }

        return {
          tenantId: tenant.id,
          tenantName: profile?.business_name || tenant.name,
          tenantSlug: tenant.slug || '',
          address: profile?.address_line1 || '',
          city: profile?.city || '',
          state: profile?.state || undefined,
          postalCode: profile?.postal_code || '',
          latitude: profile?.latitude ? Number(profile.latitude) : null,
          longitude: profile?.longitude ? Number(profile.longitude) : null,
          distance,
          stock: item.stock,
          availability: item.availability,
          priceCents: item.price_cents,
          price: Number(item.price),
          currency: item.currency || 'USD',
          sku: item.sku || '',
          productName: item.name,
          productSlug,
          inventoryItemId: item.id,
          isNearest: false,
          hasLowStock: item.stock > 0 && item.stock <= 5,
          isPreferred: false,
        };
      })
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Validate that selected location has all cart items in stock
   */
  async validateLocationForCart(
    tenantId: string,
    items: CartItem[]
  ): Promise<{ valid: boolean; missingItems: string[] }> {
    const missingItems: string[] = [];

    for (const item of items) {
      let inventoryItem: any = null;

      if (item.inventoryItemId) {
        inventoryItem = await prisma.inventory_items.findFirst({
          where: {
            id: item.inventoryItemId,
            tenant_id: tenantId,
            item_status: 'active',
            stock: { gte: item.quantity },
          },
        });
      } else if (item.productSlug) {
        const globalProduct = await prisma.global_product_catalog.findFirst({
          where: { product_slug: item.productSlug },
        });

        if (globalProduct?.gtin_upc) {
          inventoryItem = await prisma.inventory_items.findFirst({
            where: {
              gtin: globalProduct.gtin_upc,
              tenant_id: tenantId,
              item_status: 'active',
              stock: { gte: item.quantity },
            },
          });
        }
      } else if (item.sku) {
        inventoryItem = await prisma.inventory_items.findFirst({
          where: {
            sku: item.sku,
            tenant_id: tenantId,
            item_status: 'active',
            stock: { gte: item.quantity },
          },
        });
      }

      if (!inventoryItem) {
        missingItems.push(item.productSlug || item.sku || item.inventoryItemId || 'Unknown item');
      }
    }

    return {
      valid: missingItems.length === 0,
      missingItems,
    };
  }
}

// Export singleton instance
export const checkoutLocationService = new CheckoutLocationService();
