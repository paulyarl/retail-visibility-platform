import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { generateVariantId, generateVariantSkuFromParent } from '../lib/id-generator';

const router = Router();

// Validation schema for variant
const variantSchema = z.object({
  sku: z.string().optional(), // Allow empty SKUs for auto-generation
  variant_name: z.string().min(1).optional(),
  name: z.string().min(1).optional(), // Accept both 'name' and 'variant_name'
  price_cents: z.number().int().nonnegative().optional(),
  sale_price_cents: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  image_url: z.string().url().optional().nullable(),
  attributes: z.record(z.string(), z.string()).default({}),
  sort_order: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
}).refine((data) => data.variant_name || data.name, {
  message: "Either 'name' or 'variant_name' must be provided"
});

/**
 * GET /api/items/:itemId/variants
 * Get all variants for a parent item
 */
router.get('/items/:itemId/variants', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    // Verify item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get all variants for this item
    const variants = await prisma.product_variants.findMany({
      where: { parent_item_id: itemId },
      orderBy: { sort_order: 'asc' },
    });

    res.json({ variants });
  } catch (error: any) {
    console.error('[GET /items/:itemId/variants] Error:', error);
    res.status(500).json({ error: 'Failed to fetch variants', message: error.message });
  }
});

/**
 * POST /api/items/:itemId/variants
 * Create a new variant for an item
 */
router.post('/items/:itemId/variants', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    // Verify item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true, has_variants: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Validate request body
    const parsed = variantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid variant data', 
        details: parsed.error.flatten() 
      });
    }

    // Check for duplicate SKU
    const existingSku = await prisma.product_variants.findFirst({
      where: {
        tenant_id: item.tenant_id,
        sku: parsed.data.sku,
      },
    });

    if (existingSku) {
      return res.status(409).json({ error: 'SKU already exists' });
    }

    // Create variant
    // Ensure variant_name and sku are always strings
    const variantName = parsed.data.variant_name || parsed.data.name || `Variant 1`;
    let sku = parsed.data.sku;
    if (!sku || sku.trim() === '') {
      sku = generateVariantSkuFromParent(itemId, 0);
    }

    const variant = await prisma.product_variants.create({
      data: {
        id: generateVariantId(itemId),
        parent_item_id: itemId,
        tenant_id: item.tenant_id,
        variant_name: variantName,
        sku: sku,
        price_cents: parsed.data.price_cents || 0,
        sale_price_cents: parsed.data.sale_price_cents || null,
        stock: parsed.data.stock || 0,
        image_url: parsed.data.image_url || null,
        attributes: parsed.data.attributes as any || {},
        sort_order: parsed.data.sort_order || 0,
        is_active: parsed.data.is_active !== false,
      },
    });

    // Update parent item to mark it has variants
    if (!item.has_variants) {
      await prisma.inventory_items.update({
        where: { id: itemId },
        data: { has_variants: true },
      });
    }

    res.status(201).json({ variant });
  } catch (error: any) {
    console.error('[POST /items/:itemId/variants] Error:', error);
    res.status(500).json({ error: 'Failed to create variant', message: error.message });
  }
});

/**
 * POST /api/items/:itemId/variants/bulk
 * Create multiple variants at once
 */
