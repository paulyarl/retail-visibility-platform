import express from 'express';
import { authenticateToken, checkTenantAccess } from '../auth/auth.middleware';
import { FeaturedProductsService } from '../services/FeaturedProductsService';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = express.Router();

// Validation schemas
const addFeaturedTypeSchema = z.object({
  featured_type: z.enum(['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick']),
  featured_priority: z.number().int().min(0).max(100).optional(),
  featured_expires_at: z.string().datetime().nullable().optional(),
  auto_unfeature: z.boolean().optional(),
});

const updateFeaturedTypeSchema = z.object({
  featured_expires_at: z.string().datetime().nullable().optional(),
  auto_unfeature: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/tenants/:tenantId/featured-products - Get all featured products for a tenant
router.get('/tenants/:tenantId/featured-products', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { featured_type, is_active, limit, offset } = req.query;

    const featuredProducts = await FeaturedProductsService.getFeaturedProductsForTenant(tenantId, {
      featured_type: featured_type as string,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      featuredProducts,
      pagination: {
        limit: limit ? parseInt(limit as string) : null,
        offset: offset ? parseInt(offset as string) : null,
        total: featuredProducts.length,
      },
    });
  } catch (error: any) {
    console.error('[GET featured-products] Error:', error);
    res.status(500).json({ error: 'failed_to_get_featured_products', message: error.message });
  }
});

// GET /api/tenants/:tenantId/featured-products/stats - Get featured products statistics
router.get('/tenants/:tenantId/featured-products/stats', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const stats = await FeaturedProductsService.getFeaturedProductsStats(tenantId);

    res.json(stats);
  } catch (error: any) {
    console.error('[GET featured-products/stats] Error:', error);
    res.status(500).json({ error: 'failed_to_get_featured_products_stats', message: error.message });
  }
});

// GET /api/tenants/:tenantId/featured-products/storefront - Get featured products for storefront display
// Public endpoint - no authentication required for storefront display
router.get('/tenants/:tenantId/featured-products/storefront', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = '10' } = req.query;

    const groupedFeaturedProducts = await FeaturedProductsService.getStorefrontFeaturedProducts(
      tenantId,
      parseInt(limit as string)
    );

    res.json(groupedFeaturedProducts);
  } catch (error: any) {
    console.error('[GET featured-products/storefront] Error:', error);
    res.status(500).json({ error: 'failed_to_get_storefront_featured_products', message: error.message });
  }
});

// GET /api/items/:itemId/featured-types - Get featured types for a specific item
router.get('/items/:itemId/featured-types', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;

    // First verify the item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'item_not_found' });
    }

    // Check tenant access
    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const hasAccess = isAdmin || (req.user?.tenantIds?.includes(item.tenant_id) ?? false);

    if (!hasAccess) {
      // Fallback: check user_tenants table
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user?.userId || '',
            tenant_id: item.tenant_id,
          },
        },
      });

      if (!userTenant) {
        return res.status(403).json({ error: 'tenant_access_denied' });
      }
    }

    const featuredTypes = await FeaturedProductsService.getFeaturedTypesForItem(itemId);

    res.json({
      itemId,
      tenantId: item.tenant_id,
      featuredTypes,
      featuredTypesArray: featuredTypes.map(ft => ft.featured_type),
    });
  } catch (error: any) {
    console.error('[GET items/:itemId/featured-types] Error:', error);
    res.status(500).json({ error: 'failed_to_get_featured_types', message: error.message });
  }
});

// POST /api/items/:itemId/featured-types - Add a featured type to an item
router.post('/items/:itemId/featured-types', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const parsed = addFeaturedTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_request_body', 
        details: parsed.error.flatten() 
      });
    }

    // Verify the item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'item_not_found' });
    }

    // Check tenant access
    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const hasAccess = isAdmin || (req.user?.tenantIds?.includes(item.tenant_id) ?? false);

    if (!hasAccess) {
      // Fallback: check user_tenants table
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user?.userId || '',
            tenant_id: item.tenant_id,
          },
        },
      });

      if (!userTenant) {
        return res.status(403).json({ error: 'tenant_access_denied' });
      }
    }

    const featuredProduct = await FeaturedProductsService.addFeaturedType(
      itemId,
      item.tenant_id,
      parsed.data.featured_type,
      {
        featured_priority: parsed.data.featured_priority,
        featured_expires_at: parsed.data.featured_expires_at ? new Date(parsed.data.featured_expires_at) : null,
        auto_unfeature: parsed.data.auto_unfeature,
      }
    );

    res.status(201).json({
      message: 'featured_type_added',
      featuredProduct,
    });
  } catch (error: any) {
    console.error('[POST items/:itemId/featured-types] Error:', error);
    res.status(500).json({ error: 'failed_to_add_featured_type', message: error.message });
  }
});

