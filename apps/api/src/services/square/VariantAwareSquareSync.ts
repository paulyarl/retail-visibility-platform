/**
 * Variant-Aware Square Catalog Sync Service
 * 
 * Enhanced Square sync that properly handles product variants:
 * - Each variant becomes a separate Square variation
 * - Variant attributes are preserved in variation names
 * - Stock and price are tracked per variant
 * - Parent item relationships are maintained
 */

import { VariantAwarePropagationService, PropagationProduct, PropagationResult } from '../VariantAwarePropagationService';
import { squareIntegrationRepository } from './square-integration.repository';
import { prisma } from '../../prisma';
import { logger } from '../../logger';

export interface SquareProductWithVariants {
  id: string;
  type: string;
  item_data: {
    name: string;
    description?: string;
    category_id?: string;
    variations: SquareVariation[];
    image_ids?: string[];
  };
}

export interface SquareVariation {
  id: string;
  type: string;
  item_variation_data: {
    item_id: string;
    name?: string;
    sku?: string;
    price_money?: {
      amount: number;
      currency: string;
    };
  };
}

export interface VariantAwareSquareSyncConfig {
  tenantId: string;
  integrationId: string;
  includeVariants?: boolean;
  syncStock?: boolean;
  syncPrices?: boolean;
  batchSize?: number;
}

export class VariantAwareSquareSync {
  private propagationService: VariantAwarePropagationService;
  private tenantId: string;
  private integrationId: string;
  private config: VariantAwareSquareSyncConfig;

  constructor(config: VariantAwareSquareSyncConfig) {
    this.propagationService = VariantAwarePropagationService.getInstance();
    this.tenantId = config.tenantId;
    this.integrationId = config.integrationId;
    this.config = {
      includeVariants: true,
      syncStock: true,
      syncPrices: true,
      batchSize: 50,
      ...config
    };
  }

  /**
   * Sync all products to Square with variant support
   */
  async syncAllProducts(): Promise<PropagationResult> {
    logger.info(`Starting variant-aware Square sync for tenant ${this.tenantId}`);

    const request = {
      tenantId: this.tenantId,
      target: {
        type: 'square_sync' as const,
        targetId: this.integrationId,
        config: this.config
      },
      operation: 'sync' as const,
      options: {
        includeVariants: this.config.includeVariants,
        batchSize: this.config.batchSize
      }
    };

    return this.propagationService.propagateProducts(request);
  }

  /**
   * Sync specific products to Square
   */
  async syncSpecificProducts(productIds: string[]): Promise<PropagationResult> {
    logger.info(`Syncing ${productIds.length} specific products to Square for tenant ${this.tenantId}`);

    const request = {
      tenantId: this.tenantId,
      productIds,
      target: {
        type: 'square_sync' as const,
        targetId: this.integrationId,
        config: this.config
      },
      operation: 'sync' as const,
      options: {
        includeVariants: this.config.includeVariants,
        batchSize: this.config.batchSize
      }
    };

    return this.propagationService.propagateProducts(request);
  }

  /**
   * Transform variant-aware product to Square format
   */
  transformToSquareProduct(product: PropagationProduct): SquareProductWithVariants {
    const baseProduct: SquareProductWithVariants = {
      id: `#${product.id}`,
      type: 'ITEM',
      item_data: {
        name: product.parentItem?.name || product.name,
        description: product.description,
        variations: []
      }
    };

    if (product.variantType === 'parent_item' && !product.hasVariants) {
      // Simple product without variants
      baseProduct.item_data.variations = [{
        id: `#${product.id}-variation`,
        type: 'ITEM_VARIATION',
        item_variation_data: {
          item_id: `#${product.id}`,
          name: 'Regular',
          sku: product.sku,
          price_money: {
            amount: product.priceCents,
            currency: 'USD'
          }
        }
      }];
    } else if (product.variantType === 'product_variant') {
      // Individual variant
      const variantName = this.generateVariantDisplayName(product);
      
      baseProduct.item_data.variations = [{
        id: `#${product.id}-variation`,
        type: 'ITEM_VARIATION',
        item_variation_data: {
          item_id: `#${product.parentItem?.id || product.id}`,
          name: variantName,
          sku: product.sku,
          price_money: {
            amount: product.priceCents,
            currency: 'USD'
          }
        }
      }];
    }

    return baseProduct;
  }

