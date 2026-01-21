import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireInventoryAccess } from '../middleware/permissions';

const router = Router();
const prisma = new PrismaClient();

// Tier-based featuring limits
const FEATURING_LIMITS: Record<string, number> = {
  'trial': 0,
  'google-only': 3,
  'starter': 5,
  'professional': 15,
  'enterprise': 50,
  'organization': 100,
};

// Get featured products for a tenant (using junction table)
router.get('/tenants/:tenantId/products/featured', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = 50, activeOnly = 'true' } = req.query;

    const where: any = {
      tenant_id: tenantId,
    };

    // Filter by active status
    if (activeOnly === 'true') {
      where.is_active = true;
    }

    // Filter by expiration
    where.OR = [
      { featured_expires_at: null },
      { featured_expires_at: { gte: new Date() } }
    ];

    const featuredProducts = await prisma.featured_products.findMany({
      where,
      include: {
        inventory_items: {
          select: {
            id: true,
            sku: true,
            name: true,
            title: true,
            brand: true,
            description: true,
            price_cents: true,
            sale_price_cents: true,
            stock: true,
            image_url: true,
            has_variants: true,
            availability: true,
          }
        }
      },
      orderBy: [
        { featured_priority: 'desc' },
        { featured_at: 'desc' }
      ],
      take: parseInt(limit as string),
    });

    // Transform the data to match the expected format
    const transformedProducts = featuredProducts.map(fp => ({
      ...fp.inventory_items,
      featured_type: fp.featured_type,
      featured_priority: fp.featured_priority,
      featured_at: fp.featured_at,
      featured_until: fp.featured_expires_at,
      is_active: fp.is_active,
      auto_unfeature: fp.auto_unfeature,
    }));

    res.json({
      products: transformedProducts,
      count: transformedProducts.length
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

// Get featuring status and limits (using junction table)
router.get('/tenants/:tenantId/products/featuring/status', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Get tenant tier
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_tier: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tier = tenant.subscription_tier || 'trial';
    const limit = FEATURING_LIMITS[tier] || 0;

    // Count current featured products from junction table
    const current = await prisma.featured_products.count({
      where: {
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { featured_expires_at: null },
          { featured_expires_at: { gte: new Date() } }
        ]
      }
    });

    res.json({
      tier,
      limit,
      current,
      available: Math.max(0, limit - current),
      canFeature: current < limit
    });
  } catch (error) {
    console.error('Error fetching featuring status:', error);
    res.status(500).json({ error: 'Failed to fetch featuring status' });
  }
});

// Feature a product (using junction table)
router.post('/tenants/:tenantId/products/:productId/feature', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId, productId } = req.params;
    const { duration, priority = 50 } = req.body;

    // Check featuring limit
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_tier: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tier = tenant.subscription_tier || 'trial';
    const limit = FEATURING_LIMITS[tier] || 0;

    const currentCount = await prisma.featured_products.count({
      where: {
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { featured_expires_at: null },
          { featured_expires_at: { gte: new Date() } }
        ]
      }
    });

    if (currentCount >= limit) {
      return res.status(403).json({
        error: 'featuring_limit_reached',
        message: `You've reached your featuring limit (${limit} products for ${tier} tier)`,
        current: currentCount,
        limit
      });
    }

    // Calculate expiration
    let featuredUntil = null;
    if (duration) {
      featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + parseInt(duration));
    }

    // Create featured product record in junction table
    const featuredProduct = await prisma.featured_products.create({
      data: {
        inventory_item_id: productId,
        tenant_id: tenantId,
        featured_type: 'store_selection', // Default to store_selection for legacy system
        featured_priority: parseInt(priority) || 50,
        featured_at: new Date(),
        featured_expires_at: featuredUntil,
        is_active: true,
        auto_unfeature: true
      },
      include: {
        inventory_items: {
          select: {
            id: true,
            sku: true,
            name: true,
            title: true,
            brand: true,
            price_cents: true,
            image_url: true,
          }
        }
      }
    });

    res.json({
      success: true,
      product: {
        ...featuredProduct.inventory_items,
        featured_type: featuredProduct.featured_type,
        featured_priority: featuredProduct.featured_priority,
        featured_at: featuredProduct.featured_at,
        featured_until: featuredProduct.featured_expires_at,
        is_active: featuredProduct.is_active,
      }
    });
  } catch (error) {
    console.error('Error featuring product:', error);
    res.status(500).json({ error: 'Failed to feature product' });
  }
});