// PUT /api/items/:itemId/featured-types/:featuredType - Update featured type expiration
router.put('/items/:itemId/featured-types/:featuredType', authenticateToken, async (req, res) => {
  try {
    const { itemId, featuredType } = req.params;
    const parsed = updateFeaturedTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_request_body', 
        details: parsed.error.flatten() 
      });
    }

    // Validate featured_type
    if (!['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick'].includes(featuredType)) {
      return res.status(400).json({ error: 'invalid_featured_type' });
    }

    // Verify the item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'item_not_found' });
    }

    // Check tenant access
    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const hasAccess = isAdmin || (req.user?.tenantIds?.includes(item.tenant_id) ?? false);

    if (!hasAccess) {
      // Fallback: check user_tenants table
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user?.userId || '',
            tenant_id: item.tenant_id,
          },
        },
      });

      if (!userTenant) {
        return res.status(403).json({ error: 'tenant_access_denied' });
      }
    }

    const updatedFeaturedProduct = await FeaturedProductsService.updateFeaturedTypeExpiration(
      itemId,
      featuredType as any,
      parsed.data.featured_expires_at ? new Date(parsed.data.featured_expires_at) : null,
      parsed.data.auto_unfeature
    );

    if (!updatedFeaturedProduct) {
      return res.status(404).json({ error: 'featured_type_not_found' });
    }

    res.json({
      message: 'featured_type_updated',
      featuredProduct: updatedFeaturedProduct,
    });
  } catch (error: any) {
    console.error('[PUT items/:itemId/featured-types/:featuredType] Error:', error);
    res.status(500).json({ error: 'failed_to_update_featured_type', message: error.message });
  }
});

// POST /api/featured-products/migrate - Migrate legacy featured products to multi-type system
router.post('/migrate', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Check user access
    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const hasAccess = isAdmin || (req.user?.tenantIds?.includes(tenantId) ?? false);

    if (!hasAccess) {
      return res.status(403).json({ error: 'tenant_access_denied' });
    }

    const result = await FeaturedProductsService.migrateLegacyFeaturedProducts(tenantId);

    res.json({
      message: 'migration_completed',
      ...result
    });
  } catch (error: any) {
    console.error('[POST /featured-products/migrate] Error:', error);
    res.status(500).json({ error: 'failed_to_migrate_featured_products', message: error.message });
  }
});

// GET /api/featured-products/management - Get all featured products for management (no limits)
router.get('/management', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Check user access
    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const hasAccess = isAdmin || (req.user?.tenantIds?.includes(tenantId as string) ?? false);

    if (!hasAccess) {
      return res.status(403).json({ error: 'tenant_access_denied' });
    }

    const result = await FeaturedProductsService.getAllFeaturedProductsForManagement(tenantId as string);

    res.json(result);
  } catch (error: any) {
    console.error('[GET /featured-products/management] Error:', error);
    res.status(500).json({ error: 'failed_to_get_management_featured_products', message: error.message });
  }
});

// GET /api/featured-products/debug - Debug endpoint to check featured products
router.get('/debug', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Get all featured products for this tenant
    const featuredProducts = await prisma.featured_products.findMany({
      where: {
        tenant_id: tenantId
      },
      include: {
        inventory_items: {
          select: {
            id: true,
            name: true,
            sku: true,
            tenant_id: true
          }
        }
      },
      orderBy: [
        { featured_priority: 'desc' },
        { featured_at: 'desc' }
      ]
    });

    res.json({
      tenantId,
      totalFeatured: featuredProducts.length,
      featuredProducts: featuredProducts.map(fp => ({
        id: fp.id,
        inventory_item_id: fp.inventory_item_id,
        featured_type: fp.featured_type,
        featured_priority: fp.featured_priority,
        featured_at: fp.featured_at,
        featured_expires_at: fp.featured_expires_at,
        is_active: fp.is_active,
        inventory_item: fp.inventory_items
      }))
    });
  } catch (error: any) {
    console.error('[GET /featured-products/debug] Error:', error);
    res.status(500).json({ error: 'failed_to_debug_featured_products', message: error.message });
  }
});

