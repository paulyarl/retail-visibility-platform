/**
 * Location Availability API Routes
 * 
 * Provides multi-location product availability queries with geographic distance calculations.
 */

import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import { z } from 'zod';

const router = Router();

// Earth's radius in miles
// Earth's radius in kilometers
const EARTH_RADIUS_MILES = 3959;
const EARTH_RADIUS_KM = 6371;

// Validation schemas
const availabilityQuerySchema = z.object({
  slug: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  lat: z.string().regex(/^-?\d+\.?\d*$/).optional(),
  lng: z.string().regex(/^-?\d+\.?\d*$/).optional(),
  maxDistance: z.string().regex(/^\d+$/).optional(),
  maxResults: z.string().regex(/^\d+$/).optional(),
  includeOutOfStock: z.enum(['true', 'false']).optional(),
  preferredTenantId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  sortBy: z.enum(['distance', 'price', 'stock']).optional()
});

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
 * GET /api/catalog/availability
 * Get product availability across multiple locations by slug
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = availabilityQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_query',
        details: parsed.error.flatten()
      });
    }

    const {
      slug,
      lat,
      lng,
      maxDistance = '50',
      maxResults = '10',
      includeOutOfStock = 'true',
      preferredTenantId,
      organizationId,
      sortBy = 'distance'
    } = parsed.data;

    if (!slug) {
      return res.status(400).json({
        error: 'missing_slug',
        message: 'Product slug is required'
      });
    }

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;
    const maxDist = parseInt(maxDistance);
    const maxRes = parseInt(maxResults);

    // Get the global product
    const globalProduct = await prisma.global_product_catalog.findFirst({
      where: { product_slug: slug, status: 'active' }
    });

    if (!globalProduct) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Product not found in global catalog'
      });
    }

    // Find inventory items matching this product (by UPC or name/brand)
    const inventoryQuery: any = {
      where: {
        item_status: 'active',
        visibility: 'public',
        ...(organizationId && {
          tenants: {
            organization_id: organizationId
          }
        }),
        ...(includeOutOfStock === 'false' && {
          availability: 'in_stock'
        })
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
                logo_url: true
              }
            }
          }
        }
      }
    };

    // Match by UPC first, then by name similarity
    let inventoryItems: any[] = [];
    
    if (globalProduct.gtin_upc) {
      inventoryItems = await prisma.inventory_items.findMany({
        ...inventoryQuery,
        where: {
          ...inventoryQuery.where,
          gtin: globalProduct.gtin_upc
        }
      });
    }

    // If no UPC matches, try name/brand match
    if (inventoryItems.length === 0) {
      inventoryItems = await prisma.inventory_items.findMany({
        ...inventoryQuery,
        where: {
          ...inventoryQuery.where,
          OR: [
            { name: { equals: globalProduct.name, mode: 'insensitive' } },
            { title: { equals: globalProduct.name, mode: 'insensitive' } },
            {
              AND: [
                { brand: { equals: globalProduct.brand || '', mode: 'insensitive' } },
                { name: { contains: globalProduct.name, mode: 'insensitive' } }
              ]
            }
          ]
        }
      });
    }

    // Transform to location availability
    let locations = inventoryItems
      .filter(item => item.tenants)
      .map(item => {
        const tenant = item.tenants;
        const profile = tenant.tenant_business_profiles_list;
        
        // Handle Prisma Decimal type for lat/lng
        let distance: number | null = null;
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
          tenantSlug: tenant.slug,
          tenantLogo: profile?.logo_url || null,
          locationId: item.location_id,
          address: profile?.address_line1 || '',
          city: profile?.city || '',
          distance: distance ?? 999,
          stock: item.stock,
          availability: item.availability,
          priceCents: item.price_cents,
          price: Number(item.price),
          currency: item.currency,
          sku: item.sku,
          productName: item.name,
          productSlug: slug,
          universalSku: globalProduct.universal_sku,
          isPreferred: preferredTenantId === tenant.id,
          isNearest: false,
          hasLowStock: item.stock > 0 && item.stock <= 5
        };
      });

    // Filter by distance
    if (userLat !== null && userLng !== null) {
      locations = locations.filter(l => l.distance <= maxDist);
    }

    // Sort
    if (sortBy === 'distance' && userLat !== null && userLng !== null) {
      locations.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'price') {
      locations.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sortBy === 'stock') {
      locations.sort((a, b) => b.stock - a.stock);
    }

    // Mark nearest
    if (locations.length > 0 && userLat !== null && userLng !== null) {
      const inStock = locations.filter(l => l.availability === 'in_stock');
      if (inStock.length > 0) {
        inStock[0].isNearest = true;
      }
    }

    // Limit results
    locations = locations.slice(0, maxRes);

    // Build response
    const response = {
      productSlug: slug,
      universalSku: globalProduct.universal_sku,
      productName: globalProduct.name,
      totalLocations: locations.length,
      inStockLocations: locations.filter(l => l.availability === 'in_stock').length,
      nearestAvailable: locations.find(l => l.isNearest && l.availability === 'in_stock'),
      locations,
      userLocation: (userLat !== null && userLng !== null) ? {
        latitude: userLat,
        longitude: userLng
      } : undefined
    };

    res.json(response);
  } catch (error) {
    console.error('[LocationAvailability] Error fetching availability:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch availability' });
  }
});