// Unfeature a product (using junction table)
router.delete('/tenants/:tenantId/products/:productId/feature', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId, productId } = req.params;

    // Delete from junction table
    const deletedRecord = await prisma.featured_products.deleteMany({
      where: {
        inventory_item_id: productId,
        tenant_id: tenantId
      }
    });

    if (deletedRecord.count === 0) {
      return res.status(404).json({ error: 'Featured product not found' });
    }

    res.json({
      success: true,
      message: 'Product unfeatured successfully'
    });
  } catch (error) {
    console.error('Error unfeaturing product:', error);
    res.status(500).json({ error: 'Failed to unfeature product' });
  }
});

// Bulk feature products
router.post('/tenants/:tenantId/products/feature/bulk', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { productIds, duration, priority = 0 } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds must be a non-empty array' });
    }

    // Check featuring limit
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_tier: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tier = tenant.subscription_tier || 'trial';
    const limit = FEATURING_LIMITS[tier] || 0;

    const currentCount = await prisma.inventory_items.count({
      where: {
        tenant_id: tenantId,
        is_featured: true,
        OR: [
          { featured_until: null },
          { featured_until: { gte: new Date() } }
        ]
      }
    });

    const available = limit - currentCount;
    if (productIds.length > available) {
      return res.status(403).json({
        error: 'featuring_limit_exceeded',
        message: `Cannot feature ${productIds.length} products. Only ${available} slots available.`,
        current: currentCount,
        limit,
        requested: productIds.length
      });
    }

    // Calculate expiration
    let featuredUntil = null;
    if (duration) {
      featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + parseInt(duration));
    }

    // Bulk update
    const result = await prisma.inventory_items.updateMany({
      where: {
        id: { in: productIds },
        tenant_id: tenantId
      },
      data: {
        is_featured: true,
        featured_at: new Date(),
        featured_until: featuredUntil,
        featured_priority: parseInt(priority) || 0
      }
    });

    res.json({
      success: true,
      updated: result.count
    });
  } catch (error) {
    console.error('Error bulk featuring products:', error);
    res.status(500).json({ error: 'Failed to bulk feature products' });
  }
});

// Update featured product active status (using junction table)
router.patch('/tenants/:tenantId/products/:productId/feature/active', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId, productId } = req.params;
    const { is_active } = req.body;

    const product = await prisma.featured_products.updateMany({
      where: {
        inventory_item_id: productId,
        tenant_id: tenantId
      },
      data: {
        is_active: is_active
      }
    });

    if (product.count === 0) {
      return res.status(404).json({ error: 'Featured product not found' });
    }

    // Get the updated record to return
    const updatedRecord = await prisma.featured_products.findFirst({
      where: {
        inventory_item_id: productId,
        tenant_id: tenantId
      },
      include: {
        inventory_items: {
          select: {
            id: true,
            sku: true,
            name: true,
            featured_until: true,
            featured_priority: true
          }
        }
      }
    });

    res.json({
      success: true,
      product: {
        ...updatedRecord?.inventory_items,
        featured_type: updatedRecord?.featured_type,
        featured_priority: updatedRecord?.featured_priority,
        featured_at: updatedRecord?.featured_at,
        featured_until: updatedRecord?.featured_expires_at,
        is_active: updatedRecord?.is_active,
      }
    });
  } catch (error) {
    console.error('Error updating featured active status:', error);
    res.status(500).json({ error: 'Failed to update featured active status' });
  }
});

