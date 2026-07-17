import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireInventoryAccess } from '../middleware/permissions';
import FeaturedProductsSingletonService from '../services/FeaturedProductsSingletonService';
import { prisma } from '../prisma';
import { logger } from '../logger';

const router = Router();
const featuredProductsService = FeaturedProductsSingletonService.getInstance();

// Tier-based featuring limits
const FEATURING_LIMITS: Record<string, number> = {
  'trial': 0,
  'google-only': 3,
  'starter': 5,
  'professional': 15,
  'enterprise': 50,
  'organization': 100,
};

// Get featured products for a tenant (using singleton service with caching)
router.get('/tenants/:tenantId/products/featured', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = 50, activeOnly = 'true' } = req.query;

    // Use singleton service with caching for featured products
    const featuredProducts = await featuredProductsService.getFeaturedProductsByTenant(tenantId, {
      featuredType: 'featured', // Only featured managed by this page
      isActive: activeOnly === 'true',
      limit: parseInt(limit as string),
      sortBy: 'priority',
      sortOrder: 'desc'
    });

    // Get inventory items for stock filtering
    const inventoryItemIds = featuredProducts
      .map(fp => fp.inventoryItemId)
      .filter((id): id is string => id !== undefined);
    
    const inventoryItems = inventoryItemIds.length > 0 ? await prisma.inventory_items.findMany({
      where: { id: { in: inventoryItemIds } },
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
        item_status: true,
        visibility: true
      }
    }) : [];

    // Create inventory items map for stock lookup
    const inventoryMap = new Map(inventoryItems.map(item => [item.id, item]));

    // Filter by stock and combine data
    const inStockFeaturedProducts = featuredProducts
      .filter(fp => {
        if (!fp.inventoryItemId) return false;
        const inventoryItem = inventoryMap.get(fp.inventoryItemId);
        return inventoryItem && inventoryItem.stock > 0 && 
               inventoryItem.item_status === 'active' && 
               inventoryItem.visibility === 'public';
      })
      .map(fp => {
        if (!fp.inventoryItemId) throw new Error('Inventory item ID is required');
        const inventoryItem = inventoryMap.get(fp.inventoryItemId);
        if (!inventoryItem) throw new Error('Inventory item not found');
        
        return {
          ...fp,
          // Add inventory item fields to match expected format
          id: inventoryItem.id,
          inventory_item_id: fp.inventoryItemId, // CRITICAL: Junction table key for featured product operations
          sku: inventoryItem.sku,
          name: inventoryItem.name,
          title: inventoryItem.title,
          brand: inventoryItem.brand,
          description: inventoryItem.description,
          price_cents: inventoryItem.price_cents,
          sale_price_cents: inventoryItem.sale_price_cents,
          stock: inventoryItem.stock,
          image_url: inventoryItem.image_url,
          has_variants: inventoryItem.has_variants,
          availability: inventoryItem.availability,
          item_status: inventoryItem.item_status,
          visibility: inventoryItem.visibility,
          // Keep featured fields
          featured_type: fp.featuredType,
          featured_priority: fp.priority,
          featured_at: fp.featuredAt,
          featured_until: fp.expiresAt,
          is_active: fp.isActive,
          auto_unfeature: fp.autoUnfeature
        };
      });

    res.json({
      products: inStockFeaturedProducts,
      count: inStockFeaturedProducts.length
    });
  } catch (error) {
    logger.error('Error fetching featured products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    // Count current featured products from junction table (only featured)
    const current = await prisma.featured_products.count({
      where: {
        tenant_id: tenantId,
        featured_type: 'featured', // Only count products featured by this manager
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
    logger.error('Error fetching featuring status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
        featured_type: 'featured  ', // Only count products featured by this manager
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
        featured_type: 'featured', // Default to featured for legacy system
        featured_priority: parseInt(priority) || 50,
        featured_at: new Date(),
        featured_expires_at: featuredUntil,
        is_active: true,
        auto_unfeature: true,
        admin_approved: true, // Auto-approve featured products by default
        approved_at: new Date()
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
    logger.error('Error featuring product:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error unfeaturing product:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error bulk featuring products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to bulk feature products' });
  }
});

// Update featured product active status (using junction table)
router.patch('/tenants/:tenantId/products/:productId/feature/active', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId, productId } = req.params;
    const { is_active } = req.body;

    // When resuming, extend expiration if it has already passed so the product
    // actually appears in the active featured list.
    let updateData: any = { is_active };
    if (is_active === true) {
      const existingRecord = await prisma.featured_products.findFirst({
        where: {
          inventory_item_id: productId,
          tenant_id: tenantId
        }
      });
      if (existingRecord) {
        const now = new Date();
        const expiresAt = existingRecord.featured_expires_at;
        if (!expiresAt || new Date(expiresAt) <= now) {
          const newExpiry = new Date();
          newExpiry.setDate(newExpiry.getDate() + 30);
          updateData.featured_expires_at = newExpiry;
        }
      }
    }

    const product = await prisma.featured_products.updateMany({
      where: {
        inventory_item_id: productId,
        tenant_id: tenantId
      },
      data: updateData
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
    logger.error('Error updating featured active status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error updating featured expiration:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error updating featured priority:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    const { 
      limit = 100, 
      offset = 0, 
      tenant_id,
      subscription_tier,
      expiration_status,
      featured_type,
      is_active
    } = req.query;

    // Build where clause
    let whereClause: any = {};

    // Add tenant filter
    if (tenant_id) {
      whereClause.tenant_id = tenant_id;
    }

    // Add featured type filter
    if (featured_type) {
      whereClause.featured_type = featured_type;
    }

    // Add active status filter
    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    // Add expiration status filter
    if (expiration_status) {
      switch (expiration_status) {
        case 'expired':
          whereClause.featured_expires_at = {
            lte: new Date()
          };
          break;
        case 'expiring_soon':
          whereClause.featured_expires_at = {
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            gt: new Date()
          };
          break;
        case 'active':
          whereClause.featured_expires_at = {
            gt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // more than 3 days from now
          };
          break;
        case 'no_expiration':
          whereClause.featured_expires_at = null;
          break;
      }
    }

    const featuredProducts = await prisma.featured_products.findMany({
      where: whereClause,
      orderBy: [
        { featured_priority: 'desc' },
        { featured_at: 'desc' }
      ],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true,
        inventory_item_id: true,
        tenant_id: true,
        featured_type: true,
        featured_priority: true,
        featured_at: true,
        featured_expires_at: true,
        auto_unfeature: true,
        is_active: true,
        inventory_items: {
          select: {
            id: true,
            sku: true,
            name: true,
            title: true,
            brand: true,
            price_cents: true,
            image_url: true,
            stock: true
          }
        },
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true
          }
        }
      }
    });

    // Apply subscription tier filter if specified (post-filter)
    let filteredProducts = featuredProducts;
    if (subscription_tier) {
      filteredProducts = featuredProducts.filter(fp => 
        fp.tenants.subscription_tier === subscription_tier
      );
    }

    // Transform the data to match expected format
    const transformedProducts = filteredProducts.map(fp => ({
      featured_product_id: fp.id,  // Unique featured products record ID
      id: fp.inventory_items.id,    // Product ID (may have duplicates)
      tenant_id: fp.tenant_id,
      sku: fp.inventory_items.sku,
      name: fp.inventory_items.name,
      title: fp.inventory_items.title,
      brand: fp.inventory_items.brand,
      price_cents: fp.inventory_items.price_cents,
      image_url: fp.inventory_items.image_url,
      stock: fp.inventory_items.stock,
      featured_type: fp.featured_type,
      featured_priority: fp.featured_priority,
      featured_at: fp.featured_at,
      featured_until: fp.featured_expires_at,
      auto_unfeature: fp.auto_unfeature,
      is_active: fp.is_active,
      tenants: fp.tenants
    }));

    const total = await prisma.featured_products.count({
      where: whereClause
    });

    res.json({
      products: transformedProducts,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    logger.error('Error fetching admin featured products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    const [totalFeatured, featuredItems, expiringSoon, typeStats] = await Promise.all([
      // Total featured products
      prisma.featured_products.count({
        where: {
          is_active: true
        }
      }),
      
      // Featured products by tier and type
      prisma.featured_products.findMany({
        where: {
          is_active: true
        },
        include: {
          tenants: {
            select: {
              subscription_tier: true
            }
          }
        }
      }),
      
      // Expiring soon (next 7 days)
      prisma.featured_products.count({
        where: {
          is_active: true,
          featured_expires_at: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Featured products by type
      prisma.featured_products.groupBy({
        by: ['featured_type'],
        where: {
          is_active: true
        },
        _count: {
          featured_type: true
        }
      })
    ]);

    // Process featured items by tier
    const tierCounts = featuredItems.reduce((acc, item) => {
      const tier = item.tenants?.subscription_tier || 'unknown';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byTier = Object.entries(tierCounts)
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);

    // Process type statistics
    const byType = typeStats
      .map(stat => ({ 
        type: stat.featured_type, 
        count: stat._count.featured_type 
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      totalFeatured,
      byTier,
      byType,
      expiringSoon
    });
  } catch (error) {
    logger.error('Error fetching featuring stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch featuring stats' });
  }
});

// Get inactive/paused featured products (using singleton service with caching)
router.get('/tenants/:tenantId/products/featured/inactive', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = 50 } = req.query;

    // Query for paused products only
    const pausedProducts = await prisma.featured_products.findMany({
      where: {
        tenant_id: tenantId,
        is_active: false, // Only paused products
      },
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
        { featured_at: 'desc' }
      ],
      take: parseInt(limit as string)
    });

    // Transform the data - only include actually paused products
    const transformedProducts = pausedProducts.map(fp => ({
      ...fp.inventory_items,
      inventory_item_id: fp.inventory_item_id, // CRITICAL: Junction table key for featured product operations
      featured_type: fp.featured_type,
      featured_priority: fp.featured_priority,
      featured_at: fp.featured_at,
      featured_until: fp.featured_expires_at,
      is_active: fp.is_active, // This should be false for paused products
      auto_unfeature: fp.auto_unfeature,
      inactivityReason: 'paused' as const,
      reasonText: 'Paused by merchant'
    }));

    res.json({
      products: transformedProducts,
      count: transformedProducts.length
    });
  } catch (error) {
    logger.error('Error fetching inactive featured products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch inactive featured products' });
  }
});

