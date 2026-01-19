import express from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';

interface FeaturedProduct {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  stock: number;
  image_url?: string;
  directory_category_id?: string;
  featured_type: string;
  featured_priority: number;
  featured_at: string;
}

const router = express.Router();

// Get all featured products by type for a tenant
router.get('/tenants/:tenantId/featured', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type } = req.query; // 'store_selection', 'new_arrival', 'seasonal', 'sale'

    const whereClause: any = {
      tenant_id: tenantId,
      is_featured: true,
    };

    if (type && type !== 'all') {
      whereClause.featured_type = type;
    }

    const featuredProducts = await prisma.inventory_items.findMany({
      where: whereClause,
      orderBy: [
        { featured_priority: 'desc' },
        { featured_at: 'desc' }
      ]
    });

    // Group by type for dashboard view
    const groupedByType = featuredProducts.reduce((acc: Record<string, any[]>, product: any) => {
      const type = product.featured_type || 'store_selection';
      if (!acc[type]) acc[type] = [];
      acc[type].push(product);
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      success: true,
      data: {
        all: featuredProducts,
        grouped: groupedByType,
        counts: Object.keys(groupedByType).reduce((acc, type) => {
          acc[type] = groupedByType[type].length;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured products'
    });
  }
});

// Update featured products by type
router.put('/tenants/:tenantId/featured/:type', authenticateToken, async (req, res) => {
  try {
    const { tenantId, type } = req.params;
    const { productIds, priorities } = req.body;

    // Validate featured type
    const validTypes = ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid featured type'
      });
    }

    // Clear existing featured products of this type
    await prisma.inventory_items.updateMany({
      where: {
        tenant_id: tenantId,
        featured_type: type
      },
      data: {
        is_featured: false,
        featured_type: null,
        featured_priority: 0,
        featured_at: null
      }
    });

    // Set new featured products
    if (productIds && productIds.length > 0) {
      const updatePromises = productIds.map((productId: string, index: number) => 
        prisma.inventory_items.update({
          where: { id: productId },
          data: {
            is_featured: true,
            featured_type: type,
            featured_priority: priorities?.[index] || 0,
            featured_at: new Date()
          }
        })
      );

      await Promise.all(updatePromises);
    }

    res.json({
      success: true,
      message: `Updated ${type} featured products`
    });
  } catch (error) {
    console.error('Error updating featured products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update featured products'
    });
  }
});

// Get available products for featuring (not already featured of this type)
router.get('/tenants/:tenantId/available-featured', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type, search, category } = req.query;

    const whereClause: any = {
      tenant_id: tenantId,
      item_status: 'active'
    };

    // Exclude products already featured of this type
    if (type && type !== 'all') {
      whereClause.OR = [
        { featured_type: { not: type } },
        { featured_type: null }
      ];
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category) {
      whereClause.directory_category_id = category;
    }

    const availableProducts = await prisma.inventory_items.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: availableProducts
    });
  } catch (error) {
    console.error('Error fetching available products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available products'
    });
  }
});

export default router;
