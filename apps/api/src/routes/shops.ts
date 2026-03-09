/**
 * Shops API Routes
 * 
 * API endpoints for shops discovery and featured products
 * Uses ShopsFeaturedService for all operations
 */

import { Router } from 'express';
import ShopsFeaturedService from '../services/ShopsFeaturedService';
import ShopService from '../services/ShopService';

const router = Router();
const shopsService = ShopsFeaturedService.getInstance();

// ====================
// SHOP DIRECTORY ENDPOINTS
// ====================

/**
 * GET /api/shops/directory
 * Get all published shops for directory browsing
 * Uses ShopService singleton with MV-optimized caching
 */
router.get('/directory', async (req, res) => {
  try {
    const { limit = 20, offset = 0, search, category, region } = req.query;
    
    // Use ShopService singleton
    const ShopService = (await import('../services/ShopService')).default;
    const shopService = ShopService.getInstance();
    
    const shops = await shopService.getShopsDirectory({
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      search: search as string,
      category: category as string,
      location: region as string
    });

    // Normalize field names to match individual shop endpoint
    const normalizedShops = shops.map(shop => ({
      ...shop,
      category: shop.primary_category, // Add 'category' field for consistency
      // Keep primary_category for backward compatibility
    }));

    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 min cache
    res.setHeader('X-Cache-Source', 'ShopService-Singleton');

    res.json({
      success: true,
      data: normalizedShops,
      count: normalizedShops.length,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      filters: {
        search,
        category,
        region
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching shop directory:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop directory',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/trending
 * Get trending shops based on activity and ratings
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    
    // Use ShopService singleton for real trending shops data
    const ShopService = (await import('../services/ShopService')).default;
    const shopService = ShopService.getInstance();
    
    const trendingShops = await shopService.getTrendingShops({
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: trendingShops,
      count: trendingShops.length,
      type: 'trending'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching trending shops:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending shops',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/categories
 * Get shop categories for filtering
 */
router.get('/categories', async (req, res) => {
  try {
    // Import ShopService to get real categories from database
    const { default: ShopService } = await import('../services/ShopService');
    const shopService = ShopService.getInstance();

    // Get distinct primary categories from shops directory
    const categories = await shopService.getShopCategories();

    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching shop categories:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop categories',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/:identifier
 * Get shop details by any identifier (slug, tenantId, or autoId)
 */
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('[SHOPS API] Getting shop by identifier:', identifier);
    
    // Use the unified shop service with fallbacks from 3 tables
    const shopService = ShopService.getInstance();
    const unifiedShop = await shopService.getUnifiedShopByIdentifier(identifier);
    
    if (!unifiedShop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found',
        message: `No published shop found for identifier: ${identifier}`
      });
    }
    
    console.log('[SHOPS API] Found unified shop data:', unifiedShop.tenantId);

    // Build shop response using unified data
    const shopDetails = {
      tenantId: unifiedShop.tenantId,
      name: unifiedShop.name,
      slug: unifiedShop.slug,
      autoId: unifiedShop.subdomain?.toUpperCase() || 'AUTOID',
      description: unifiedShop.description,
      location: `${unifiedShop.city}, ${unifiedShop.state}`,
      address: unifiedShop.address,
      city: unifiedShop.city,
      state: unifiedShop.state,
      zip_code: unifiedShop.zipCode,
      latitude: unifiedShop.latitude ? parseFloat(unifiedShop.latitude as string) : null,
      longitude: unifiedShop.longitude ? parseFloat(unifiedShop.longitude as string) : null,
      category: unifiedShop.primaryCategory,
      productCount: unifiedShop.productCount,
      rating: unifiedShop.ratingAvg,
      reviewCount: unifiedShop.ratingCount,
      imageUrl: unifiedShop.logoUrl,
      bannerUrl: unifiedShop.bannerUrl,
      logo_url: unifiedShop.logoUrl,
      isVerified: unifiedShop.isFeatured,
      isActive: unifiedShop.isPublished,
      createdAt: unifiedShop.createdAt,
      updatedAt: unifiedShop.updatedAt,
      contact: {
        email: unifiedShop.email,
        phone: unifiedShop.phone,
        website: unifiedShop.website
      },
      hours: unifiedShop.hours || {
        monday: '8:00 AM - 8:00 PM',
        tuesday: '8:00 AM - 8:00 PM',
        wednesday: '8:00 AM - 8:00 PM',
        thursday: '8:00 AM - 8:00 PM',
        friday: '8:00 AM - 8:00 PM',
        saturday: '9:00 AM - 6:00 PM',
        sunday: '10:00 AM - 4:00 PM'
      },
      urls: unifiedShop.urls
    };

    // Return shop data directly - FlexibleApiSingleton will add the wrapper
    res.json({
      success: true,
      data: shopDetails,
      resolved: {
        identifier: unifiedShop.tenantId,
        type: 'tenantId',
        found: true
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching shop details:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop details',
      message: errorMessage
    });
  }
});

// ====================
// SHOPS FEATURED PRODUCTS ENDPOINTS
// ====================

/**
 * GET /api/shops/featured/random
 * Get random products for shops discovery
 */
router.get('/featured/random', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopRandomProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    });

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'random'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching random products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch random products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/featured/trending
 * Get trending products for shops discovery
 */
router.get('/featured/trending', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopTrendingProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'trending'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching trending products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/featured/new
 * Get new products for shops discovery
 */
router.get('/featured/new', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopNewProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'new_arrival'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching new products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/featured/sale
 * Get sale products for shops discovery
 */
router.get('/featured/sale', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopSaleProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    });

    res.json({
      success: true,
      data: products,
      count: (products as any[]).length,
      type: 'sale'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching sale products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sale products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/featured/seasonal
 * Get seasonal products for shops discovery
 */
router.get('/featured/seasonal', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopSeasonalProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    });

    res.json({
      success: true,
      data: products,
      count: (products as any[]).length,
      type: 'seasonal'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching seasonal products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seasonal products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/featured/staff-pick
 * Get staff pick products for shops discovery
 */
router.get('/featured/staff-pick', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopStaffPicks({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'staff_pick'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching staff pick products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff pick products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/shops/featured/store-selection
 * Get store selection products for shops discovery
 */
router.get('/featured/store-selection', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopStoreSelections({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'store_selection'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching store selection products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store selection products',
      message: errorMessage
    });
  }
});

// ====================
// SHOPS DISCOVERY ENDPOINTS
// ====================

/**
 * GET /api/shops/recently-viewed
 * Get recently viewed shops for a user
 */
router.get('/recently-viewed', async (req, res) => {
  try {
    const { userId, limit } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }
    
    // NOTE: getRecentlyViewedShops method doesn't exist in ShopsFeaturedService yet
/*
    const shops = await shopsService.getRecentlyViewedShops({
      userId: userId as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
*/

    res.json({
      success: true,
      data: [], // Empty array since method doesn't exist yet
      count: 0,
      userId,
      message: 'getRecentlyViewedShops method not implemented yet'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Error fetching recently viewed shops:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recently viewed shops',
      message: errorMessage
    });
  }
});

// ====================
// HEALTH CHECK ENDPOINT
// ====================

/**
 * GET /api/shops/health
 * Health check for shops service
 */
router.get('/health', async (req, res) => {
  try {
    // Test the service by calling a simple method
    await shopsService.getShopRandomProducts({ limit: 1 });
    
    res.json({
      success: true,
      service: 'shops-api',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHOPS API] Health check failed:', errorMessage);
    res.status(500).json({
      success: false,
      service: 'shops-api',
      status: 'unhealthy',
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