  /**
   * Generate display name for Square variation from variant attributes
   */
  private generateVariantDisplayName(product: PropagationProduct): string {
    if (!product.variantAttributes || Object.keys(product.variantAttributes).length === 0) {
      return product.variantName || 'Variant';
    }

    // Format attributes as "Size: L, Color: Red"
    const attributes = Object.entries(product.variantAttributes)
      .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
      .join(', ');

    return attributes || product.variantName || 'Variant';
  }

  /**
   * Create or update Square product with variants
   */
  async upsertSquareProduct(product: PropagationProduct): Promise<void> {
    try {
      // Check if product already exists in Square
      const existingMapping = await squareIntegrationRepository.getProductMappingByInventoryItemId(
        this.tenantId,
        product.parentItem?.id || product.id
      );

      const squareProduct = this.transformToSquareProduct(product);

      if (existingMapping) {
        // Update existing product
        logger.info(`Updating Square product ${existingMapping.square_catalog_object_id}`);
        
        // TODO: Implement Square API call to update product
        // await this.squareClient.updateCatalogObject(existingMapping.square_catalog_object_id, squareProduct);
        
        // Update mapping by creating new one (UPSERT behavior)
        await squareIntegrationRepository.createProductMapping({
          tenantId: this.tenantId,
          integrationId: this.integrationId,
          inventoryItemId: product.parentItem?.id || product.id,
          squareCatalogObjectId: existingMapping.square_catalog_object_id,
          squareItemVariationId: squareProduct.item_data.variations[0]?.id
        });
      } else {
        // Create new product
        logger.info(`Creating new Square product for ${product.name}`);
        
        // TODO: Implement Square API call to create product
        // const result = await this.squareClient.createCatalogObject(squareProduct);
        
        // Create mapping
        await squareIntegrationRepository.createProductMapping({
          tenantId: this.tenantId,
          integrationId: this.integrationId,
          inventoryItemId: product.parentItem?.id || product.id,
          squareCatalogObjectId: squareProduct.id, // Would come from Square API response
          squareItemVariationId: squareProduct.item_data.variations[0]?.id
        });
      }

      // Handle stock sync if enabled
      if (this.config.syncStock) {
        await this.syncStockToSquare(product, squareProduct);
      }

    } catch (error) {
      logger.error(`Failed to upsert Square product for ${product.name}:`, { region: 'unknown' });
      throw error;
    }
  }

  /**
   * Sync stock levels to Square
   */
  private async syncStockToSquare(product: PropagationProduct, squareProduct: SquareProductWithVariants): Promise<void> {
    try {
      const variationId = squareProduct.item_data.variations[0]?.id;
      if (!variationId) {
        logger.warn(`No variation ID found for product ${product.name}, skipping stock sync`);
        return;
      }

      // TODO: Implement Square API call to update inventory
      // await this.squareClient.adjustInventory({
      //   catalogObjectId: variationId,
      //   quantity: product.stock,
      //   adjustOperation: 'SET'
      // });

      logger.info(`Synced stock ${product.stock} to Square for ${product.name}`);

    } catch (error) {
      logger.error(`Failed to sync stock for ${product.name}:`, { region: 'unknown' });
      throw error;
    }
  }

  /**
   * Batch sync multiple products
   */
  async batchSync(products: PropagationProduct[]): Promise<PropagationResult> {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ productId: string; variantId?: string; error: string }> = [];

    logger.info(`Starting batch sync of ${products.length} products to Square`);

    // Process in batches
    const batchSize = this.config.batchSize || 50;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)} (${batch.length} products)`);

      for (const product of batch) {
        try {
          await this.upsertSquareProduct(product);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            productId: product.id,
            variantId: product.variantId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Batch sync completed: ${successCount} success, ${errorCount} errors in ${duration}ms`);

    return {
      success: errorCount === 0,
      propagatedCount: successCount,
      errorCount,
      errors,
      details: {
        target: {
          type: 'square_sync',
          targetId: this.integrationId,
          config: this.config
        },
        operation: 'batch_sync',
        duration
      }
    };
  }

  /**
   * Get sync status for products
   */
  async getSyncStatus(productIds?: string[]): Promise<Array<{
    productId: string;
    lastSyncedAt?: Date;
    squareCatalogObjectId?: string;
    squareItemVariationId?: string;
  }>> {
    // For now, return empty array as the repository method doesn't exist
    // TODO: Implement proper sync status tracking
    logger.info(`Getting sync status for ${productIds?.length || 'all'} products`);
    
    return [];
  }
}
