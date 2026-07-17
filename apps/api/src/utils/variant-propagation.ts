/**
 * Variant Propagation Utility
 * 
 * Provides standardized variant propagation functionality for all propagation methods
 * Ensures variants are properly copied to target tenants with proper SKU generation
 * and category handling
 */

import { prisma } from '../prisma';
import { generateProductCatId,generateTenantVariantId } from '../lib/id-generator';
import { customAlphabet } from 'nanoid';
import { logger } from '../logger';

// Generate variant ID function
// function generateVariantId(parentItemId: string): string {
//   const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
//   return `vid-${parentItemId}-${nanoid()}`;
// }

export interface VariantPropagationResult {
  created: number;
  updated: number;
  errors: Array<{ variantId?: string; error: string }>;
}

/**
 * Ensure a directory category exists for a target tenant
 * If the source item has a category, check if it exists for the target tenant
 * If not, create it based on the source category
 */
async function ensureCategoryForVariantTargetTenant(
  sourceCategoryId: string | null,
  targetTenantId: string
): Promise<string | null> {
  if (!sourceCategoryId) return null;
  
  // Check if category exists for target tenant
  const existingCategory = await prisma.directory_category.findFirst({
    where: {
      id: sourceCategoryId,
      tenantId: targetTenantId,
      isActive: true
    },
    select: { id: true, name: true, slug: true, googleCategoryId: true }
  });
  
  if (existingCategory) {
    return existingCategory.id;
  }
  
  // Get source category details
  const sourceCategory = await prisma.directory_category.findFirst({
    where: { id: sourceCategoryId },
    select: { id: true, name: true, slug: true, googleCategoryId: true }
  });
  
  if (!sourceCategory) {
    return null;
  }
  
  // Create category for target tenant
  const newCategory = await prisma.directory_category.create({
    data: {
      id: generateProductCatId(targetTenantId),
      tenantId: targetTenantId,
      name: sourceCategory.name,
      slug: sourceCategory.slug,
      googleCategoryId: sourceCategory.googleCategoryId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  });
  
  return newCategory.id;
}

/**
 * Propagate variants from a source item to a target tenant
 * 
 * @param sourceItemId - The ID of the source item
 * @param targetTenantId - The ID of the target tenant
 * @param newItemId - The ID of the newly created target item (for create operations)
 * @param existingItemId - The ID of existing target item (for update operations)
 * @param sourceCategoryId - The source item's category ID
 * @param mode - 'create' for new items, 'update' for existing items
 * @returns Promise<VariantPropagationResult>
 */
export async function propagateVariants(
  sourceItemId: string,
  targetTenantId: string,
  newItemId?: string,
  existingItemId?: string,
  sourceCategoryId?: string | null,
  mode: 'create' | 'update' = 'create'
): Promise<VariantPropagationResult> {
  const result: VariantPropagationResult = {
    created: 0,
    updated: 0,
    errors: []
  };

  try {
    console.log(`[Variant Propagation] Starting: source=${sourceItemId}, target=${targetTenantId}, mode=${mode}`);
    
    // Get source variants
    const sourceVariants = await prisma.product_variants.findMany({
      where: { parent_item_id: sourceItemId },
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'asc' }
      ]
    });

    console.log(`[Variant Propagation] Found ${sourceVariants.length} source variants`);

    if (sourceVariants.length === 0) {
      return result; // No variants to propagate
    }

    // Ensure category exists for target tenant
    const targetCategoryId = await ensureCategoryForVariantTargetTenant(sourceCategoryId || null, targetTenantId);

    // Delete existing variants if in update mode
    if (mode === 'update' && existingItemId) {
      await prisma.product_variants.deleteMany({
        where: { parent_item_id: existingItemId }
      });
    }

    // Create variants for target item
    const targetItemId = newItemId || existingItemId;
    if (!targetItemId) {
      throw new Error('Target item ID is required for variant propagation');
    }

    console.log(`[Variant Propagation] Target item ID: ${targetItemId}`);

    const variantData = sourceVariants.map((variant, index) => {
      const variantId = generateTenantVariantId(targetItemId, targetTenantId);
      console.log(`[Variant Propagation] Creating variant ${index + 1}/${sourceVariants.length}: ${variantId} -> parent: ${targetItemId}`);
      
      return {
        id: variantId,
        parent_item_id: targetItemId,
        tenant_id: targetTenantId,
        variant_name: variant.variant_name,
        sku: variant.sku, // Keep original SKU for consistency
        price_cents: variant.price_cents,
        sale_price_cents: variant.sale_price_cents || null,
        stock: variant.stock,
        attributes: variant.attributes as any,
        is_active: variant.is_active,
        sort_order: variant.sort_order,
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

    await prisma.product_variants.createMany({
      data: variantData
    });

    console.log(`[Variant Propagation] Created ${variantData.length} variants for target ${targetItemId}`);
    
    // Verify the variants were created correctly
    const createdVariants = await prisma.product_variants.findMany({
      where: { 
        parent_item_id: targetItemId,
        tenant_id: targetTenantId 
      },
      select: {
        id: true,
        parent_item_id: true,
        tenant_id: true,
        variant_name: true,
        sku: true
      }
    });

    console.log(`[Variant Propagation] Verification: Found ${createdVariants.length} variants with correct parent relationship`);
    createdVariants.forEach(v => {
      console.log(`  - ${v.id}: parent=${v.parent_item_id}, tenant=${v.tenant_id}, sku=${v.sku}`);
    });

    result.created = variantData.length;

  } catch (error: any) {
    logger.error('[Variant Propagation] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    result.errors.push({ error: error.message });
  }

  return result;
}

/**
 * Check if an item has variants
 * 
 * @param itemId - The item ID to check
 * @returns Promise<boolean>
 */
export async function itemHasVariants(itemId: string): Promise<boolean> {
  const variantCount = await prisma.product_variants.count({
    where: { parent_item_id: itemId }
  });
  return variantCount > 0;
}

/**
 * Get all variants for an item
 * 
 * @param itemId - The item ID
 * @returns Promise<Array of variants>
 */
export async function getItemVariants(itemId: string) {
  return await prisma.product_variants.findMany({
    where: { parent_item_id: itemId },
    orderBy: [
      { sort_order: 'asc' },
      { created_at: 'asc' }
    ]
  });
}
