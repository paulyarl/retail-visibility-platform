/**
 * Variant Service - UniversalSingleton Implementation
 * Handles all variant-related business logic with proper error handling, logging, and caching
 */

import { prisma } from '../prisma';
import { BaseService } from './BaseService';
import { logger } from '../logger';

export interface Variant {
  id: string;
  parent_item_id: string;
  tenant_id: string;
  sku: string;
  variant_name: string;
  price_cents?: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  attributes: Record<string, string>;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVariantDto {
  sku: string;
  variant_name: string;
  price_cents?: number;
  sale_price_cents?: number;
  stock?: number;
  image_url?: string;
  attributes?: Record<string, string>;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateVariantDto {
  sku?: string;
  variant_name?: string;
  price_cents?: number;
  sale_price_cents?: number;
  stock?: number;
  image_url?: string;
  attributes?: Record<string, string>;
  sort_order?: number;
  is_active?: boolean;
}

export interface VariantWithParent extends Variant {
  parent_item: {
    id: string;
    name: string;
    sku: string;
    has_variants: boolean;
  };
}

export class VariantService extends BaseService {
  private static instance: VariantService;
  
  private constructor() {
    super();
  }

  static getInstance(): VariantService {
    if (!VariantService.instance) {
      VariantService.instance = new VariantService();
    }
    return VariantService.instance;
  }

  /**
   * Get all variants for a parent item
   */
  async getVariants(parentItemId: string): Promise<Variant[]> {
    try {
      const variants = await this.prisma.product_variants.findMany({
        where: { parent_item_id: parentItemId },
        orderBy: { sort_order: 'asc' }
      });

      logger.info(`Retrieved ${variants.length} variants for parent ${parentItemId}`);
      return variants as VariantWithParent[];
    } catch (error) {
      logger.error('Failed to get variants: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve variants for item ${parentItemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single variant by ID
   */
  async getVariantById(variantId: string): Promise<Variant | null> {
    try {
      const variant = await this.prisma.product_variants.findUnique({
        where: { id: variantId }
      });

      if (!variant) {
        logger.warn(`Variant not found: ${variantId}`);
        return null;
      }

      logger.info(`Retrieved variant: ${variantId}`);
      return variant as VariantWithParent;
    } catch (error) {
      logger.error('Failed to get variant by ID: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve variant ${variantId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new variant
   */
  async createVariant(parentItemId: string, data: CreateVariantDto): Promise<Variant> {
    try {
      // Verify parent item exists
      const parentItem = await this.prisma.inventory_items.findUnique({
        where: { id: parentItemId },
        select: { tenant_id: true, has_variants: true }
      });

      if (!parentItem) {
        throw new Error(`Parent item not found: ${parentItemId}`);
      }

      // Check for duplicate SKU only if SKU is provided (not empty)
      if (data.sku && data.sku.trim() !== '') {
        const existingSku = await this.prisma.product_variants.findFirst({
          where: {
            tenant_id: parentItem.tenant_id,
            sku: data.sku,
          }
        });

        if (existingSku) {
          throw new Error(`SKU already exists: ${data.sku}`);
        }
      }

      // Generate variant ID
      const variantId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Auto-generate SKU if not provided
      let sku = data.sku;
      if (!sku || sku.trim() === '') {
        // Get parent item SKU for generating variant SKU
        const parentItemData = await this.prisma.inventory_items.findUnique({
          where: { id: parentItemId },
          select: { sku: true, product_type: true }
        });
        
        if (parentItemData) {
          const { generateVariantSkuFromParent } = await import('../lib/id-generator');
          // Get count of existing variants to use as index
          const existingVariantsCount = await this.prisma.product_variants.count({
            where: { parent_item_id: parentItemId }
          });
          sku = generateVariantSkuFromParent(parentItemData.sku, existingVariantsCount, parentItemData.product_type as any);
        } else {
          sku = `VAR-${variantId}`;
        }
      }

      // Create variant
      const variant = await this.prisma.product_variants.create({
        data: {
          id: variantId,
          parent_item_id: parentItemId,
          tenant_id: parentItem.tenant_id,
          sku,
          variant_name: data.variant_name,
          price_cents: data.price_cents,
          stock: data.stock,
          sale_price_cents: data.sale_price_cents,
          image_url: data.image_url,
          attributes: data.attributes || {},
          sort_order: data.sort_order ?? 0,
          is_active: data.is_active ?? true,
        },
      });

      // Update parent item to mark it has variants if this is the first variant
      if (!parentItem.has_variants) {
        await this.prisma.inventory_items.update({
          where: { id: parentItemId },
          data: { has_variants: true },
        });
      }

      logger.info(`Created variant: ${variantId} for parent ${parentItemId}`);
      return variant as Variant;
    } catch (error) {
      logger.error('Failed to create variant: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to create variant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create multiple variants at once
   */
  async createVariantsBulk(parentItemId: string, variantsData: CreateVariantDto[]): Promise<{ count: number; variants: Variant[] }> {
    try {
      // Verify parent item exists
      const parentItem = await this.prisma.inventory_items.findUnique({
        where: { id: parentItemId },
        select: { tenant_id: true }
      });

      if (!parentItem) {
        throw new Error(`Parent item not found: ${parentItemId}`);
      }

      // Validate all variants
      const validatedVariants = [];
      for (const variantData of variantsData) {
        // Check for duplicate SKUs
        const existingSku = await this.prisma.product_variants.findFirst({
          where: {
            tenant_id: parentItem.tenant_id,
            sku: variantData.sku,
          },
        });

        if (existingSku) {
          throw new Error(`Duplicate SKU: ${variantData.sku}`);
        }

        validatedVariants.push({
          id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          parent_item_id: parentItemId,
          tenant_id: parentItem.tenant_id,
          ...variantData,
          attributes: variantData.attributes || {},
          sort_order: variantData.sort_order ?? 0,
          is_active: variantData.is_active ?? true,
        });
      }

      // Create all variants
      const created = await this.prisma.product_variants.createMany({
        data: validatedVariants,
      });

      // Update parent item to mark it has variants
      await this.prisma.inventory_items.update({
        where: { id: parentItemId },
        data: { has_variants: true },
      });

      logger.info(`Created ${created.count} variants for parent ${parentItemId}`);
      return { count: created.count, variants: [] }; // Bulk create doesn't return the created items
    } catch (error) {
      logger.error('Failed to create variants in bulk: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to create variants in bulk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a variant
   */
  async updateVariant(variantId: string, data: UpdateVariantDto): Promise<Variant> {
    try {
      // Verify variant exists
      const existing = await this.prisma.product_variants.findUnique({
        where: { id: variantId },
        select: { tenant_id: true, sku: true }
      });

      if (!existing) {
        throw new Error(`Variant not found: ${variantId}`);
      }

      // If SKU is being changed, check for duplicates
      if (data.sku && data.sku !== existing.sku) {
        const duplicate = await this.prisma.product_variants.findFirst({
          where: {
            tenant_id: existing.tenant_id,
            sku: data.sku,
            id: { not: variantId },
          },
        });

        if (duplicate) {
          throw new Error(`SKU already exists: ${data.sku}`);
        }
      }

      // Update variant
      const updated = await this.prisma.product_variants.update({
        where: { id: variantId },
        data: {
          ...data,
          attributes: data.attributes ? (data.attributes as any) : undefined,
          updated_at: new Date(),
        },
      });

      logger.info(`Updated variant: ${variantId}`);
      return updated as Variant;
    } catch (error) {
      logger.error('Failed to update variant: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to update variant ${variantId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a variant
   */
  async deleteVariant(variantId: string): Promise<void> {
    try {
      // Verify variant exists
      const existing = await this.prisma.product_variants.findUnique({
        where: { id: variantId },
        select: { parent_item_id: true }
      });

      if (!existing) {
        throw new Error(`Variant not found: ${variantId}`);
      }

      // Delete variant
      await this.prisma.product_variants.delete({
        where: { id: variantId },
      });

      // Check if parent still has variants
      const remainingVariants = await this.prisma.product_variants.count({
        where: { parent_item_id: existing.parent_item_id },
      });

      // If no variants left, update parent item
      if (remainingVariants === 0) {
        await this.prisma.inventory_items.update({
          where: { id: existing.parent_item_id },
          data: { has_variants: false },
        });
      }

      logger.info(`Deleted variant: ${variantId}`);
    } catch (error) {
      logger.error('Failed to delete variant: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to delete variant ${variantId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete all variants for a parent item
   */
  async deleteAllVariants(parentItemId: string): Promise<{ count: number }> {
    try {
      // Verify parent item exists
      const item = await this.prisma.inventory_items.findUnique({
        where: { id: parentItemId },
        select: { id: true }
      });

      if (!item) {
        throw new Error(`Parent item not found: ${parentItemId}`);
      }

      // Delete all variants
      const deleted = await this.prisma.product_variants.deleteMany({
        where: { parent_item_id: parentItemId },
      });

      // Update parent item
      await this.prisma.inventory_items.update({
        where: { id: parentItemId },
        data: { has_variants: false },
      });

      logger.info(`Deleted ${deleted.count} variants for parent ${parentItemId}`);
      return { count: deleted.count };
    } catch (error) {
      logger.error('Failed to delete all variants: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to delete all variants for ${parentItemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get variant statistics
   */
  async getVariantStats(tenantId?: string): Promise<{
    totalVariants: number;
    activeVariants: number;
    parentItemsWithVariants: number;
    averageVariantsPerParent: number;
  }> {
    try {
      const whereClause = tenantId ? { tenant_id: tenantId } : {};
      
      const [totalVariants, activeVariants, parentItemsWithVariants] = await Promise.all([
        this.prisma.product_variants.count({ where: whereClause }),
        this.prisma.product_variants.count({ where: { ...whereClause, is_active: true } }),
        this.prisma.inventory_items.count({ where: { ...whereClause, has_variants: true } }),
      ]);

      const averageVariantsPerParent = parentItemsWithVariants > 0 ? totalVariants / parentItemsWithVariants : 0;

      return {
        totalVariants,
        activeVariants,
        parentItemsWithVariants,
        averageVariantsPerParent: Math.round(averageVariantsPerParent * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get variant statistics: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error('Failed to retrieve variant statistics: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Search variants by SKU or name
   */
  async searchVariants(tenantId: string, query: string, limit: number = 50): Promise<Variant[]> {
    try {
      const variants = await this.prisma.product_variants.findMany({
        where: {
          tenant_id: tenantId,
          OR: [
            { sku: { contains: query, mode: 'insensitive' } },
            { variant_name: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { variant_name: 'asc' },
        take: limit
      });

      return variants as VariantWithParent[];
    } catch (error) {
      logger.error('Failed to search variants: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to search variants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