/**
 * GET /api/catalog/availability/sku
 * Get product availability by universal SKU
 */
router.get('/sku', optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = availabilityQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_query',
        details: parsed.error.flatten()
      });
    }

    const {
      sku,
      lat,
      lng,
      maxDistance = '50',
      maxResults = '10',
      includeOutOfStock = 'true',
      organizationId,
      sortBy = 'distance'
    } = parsed.data;

    if (!sku) {
      return res.status(400).json({
        error: 'missing_sku',
        message: 'Universal SKU is required'
      });
    }

    // Find product by universal SKU
    const slugRegistry = await prisma.product_slug_registry.findFirst({
      where: { universal_sku: sku }
    });

    if (!slugRegistry) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Product not found by SKU'
      });
    }

    // Re-query using slug - redirect to the slug endpoint logic
    req.query = Object.fromEntries(new URLSearchParams({
      slug: slugRegistry.product_slug,
      ...(lat && { lat }),
      ...(lng && { lng }),
      maxDistance,
      maxResults,
      includeOutOfStock,
      ...(organizationId && { organizationId }),
      sortBy
    }));

    // Get the global product
    const globalProduct = await prisma.global_product_catalog.findFirst({
      where: { product_slug: slugRegistry.product_slug, status: 'active' }
    });

    if (!globalProduct) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Product not found in global catalog'
      });
    }

    // Continue with the same logic as the main endpoint
    const userLatVal = lat ? parseFloat(lat) : null;
    const userLngVal = lng ? parseFloat(lng) : null;
    const maxDist = parseInt(maxDistance);
    const maxRes = parseInt(maxResults);

    // Find inventory items matching this product
    let inventoryItems: any[] = [];
    
    if (globalProduct.gtin_upc) {
      inventoryItems = await prisma.inventory_items.findMany({
        where: {
          gtin: globalProduct.gtin_upc,
          item_status: 'active',
          visibility: 'public',
          ...(organizationId && {
            tenants: { organization_id: organizationId }
          }),
          ...(includeOutOfStock === 'false' && {
            availability: 'in_stock'
          })
        },
        include: {
          tenants: { select: { id: true, name: true, slug: true } }
        }
      });
    }

    if (inventoryItems.length === 0) {
      inventoryItems = await prisma.inventory_items.findMany({
        where: {
          OR: [
            { name: { equals: globalProduct.name, mode: 'insensitive' } },
            { title: { equals: globalProduct.name, mode: 'insensitive' } },
            {
              AND: [
                { brand: { equals: globalProduct.brand || '', mode: 'insensitive' } },
                { name: { contains: globalProduct.name, mode: 'insensitive' } }
              ]
            }
          ],
          item_status: 'active',
          visibility: 'public',
          ...(organizationId && {
            tenants: { organization_id: organizationId }
          }),
          ...(includeOutOfStock === 'false' && {
            availability: 'in_stock'
          })
        },
        include: {
          tenants: { select: { id: true, name: true, slug: true } }
        }
      });
    }

    // Build response
    const locations = inventoryItems
      .filter(item => item.tenants)
      .map(item => ({
        tenantId: item.tenants!.id,
        tenantName: item.tenants!.name,
        tenantSlug: item.tenants!.slug,
        distance: 999,
        stock: item.stock,
        availability: item.availability,
        priceCents: item.price_cents,
        price: Number(item.price),
        currency: item.currency,
        sku: item.sku,
        productName: item.name,
        productSlug: slugRegistry.product_slug
      }))
      .slice(0, maxRes);

    return res.json({
      productSlug: slugRegistry.product_slug,
      universalSku: sku,
      productName: globalProduct.name,
      totalLocations: locations.length,
      inStockLocations: locations.filter(l => l.availability === 'in_stock').length,
      locations
    });
  } catch (error) {
    console.error('[LocationAvailability] Error fetching SKU availability:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch availability' });
  }
});