// PATCH /api/items/:itemId/featured-types/:featuredType - Update featured type expiration (alias for PUT)
router.patch('/items/:itemId/featured-types/:featuredType', authenticateToken, async (req, res) => {
  try {
    const { itemId, featuredType } = req.params;
    const parsed = updateFeaturedTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_request_body', 
        details: parsed.error.flatten() 
      });
    }

    // Validate featured_type
    if (!['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick'].includes(featuredType)) {
      return res.status(400).json({ error: 'invalid_featured_type' });
    }

    // Verify the item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'item_not_found' });
    }

    // Check tenant access
    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const hasAccess = isAdmin || (req.user?.tenantIds?.includes(item.tenant_id) ?? false);

    if (!hasAccess) {
      // Fallback: check user_tenants table
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user?.userId || '',
            tenant_id: item.tenant_id,
          },
        },
      });

      if (!userTenant) {
        return res.status(403).json({ error: 'tenant_access_denied' });
      }
    }

    const updatedFeaturedProduct = await FeaturedProductsService.updateFeaturedType(
      itemId,
      featuredType as any,
      {
        featured_expires_at: parsed.data.featured_expires_at ? new Date(parsed.data.featured_expires_at) : null,
        auto_unfeature: parsed.data.auto_unfeature,
        is_active: parsed.data.is_active
      }
    );

    if (!updatedFeaturedProduct) {
      return res.status(404).json({ error: 'featured_type_not_found' });
    }

    res.json({
      message: 'featured_type_updated',
      featuredProduct: updatedFeaturedProduct,
    });
  } catch (error: any) {
    console.error('[PATCH items/:itemId/featured-types/:featuredType] Error:', error);
    res.status(500).json({ error: 'failed_to_update_featured_type', message: error.message });
  }
});

// DELETE /api/items/:itemId/featured-types/:featuredType - Remove a featured type from an item
router.delete('/items/:itemId/featured-types/:featuredType', authenticateToken, async (req, res) => {
  try {
    const { itemId, featuredType } = req.params;

    // Validate featured_type
    if (!['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick'].includes(featuredType)) {
      return res.status(400).json({ error: 'invalid_featured_type' });
    }

    // Verify the item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'item_not_found' });
    }

    // Check tenant access
    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const hasAccess = isAdmin || (req.user?.tenantIds?.includes(item.tenant_id) ?? false);

    if (!hasAccess) {
      // Fallback: check user_tenants table
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user?.userId || '',
            tenant_id: item.tenant_id,
          },
        },
      });

      if (!userTenant) {
        return res.status(403).json({ error: 'tenant_access_denied' });
      }
    }

    const success = await FeaturedProductsService.removeFeaturedType(itemId, featuredType as any);

    if (!success) {
      return res.status(404).json({ error: 'featured_type_not_found' });
    }

    res.json({
      message: 'featured_type_removed',
    });
  } catch (error: any) {
    console.error('[DELETE items/:itemId/featured-types/:featuredType] Error:', error);
    res.status(500).json({ error: 'failed_to_remove_featured_type', message: error.message });
  }
});

// POST /api/tenants/:tenantId/featured-products/bulk - Bulk add featured types
router.post('/tenants/:tenantId/featured-products/bulk', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'invalid_items_array' });
    }

    // Validate each item
    const validatedItems = items.map(item => {
      const parsed = addFeaturedTypeSchema.safeParse(item);
      if (!parsed.success) {
        throw new Error(`Invalid item data: ${parsed.error.message}`);
      }
      return {
        inventory_item_id: item.inventory_item_id,
        tenant_id: tenantId,
        featured_type: parsed.data.featured_type,
        featured_priority: parsed.data.featured_priority,
        featured_expires_at: parsed.data.featured_expires_at ? new Date(parsed.data.featured_expires_at) : null,
        auto_unfeature: parsed.data.auto_unfeature,
      };
    });

    const featuredProducts = await FeaturedProductsService.bulkAddFeaturedTypes(validatedItems);

    res.status(201).json({
      message: 'bulk_featured_types_added',
      featuredProducts,
      count: featuredProducts.length,
    });
  } catch (error: any) {
    console.error('[POST featured-products/bulk] Error:', error);
    res.status(500).json({ error: 'failed_to_bulk_add_featured_types', message: error.message });
  }
});

export default router;