// Update featured product expiration (using junction table)
router.patch('/tenants/:tenantId/products/:productId/feature/expiration', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId, productId } = req.params;
    const { featured_until } = req.body;

    const product = await prisma.featured_products.updateMany({
      where: {
        inventory_item_id: productId,
        tenant_id: tenantId
      },
      data: {
        featured_expires_at: featured_until ? new Date(featured_until) : null
      }
    });

    if (product.count === 0) {
      return res.status(404).json({ error: 'Featured product not found' });
    }

    // Get the updated record to return
    const updatedRecord = await prisma.featured_products.findFirst({
      where: {
        inventory_item_id: productId,
        tenant_id: tenantId
      },
      include: {
        inventory_items: {
          select: {
            id: true,
            sku: true,
            name: true,
            featured_until: true,
            featured_priority: true
          }
        }
      }
    });

    res.json({
      success: true,
      product: {
        ...updatedRecord?.inventory_items,
        featured_type: updatedRecord?.featured_type,
        featured_priority: updatedRecord?.featured_priority,
        featured_at: updatedRecord?.featured_at,
        featured_until: updatedRecord?.featured_expires_at,
        is_active: updatedRecord?.is_active,
      }
    });
  } catch (error) {
    console.error('Error updating featured expiration:', error);
    res.status(500).json({ error: 'Failed to update featured expiration' });
  }
});

// Update featured product priority
router.patch('/tenants/:tenantId/products/:productId/feature/priority', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId, productId } = req.params;
    const { priority } = req.body;

    if (typeof priority !== 'number' || priority < 0 || priority > 100) {
      return res.status(400).json({ error: 'Priority must be a number between 0 and 100' });
    }

    const product = await prisma.inventory_items.update({
      where: {
        id: productId,
        tenant_id: tenantId,
        is_featured: true
      },
      data: {
        featured_priority: priority
      },
      select: {
        id: true,
        sku: true,
        name: true,
        featured_priority: true
      }
    });

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Error updating featured priority:', error);
    res.status(500).json({ error: 'Failed to update featured priority' });
  }
});

// Admin: Get all featured products across platform
router.get('/admin/products/featured', authenticateToken, async (req, res) => {
  try {
    // Check if user is platform admin
    const user = (req as any).user;
    if (user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    const { limit = 100, offset = 0 } = req.query;

    const featuredProducts = await prisma.inventory_items.findMany({
      where: {
        is_featured: true,
        OR: [
          { featured_until: null },
          { featured_until: { gte: new Date() } }
        ]
      },
      orderBy: [
        { featured_priority: 'desc' },
        { featured_at: 'desc' }
      ],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true,
        tenant_id: true,
        sku: true,
        name: true,
        title: true,
        brand: true,
        price_cents: true,
        image_url: true,
        is_featured: true,
        featured_at: true,
        featured_until: true,
        featured_priority: true,
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true
          }
        }
      }
    });

    const total = await prisma.inventory_items.count({
      where: {
        is_featured: true,
        OR: [
          { featured_until: null },
          { featured_until: { gte: new Date() } }
        ]
      }
    });

    res.json({
      products: featuredProducts,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching admin featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

// Admin: Get featuring statistics
router.get('/admin/products/featuring/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is platform admin
    const user = (req as any).user;
    if (user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    const [totalFeatured, byTierRaw, expiringSoon] = await Promise.all([
      // Total featured products
      prisma.inventory_items.count({
        where: {
          is_featured: true,
          OR: [
            { featured_until: null },
            { featured_until: { gte: new Date() } }
          ]
        }
      }),
      
      // Featured products by tier
      prisma.$queryRaw`
        SELECT 
          t.subscription_tier as tier,
          COUNT(i.id) as count
        FROM inventory_items i
        JOIN tenants t ON i.tenant_id = t.id
        WHERE i.is_featured = true
        AND (i.featured_until IS NULL OR i.featured_until >= NOW())
        GROUP BY t.subscription_tier
        ORDER BY count DESC
      `,
      
      // Expiring soon (next 7 days)
      prisma.inventory_items.count({
        where: {
          is_featured: true,
          featured_until: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Convert BigInt to number for JSON serialization
    const byTier = (byTierRaw as any[]).map(row => ({
      tier: row.tier,
      count: Number(row.count)
    }));

    res.json({
      totalFeatured,
      byTier,
      expiringSoon
    });
  } catch (error) {
    console.error('Error fetching featuring stats:', error);
    res.status(500).json({ error: 'Failed to fetch featuring stats' });
  }
});

export default router;
