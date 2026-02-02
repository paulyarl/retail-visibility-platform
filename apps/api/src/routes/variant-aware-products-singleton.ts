/**
 * Variant-Aware Products API Routes - UniversalSingleton Implementation
 * Integrates VariantAwareProductsService with Express API using the new materialized views
 */

import { Router, Request, Response } from 'express';
import { VariantAwareProductsService } from '../services/VariantAwareProductsService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// Get singleton instance
const variantAwareProductsService = VariantAwareProductsService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/products-singleton/variant-aware
 * Get variant-aware products with filtering and pagination
 */
router.get('/variant-aware', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const queryOptions = {
      ...req.query,
      tenant_id: user.tenantId,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      min_price: req.query.min_price ? parseInt(req.query.min_price as string) : undefined,
      max_price: req.query.max_price ? parseInt(req.query.max_price as string) : undefined,
      on_sale: req.query.on_sale ? req.query.on_sale === 'true' : undefined,
      has_variants: req.query.has_variants ? req.query.has_variants === 'true' : undefined,
    };

    const result = await variantAwareProductsService.getVariantAwareProducts(queryOptions);
    
    res.json({
      success: true,
      ...result,
      message: 'Variant-aware products retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Get products error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve variant-aware products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/products-singleton/variant-aware/:productId
 * Get a single variant-aware product by ID
 */
router.get('/variant-aware/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { include_variants } = req.query;
    const user = (req as any).user;

    const product = await variantAwareProductsService.getVariantAwareProduct(
      productId, 
      include_variants === 'true'
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Verify tenant access
    if (product.tenant_id !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      success: true,
      product,
      message: 'Variant-aware product retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Get product error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve variant-aware product',
      message: errorMessage
    });
  }
});

/**
 * GET /api/products-singleton/parents-with-variants
 * Get parent products with their variants
 */
router.get('/parents-with-variants', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const options = {
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const products = await variantAwareProductsService.getParentProductsWithVariants(
      user.tenantId,
      options
    );
    
    res.json({
      success: true,
      products,
      count: products.length,
      message: 'Parent products with variants retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Get parents with variants error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve parent products with variants',
      message: errorMessage
    });
  }
});

/**
 * GET /api/products-singleton/individual-variants
 * Get individual variants (products that are variants)
 */
router.get('/individual-variants', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const options = {
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      on_sale: req.query.on_sale ? req.query.on_sale === 'true' : undefined,
    };

    const variants = await variantAwareProductsService.getIndividualVariants(
      user.tenantId,
      options
    );
    
    res.json({
      success: true,
      variants,
      count: variants.length,
      message: 'Individual variants retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Get individual variants error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve individual variants',
      message: errorMessage
    });
  }
});

/**
 * GET /api/products-singleton/featured
 * Get featured products with variant awareness
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { 
      featured_type, 
      limit = '20',
      include_variants 
    } = req.query;

    const options = {
      featured_type: featured_type as string,
      limit: parseInt(limit as string),
      include_variants: include_variants === 'true'
    };

    const products = await variantAwareProductsService.getFeaturedVariantAwareProducts(
      user.tenantId,
      options
    );
    
    res.json({
      success: true,
      products,
      count: products.length,
      featured_type,
      message: 'Featured variant-aware products retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Get featured products error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve featured variant-aware products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/products-singleton/on-sale
 * Get products on sale with variant awareness
 */
router.get('/on-sale', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { 
      limit = '20',
      include_variants,
      min_discount
    } = req.query;

    const options = {
      limit: parseInt(limit as string),
      include_variants: include_variants === 'true',
      min_discount: min_discount ? parseInt(min_discount as string) : undefined
    };

    const products = await variantAwareProductsService.getSaleVariantAwareProducts(
      user.tenantId,
      options
    );
    
    res.json({
      success: true,
      products,
      count: products.length,
      message: 'Sale variant-aware products retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Get sale products error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sale variant-aware products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/products-singleton/search
 * Search products with variant awareness
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { q: query, limit = '50', include_variants } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const options = {
      limit: parseInt(limit as string),
      include_variants: include_variants === 'true'
    };

    const products = await variantAwareProductsService.searchVariantAwareProducts(
      user.tenantId,
      query,
      options
    );
    
    res.json({
      success: true,
      products,
      query,
      count: products.length,
      message: 'Search completed successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Search error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to search variant-aware products',
      message: errorMessage
    });
  }
});

/**
 * GET /api/products-singleton/stats
 * Get variant-aware product statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const stats = await variantAwareProductsService.getVariantAwareProductStats(user.tenantId);
    
    res.json({
      success: true,
      stats,
      message: 'Variant-aware product statistics retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT-AWARE PRODUCTS] Get stats error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve variant-aware product statistics',
      message: errorMessage
    });
  }
});

export default router;
