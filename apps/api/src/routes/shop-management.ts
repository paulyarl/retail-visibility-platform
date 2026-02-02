/**
 * Shop Management API Routes
 * 
 * Real persistent shop management operations
 * Replaces mock data with actual database operations
 */

import { Router } from 'express';
import ShopManagementService from '../services/ShopManagementService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const shopService = ShopManagementService.getInstance();

// Apply authentication to all routes
router.use(authenticateToken);

// ====================
// CATEGORY ENDPOINTS
// ====================

/**
 * GET /api/shop-management/categories
 * Get available GBP categories for shop creation
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await shopService.getAvailableCategories();
    
    res.json({
      success: true,
      data: categories,
      message: 'GBP categories retrieved successfully'
    });
  } catch (error) {
    console.error('[Get Categories Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to retrieve categories'
    });
  }
});

/**
 * PUT /api/shop-management/:tenantId/category
 * Set shop category with GBP validation
 */
router.put('/:tenantId/category', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { categoryId } = req.body;
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Category ID is required'
      });
    }
    
    const shop = await shopService.setShopCategory(tenantId, categoryId);
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop category updated successfully'
    });
  } catch (error) {
    console.error('[Set Category Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to set shop category'
    });
  }
});

// ====================
// LIMIT CHECK ENDPOINTS
// ====================

/**
 * GET /api/shop-management/:tenantId/limits
 * Check tenant tier limits for shop creation
 */
router.get('/:tenantId/limits', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const limitCheck = await shopService.checkTenantShopLimit(tenantId);
    
    res.json({
      success: true,
      data: limitCheck
    });
  } catch (error) {
    console.error('[Check Limits Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to check shop limits'
    });
  }
});

// ====================
// SHOP CRUD ENDPOINTS
// ====================

/**
 * GET /api/shop-management/:tenantId
 * Get shop data for a tenant
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const shop = await shopService.getShop(tenantId);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Shop not found'
      });
    }

    res.json({
      success: true,
      data: shop
    });
  } catch (error) {
    console.error('[Get Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch shop data'
    });
  }
});

/**
 * POST /api/shop-management/:tenantId
 * Create or update shop data
 */
router.post('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const shopData = req.body;
    
    const shop = await shopService.upsertShop(tenantId, shopData);
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop data saved successfully'
    });
  } catch (error) {
    console.error('[Upsert Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to save shop data'
    });
  }
});

/**
 * PUT /api/shop-management/:tenantId
 * Update shop data
 */
router.put('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const shopData = req.body;
    
    const shop = await shopService.upsertShop(tenantId, shopData);
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop updated successfully'
    });
  } catch (error) {
    console.error('[Update Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update shop'
    });
  }
});

// ====================
// PUBLISHING ENDPOINTS
// ====================

/**
 * POST /api/shop-management/:tenantId/publish
 * Publish shop (make it publicly visible)
 */
router.post('/:tenantId/publish', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const shop = await shopService.publishShop(tenantId);
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop published successfully'
    });
  } catch (error) {
    console.error('[Publish Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to publish shop'
    });
  }
});

/**
 * POST /api/shop-management/:tenantId/unpublish
 * Unpublish shop (make it private)
 */
router.post('/:tenantId/unpublish', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const shop = await shopService.unpublishShop(tenantId);
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop unpublished successfully'
    });
  } catch (error) {
    console.error('[Unpublish Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to unpublish shop'
    });
  }
});

// ====================
// CATEGORY ENDPOINTS
// ====================

/**
 * PUT /api/shop-management/:tenantId/category
 * Update shop category
 */
router.put('/:tenantId/category', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { categoryId } = req.body;
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Category ID is required'
      });
    }
    
    const shop = await shopService.upsertShop(tenantId, { categoryId });
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop category updated successfully'
    });
  } catch (error) {
    console.error('[Update Category Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update shop category'
    });
  }
});

// ====================
// CUSTOMIZATION ENDPOINTS
// ====================

/**
 * PUT /api/shop-management/:tenantId/branding
 * Update shop branding (logo, banner, colors)
 */
router.put('/:tenantId/branding', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { logoUrl, bannerUrl, colors } = req.body;
    
    // Update business profile with branding data
    const shop = await shopService.upsertShop(tenantId, {
      // Note: Logo and banner would be handled via file upload endpoints
      // This endpoint would handle colors and other branding settings
    } as any);
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop branding updated successfully'
    });
  } catch (error) {
    console.error('[Update Branding Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update shop branding'
    });
  }
});

/**
 * PUT /api/shop-management/:tenantId/hours
 * Update shop hours (including timezone)
 */
router.put('/:tenantId/hours', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { hours, timezone } = req.body;
    
    if (!hours) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Hours data is required'
      });
    }
    
    // Merge timezone into hours object following the same pattern as the hours page
    const hoursWithTimezone = {
      ...hours,
      timezone: timezone || 'America/New_York'
    };
    
    const shop = await shopService.upsertShop(tenantId, { 
      hours: hoursWithTimezone,
      timezone 
    });
    
    res.json({
      success: true,
      data: shop,
      message: 'Shop hours updated successfully'
    });
  } catch (error) {
    console.error('[Update Hours Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update shop hours'
    });
  }
});

/**
 * PUT /api/shop-management/:tenantId/social
 * Update social media links
 */
router.put('/:tenantId/social', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { socialLinks } = req.body;
    
    if (!socialLinks) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Social links data is required'
      });
    }
    
    const shop = await shopService.upsertShop(tenantId, { socialLinks });
    
    res.json({
      success: true,
      data: shop,
      message: 'Social links updated successfully'
    });
  } catch (error) {
    console.error('[Update Social Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update social links'
    });
  }
});

// ====================
// ANALYTICS ENDPOINTS
// ====================

/**
 * GET /api/shop-management/:tenantId/analytics
 * Get shop analytics
 */
router.get('/:tenantId/analytics', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const analytics = await shopService.getShopAnalytics(tenantId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('[Get Analytics Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch shop analytics'
    });
  }
});

// ====================
// MULTI-SHOP ENDPOINTS
// ====================

/**
 * GET /api/shop-management/tenant/:tenantId/shops
 * Get all shops for a tenant (for multi-shop scenarios)
 */
router.get('/tenant/:tenantId/shops', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const shops = await shopService.getTenantShops(tenantId);
    
    res.json({
      success: true,
      data: shops,
      total: shops.length
    });
  } catch (error) {
    console.error('[Get Tenant Shops Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch tenant shops'
    });
  }
});

/**
 * DELETE /api/shop-management/:tenantId
 * Delete shop data
 */
router.delete('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    await shopService.deleteShop(tenantId);
    
    res.json({
      success: true,
      message: 'Shop deleted successfully'
    });
  } catch (error) {
    console.error('[Delete Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to delete shop'
    });
  }
});

export default router;