/**
 * POST /api/catalog/availability/batch
 * Get availability for multiple products (for cart)
 */
router.post('/batch', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { items, lat, lng, organizationId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'invalid_items',
        message: 'Items array is required'
      });
    }

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    // Query availability for each item in parallel
    const results = await Promise.all(
      items.map(async (item: { productSlug: string; quantity: number }) => {
        const params = new URLSearchParams({
          slug: item.productSlug,
          maxDistance: '50',
          maxResults: '5',
          includeOutOfStock: 'false',
          sortBy: 'distance',
          ...(userLat !== null && { lat: String(userLat) }),
          ...(userLng !== null && { lng: String(userLng) }),
          ...(organizationId && { organizationId })
        });

        // Direct query instead of HTTP call
        const inventoryItems = await prisma.inventory_items.findMany({
          where: {
            OR: [
              { metadata: { path: ['product_slug'], equals: item.productSlug } },
              { name: { equals: item.productSlug.replace(/-/g, ' '), mode: 'insensitive' } }
            ],
            item_status: 'active',
            visibility: 'public',
            availability: 'in_stock',
            stock: { gte: item.quantity },
            ...(organizationId && {
              tenants: { organization_id: organizationId }
            })
          },
          include: {
            tenants: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          },
          take: 5
        });

        const locations = inventoryItems
          .filter(i => i.tenants)
          .map(inv => ({
            tenantId: inv.tenants!.id,
            tenantName: inv.tenants!.name,
            distance: 999,
            stock: inv.stock,
            availability: inv.availability,
            priceCents: inv.price_cents
          }))
          .sort((a, b) => a.distance - b.distance);

        return {
          productSlug: item.productSlug,
          quantity: item.quantity,
          available: locations.length > 0,
          locations
        };
      })
    );

    res.json({ items: results });
  } catch (error) {
    console.error('[LocationAvailability] Error in batch query:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch batch availability' });
  }
});

/**
 * POST /api/catalog/checkout/locations
 * Find nearest locations for all cart items (multi-location checkout)
 * Supports both deposit and full checkout flows
 */
router.post('/checkout/locations', async (req: Request, res: Response) => {
  try {
    const { items, lat, lng, organizationId, preferredTenantId, maxDistance = 100 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'items_required',
        message: 'Cart items are required'
      });
    }

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    // Import checkout location service
    const { checkoutLocationService } = await import('../services/CheckoutLocationService');
    
    const result = await checkoutLocationService.findLocationsForCart(
      items,
      userLat,
      userLng,
      organizationId,
      preferredTenantId,
      maxDistance
    );

    res.json(result);
  } catch (error) {
    console.error('[LocationAvailability] Error in checkout locations:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to find checkout locations' });
  }
});

/**
 * GET /api/catalog/checkout/locations/:organizationId/:productSlug
 * Get all organization locations for a specific product (location picker)
 */
router.get('/checkout/locations/:organizationId/:productSlug', async (req: Request, res: Response) => {
  try {
    const { organizationId, productSlug } = req.params;
    const { lat, lng } = req.query;

    const userLat = lat ? parseFloat(lat as string) : undefined;
    const userLng = lng ? parseFloat(lng as string) : undefined;

    const { checkoutLocationService } = await import('../services/CheckoutLocationService');
    
    const locations = await checkoutLocationService.getOrganizationLocations(
      productSlug,
      organizationId,
      userLat,
      userLng
    );

    res.json({
      productSlug,
      organizationId,
      totalLocations: locations.length,
      locations
    });
  } catch (error) {
    console.error('[LocationAvailability] Error getting organization locations:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get organization locations' });
  }
});

/**
 * POST /api/catalog/checkout/validate-location
 * Validate that a location has all cart items in stock
 */
router.post('/checkout/validate-location', async (req: Request, res: Response) => {
  try {
    const { tenantId, items } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        error: 'tenant_id_required',
        message: 'Tenant ID is required'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'items_required',
        message: 'Cart items are required'
      });
    }

    const { checkoutLocationService } = await import('../services/CheckoutLocationService');
    
    const result = await checkoutLocationService.validateLocationForCart(tenantId, items);

    res.json({
      tenantId,
      valid: result.valid,
      missingItems: result.missingItems
    });
  } catch (error) {
    console.error('[LocationAvailability] Error validating location:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to validate location' });
  }
});

export default router;
