/**
 * Cached Products CRUD API
 * Platform Admin management of Quick Start product cache
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, requirePlatformAdmin } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const listQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1', 10)),
  pageSize: z.string().optional().transform(v => parseInt(v || '50', 10)),
  search: z.string().optional(),
  businessType: z.string().optional(),
  categoryName: z.string().optional(),
  hasImage: z.string().optional().transform(v => v === 'true'),
  sortBy: z.enum(['usage_count', 'quality_score', 'created_at', 'product_name']).optional().default('usage_count'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const updateSchema = z.object({
  product_name: z.string().min(1).optional(),
  price_cents: z.number().int().nonnegative().optional(),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  enhanced_description: z.string().nullable().optional(),
  features: z.any().nullable().optional(),
  specifications: z.any().nullable().optional(),
  quality_score: z.number().min(-1).max(1).optional(),
});

/**
 * GET /api/admin/cached-products
 * List all cached products with filtering and pagination
 */
router.get('/', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const { page, pageSize, search, businessType, categoryName, hasImage, sortBy, sortOrder } = query;
    
    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { product_name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (businessType) {
      where.business_type = businessType;
    }
    
    if (categoryName) {
      where.category_name = categoryName;
    }
    
    if (hasImage !== undefined) {
      where.has_image = hasImage;
    }
    
    // Get total count
    const total = await prisma.quick_start_product_cache.count({ where });
    
    // Get paginated results
    const products = await prisma.quick_start_product_cache.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    
    // Get unique business types and categories for filters
    const businessTypes = await prisma.quick_start_product_cache.groupBy({
      by: ['business_type'],
      _count: { _all: true },
    });
    
    const categories = await prisma.quick_start_product_cache.groupBy({
      by: ['category_name'],
      _count: { _all: true },
    });
    
    res.json({
      success: true,
      data: products.map((p: any) => ({
        id: p.id,
        businessType: p.business_type,
        categoryName: p.category_name,
        googleCategoryId: p.google_category_id,
        productName: p.product_name,
        priceCents: p.price_cents,
        brand: p.brand,
        description: p.description,
        skuPattern: p.sku_pattern,
        imageUrl: p.image_url,
        thumbnailUrl: p.thumbnail_url,
        imageWidth: p.image_width,
        imageHeight: p.image_height,
        imageBytes: p.image_bytes,
        enhancedDescription: p.enhanced_description,
        features: p.features,
        specifications: p.specifications,
        generationSource: p.generation_source,
        hasImage: p.has_image,
        imageQuality: p.image_quality,
        usageCount: p.usage_count,
        qualityScore: p.quality_score,
        createdAt: p.created_at,
        lastUsedAt: p.last_used_at,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filters: {
        businessTypes: businessTypes.map((b: any) => ({ 
          value: b.business_type, 
          count: b._count._all 
        })),
        categories: categories.map((c: any) => ({ 
          value: c.category_name, 
          count: c._count._all 
        })),
      },
    });
  } catch (error: any) {
    console.error('[Cached Products] List error:', error);
    res.status(500).json({ error: 'Failed to list cached products', message: error.message });
  }
});

/**
 * GET /api/admin/cached-products/:id
 * Get a single cached product
 */
router.get('/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.quick_start_product_cache.findUnique({
      where: { id },
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Cached product not found' });
    }
    
    res.json({
      success: true,
      data: {
        id: product.id,
        businessType: product.business_type,
        categoryName: product.category_name,
        googleCategoryId: product.google_category_id,
        productName: product.product_name,
        priceCents: product.price_cents,
        brand: product.brand,
        description: product.description,
        skuPattern: product.sku_pattern,
        imageUrl: product.image_url,
        thumbnailUrl: product.thumbnail_url,
        imageWidth: product.image_width,
        imageHeight: product.image_height,
        imageBytes: product.image_bytes,
        enhancedDescription: product.enhanced_description,
        features: product.features,
        specifications: product.specifications,
        generationSource: product.generation_source,
        hasImage: product.has_image,
        imageQuality: product.image_quality,
        usageCount: product.usage_count,
        qualityScore: product.quality_score,
        createdAt: product.created_at,
        lastUsedAt: product.last_used_at,
      },
    });
  } catch (error: any) {
    console.error('[Cached Products] Get error:', error);
    res.status(500).json({ error: 'Failed to get cached product', message: error.message });
  }
});

/**
 * PUT /api/admin/cached-products/:id
 * Update a cached product
 */
router.put('/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = updateSchema.parse(req.body);
    
    const product = await prisma.quick_start_product_cache.findUnique({
      where: { id },
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Cached product not found' });
    }
    
    const updated = await prisma.quick_start_product_cache.update({
      where: { id },
      data: updates,
    });
    
    res.json({
      success: true,
      data: {
        id: updated.id,
        productName: updated.product_name,
        priceCents: updated.price_cents,
        brand: updated.brand,
        description: updated.description,
        qualityScore: updated.quality_score,
      },
    });
  } catch (error: any) {
    console.error('[Cached Products] Update error:', error);
    res.status(500).json({ error: 'Failed to update cached product', message: error.message });
  }
});

/**
 * DELETE /api/admin/cached-products/bulk
 * Bulk delete cached products
 * NOTE: Must be defined BEFORE /:id route to avoid /bulk being matched as an ID
 */
router.delete('/bulk', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    
    const result = await prisma.quick_start_product_cache.deleteMany({
      where: { id: { in: ids } },
    });
    
    res.json({
      success: true,
      deleted: result.count,
    });
  } catch (error: any) {
    console.error('[Cached Products] Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete cached products', message: error.message });
  }
});

/**
 * DELETE /api/admin/cached-products/:id
 * Delete a cached product
 */
router.delete('/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.quick_start_product_cache.findUnique({
      where: { id },
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Cached product not found' });
    }
    
    await prisma.quick_start_product_cache.delete({
      where: { id },
    });
    
    res.json({
      success: true,
      message: 'Cached product deleted',
    });
  } catch (error: any) {
    console.error('[Cached Products] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete cached product', message: error.message });
  }
});

/**
 * POST /api/admin/cached-products/clear-category
 * Clear all cached products for a specific business type + category
 */
router.post('/clear-category', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { businessType, categoryName } = req.body;
    
    if (!businessType || !categoryName) {
      return res.status(400).json({ error: 'businessType and categoryName are required' });
    }
    
    const result = await prisma.quick_start_product_cache.deleteMany({
      where: {
        business_type: businessType,
        category_name: categoryName,
      },
    });
    
    res.json({
      success: true,
      deleted: result.count,
      message: `Cleared ${result.count} products from ${businessType} > ${categoryName}`,
    });
  } catch (error: any) {
    console.error('[Cached Products] Clear category error:', error);
    res.status(500).json({ error: 'Failed to clear category', message: error.message });
  }
});

export default router;