router.post('/items/:itemId/variants/bulk', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { variants } = req.body;

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'Variants array is required' });
    }

    // Verify item exists and user has access
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { tenant_id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Validate all variants
    const validatedVariants = [];
    for (const variant of variants) {
      const parsed = variantSchema.safeParse(variant);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid variant data', 
          details: parsed.error.flatten() 
        });
      }
      validatedVariants.push(parsed.data);
    }

    // Generate SKUs first, then check for duplicates
    const variantsWithSkus = validatedVariants.map((v, index) => {
      const variantName = v.variant_name || v.name || `Variant ${index + 1}`;
      let sku = v.sku;
      if (!sku || sku.trim() === '') {
        sku = generateVariantSkuFromParent(itemId, index);
      }
      return { ...v, variant_name: variantName, sku };
    });

    // Check for duplicate SKUs (only if provided manually)
    const manualSkus = variantsWithSkus.filter(v => v.sku && v.sku.trim() !== '').map(v => v.sku);
    if (manualSkus.length > 0) {
      const existingSkus = await prisma.product_variants.findMany({
        where: {
          tenant_id: item.tenant_id,
          sku: { in: manualSkus },
        },
        select: { sku: true },
      });

      if (existingSkus.length > 0) {
        return res.status(409).json({ 
          error: 'Duplicate SKUs found', 
          skus: existingSkus.map(s => s.sku) 
        });
      }
    }

    // Create all variants
    const created = await prisma.product_variants.createMany({
      data: variantsWithSkus.map((v, index) => ({
        id: generateVariantId(itemId),
        parent_item_id: itemId,
        tenant_id: item.tenant_id,
        variant_name: v.variant_name,
        sku: v.sku,
        price_cents: v.price_cents || 0,
        sale_price_cents: v.sale_price_cents || null,
        stock: v.stock || 0,
        image_url: v.image_url || null,
        attributes: v.attributes as any || {},
        sort_order: v.sort_order || index,
        is_active: v.is_active !== false,
      })),
    });

    // Fetch the created variants to return them with IDs and generated SKUs
    const createdVariants = await prisma.product_variants.findMany({
      where: {
        parent_item_id: itemId,
        tenant_id: item.tenant_id,
        sku: { in: variantsWithSkus.map(v => v.sku) }
      },
      orderBy: { created_at: 'desc' },
      take: created.count
    });

    // Update parent item to mark it has variants
    await prisma.inventory_items.update({
      where: { id: itemId },
      data: { has_variants: true },
    });

    res.status(201).json({ 
      message: `Created ${created.count} variants`,
      count: created.count,
      variants: createdVariants // Return the created variants with IDs and SKUs
    });
  } catch (error: any) {
    console.error('[POST /items/:itemId/variants/bulk] Error:', error);
    res.status(500).json({ error: 'Failed to create variants', message: error.message });
  }
});

/**
 * PUT /api/variants/:variantId
 * Update a variant
 */
router.put('/variants/:variantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;

    // Verify variant exists
    const existing = await prisma.product_variants.findUnique({
      where: { id: variantId },
      select: { tenant_id: true, sku: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Validate request body (partial update)
    const parsed = variantSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid variant data', 
        details: parsed.error.flatten() 
      });
    }

    // If SKU is being changed, check for duplicates
    if (parsed.data.sku && parsed.data.sku !== existing.sku) {
      const duplicate = await prisma.product_variants.findFirst({
        where: {
          tenant_id: existing.tenant_id,
          sku: parsed.data.sku,
          id: { not: variantId },
        },
      });

      if (duplicate) {
        return res.status(409).json({ error: 'SKU already exists' });
      }
    }

    // Update variant
    const updated = await prisma.product_variants.update({
      where: { id: variantId },
      data: {
        ...parsed.data,
        attributes: parsed.data.attributes ? (parsed.data.attributes as any) : undefined,
        updated_at: new Date(),
      },
    });

    res.json({ variant: updated });
  } catch (error: any) {
    console.error('[PUT /variants/:variantId] Error:', error);
    res.status(500).json({ error: 'Failed to update variant', message: error.message });
  }
});

/**
 * DELETE /api/variants/:variantId
 * Delete a variant
 */
router.delete('/variants/:variantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;

    // Verify variant exists
    const existing = await prisma.product_variants.findUnique({
      where: { id: variantId },
      select: { parent_item_id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Delete variant
    await prisma.product_variants.delete({
      where: { id: variantId },
    });

    // Check if parent still has variants
    const remainingVariants = await prisma.product_variants.count({
      where: { parent_item_id: existing.parent_item_id },
    });

    // If no variants left, update parent item
    if (remainingVariants === 0) {
      await prisma.inventory_items.update({
        where: { id: existing.parent_item_id },
        data: { has_variants: false },
      });
    }

    res.json({ message: 'Variant deleted successfully' });
  } catch (error: any) {
    console.error('[DELETE /variants/:variantId] Error:', error);
    res.status(500).json({ error: 'Failed to delete variant', message: error.message });
  }
});

/**
 * DELETE /api/items/:itemId/variants
 * Delete all variants for an item
 */
router.delete('/items/:itemId/variants', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    // Verify item exists
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { id: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete all variants
    const deleted = await prisma.product_variants.deleteMany({
      where: { parent_item_id: itemId },
    });

    // Update parent item
    await prisma.inventory_items.update({
      where: { id: itemId },
      data: { has_variants: false },
    });

    res.json({ 
      message: `Deleted ${deleted.count} variants`,
      count: deleted.count 
    });
  } catch (error: any) {
    console.error('[DELETE /items/:itemId/variants] Error:', error);
    res.status(500).json({ error: 'Failed to delete variants', message: error.message });
  }
});

export default router;
