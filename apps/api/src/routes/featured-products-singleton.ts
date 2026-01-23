/**
 * Featured Products API Routes - UniversalSingleton Implementation
 * Integrates FeaturedProductsSingletonService with Express API
 */

import { Router } from 'express';
import FeaturedProductsSingletonService from '../services/FeaturedProductsSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const featuredProductsService = FeaturedProductsSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get featured products statistics
 * GET /api/featured-products-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    // Check if user has permission to view stats for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await featuredProductsService.getFeaturedProductsStats(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Featured products statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[FEATURED PRODUCTS SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured products statistics'
    });
  }
});

/**
 * Get featured product by ID
 * GET /api/featured-products-singleton/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const featuredProduct = await featuredProductsService.getFeaturedProduct(id);
    
    if (!featuredProduct) {
      return res.status(404).json({
        success: false,
        message: 'Featured product not found'
      });
    }
    
    // Check if user has permission to access this tenant's featured products
    if (req.user?.tenantIds && !req.user.tenantIds.includes(featuredProduct.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    res.json({
      success: true,
      data: {
        featuredProduct,
        timestamp: new Date().toISOString()
      },
      message: 'Featured product retrieved successfully'
    });
  } catch (error) {
    console.error('Featured product retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve featured product',
      error: (error as Error).message
    });
  }
});

/**
 * Get featured products by tenant
 * GET /api/featured-products-singleton/tenant/:tenantId
 */
router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { page = '1', limit = '10', type } = req.query;
    
    // Check if user has permission to access this tenant's featured products
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const featuredProducts = await featuredProductsService.getFeaturedProductsByTenant(tenantId, {
      featuredType: type as string,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string)
    });
    
    res.json({
      success: true,
      data: {
        featuredProducts,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: featuredProducts.length
        },
        timestamp: new Date().toISOString()
      },
      message: 'Tenant featured products retrieved successfully'
    });
  } catch (error) {
    console.error('Tenant featured products retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tenant featured products',
      error: (error as Error).message
    });
  }
});

/**
 * Get featured products by type
 * GET /api/featured-products-singleton/type/:type
 */
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { page = '1', limit = '10' } = req.query;
    
    const featuredProducts = await featuredProductsService.getFeaturedProductsByType(type, {
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string)
    });
    
    // Filter featured products user has access to
    const accessibleProducts = featuredProducts.filter(product => 
      !req.user?.tenantIds || req.user.tenantIds.includes(product.tenantId)
    );
    
    res.json({
      success: true,
      data: {
        featuredProducts: accessibleProducts,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: accessibleProducts.length
        },
        timestamp: new Date().toISOString()
      },
      message: 'Featured products by type retrieved successfully'
    });
  } catch (error) {
    console.error('Featured products by type retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve featured products by type',
      error: (error as Error).message
    });
  }
});

/**
 * List all featured products
 * GET /api/featured-products-singleton
 */
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '10', type, tenantId } = req.query;
    
    const featuredProducts = await featuredProductsService.listFeaturedProducts({
      tenantId: tenantId as string,
      featuredType: type as string,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      sortBy: 'featuredAt',
      sortOrder: 'desc'
    });
    
    // Filter featured products user has access to
    const accessibleProducts = featuredProducts.filter(product => 
      !req.user?.tenantIds || req.user.tenantIds.includes(product.tenantId)
    );
    
    res.json({
      success: true,
      data: {
        featuredProducts: accessibleProducts,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: accessibleProducts.length
        },
        timestamp: new Date().toISOString()
      },
      message: 'Featured products retrieved successfully'
    });
  } catch (error) {
    console.error('Featured products listing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve featured products',
      error: (error as Error).message
    });
  }
});

/**
 * Create new featured product
 * POST /api/featured-products-singleton
 */
router.post('/', async (req, res) => {
  try {
    const featuredProductData = req.body;
    
    // Check if user has permission to create featured product for this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(featuredProductData.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const featuredProduct = await featuredProductsService.createFeaturedProduct(featuredProductData);
    
    res.status(201).json({
      success: true,
      data: {
        featuredProduct,
        timestamp: new Date().toISOString()
      },
      message: 'Featured product created successfully'
    });
  } catch (error) {
    console.error('Featured product creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create featured product',
      error: (error as Error).message
    });
  }
});

/**
 * Update featured product
 * PUT /api/featured-products-singleton/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get the featured product first to check permissions
    const existingFeaturedProduct = await featuredProductsService.getFeaturedProduct(id);
    if (!existingFeaturedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Featured product not found'
      });
    }
    
    // Check if user has permission to update this featured product
    if (req.user?.tenantIds && !req.user.tenantIds.includes(existingFeaturedProduct.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const featuredProduct = await featuredProductsService.updateFeaturedProduct(id, updates);
    
    res.json({
      success: true,
      data: {
        featuredProduct,
        timestamp: new Date().toISOString()
      },
      message: 'Featured product updated successfully'
    });
  } catch (error) {
    console.error('Featured product update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured product',
      error: (error as Error).message
    });
  }
});

/**
 * Delete featured product
 * DELETE /api/featured-products-singleton/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the featured product first to check permissions
    const existingFeaturedProduct = await featuredProductsService.getFeaturedProduct(id);
    if (!existingFeaturedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Featured product not found'
      });
    }
    
    // Check if user has permission to delete this featured product
    if (req.user?.tenantIds && !req.user.tenantIds.includes(existingFeaturedProduct.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    await featuredProductsService.deleteFeaturedProduct(id);
    
    res.json({
      success: true,
      data: {
        featuredProductId: id,
        timestamp: new Date().toISOString()
      },
      message: 'Featured product deleted successfully'
    });
  } catch (error) {
    console.error('Featured product deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete featured product',
      error: (error as Error).message
    });
  }
});

export default router;
