/**
 * Clone Routes
 * 
 * Provides endpoints for cloning products and categories to create variants
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireWritableSubscription } from '../middleware/tier-access';
import { generateItemId, generateProductCatId, generateQsCatId, generateQuickStartSku } from '../lib/id-generator';

const router = Router();

// Validation schemas
const cloneProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  newName: z.string().optional(),
  newSku: z.string().optional(),
  modifications: z.object({
    name: z.string().optional(),
    sku: z.string().optional(),
    price: z.number().optional(),
    priceCents: z.number().optional(),
    stock: z.number().optional(),
    quantity: z.number().optional(),
    brand: z.string().optional(),
    description: z.string().optional(),
    marketingDescription: z.string().optional(),
  }).optional(),
});

const cloneCategorySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  newName: z.string().min(1, 'New category name is required'),
  newSlug: z.string().optional(),
});

/**
 * POST /clone/product
 * Clone a product to create a variant
 */
router.post('/product', authenticateToken, requireWritableSubscription, async (req: Request, res: Response) => {
  try {
    const parsed = cloneProductSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        details: parsed.error.issues,
      });
    }

    const { productId, tenantId, modifications } = parsed.data;

    // Verify tenant access
    const userId = (req.user as any)?.userId;
    const userTenant = await prisma.user_tenants.findFirst({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!userTenant) {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'You do not have permission to clone products for this tenant',
      });
    }

    // Get the original product
    const originalProduct = await prisma.inventory_items.findFirst({
      where: {
        id: productId,
        tenant_id:tenantId,
      },
    });

    if (!originalProduct) {
      return res.status(404).json({
        success: false,
        error: 'product_not_found',
        message: 'Product not found',
      });
    }

    // Generate new SKU if not provided
    let newSku = modifications?.sku;
    if (!newSku) {
      // Auto-generate variant SKU
      const baseSku = originalProduct.sku || '';
      const timestamp = Date.now().toString().slice(-6);
      newSku = baseSku ? `${baseSku}-V${timestamp}` : generateQuickStartSku(Date.now());
    }

    // Check if SKU already exists
    const existingSku = await prisma.inventory_items.findFirst({
      where: {
        tenant_id: tenantId,
        sku: newSku,
      },
    });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        error: 'sku_exists',
        message: `SKU "${newSku}" already exists`,
      });
    }

    // Generate new name if not provided
    let newName = modifications?.name;
    if (!newName) {
      // Auto-generate variant name
      const variantSuffixes = ['Variant', 'Copy', 'V2', 'Alt', 'Plus'];
      const randomSuffix = variantSuffixes[Math.floor(Math.random() * variantSuffixes.length)];
      newName = `${originalProduct.name} ${randomSuffix}`;
    }

    // Create the cloned product
    const clonedProduct = await prisma.inventory_items.create({
      data: {
        id: generateItemId(),
        tenant_id: tenantId,
        sku: newSku,
        name: newName,
        title: modifications?.name || newName,
        description: modifications?.description || originalProduct.description,
        marketing_description: modifications?.marketingDescription || originalProduct.marketing_description,
        price: modifications?.price !== undefined ? modifications.price : originalProduct.price,
        price_cents: modifications?.priceCents !== undefined ? modifications.priceCents : originalProduct.price_cents,
        currency: originalProduct.currency,
        stock: modifications?.stock !== undefined ? modifications.stock : originalProduct.stock,
        quantity: modifications?.quantity !== undefined ? modifications.quantity : originalProduct.quantity,
        availability: originalProduct.availability,
        brand: modifications?.brand || originalProduct.brand,
        manufacturer: originalProduct.manufacturer,
        condition: originalProduct.condition,
        gtin: originalProduct.gtin,
        mpn: originalProduct.mpn,
        image_url: originalProduct.image_url,
        image_gallery: originalProduct.image_gallery,
        metadata: originalProduct.metadata as any,
        custom_cta: originalProduct.custom_cta as any,
        social_links: originalProduct.social_links as any,
        custom_branding: originalProduct.custom_branding as any,
        custom_sections: originalProduct.custom_sections as any,
        landing_page_theme: originalProduct.landing_page_theme,
        directory_category_id: originalProduct.directory_category_id,
        category_path: originalProduct.category_path,
        item_status: 'inactive', // Start as draft
        visibility: 'private', // Start as private
        updated_at: new Date(),
      },
    });

    console.log(`[Clone] Product cloned: ${originalProduct.name} -> ${newName} (${newSku}) for tenant ${tenantId}`);

    return res.status(201).json({
      success: true,
      product: clonedProduct,
      message: 'Product cloned successfully',
    });

  } catch (error: any) {
    console.error('[Clone Product] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error.message,
    });
  }
});

/**
 * POST /clone/category
 * Clone a category
 */
router.post('/category', authenticateToken, requireWritableSubscription, async (req: Request, res: Response) => {
  try {
    const parsed = cloneCategorySchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        details: parsed.error.issues,
      });
    }

    const { categoryId, tenantId, newName, newSlug } = parsed.data;

    // Verify tenant access
    const userId = (req.user as any)?.userId;
    const userTenant = await prisma.user_tenants.findFirst({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        role: { in: ['OWNER',   'ADMIN'] },
      },
    });

    if (!userTenant) {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'You do not have permission to clone categories for this tenant',
      });
    }

    // Get the original category
    const originalCategory = await prisma.directory_category.findFirst({
      where: {
        id: categoryId,
        tenantId: tenantId,
      },
    });

    if (!originalCategory) {
      return res.status(404).json({
        success: false,
        error: 'category_not_found',
        message: 'Category not found',
      });
    }

    // Generate slug if not provided
    const slug = newSlug || newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingSlug = await prisma.directory_category.findFirst({
      where: {
        tenantId: tenantId,
        slug,
      },
    });

    if (existingSlug) {
      return res.status(409).json({
        success: false,
        error: 'slug_exists',
        message: `Category with slug "${slug}" already exists`,
      });
    }

    // Create the cloned category
    const clonedCategory = await prisma.directory_category.create({
      data: {
        id: generateProductCatId(tenantId),
        tenantId: tenantId,
        name: newName,
        slug,
        googleCategoryId: originalCategory.googleCategoryId,
        parentId: originalCategory.parentId,
        sortOrder: originalCategory.sortOrder,
        isActive: false, // Start as inactive
        updatedAt: new Date(),
      },
    });

    console.log(`[Clone] Category cloned: ${originalCategory.name} -> ${newName} (${slug}) for tenant ${tenantId}`);

    return res.status(201).json({
      success: true,
      category: clonedCategory,
      message: 'Category cloned successfully',
    });

  } catch (error: any) {
    console.error('[Clone Category] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error.message,
    });
  }
});

export default router;
