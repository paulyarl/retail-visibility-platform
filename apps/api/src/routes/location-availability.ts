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

    // Validate that input is a proper product_slug format (lpc_* or upc_*)
    const isProductSlug = /^(lpc_|upc_)/i.test(slug);
    
    if (!isProductSlug) {
      // Input looks like an SKU, not a product_slug - client should use /sku endpoint
      return res.status(400).json({
        error: 'invalid_slug_format',
        message: 'Parameter must be a product_slug (lpc_* or upc_* prefix). For SKU lookup, use /api/catalog/availability/sku endpoint.',
        hint: 'Use the /sku endpoint with the sku parameter for SKU-based lookups'
      });
    }

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;
    const maxDist = parseInt(maxDistance);
    const maxRes = parseInt(maxResults);

    // Find the product in slug registry
    const slugRegistry = await prisma.product_slug_registry.findFirst({
      where: {
        product_slug: slug
      }
    });

    if (!slugRegistry) {
      return res.status(404).json({
        error: 'not_found',
        message: `Product slug not found: ${slug}`
      });
    }

    const productSlug = slugRegistry.product_slug;
    const universalSku = slugRegistry.universal_sku || slugRegistry.original_sku || slug;
    console.log(`[LocationAvailability] Found slug registry for ${slug}: product_slug=${productSlug}`);

    // Query mv_global_discovery for availability across all tenants
    // This is the authoritative source for product availability
    const pool = require('../utils/db-pool').getDirectPool();
    
    let locationQuery = `
      SELECT 
        inventory_item_id,
        product_name,
        product_slug,
        sku,
        current_price_cents,
        list_price_cents,
        sale_price_cents,
        is_on_sale,
        discount_percentage,
        stock,
        in_stock,
        image_url,
        tenant_id,
        tenant_name,
        tenant_slug,
        tenant_logo_url,
        tenant_city,
        tenant_state,
        tenant_latitude,
        tenant_longitude,
        store_average_rating,
        store_review_count,
        item_status,
        visibility
      FROM mv_global_discovery
      WHERE product_slug = $1
        AND item_status = 'active'
        AND visibility = 'public'
    `;
    
    const queryParams: any[] = [productSlug];
    
    if (organizationId) {
      // Join with tenants to filter by organization
      locationQuery += ` AND tenant_id IN (SELECT id FROM tenants WHERE organization_id = $2)`;
      queryParams.push(organizationId);
    }
    
    if (includeOutOfStock === 'false') {
      locationQuery += ` AND in_stock = true`;
    }
    
    const discoveryResult = await pool.query(locationQuery, queryParams);
    
    if (discoveryResult.rows.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Product not found in any location'
      });
    }

    // Transform discovery results to location availability
    let locations = discoveryResult.rows.map((row: any) => {
      let distance: number | null = null;
      if (userLat !== null && userLng !== null && row.tenant_latitude && row.tenant_longitude) {
        distance = calculateDistance(userLat, userLng, row.tenant_latitude, row.tenant_longitude);
      }

      return {
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        tenantLogo: row.tenant_logo_url || null,
        locationId: null,
        address: '',
        city: row.tenant_city || '',
        distance: distance ?? 999,
        stock: row.stock || 0,
        availability: row.in_stock ? 'in_stock' : 'out_of_stock',
        priceCents: row.current_price_cents || 0,
        price: (row.current_price_cents || 0) / 100,
        currency: 'USD',
        sku: row.sku,
        productName: row.product_name,
        productSlug: row.product_slug,
        universalSku: universalSku,
        isPreferred: preferredTenantId === row.tenant_id,
        isNearest: false,
        hasLowStock: row.stock > 0 && row.stock <= 5,
        isOnSale: row.is_on_sale,
        discountPercentage: row.discount_percentage || 0
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
    const firstRow = discoveryResult.rows[0];
    const response = {
      productSlug: productSlug,
      universalSku: universalSku,
      productName: firstRow?.product_name || slug,
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

    // Find product by universal SKU or original SKU
    // UPC products: universal_sku = UPC code (unique across tenants)
    // LPC products: universal_sku = NULL, use original_sku (tenant-scoped)
    const slugRegistry = await prisma.product_slug_registry.findFirst({
      where: {
        OR: [
          { universal_sku: sku },  // UPC lookup
          { original_sku: sku }     // LPC fallback
        ]
      }
    });

    if (!slugRegistry) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Product not found by SKU'
      });
    }

    const productSlug = slugRegistry.product_slug;
    const universalSku = slugRegistry.universal_sku || slugRegistry.original_sku || sku;

    const userLatVal = lat ? parseFloat(lat) : null;
    const userLngVal = lng ? parseFloat(lng) : null;
    const maxDist = parseInt(maxDistance);
    const maxRes = parseInt(maxResults);

    // Query mv_global_discovery for availability
    const pool = require('../utils/db-pool').getDirectPool();
    
    let locationQuery = `
      SELECT 
        inventory_item_id,
        product_name,
        product_slug,
        sku,
        current_price_cents,
        list_price_cents,
        sale_price_cents,
        is_on_sale,
        discount_percentage,
        stock,
        in_stock,
        image_url,
        tenant_id,
        tenant_name,
        tenant_slug,
        tenant_logo_url,
        tenant_city,
        tenant_state,
        tenant_latitude,
        tenant_longitude,
        store_average_rating,
        store_review_count
      FROM mv_global_discovery
      WHERE product_slug = $1
        AND item_status = 'active'
        AND visibility = 'public'
    `;
    
    const queryParams: any[] = [productSlug];
    
    if (organizationId) {
      locationQuery += ` AND tenant_id IN (SELECT id FROM tenants WHERE organization_id = $2)`;
      queryParams.push(organizationId);
    }
    
    if (includeOutOfStock === 'false') {
      locationQuery += ` AND in_stock = true`;
    }
    
    const discoveryResult = await pool.query(locationQuery, queryParams);
    
    // Transform to location availability
    let locations = discoveryResult.rows.map((row: any) => {
      let distance: number | null = null;
      if (userLatVal !== null && userLngVal !== null && row.tenant_latitude && row.tenant_longitude) {
        distance = calculateDistance(userLatVal, userLngVal, row.tenant_latitude, row.tenant_longitude);
      }

      return {
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        tenantLogo: row.tenant_logo_url || null,
        distance: distance ?? 999,
        stock: row.stock || 0,
        availability: row.in_stock ? 'in_stock' : 'out_of_stock',
        priceCents: row.current_price_cents || 0,
        price: (row.current_price_cents || 0) / 100,
        currency: 'USD',
        sku: row.sku,
        productName: row.product_name,
        productSlug: row.product_slug,
        universalSku: universalSku,
        isOnSale: row.is_on_sale,
        discountPercentage: row.discount_percentage || 0
      };
    });

    // Filter by distance if user location provided
    if (userLatVal !== null && userLngVal !== null) {
      locations = locations.filter(l => l.distance <= maxDist);
    }

    // Sort
    if (sortBy === 'distance' && userLatVal !== null && userLngVal !== null) {
      locations.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'price') {
      locations.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sortBy === 'stock') {
      locations.sort((a, b) => b.stock - a.stock);
    }

    // Limit results
    locations = locations.slice(0, maxRes);

    const firstRow = discoveryResult.rows[0];

    return res.json({
      productSlug: productSlug,
      universalSku: universalSku,
      productName: firstRow?.product_name || sku,
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
