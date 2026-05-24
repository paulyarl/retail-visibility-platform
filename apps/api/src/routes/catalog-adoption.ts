/**
 * Catalog Adoption API Routes
 * 
 * Handles product adoption from the global catalog to tenant inventory.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../prisma';
import { product_source } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { generateItemId, generateTenantItemId } from '../lib/id-generator';

const router = Router();

// Validation schema
const adoptProductSchema = z.object({
  tenantId: z.string().min(1),
  globalProductId: z.string().min(1),
  productSlug: z.string().min(1),
  priceCents: z.number().int().positive(),
  stock: z.number().int().min(0),
  sku: z.string().min(1),
  description: z.string().optional()
});

/**
 * POST /api/catalog/adopt
 * Adopt a product from the global catalog
 * 
 * Body:
 * - tenantId: Target tenant ID
 * - globalProductId: ID from global_product_catalog
 * - productSlug: Product slug
 * - universalSku: Universal SKU
 * - priceCents: Selling price in cents
 * - stock: Initial stock quantity
 * - sku: Tenant's internal SKU
 * - description: Optional custom description
 */
router.post('/adopt', authenticateToken, async (req: Request, res: Response) => {
  try {
    const parsed = adoptProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten()
      });
    }

    const {
      tenantId,
      globalProductId,
      productSlug,
      priceCents,
      stock,
      sku,
      description
    } = parsed.data;

    // Verify user has access to tenant
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
    }

    // Check tenant access
    const tenant = await prisma.tenants.findFirst({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'not_found', message: 'Tenant not found' });
    }

    // Get tier permissions - subscription_tier is a string key, not an ID
    const tierPermissions = await prisma.tier_catalog_permissions.findFirst({
      where: { tier_id: tenant.subscription_tier }
    });

    if (!tierPermissions?.can_add_from_global_catalog) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Your tier does not allow adding products from the global catalog'
      });
    }

    // Check product limit
    if (tierPermissions.max_catalog_products !== null) {
      const currentCount = await prisma.inventory_items.count({
        where: { tenant_id: tenantId }
      });

      if (currentCount >= tierPermissions.max_catalog_products) {
        return res.status(403).json({
          error: 'limit_exceeded',
          message: `Maximum product limit (${tierPermissions.max_catalog_products}) reached`
        });
      }
    }

    // Get global product
    const globalProduct = await prisma.global_product_catalog.findFirst({
      where: {
        id: globalProductId,
        status: 'active'
      }
    });

    if (!globalProduct) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Product not found in global catalog'
      });
    }

    // Check if product already exists in tenant inventory (by UPC)
    if (globalProduct.gtin_upc) {
      const existing = await prisma.inventory_items.findFirst({
        where: {
          tenant_id: tenantId,
          gtin: globalProduct.gtin_upc
        }
      });

      if (existing) {
        return res.status(409).json({
          error: 'duplicate',
          message: 'A product with this UPC already exists in your inventory',
          existingProductId: existing.id
        });
      }
    }

    // Check if SKU already exists for tenant
    const existingSku = await prisma.inventory_items.findFirst({
      where: {
        tenant_id: tenantId,
        sku
      }
    });

    if (existingSku) {
      return res.status(409).json({
        error: 'duplicate_sku',
        message: 'A product with this SKU already exists'
      });
    }

    // Create inventory item
    const inventoryItem = await prisma.inventory_items.create({
      data: {
        id: generateTenantItemId(tenantId),
        tenant_id: tenantId,
        sku,
        name: globalProduct.name,
        title: globalProduct.name,
        brand: globalProduct.brand || '',
        description: description || globalProduct.description || '',
        price_cents: priceCents,
        price: priceCents / 100,
        stock,
        quantity: stock,
        gtin: globalProduct.gtin_upc || '',
        category_path: globalProduct.category_path || [],
        image_url: Array.isArray(globalProduct.images) && globalProduct.images[0] && typeof globalProduct.images[0] === 'object' && 'url' in globalProduct.images[0] 
          ? (globalProduct.images[0] as { url: string }).url 
          : null,
        image_gallery: Array.isArray(globalProduct.images) 
          ? globalProduct.images.map((img: any) => img?.url || '').filter(Boolean)
          : [],
        availability: stock > 0 ? 'in_stock' : 'out_of_stock',
        item_status: 'active',
        visibility: 'public',
        currency: 'USD',
        product_type: 'physical',
        source: product_source.API_IMPORT,
        updated_at: new Date(),
        // Use specifications from global catalog (only field available there)
        specifications: globalProduct.specifications || {},
        // Fields not in global catalog - will be null for adopted products
        features: [],
        enhanced_description: null,
        license_type: null,
        access_duration_days: null,
        download_limit: null,
        metadata: {
          global_product_id: globalProductId,
          product_slug: productSlug,
          adopted_at: new Date().toISOString(),
          adopted_from: 'global_catalog'
        }
      }
    });

    // Register slug if not already registered
    // universal_sku rules:
    // - UPC products: universal_sku = UPC code (unique across tenants)
    // - LPC products: universal_sku = NULL (not unique, tenant-scoped)
    const universalSku = globalProduct.gtin_upc && globalProduct.gtin_upc.trim() !== '' && globalProduct.gtin_upc.trim().length >= 6
      ? globalProduct.gtin_upc.trim()  // UPC: use the UPC code
      : null;              // LPC: no universal SKU

    await prisma.product_slug_registry.upsert({
      where: { product_slug: productSlug },
      create: {
        id: `psr-${crypto.randomUUID()}`,
        product_slug: productSlug,
        universal_sku: universalSku,
        slug_hash: crypto.createHash('sha256').update(productSlug).digest('hex'),
        tenant_id: tenantId,
        original_sku: sku,
        slug_type: globalProduct.gtin_upc ? 'upc' : 'lpc',
        slug_prefix: globalProduct.gtin_upc ? 'upc' : 'lpc',
        brand_normalized: globalProduct.brand?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null,
        category_normalized: globalProduct.category_path?.[0]?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'general',
        format_version: 'v2',
        migration_status: 'adopted',
        is_active: true
      },
      update: {
        tenant_id: tenantId,
        original_sku: sku,
        universal_sku: universalSku,
        is_active: true
      }
    });

    res.status(201).json({
      success: true,
      product: inventoryItem,
      message: 'Product adopted successfully'
    });
  } catch (error) {
    console.error('[CatalogAdoption] Error adopting product:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to adopt product' });
  }
});

