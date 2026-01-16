import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Helper to generate variant ID
function generateVariantId(): string {
  return `var-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Validation schema for variant
const variantSchema = z.object({
  sku: z.string().min(1),
  variant_name: z.string().min(1),
  price_cents: z.number().int().nonnegative().optional(),
  sale_price_cents: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  image_url: z.string().url().optional().nullable(),
  attributes: z.record(z.string(), z.string()).default({}),
  sort_order: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
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
    const variant = await prisma.product_variants.create({
      data: {
        id: generateVariantId(),
        parent_item_id: itemId,
        tenant_id: item.tenant_id,
        ...parsed.data,
        attributes: parsed.data.attributes as any,
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

    // Check for duplicate SKUs
    const skus = validatedVariants.map(v => v.sku);
    const existingSkus = await prisma.product_variants.findMany({
      where: {
        tenant_id: item.tenant_id,
        sku: { in: skus },
      },
      select: { sku: true },
    });

    if (existingSkus.length > 0) {
      return res.status(409).json({ 
        error: 'Duplicate SKUs found', 
        skus: existingSkus.map(s => s.sku) 
      });
    }

    // Create all variants
    const created = await prisma.product_variants.createMany({
      data: validatedVariants.map(v => ({
        id: generateVariantId(),
        parent_item_id: itemId,
        tenant_id: item.tenant_id,
        ...v,
        attributes: v.attributes as any,
      })),
    });

    // Update parent item to mark it has variants
    await prisma.inventory_items.update({
      where: { id: itemId },
      data: { has_variants: true },
    });

    res.status(201).json({ 
      message: `Created ${created.count} variants`,
      count: created.count 
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
