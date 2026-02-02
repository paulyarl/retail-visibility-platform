/**
 * Variant Bulk Operations Service - UniversalSingleton Implementation
 * Handles bulk operations for variants with proper error handling and logging
 */

import { BaseService } from './BaseService';
import { VariantService, CreateVariantDto, UpdateVariantDto } from './VariantService';
import { logger } from '../logger';

export interface BulkPricingUpdate {
  variant_ids: string[];
  price_cents?: number;
  sale_price_cents?: number;
  apply_sale_to_all?: boolean;
}

export interface BulkStockUpdate {
  variant_ids: string[];
  stock: number;
  operation: 'set' | 'add' | 'subtract';
}

export interface BulkActivationUpdate {
  variant_ids: string[];
  is_active: boolean;
}

export interface BulkFeaturedTypeUpdate {
  variant_ids: string[];
  featured_type?: string;
  featured_priority?: number;
  featured_expires_at?: Date;
  auto_unfeature?: boolean;
}

export interface BulkOperationResult {
  success_count: number;
  error_count: number;
  errors: Array<{
    variant_id: string;
    error: string;
  }>;
  details?: any;
}

export class VariantBulkOperationsService extends BaseService {
  private static instance: VariantBulkOperationsService;
  private variantService: VariantService;
  
  private constructor() {
    super();
    this.variantService = VariantService.getInstance();
  }

  static getInstance(): VariantBulkOperationsService {
    if (!VariantBulkOperationsService.instance) {
      VariantBulkOperationsService.instance = new VariantBulkOperationsService();
    }
    return VariantBulkOperationsService.instance;
  }

