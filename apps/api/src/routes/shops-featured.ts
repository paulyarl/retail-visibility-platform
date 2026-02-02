import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

/**
 * GET /api/shops/featured
 * Get featured shops with pagination and filtering
 */
router.get('/featured', async (req, res) => {
  try {
    const { limit = 10, offset = 0, category, region } = req.query;
    
    // For now, return mock featured shops data
    // In production, this would query from a featured_shops table
    const mockFeaturedShops = [
      {
        tenantId: 'tid-m8ijkrnk',
        name: 'Baraka International Market',
        slug: 'baraka-market',
        autoId: 'ULCW',
        location: 'Pittsburgh, PA',
        productCount: 156,
        rating: 4.8,
        trendingScore: 95,
        weeklyGrowth: 12.5,
        featuredUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        priority: 1,
        category: 'grocery',
        urls: {
          slugUrl: '/shops/baraka-market',
          tenantIdUrl: '/shops/tid-m8ijkrnk',
          autoIdUrl: '/shops/ULCW',
          canonicalUrl: '/shops/baraka-market'
        }
      },
      {
        tenantId: 'tid-042hi7ju',
        name: 'Fresh Market Downtown',
        slug: 'fresh-market-downtown',
        autoId: 'FRSH',
        location: 'Pittsburgh, PA',
        productCount: 89,
        rating: 4.6,
        trendingScore: 88,
        weeklyGrowth: 8.2,
        featuredUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        priority: 2,
        category: 'grocery',
        urls: {
          slugUrl: '/shops/fresh-market-downtown',
          tenantIdUrl: '/shops/tid-042hi7ju',
          autoIdUrl: '/shops/FRSH',
          canonicalUrl: '/shops/fresh-market-downtown'
        }
      }
    ];
    
    // Apply filters if provided
    let filteredShops = mockFeaturedShops;
    
    if (category) {
      filteredShops = filteredShops.filter(shop => 
        shop.category === category || shop.name.toLowerCase().includes(category.toString().toLowerCase())
      );
    }
    
    if (region) {
      filteredShops = filteredShops.filter(shop => 
        shop.location.toLowerCase().includes(region.toString().toLowerCase())
      );
    }
    
    // Apply pagination
    const startIndex = parseInt(offset.toString());
    const endIndex = startIndex + parseInt(limit.toString());
    const paginatedShops = filteredShops.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedShops,
      pagination: {
        limit: parseInt(limit.toString()),
        offset: startIndex,
        total: filteredShops.length,
        hasMore: endIndex < filteredShops.length
      },
      filters: {
        category,
        region
      }
    });
  } catch (error) {
    console.error('[Featured Shops API Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch featured shops'
    });
  }
});

/**
 * POST /api/shops/featured
 * Add a shop to featured list (admin only)
 */
router.post('/featured', async (req, res) => {
  try {
    const { tenantId, featuredUntil, priority } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Tenant ID is required'
      });
    }
    
    // For now, just return success
    // In production, this would add to a featured_shops table
    const result = {
      tenantId,
      featuredUntil: featuredUntil ? new Date(featuredUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      priority: priority || 1,
      addedAt: new Date()
    };
    
    res.json({
      success: true,
      data: result,
      message: 'Shop added to featured list successfully'
    });
  } catch (error) {
    console.error('[Add Featured Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to add shop to featured list'
    });
  }
});

export default router;
