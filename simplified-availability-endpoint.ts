// Simplified availability API using inventory_items directly
import { Request, Response } from 'express';
import { prisma } from '@/lib/prisma';

/**
 * Get product availability by slug - Simplified Version
 * Queries inventory_items directly instead of complex global catalog
 */
export async function getProductAvailabilityBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.query;
    
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({
        error: 'missing_slug',
        message: 'Product slug is required'
      });
    }

    // Query inventory_items directly with the product_slug index
    const inventoryItems = await prisma.inventory_items.findMany({
      where: {
        product_slug: slug,
        item_status: 'active',
        visibility: 'public',
        // Optional: Filter by organization if provided
        ...(req.query.organizationId && {
          tenant: {
            organization_id: req.query.organizationId as string
          }
        })
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { stock: 'desc' }, // Items with more stock first
        { name: 'asc' }
      ]
    });

    if (inventoryItems.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Product not found'
      });
    }

    // Transform to expected format
    const locations = inventoryItems.map(item => ({
      tenantId: item.tenant_id,
      tenantName: item.tenant.name,
      tenantSlug: item.tenant.slug,
      distance: 999, // TODO: Calculate actual distance if lat/lng provided
      stock: item.stock,
      availability: item.availability || (item.stock > 0 ? 'in_stock' : 'out_of_stock'),
      priceCents: item.price_cents,
      price: item.price_cents ? item.price_cents / 100 : 0,
      currency: item.currency || 'USD',
      sku: item.sku,
      productName: item.name,
      productSlug: item.product_slug
    }));

    return res.json({
      productSlug: slug,
      productName: inventoryItems[0].name,
      totalLocations: locations.length,
      inStockLocations: locations.filter(loc => loc.stock > 0).length,
      locations,
      // Include user location if provided
      ...(req.query.lat && req.query.lng && {
        userLocation: {
          latitude: parseFloat(req.query.lat as string),
          longitude: parseFloat(req.query.lng as string)
        }
      })
    });

  } catch (error) {
    console.error('[SimplifiedAvailability] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch availability'
    });
  }
}
