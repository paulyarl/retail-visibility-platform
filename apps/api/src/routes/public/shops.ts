/**
 * Public Shops API Routes
 * 
 * Public endpoints for shops discovery that don't require authentication
 * Mirrors the main shops API but without auth middleware
 */

import { Router } from 'express';
import ShopsFeaturedService from '../../services/ShopsFeaturedService';

const router = Router();
const shopsService = ShopsFeaturedService.getInstance();

// ====================
// PUBLIC SHOP ENDPOINTS
// ====================

/**
 * GET /api/public/shops/trending
 * Get trending shops (public access)
 * Uses ShopService singleton with MV-optimized caching
 */
router.get('/trending', async (req, res) => {
  console.log('[PUBLIC SHOPS] /trending route called with query:', req.query);
  try {
    const { limit = 8, region } = req.query;
    
    // Use ShopService singleton (already has getTrendingShops method)
    const ShopService = (await import('../../services/ShopService')).default;
    const shopService = ShopService.getInstance();
    
    const shops = await shopService.getTrendingShops({
      limit: parseInt(limit as string)
    });

    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 min cache
    res.setHeader('X-Cache-Source', 'ShopService-Singleton');

    res.json({
      success: true,
      data: shops,
      count: shops.length,
      type: 'trending'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching trending shops:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending shops',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/featured/trending
 * Get trending products for shops discovery (public access)
 * MV-OPTIMIZED with rich product data for product pages
 */
router.get('/featured/trending', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopTrendingProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    // Extract MV refresh timestamp from first product (all have same refresh time)
    const mvRefreshedAt = products.length > 0 && products[0].mv_refreshed_at 
      ? products[0].mv_refreshed_at 
      : new Date().toISOString();

    // Set cache headers for MV-aware caching
    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache (matches MV refresh)
    res.setHeader('X-MV-Source', 'mv_trending_products');

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'trending',
      metadata: {
        mvRefreshedAt,
        mvSource: 'mv_trending_products',
        cacheMaxAge: 900,
        richDataIncluded: {
          variants: true,
          imageGallery: true,
          multiFeaturedBadges: true,
          categories: true,
          paymentGatewayStatus: true,
          behaviorTracking: true
        }
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching trending products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/featured/new
 * Get new arrival products for shops discovery (public access)
 * MV-OPTIMIZED with rich product data for product pages
 */
router.get('/featured/new', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopNewProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    // Extract MV refresh timestamp from first product
    const mvRefreshedAt = products.length > 0 && products[0].mv_refreshed_at 
      ? products[0].mv_refreshed_at 
      : new Date().toISOString();

    // Set cache headers for MV-aware caching
    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-MV-Source', 'mv_new_products');

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'new',
      metadata: {
        mvRefreshedAt,
        mvSource: 'mv_new_products',
        cacheMaxAge: 900,
        richDataIncluded: {
          variants: true,
          imageGallery: true,
          multiFeaturedBadges: true,
          categories: true,
          paymentGatewayStatus: true,
          behaviorTracking: true
        }
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching new products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/featured/random
 * Get random featured shops (public access)
 */
router.get('/featured/random', async (req, res) => {
  try {
    const { limit = 10, category, region } = req.query;
    
    // Mock random featured shops
    // TODO: Replace with actual database query for random featured shops
    const randomShops = [
      {
        tenantId: 'example-tenant-id', // Replace with actual random tenants
        name: 'Example Shop',
        slug: 'example-shop',
        autoId: 'EXAMPLE',
        location: 'Example City, State',
        productCount: 100,
        rating: 4.5,
        urls: {
          slugUrl: '/shops/example-shop',
          tenantIdUrl: '/shops/example-tenant-id',
          autoIdUrl: '/shops/EXAMPLE',
          canonicalUrl: '/shops/example-shop'
        },
        isActive: true,
        isVerified: true
      }
    ];

    res.json({
      success: true,
      data: randomShops.slice(0, parseInt(limit as string)),
      count: randomShops.length,
      type: 'random'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching random shops:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch random shops',
      message: errorMessage
    });
  }
});

// ====================
// PHASE 2: CONVERSION-FOCUSED DISCOVERY
// ====================

/**
 * GET /api/public/shops/featured/sale
 * Get sale products (conversion-focused)
 */
router.get('/featured/sale', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopSaleProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    const mvRefreshedAt = products.length > 0 && products[0].mv_refreshed_at 
      ? products[0].mv_refreshed_at 
      : new Date().toISOString();

    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.setHeader('X-MV-Source', 'mv_storefront_discovery');

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'sale',
      metadata: {
        mvRefreshedAt,
        mvSource: 'mv_storefront_discovery',
        cacheMaxAge: 900,
        expirationHandling: true
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching sale products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sale products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/featured/seasonal
 * Get seasonal products
 */
router.get('/featured/seasonal', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopSeasonalProducts({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    const mvRefreshedAt = products.length > 0 && products[0].mv_refreshed_at 
      ? products[0].mv_refreshed_at 
      : new Date().toISOString();

    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.setHeader('X-MV-Source', 'mv_storefront_discovery');

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'seasonal',
      metadata: {
        mvRefreshedAt,
        mvSource: 'mv_storefront_discovery',
        cacheMaxAge: 900,
        expirationHandling: true
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching seasonal products:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seasonal products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/featured/staff
 * Get staff picks
 */
router.get('/featured/staff', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopStaffPicks({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    const mvRefreshedAt = products.length > 0 && products[0].mv_refreshed_at 
      ? products[0].mv_refreshed_at 
      : new Date().toISOString();

    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.setHeader('X-MV-Source', 'mv_storefront_discovery');

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'staff_pick',
      metadata: {
        mvRefreshedAt,
        mvSource: 'mv_storefront_discovery',
        cacheMaxAge: 900
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching staff picks:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff picks',
      message: errorMessage
    });
  }
});

// ====================
// PHASE 3: STORE SELECTIONS + TRENDING SHOPS
// ====================

/**
 * GET /api/public/shops/featured/selection
 * Get store selections
 */
router.get('/featured/selection', async (req, res) => {
  try {
    const { tenantId, limit, shopScope } = req.query;
    
    const products = await shopsService.getShopStoreSelections({
      tenantId: tenantId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      shopScope: shopScope as 'global' | 'shop'
    }) as any[];

    const mvRefreshedAt = products.length > 0 && products[0].mv_refreshed_at 
      ? products[0].mv_refreshed_at 
      : new Date().toISOString();

    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.setHeader('X-MV-Source', 'mv_storefront_discovery');

    res.json({
      success: true,
      data: products,
      count: products.length,
      type: 'store_selection',
      metadata: {
        mvRefreshedAt,
        mvSource: 'mv_storefront_discovery',
        cacheMaxAge: 900
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching store selections:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store selections',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/trending-shops
 * Get trending shops aggregation (NEW!)
 */
router.get('/trending-shops', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const shops = await shopsService.getGlobalTrendingShops({
      limit: limit ? parseInt(limit as string) : undefined
    }) as any[];

    res.setHeader('Cache-Control', 'public, max-age=900');
    res.setHeader('X-MV-Source', 'mv_storefront_discovery_aggregated');

    res.json({
      success: true,
      data: shops,
      count: shops.length,
      type: 'trending_shops',
      metadata: {
        mvSource: 'mv_storefront_discovery_aggregated',
        cacheMaxAge: 900,
        minimumProducts: 3,
        qualityMetrics: true
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching trending shops:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending shops',
      message: errorMessage
    });
  }
});

export default router;