/**
 * GET /api/catalog/permissions/:tierId
 * Get catalog permissions for a tier
 */
router.get('/permissions/:tierId', async (req: Request, res: Response) => {
  try {
    const { tierId } = req.params;

    const permissions = await prisma.tier_catalog_permissions.findFirst({
      where: { tier_id: tierId },
      include: {
        subscription_tiers_list: {
          select: {
            tier_key: true,
            tier_type: true,
            name: true
          }
        }
      }
    });

    if (!permissions) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Tier permissions not found'
      });
    }

    res.json({
      tier_id: permissions.tier_id,
      tier_key: permissions.subscription_tiers_list?.tier_key,
      tier_type: permissions.subscription_tiers_list?.tier_type,
      can_browse_global_catalog: permissions.can_browse_global_catalog,
      can_add_from_global_catalog: permissions.can_add_from_global_catalog,
      can_override_global_inclusion: permissions.can_override_global_inclusion,
      default_global_inclusion: permissions.default_global_inclusion,
      can_opt_out_global_inclusion: permissions.can_opt_out_global_inclusion,
      catalog_visibility_level: permissions.catalog_visibility_level,
      max_catalog_products: permissions.max_catalog_products
    });
  } catch (error) {
    console.error('[CatalogAdoption] Error fetching tier permissions:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch permissions' });
  }
});

export default router;