// Get previously featured out-of-stock products
router.get('/tenants/:tenantId/products/featured/out-of-stock', authenticateToken, requireInventoryAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = 50 } = req.query;

    // Get featured products that are now out of stock
    const outOfStockFeatured = await prisma.featured_products.findMany({
      where: {
        tenant_id: tenantId,
        featured_type: 'featured',
        is_active: true,
        OR: [
          { featured_expires_at: null },
          { featured_expires_at: { gte: new Date() } }
        ]
      },
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
      distinct: ['inventory_item_id']
    });

    // Filter to only out-of-stock products
    const transformedProducts = outOfStockFeatured
      .filter(fp => fp.inventory_items.stock <= 0)
      .map(fp => ({
        ...fp.inventory_items,
        featured_type: fp.featured_type,
        featured_priority: fp.featured_priority,
        featured_at: fp.featured_at,
        featured_until: fp.featured_expires_at,
        is_active: fp.is_active,
        auto_unfeature: fp.auto_unfeature,
        inactivityReason: 'out_of_stock' as const,
        reasonText: 'Previously featured, now out of stock'
      }));

    res.json({
      products: transformedProducts,
      count: transformedProducts.length
    });
  } catch (error) {
    logger.error('Error fetching out-of-stock featured products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch out-of-stock featured products' });
  }
});

// DELETE /api/admin/products/featured/:id - Unfeature a specific featured product
router.delete('/admin/products/featured/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    // Check if the featured product exists
    const featuredProduct = await prisma.featured_products.findUnique({
      where: { id }
    });

    if (!featuredProduct) {
      return res.status(404).json({ error: 'Featured product not found' });
    }

    // Delete the featured product record
    await prisma.featured_products.delete({
      where: { id }
    });

    res.json({ 
      message: 'Product unfeatured successfully',
      deletedProductId: id
    });
  } catch (error) {
    logger.error('Error unfeaturing product:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to unfeature product' });
  }
});

export default router;
