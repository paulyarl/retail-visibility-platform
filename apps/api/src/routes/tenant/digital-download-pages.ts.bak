/**
 * Digital Download Pages API Routes
 * 
 * Tenant-scoped endpoints for managing digital download pages
 * Provides CRUD operations, asset management, and preview functionality
 * 
 * Routes:
 * - GET    /api/tenants/[tenantId]/digital-download-pages
 * - POST   /api/tenants/[tenantId]/digital-download-pages
 * - GET    /api/tenants/[tenantId]/digital-download-pages/[id]
 * - PUT    /api/tenants/[tenantId]/digital-download-pages/[id]
 * - DELETE /api/tenants/[tenantId]/digital-download-pages/[id]
 * - POST   /api/tenants/[tenantId]/digital-download-pages/[id]/preview-token
 * - GET    /api/tenants/[tenantId]/digital-download-pages/[id]/assets
 * - PUT    /api/tenants/[tenantId]/digital-download-pages/[id]/assets/reorder
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generalRateLimit } from '../../middleware/rate-limit';
import { DigitalDownloadPageService } from '../../services/DigitalDownloadPageService';
import { prisma } from '../../prisma';
import { unifiedConfig } from '../../config/unifiedConfig';

// Tenant authentication middleware
const authenticateTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.tenantId || req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    (req as any).tenant = tenant;
    next();
  } catch (error) {
    console.error('Tenant authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Helper to get tenant ID from request
function getTenantId(req: Request): string | undefined {
  return (req as any).tenant?.id;
}

// Zod schemas for validation
const listPagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['draft', 'published', 'archived', 'all']).optional(),
  search: z.string().trim().optional()
});

const createPageSchema = z.object({
  itemId: z.string().min(1, 'Valid item ID is required'),
  title: z.string().trim().min(1).max(255, 'Title must be 1-255 characters'),
  description: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(2000).optional(),
  thankYouMessage: z.string().trim().max(1000).optional(),
  supportEmail: z.string().email().optional(),
  supportUrl: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
  requireAuthentication: z.boolean().optional(),
  accessExpires: z.boolean().optional(),
  accessDurationDays: z.number().int().min(1).max(365).optional(),
  downloadLimit: z.number().int().min(1).max(100).optional(),
  allowMultipleDownloads: z.boolean().optional(),
  status: z.enum(['draft', 'published']).optional()
});

const updatePageSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(2000).optional(),
  thankYouMessage: z.string().trim().max(1000).optional(),
  supportEmail: z.string().email().optional(),
  supportUrl: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  requireAuthentication: z.boolean().optional(),
  accessExpires: z.boolean().optional(),
  accessDurationDays: z.number().int().min(1).max(365).optional(),
  downloadLimit: z.number().int().min(1).max(100).optional(),
  allowMultipleDownloads: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional()
});

const previewTokenSchema = z.object({
  expiresInHours: z.number().int().min(1).max(24).default(2)
});

const reorderAssetsSchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1, 'At least one asset ID is required')
});

const uuidParamSchema = z.object({
  id: z.string().min(1, 'Valid page ID is required')
});

const router = Router();
const pageService = new DigitalDownloadPageService();

/**
 * GET /api/tenants/:tenantId/digital-download-pages
 * List all digital download pages for a tenant
 */
