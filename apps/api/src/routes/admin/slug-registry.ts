/**
 * Admin Slug Registry Routes
 * 
 * Platform admin management for product slug registry
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { parseSlugToJSON } from '../../lib/slug-generator';
import { logger } from '../../logger';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

/**
 * GET /api/admin/slug-registry
 * List all slug registry entries with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      slugType,
      formatVersion,
      migrationStatus,
      isActive,
      brand,
      category,
      search,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (slugType) {
      where.slug_type = slugType;
    }
    if (formatVersion) {
      where.format_version = formatVersion;
    }
    if (migrationStatus) {
      where.migration_status = migrationStatus;
    }
    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    }
    if (brand) {
      where.brand_normalized = { equals: brand, mode: 'insensitive' };
    }
    if (category) {
      where.category_normalized = { equals: category, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { product_slug: { contains: search as string, mode: 'insensitive' } },
        { universal_sku: { contains: search as string, mode: 'insensitive' } },
        { original_sku: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.product_slug_registry.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limitNum
      }),
      prisma.product_slug_registry.count({ where })
    ]);

    res.json({
      data: entries,
      total
    });
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error listing entries:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list slug registry entries' });
  }
});

/**
 * GET /api/admin/slug-registry/stats
 * Get slug registry statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [
      total,
      upcCount,
      lpcCount,
      v2Count,
      activeCount,
      migratedCount,
      pendingMigrationCount
    ] = await Promise.all([
      prisma.product_slug_registry.count(),
      prisma.product_slug_registry.count({ where: { slug_type: 'upc' } }),
      prisma.product_slug_registry.count({ where: { slug_type: 'lpc' } }),
      prisma.product_slug_registry.count({ where: { format_version: 'v2' } }),
      prisma.product_slug_registry.count({ where: { is_active: true } }),
      prisma.product_slug_registry.count({ where: { migration_status: 'completed' } }),
      prisma.product_slug_registry.count({ where: { migration_status: 'pending' } })
    ]);

    res.json({
      total,
      upcCount,
      lpcCount,
      v2Count,
      activeCount,
      migratedCount,
      pendingMigrationCount
    });
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error getting stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to get slug registry stats' });
  }
});

/**
 * GET /api/admin/slug-registry/:identifier
 * Get a single slug registry entry
 */
router.get('/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    const entry = await prisma.product_slug_registry.findFirst({
      where: {
        OR: [
          { id: identifier },
          { product_slug: identifier }
        ]
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'not_found', message: 'Slug registry entry not found' });
    }

    res.json(entry);
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error getting entry:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to get slug registry entry' });
  }
});

/**
 * PATCH /api/admin/slug-registry/:id
 * Update a slug registry entry
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active, migration_status, format_version } = req.body;

    const entry = await prisma.product_slug_registry.update({
      where: { id },
      data: {
        ...(is_active !== undefined && { is_active }),
        ...(migration_status && { migration_status }),
        ...(format_version && { format_version })
      }
    });

    res.json(entry);
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error updating entry:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update slug registry entry' });
  }
});

/**
 * POST /api/admin/slug-registry/:id/regenerate
 * Regenerate a slug for a registry entry
 */
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the entry
    const entry = await prisma.product_slug_registry.findUnique({
      where: { id }
    });

    if (!entry) {
      return res.status(404).json({ error: 'not_found', message: 'Slug registry entry not found' });
    }

    // Get the inventory item that this slug belongs to
    const inventoryItem = await prisma.inventory_items.findFirst({
      where: { product_slug: entry.product_slug }
    });

    if (!inventoryItem) {
      return res.status(404).json({ error: 'not_found', message: 'Associated inventory item not found' });
    }

    // Regenerate the slug using the DB function
    const newSlug = await prisma.$queryRaw<{ generate_product_slug: string }[]>`
      SELECT generate_product_slug(
        ${inventoryItem.sku},
        ${inventoryItem.brand},
        ${inventoryItem.category_path[0] || 'general'},
        ${inventoryItem.gtin},
        ${inventoryItem.id},
        ${inventoryItem.name}
      ) as generate_product_slug
    `;

    const generatedSlug = newSlug[0]?.generate_product_slug;

    if (!generatedSlug) {
      return res.status(500).json({ error: 'generation_failed', message: 'Failed to generate new slug' });
    }

    // Update the entry
    const updatedEntry = await prisma.product_slug_registry.update({
      where: { id },
      data: {
        product_slug: generatedSlug,
        format_version: 'v2',
        migration_status: 'regenerated',
        slug_type: inventoryItem.gtin ? 'upc' : 'lpc',
        slug_prefix: inventoryItem.gtin ? 'upc' : 'lpc',
        brand_normalized: inventoryItem.brand?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null,
        category_normalized: inventoryItem.category_path?.[0]?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'general'
      }
    });

    // Also update the inventory item
    await prisma.inventory_items.update({
      where: { id: inventoryItem.id },
      data: { product_slug: generatedSlug }
    });

    res.json(updatedEntry);
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error regenerating slug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to regenerate slug' });
  }
});

