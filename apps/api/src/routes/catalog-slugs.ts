/**
 * Catalog Slug API Routes
 * 
 * Provides REST API endpoints for product slug management:
 * - Validate slug uniqueness
 * - Register new slugs
 * - Get slug registry entries
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

// Validation schemas
const validateSlugSchema = z.object({
  slug: z.string().min(1).max(255),
  organizationId: z.string().optional(),
  excludeProductId: z.string().optional()
});

const registerSlugSchema = z.object({
  product_slug: z.string().min(1).max(255),
  universal_sku: z.string().min(1).max(255),
  tenant_id: z.string().optional(),
  original_sku: z.string().optional()
});

/**
 * GET /api/catalog/slugs/validate
 * Validate slug uniqueness
 * 
 * Query params:
 * - slug: Slug to validate (required)
 * - organizationId: Organization context (optional)
 * - excludeProductId: Product ID to exclude from check (optional)
 */
router.get('/validate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = validateSlugSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_query',
        details: parsed.error.flatten()
      });
    }

    const { slug, organizationId, excludeProductId } = parsed.data;

    // Check global catalog
    const globalProduct = await prisma.global_product_catalog.findFirst({
      where: {
        product_slug: slug,
        ...(excludeProductId && { id: { not: excludeProductId } })
      }
    });

    // Check slug registry
    const registryEntry = await prisma.product_slug_registry.findFirst({
      where: {
        product_slug: slug,
        ...(excludeProductId && { id: { not: excludeProductId } })
      }
    });

    const conflicts: string[] = [];
    if (globalProduct) conflicts.push('global_catalog');
    if (registryEntry) conflicts.push('slug_registry');

    const isValid = conflicts.length === 0;

    // Generate suggested slug if conflicts exist
    let suggestedSlug: string | undefined;
    if (!isValid) {
      const baseSlug = slug.replace(/-\d+$/, '');
      const hash = crypto.randomBytes(3).toString('hex');
      suggestedSlug = `${baseSlug}-${hash}`;
    }

    res.json({
      isValid,
      conflicts: isValid ? undefined : conflicts,
      suggestedSlug
    });
  } catch (error) {
    console.error('[CatalogSlugs] Error validating slug:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to validate slug' });
  }
});

/**
 * POST /api/catalog/slugs/register
 * Register a new product slug
 * 
 * Body:
 * - product_slug: The slug to register (required)
 * - universal_sku: Universal SKU (required)
 * - tenant_id: Tenant ID (optional)
 * - original_sku: Original tenant SKU (optional)
 */
router.post('/register', authenticateToken, async (req: Request, res: Response) => {
  try {
    const parsed = registerSlugSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten()
      });
    }

    const { product_slug, universal_sku, tenant_id, original_sku } = parsed.data;

    // Check if slug already exists
    const existing = await prisma.product_slug_registry.findFirst({
      where: { product_slug }
    });

    if (existing) {
      return res.status(409).json({
        error: 'conflict',
        message: 'Slug already registered',
        existingId: existing.id
      });
    }

    // Generate slug hash
    const slug_hash = crypto.createHash('sha256').update(product_slug).digest('hex');

    // Create registry entry
    const registry = await prisma.product_slug_registry.create({
      data: {
        id: `slug-${crypto.randomUUID()}`,
        product_slug,
        universal_sku,
        slug_hash,
        tenant_id,
        original_sku
      }
    });

    res.status(201).json(registry);
  } catch (error) {
    console.error('[CatalogSlugs] Error registering slug:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to register slug' });
  }
});

/**
 * GET /api/catalog/slugs/:slug
 * Get slug registry entry by slug
 */
router.get('/:slug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const registry = await prisma.product_slug_registry.findFirst({
      where: { product_slug: slug }
    });

    if (!registry) {
      return res.status(404).json({ error: 'not_found', message: 'Slug not found in registry' });
    }

    res.json(registry);
  } catch (error) {
    console.error('[CatalogSlugs] Error fetching slug registry:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch slug registry' });
  }
});

/**
 * GET /api/catalog/slugs/upc/:upc
 * Get product by UPC from slug registry
 */
router.get('/upc/:upc', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { upc } = req.params;

    // First check global catalog
    const product = await prisma.global_product_catalog.findFirst({
      where: {
        gtin_upc: upc,
        status: 'active'
      }
    });

    if (product) {
      return res.json(product);
    }

    // Check slug registry for UPC match
    const registry = await prisma.product_slug_registry.findFirst({
      where: {
        original_sku: { endsWith: upc }
      }
    });

    if (!registry) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found by UPC' });
    }

    // Return registry entry
    res.json(registry);
  } catch (error) {
    console.error('[CatalogSlugs] Error fetching product by UPC:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch product by UPC' });
  }
});

/**
 * DELETE /api/catalog/slugs/:slug
 * Remove a slug from the registry (admin only)
 */
router.delete('/:slug', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const user = req.user;

    // Check if user is admin
    if (user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'forbidden', message: 'Admin access required' });
    }

    const deleted = await prisma.product_slug_registry.deleteMany({
      where: { product_slug: slug }
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Slug not found in registry' });
    }

    res.json({ success: true, deleted: deleted.count });
  } catch (error) {
    console.error('[CatalogSlugs] Error deleting slug:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete slug' });
  }
});

export default router;