  /**
   * Bulk update pricing for multiple variants
   */
  async bulkUpdatePricing(update: BulkPricingUpdate): Promise<BulkOperationResult> {
    try {
      const { variant_ids, price_cents, sale_price_cents, apply_sale_to_all } = update;
      
      let success_count = 0;
      let error_count = 0;
      const errors: Array<{ variant_id: string; error: string }> = [];

      logger.info(`Starting bulk pricing update for ${variant_ids.length} variants`);

      for (const variant_id of variant_ids) {
        try {
          const updateData: UpdateVariantDto = {};
          
          if (price_cents !== undefined) {
            updateData.price_cents = price_cents;
          }
          
          if (sale_price_cents !== undefined) {
            updateData.sale_price_cents = sale_price_cents;
          } else if (apply_sale_to_all && price_cents) {
            // If applying sale to all and no specific sale price, set 10% discount
            updateData.sale_price_cents = Math.round(price_cents * 0.9);
          }

          await this.variantService.updateVariant(variant_id, updateData);
          success_count++;
        } catch (error) {
          error_count++;
          errors.push({
            variant_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to update pricing for variant ${variant_id}: ` + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
        }
      }

      const result = {
        success_count,
        error_count,
        errors,
        details: {
          price_cents,
          sale_price_cents,
          apply_sale_to_all
        }
      };

      logger.info(`Bulk pricing update completed: ${success_count} success, ${error_count} errors`);
      return result;
    } catch (error) {
      logger.error('Failed to perform bulk pricing update: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Bulk pricing update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update stock for multiple variants
   */
  async bulkUpdateStock(update: BulkStockUpdate): Promise<BulkOperationResult> {
    try {
      const { variant_ids, stock, operation } = update;
      
      let success_count = 0;
      let error_count = 0;
      const errors: Array<{ variant_id: string; error: string }> = [];

      logger.info(`Starting bulk stock update for ${variant_ids.length} variants (${operation} ${stock})`);

      for (const variant_id of variant_ids) {
        try {
          // Get current stock first
          const currentVariant = await this.variantService.getVariantById(variant_id);
          if (!currentVariant) {
            throw new Error('Variant not found');
          }

          let newStock: number;
          
          switch (operation) {
            case 'set':
              newStock = stock;
              break;
            case 'add':
              newStock = currentVariant.stock + stock;
              break;
            case 'subtract':
              newStock = Math.max(0, currentVariant.stock - stock);
              break;
            default:
              throw new Error(`Invalid operation: ${operation}`);
          }

          await this.variantService.updateVariant(variant_id, { stock: newStock });
          success_count++;
        } catch (error) {
          error_count++;
          errors.push({
            variant_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to update stock for variant ${variant_id}: ` + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
        }
      }

      const result = {
        success_count,
        error_count,
        errors,
        details: {
          stock,
          operation
        }
      };

      logger.info(`Bulk stock update completed: ${success_count} success, ${error_count} errors`);
      return result;
    } catch (error) {
      logger.error('Failed to perform bulk stock update: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Bulk stock update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk activation/deactivation for multiple variants
   */
  async bulkUpdateActivation(update: BulkActivationUpdate): Promise<BulkOperationResult> {
    try {
      const { variant_ids, is_active } = update;
      
      let success_count = 0;
      let error_count = 0;
      const errors: Array<{ variant_id: string; error: string }> = [];

      logger.info(`Starting bulk activation update for ${variant_ids.length} variants (${is_active ? 'activate' : 'deactivate'})`);

      for (const variant_id of variant_ids) {
        try {
          await this.variantService.updateVariant(variant_id, { is_active });
          success_count++;
        } catch (error) {
          error_count++;
          errors.push({
            variant_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to update activation for variant ${variant_id}: ` + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
        }
      }

      const result = {
        success_count,
        error_count,
        errors,
        details: {
          is_active
        }
      };

      logger.info(`Bulk activation update completed: ${success_count} success, ${error_count} errors`);
      return result;
    } catch (error) {
      logger.error('Failed to perform bulk activation update: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Bulk activation update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk create variants for a parent product
   */
  async bulkCreateVariants(parentItemId: string, variantsData: CreateVariantDto[]): Promise<BulkOperationResult> {
    try {
      logger.info(`Starting bulk variant creation for parent ${parentItemId} (${variantsData.length} variants)`);

      const result = await this.variantService.createVariantsBulk(parentItemId, variantsData);

      const bulkResult = {
        success_count: result.count,
        error_count: 0,
        errors: [],
        details: {
          parent_item_id: parentItemId,
          variants_created: result.count
        }
      };

      logger.info(`Bulk variant creation completed: ${result.count} variants created`);
      return bulkResult;
    } catch (error) {
      logger.error('Failed to perform bulk variant creation: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Bulk variant creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk delete variants
   */
  async bulkDeleteVariants(variant_ids: string[]): Promise<BulkOperationResult> {
    try {
      let success_count = 0;
      let error_count = 0;
      const errors: Array<{ variant_id: string; error: string }> = [];

      logger.info(`Starting bulk variant deletion for ${variant_ids.length} variants`);

      for (const variant_id of variant_ids) {
        try {
          await this.variantService.deleteVariant(variant_id);
          success_count++;
        } catch (error) {
          error_count++;
          errors.push({
            variant_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to delete variant ${variant_id}: ` + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
        }
      }

      const result = {
        success_count,
        error_count,
        errors,
        details: {
          deleted_variants: variant_ids
        }
      };

      logger.info(`Bulk variant deletion completed: ${success_count} success, ${error_count} errors`);
      return result;
    } catch (error) {
      logger.error('Failed to perform bulk variant deletion: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Bulk variant deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update variant attributes
   */
  async bulkUpdateAttributes(variant_ids: string[], attributes: Record<string, string>): Promise<BulkOperationResult> {
    try {
      let success_count = 0;
      let error_count = 0;
      const errors: Array<{ variant_id: string; error: string }> = [];

      logger.info(`Starting bulk attribute update for ${variant_ids.length} variants`);

      for (const variant_id of variant_ids) {
        try {
          // Get current variant to merge attributes
          const currentVariant = await this.variantService.getVariantById(variant_id);
          if (!currentVariant) {
            throw new Error('Variant not found');
          }

          const mergedAttributes = { ...currentVariant.attributes, ...attributes };
          
          await this.variantService.updateVariant(variant_id, { attributes: mergedAttributes });
          success_count++;
        } catch (error) {
          error_count++;
          errors.push({
            variant_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to update attributes for variant ${variant_id}: ` + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
        }
      }

      const result = {
        success_count,
        error_count,
        errors,
        details: {
          attributes,
          updated_variants: variant_ids
        }
      };

      logger.info(`Bulk attribute update completed: ${success_count} success, ${error_count} errors`);
      return result;
    } catch (error) {
      logger.error('Failed to perform bulk attribute update: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Bulk attribute update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update variant sort order
   */
  async bulkUpdateSortOrder(variant_orders: Array<{ variant_id: string; sort_order: number }>): Promise<BulkOperationResult> {
    try {
      let success_count = 0;
      let error_count = 0;
      const errors: Array<{ variant_id: string; error: string }> = [];

      logger.info(`Starting bulk sort order update for ${variant_orders.length} variants`);

      for (const { variant_id, sort_order } of variant_orders) {
        try {
          await this.variantService.updateVariant(variant_id, { sort_order });
          success_count++;
        } catch (error) {
          error_count++;
          errors.push({
            variant_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to update sort order for variant ${variant_id}: ` + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
        }
      }

      const result = {
        success_count,
        error_count,
        errors,
        details: {
          variant_orders
        }
      };

      logger.info(`Bulk sort order update completed: ${success_count} success, ${error_count} errors`);
      return result;
    } catch (error) {
      logger.error('Failed to perform bulk sort order update: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Bulk sort order update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get bulk operation statistics
   */
  async getBulkOperationStats(tenantId: string): Promise<{
    total_variants: number;
    active_variants: number;
    variants_on_sale: number;
    average_price: number;
    average_stock: number;
    parent_products_with_variants: number;
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_variants,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_variants,
          COUNT(CASE WHEN sale_price_cents IS NOT NULL AND sale_price_cents > 0 AND sale_price_cents < price_cents THEN 1 END) as variants_on_sale,
          AVG(price_cents) as average_price,
          AVG(stock) as average_stock
        FROM product_variants
        WHERE tenant_id = $1
      `;

      const stats = await this.query(statsQuery, [tenantId]);
      const statsData = stats[0] || {};

      // Get parent products count
      const parentProductsQuery = `
        SELECT COUNT(DISTINCT parent_item_id) as parent_products_count
        FROM product_variants
        WHERE tenant_id = $1
          AND is_active = true
      `;

      const parentResult = await this.query(parentProductsQuery, [tenantId]);
      const parent_products_with_variants = parseInt(parentResult[0]?.parent_products_count || '0');

      return {
        total_variants: parseInt(statsData.total_variants || '0'),
        active_variants: parseInt(statsData.active_variants || '0'),
        variants_on_sale: parseInt(statsData.variants_on_sale || '0'),
        average_price: parseFloat(statsData.average_price || '0'),
        average_stock: parseFloat(statsData.average_stock || '0'),
        parent_products_with_variants
      };
    } catch (error) {
      logger.error('Failed to get bulk operation statistics: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
      throw new Error(`Failed to retrieve bulk operation statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate bulk operation data
   */
  private validateBulkOperation(variant_ids: string[]): void {
    if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
      throw new Error('Variant IDs array is required and cannot be empty');
    }

    if (variant_ids.length > 1000) {
      throw new Error('Cannot process more than 1000 variants in a single bulk operation');
    }
  }

  /**
   * Helper method to execute raw SQL queries
   */
  private async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await this.prisma.$queryRawUnsafe(sql, ...params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      logger.error('Database query error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error, sql, params });
      throw error;
    }
  }
}