router.get('/:tenantId/digital-download-pages', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const params = listPagesSchema.safeParse(req.query);
    if (!params.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: params.error.flatten() });
    }

    const { page, limit, status, search } = params.data;

    const result = await pageService.getDownloadPages(tenantId, {
      page,
      limit,
      status,
      search
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error fetching download pages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch download pages',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * GET /api/tenants/:tenantId/digital-download-pages/digital-items
 * Get digital inventory items for creating download pages
 */
router.get('/:tenantId/digital-download-pages/digital-items', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const items = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenantId,
        product_type: 'digital'
      },
      select: {
        id: true,
        name: true,
        product_type: true,
        digital_delivery_method: true,
        item_status: true,
        has_variants: true
      },
      take: limit,
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: items
    });
  } catch (error: any) {
    console.error('Error fetching digital items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch digital items',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * POST /api/tenants/:tenantId/digital-download-pages
 * Create a new digital download page
 */
router.post('/:tenantId/digital-download-pages', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const parsed = createPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    }

    const pageData = parsed.data;

    // Verify the item exists and belongs to the tenant
    const item = await prisma.inventory_items.findFirst({
      where: {
        id: pageData.itemId,
        tenant_id: tenantId
      },
      select: {
        id: true,
        name: true,
        product_type: true
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found or does not belong to this tenant'
      });
    }

    // Verify item is digital or hybrid
    if (!['digital', 'hybrid'].includes(item.product_type)) {
      return res.status(400).json({
        success: false,
        error: 'Download pages can only be created for digital or hybrid products'
      });
    }

    // Check if download page already exists for this item
    const existingPage = await prisma.digital_download_pages.findFirst({
      where: {
        item_id: pageData.itemId,
        tenant_id: tenantId
      },
      select: { id: true }
    });

    if (existingPage) {
      return res.status(409).json({
        success: false,
        error: 'Download page already exists for this item'
      });
    }

    const result = await pageService.createDownloadPage(tenantId, {
      ...pageData,
      slug: await pageService.generateUniqueSlug(tenantId, pageData.title),
      status: pageData.status || 'draft'
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Download page created successfully'
    });
  } catch (error: any) {
    console.error('Error creating download page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create download page',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * GET /api/tenants/:tenantId/digital-download-pages/:id
 * Get a specific digital download page
 */
router.get('/:tenantId/digital-download-pages/:id', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const paramResult = uuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: paramResult.error.flatten() });
    }

    const { id } = paramResult.data;

    const result = await pageService.getDownloadPage(tenantId, id);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Download page not found' });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching download page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch download page',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * PUT /api/tenants/:tenantId/digital-download-pages/:id
 * Update a digital download page
 */
router.put('/:tenantId/digital-download-pages/:id', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const paramResult = uuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: paramResult.error.flatten() });
    }

    const { id } = paramResult.data;

    const parsed = updatePageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    }

    const updateData = parsed.data;

    // Verify page exists and belongs to tenant
    const existingPage = await pageService.getDownloadPage(tenantId, id);
    if (!existingPage) {
      return res.status(404).json({ success: false, error: 'Download page not found' });
    }

    // Generate new slug if title changed
    if (updateData.title && updateData.title !== existingPage.title) {
      (updateData as any).slug = await pageService.generateUniqueSlug(tenantId, updateData.title);
    }

    const result = await pageService.updateDownloadPage(tenantId, id, updateData);

    res.json({ success: true, data: result, message: 'Download page updated successfully' });
  } catch (error: any) {
    console.error('Error updating download page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update download page',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/tenants/:tenantId/digital-download-pages/:id
 * Delete a digital download page
 */
router.delete('/:tenantId/digital-download-pages/:id', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const paramResult = uuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: paramResult.error.flatten() });
    }

    const { id } = paramResult.data;

    const existingPage = await pageService.getDownloadPage(tenantId, id);
    if (!existingPage) {
      return res.status(404).json({ success: false, error: 'Download page not found' });
    }

    await pageService.deleteDownloadPage(tenantId, id);

    res.json({ success: true, message: 'Download page deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting download page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete download page',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * POST /api/tenants/:tenantId/digital-download-pages/:id/preview-token
 * Generate a preview token for testing the download page
 */
router.post('/:tenantId/digital-download-pages/:id/preview-token', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const paramResult = uuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: paramResult.error.flatten() });
    }

    const { id } = paramResult.data;

    const parsed = previewTokenSchema.safeParse(req.body);
    const expiresInHours = parsed.success ? parsed.data.expiresInHours : 2;

    const existingPage = await pageService.getDownloadPage(tenantId, id);
    if (!existingPage) {
      return res.status(404).json({ success: false, error: 'Download page not found' });
    }

    const previewToken = await pageService.generatePreviewToken(tenantId, id, expiresInHours);

    res.json({
      success: true,
      data: {
        previewToken,
        previewUrl: `/downloads/${tenantId}/${existingPage.slug}?token=${previewToken}`,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      },
      message: 'Preview token generated successfully'
    });
  } catch (error: any) {
    console.error('Error generating preview token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview token',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * GET /api/tenants/:tenantId/digital-download-pages/:id/assets
 * Get all assets for a download page
 */
router.get('/:tenantId/digital-download-pages/:id/assets', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const paramResult = uuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: paramResult.error.flatten() });
    }

    const { id } = paramResult.data;

    const existingPage = await pageService.getDownloadPage(tenantId, id);
    if (!existingPage) {
      return res.status(404).json({ success: false, error: 'Download page not found' });
    }

    // Get all assets (including variant-specific ones)
    const assets = await pageService.getPageAssets(tenantId, id);

    res.json({ success: true, data: assets });
  } catch (error: any) {
    console.error('Error fetching page assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch page assets',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * PUT /api/tenants/:tenantId/digital-download-pages/:id/assets/reorder
 * Reorder assets on a download page
 */
router.put('/:tenantId/digital-download-pages/:id/assets/reorder', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const paramResult = uuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: paramResult.error.flatten() });
    }

    const { id } = paramResult.data;

    const parsed = reorderAssetsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { assetIds } = parsed.data;

    const existingPage = await pageService.getDownloadPage(tenantId, id);
    if (!existingPage) {
      return res.status(404).json({ success: false, error: 'Download page not found' });
    }

    await pageService.reorderPageAssets(tenantId, id, assetIds);

    res.json({ success: true, message: 'Assets reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering page assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder page assets',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * POST /api/tenants/:tenantId/digital-download-pages/:id/assets
 * Add an asset to a download page
 */
router.post('/:tenantId/digital-download-pages/:id/assets', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const { id } = req.params;
    const assetData = req.body;

    // Validate required fields
    if (!assetData.assetName || !assetData.assetType) {
      return res.status(400).json({
        success: false,
        error: 'Asset name and type are required'
      });
    }

    const asset = await pageService.addPageAsset(tenantId, id, assetData);

    res.json({
      success: true,
      data: asset
    });
  } catch (error: any) {
    console.error('Error adding page asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add page asset',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * PUT /api/tenants/:tenantId/digital-download-pages/:id/assets/:assetId
 * Update an asset
 */
router.put('/:tenantId/digital-download-pages/:id/assets/:assetId', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const { id, assetId } = req.params;
    const updateData = req.body;

    const asset = await pageService.updatePageAsset(tenantId, id, assetId, updateData);

    res.json({
      success: true,
      data: asset
    });
  } catch (error: any) {
    console.error('Error updating page asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update page asset',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/tenants/:tenantId/digital-download-pages/:id/assets/:assetId
 * Delete an asset
 */
router.delete('/:tenantId/digital-download-pages/:id/assets/:assetId', authenticateTenant, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant authentication required' });
    }

    const { id, assetId } = req.params;

    await pageService.deletePageAsset(tenantId, id, assetId);

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting page asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete page asset',
      message: unifiedConfig.isDevelopment ? error.message : undefined
    });
  }
});

export default router;