/**
 * POST /api/admin/slug-registry/:id/deactivate
 * Deactivate (soft delete) a slug registry entry
 */
router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const entry = await prisma.product_slug_registry.update({
      where: { id },
      data: { is_active: false }
    });

    res.json({ success: true, entry });
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error deactivating entry:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to deactivate slug registry entry' });
  }
});

/**
 * POST /api/admin/slug-registry/:id/activate
 * Restore a deactivated slug registry entry
 */
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const entry = await prisma.product_slug_registry.update({
      where: { id },
      data: { is_active: true }
    });

    res.json({ success: true, entry });
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error activating entry:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to activate slug registry entry' });
  }
});

/**
 * POST /api/admin/slug-registry/bulk-migrate
 * Bulk migrate slugs to v2 format
 */
router.post('/bulk-migrate', async (req: Request, res: Response) => {
  try {
    const { entryIds } = req.body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ error: 'invalid_request', message: 'entryIds array is required' });
    }

    const results = [];
    let success = 0;
    let failed = 0;

    for (const id of entryIds) {
      try {
        const entry = await prisma.product_slug_registry.findUnique({
          where: { id }
        });

        if (!entry) {
          results.push({ id, status: 'failed', error: 'Entry not found' });
          failed++;
          continue;
        }

        // Get inventory item
        const inventoryItem = await prisma.inventory_items.findFirst({
          where: { product_slug: entry.product_slug }
        });

        if (!inventoryItem) {
          results.push({ id, status: 'failed', error: 'Inventory item not found' });
          failed++;
          continue;
        }

        // Regenerate slug
        const newSlug = await prisma.$queryRaw<{ generate_product_slug: string }[]>`
          SELECT generate_product_slug(
            ${inventoryItem.sku},
            ${inventoryItem.brand},
            ${inventoryItem.category_path[0] || 'general'},
            ${inventoryItem.gtin},
            ${inventoryItem.id},
            ${inventoryItem.name}
          ) as generate_product_slug
        `;

        const generatedSlug = newSlug[0]?.generate_product_slug;

        if (generatedSlug) {
          await prisma.product_slug_registry.update({
            where: { id },
            data: {
              product_slug: generatedSlug,
              format_version: 'v2',
              migration_status: 'completed',
              slug_type: inventoryItem.gtin ? 'upc' : 'lpc',
              slug_prefix: inventoryItem.gtin ? 'upc' : 'lpc',
              brand_normalized: inventoryItem.brand?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null,
              category_normalized: inventoryItem.category_path?.[0]?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'general'
            }
          });

          await prisma.inventory_items.update({
            where: { id: inventoryItem.id },
            data: { product_slug: generatedSlug }
          });

          results.push({ id, status: 'success' });
          success++;
        } else {
          results.push({ id, status: 'failed', error: 'Slug generation failed' });
          failed++;
        }
      } catch (err) {
        results.push({ id, status: 'failed', error: String(err) });
        failed++;
      }
    }

    res.json({ success, failed, results });
  } catch (error) {
    logger.error('[AdminSlugRegistry] Error bulk migrating:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to bulk migrate slugs' });
  }
});

export default router;
