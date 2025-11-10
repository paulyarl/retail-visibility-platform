/**
 * Square Catalog Sync
 * Handles product synchronization between Square and Platform
 * Phase 3: Sync Service Implementation
 */

import { squareIntegrationRepository } from './square-integration.repository';
import { prisma } from '../../prisma';

export interface SquareProduct {
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

export interface PlatformProduct {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  price?: number;
  sku?: string;
  images?: string[];
  categoryId?: string;
  isActive: boolean;
  isPublic: boolean;
}

export interface ProductMapping {
  platformProductId: string;
  squareCatalogObjectId: string;
  squareItemVariationId?: string;
  lastSyncedAt: Date;
}

export class CatalogSync {
  private tenantId: string;
  private integrationId: string;
  private squareClient: any;

  constructor(tenantId: string, integrationId: string, squareClient: any) {
    this.tenantId = tenantId;
    this.integrationId = integrationId;
    this.squareClient = squareClient;
  }

  /**
   * Transform Square product to Platform format
   */
  transformSquareToPlatform(squareProduct: SquareProduct): Partial<PlatformProduct> {
    const variation = squareProduct.item_data.variations[0];
    const priceAmount = variation?.item_variation_data?.price_money?.amount;

    return {
      name: squareProduct.item_data.name,
      description: squareProduct.item_data.description || undefined,
      price: priceAmount ? priceAmount / 100 : undefined, // Convert cents to dollars
      sku: variation?.item_variation_data?.sku || undefined,
      // images will be handled separately
      isActive: true,
      isPublic: true,
    };
  }

  /**
   * Transform Platform product to Square format
   */
  transformPlatformToSquare(platformProduct: PlatformProduct): any {
    return {
      type: 'ITEM',
      id: `#${platformProduct.id}`, // Temporary ID for batch operations
      item_data: {
        name: platformProduct.name,
        description: platformProduct.description || '',
        variations: [
          {
            type: 'ITEM_VARIATION',
            id: `#${platformProduct.id}-variation`,
            item_variation_data: {
              item_id: `#${platformProduct.id}`,
              name: 'Regular',
              sku: platformProduct.sku || '',
              price_money: platformProduct.price
                ? {
                    amount: Math.round(platformProduct.price * 100), // Convert dollars to cents
                    currency: 'USD',
                  }
                : undefined,
            },
          },
        ],
      },
    };
  }

  /**
   * Import a Square product to Platform
   */
  async importProduct(squareProduct: SquareProduct): Promise<PlatformProduct> {
    try {
      console.log(`[CatalogSync] Importing product: ${squareProduct.item_data.name}`);

      // Check if product already exists via mapping
      const existingMapping = await squareIntegrationRepository.getProductMappingBySquareId(
        this.integrationId,
        squareProduct.id
      );

      const platformData = this.transformSquareToPlatform(squareProduct);

      let platformProduct: any;

      if (existingMapping) {
        // Update existing product
        console.log(`[CatalogSync] Updating existing product: ${existingMapping.inventory_item_id}`);
        
        platformProduct = await prisma.inventoryItem.update({
          where: { id: existingMapping.inventory_item_id },
          data: {
            ...platformData,
            updatedAt: new Date(),
          },
        });

        // Update mapping
        await squareIntegrationRepository.updateProductMapping(existingMapping.id, {
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        });
      } else {
        // Create new product
        console.log(`[CatalogSync] Creating new product: ${squareProduct.item_data.name}`);
        
        platformProduct = await prisma.inventoryItem.create({
          data: {
            tenantId: this.tenantId,
            ...platformData,
            source: 'SQUARE_IMPORT',
          } as any,
        });

        // Create mapping
        const variation = squareProduct.item_data.variations[0];
        await squareIntegrationRepository.createProductMapping({
          tenantId: this.tenantId,
          integrationId: this.integrationId,
          inventoryItemId: platformProduct.id,
          squareCatalogObjectId: squareProduct.id,
          squareItemVariationId: variation?.id,
        });
      }

      console.log(`[CatalogSync] Successfully imported product: ${platformProduct.id}`);
      return platformProduct;
    } catch (error) {
      console.error(`[CatalogSync] Failed to import product:`, error);
      throw error;
    }
  }

  /**
   * Export a Platform product to Square
   */
  async exportProduct(platformProduct: PlatformProduct): Promise<SquareProduct> {
    try {
      console.log(`[CatalogSync] Exporting product: ${platformProduct.name}`);

      // Check if product already exists in Square via mapping
      const existingMapping = await squareIntegrationRepository.getProductMappingByInventoryItemId(
        this.tenantId,
        platformProduct.id
      );

      const squareData = this.transformPlatformToSquare(platformProduct);

      let squareProduct: SquareProduct;

      if (existingMapping) {
        // Update existing product in Square
        console.log(`[CatalogSync] Updating existing Square product: ${existingMapping.square_catalog_object_id}`);
        
        // TODO: Implement actual Square API update
        // const response = await this.squareClient.getCatalogApi().upsertCatalogObject({
        //   idempotencyKey: `${platformProduct.id}-${Date.now()}`,
        //   object: {
        //     ...squareData,
        //     id: existingMapping.square_catalog_object_id,
        //   },
        // });
        // squareProduct = response.result.catalogObject;

        // For now, mock the response
        squareProduct = {
          id: existingMapping.square_catalog_object_id,
          ...squareData,
        };

        // Update mapping
        await squareIntegrationRepository.updateProductMapping(existingMapping.id, {
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        });
      } else {
        // Create new product in Square
        console.log(`[CatalogSync] Creating new Square product: ${platformProduct.name}`);
        
        // TODO: Implement actual Square API create
        // const response = await this.squareClient.getCatalogApi().upsertCatalogObject({
        //   idempotencyKey: `${platformProduct.id}-${Date.now()}`,
        //   object: squareData,
        // });
        // squareProduct = response.result.catalogObject;

        // For now, mock the response
        squareProduct = {
          id: `square-${platformProduct.id}`,
          ...squareData,
        };

        // Create mapping
        const variation = squareProduct.item_data.variations[0];
        await squareIntegrationRepository.createProductMapping({
          tenantId: this.tenantId,
          integrationId: this.integrationId,
          inventoryItemId: platformProduct.id,
          squareCatalogObjectId: squareProduct.id,
          squareItemVariationId: variation?.id,
        });
      }

      console.log(`[CatalogSync] Successfully exported product: ${squareProduct.id}`);
      return squareProduct;
    } catch (error) {
      console.error(`[CatalogSync] Failed to export product:`, error);
      throw error;
    }
  }

  /**
   * Batch import products from Square
   */
  async batchImport(squareProducts: SquareProduct[]): Promise<{
    succeeded: PlatformProduct[];
    failed: Array<{ product: SquareProduct; error: string }>;
  }> {
    const succeeded: PlatformProduct[] = [];
    const failed: Array<{ product: SquareProduct; error: string }> = [];

    for (const squareProduct of squareProducts) {
      try {
        const platformProduct = await this.importProduct(squareProduct);
        succeeded.push(platformProduct);
      } catch (error: any) {
        failed.push({
          product: squareProduct,
          error: error.message,
        });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Batch export products to Square
   */
  async batchExport(platformProducts: PlatformProduct[]): Promise<{
    succeeded: SquareProduct[];
    failed: Array<{ product: PlatformProduct; error: string }>;
  }> {
    const succeeded: SquareProduct[] = [];
    const failed: Array<{ product: PlatformProduct; error: string }> = [];

    for (const platformProduct of platformProducts) {
      try {
        const squareProduct = await this.exportProduct(platformProduct);
        succeeded.push(squareProduct);
      } catch (error: any) {
        failed.push({
          product: platformProduct,
          error: error.message,
        });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Get product mapping
   */
  async getMapping(platformProductId: string): Promise<ProductMapping | null> {
    const mapping = await squareIntegrationRepository.getProductMappingByInventoryItemId(
      this.tenantId,
      platformProductId
    );

    if (!mapping) return null;

    return {
      platformProductId: mapping.inventory_item_id,
      squareCatalogObjectId: mapping.square_catalog_object_id,
      squareItemVariationId: mapping.square_item_variation_id || undefined,
      lastSyncedAt: mapping.last_synced_at || new Date(),
    };
  }

  /**
   * Delete product mapping
   */
  async deleteMapping(platformProductId: string): Promise<void> {
    const mapping = await squareIntegrationRepository.getProductMappingByInventoryItemId(
      this.tenantId,
      platformProductId
    );

    if (mapping) {
      await squareIntegrationRepository.deleteProductMapping(mapping.id);
    }
  }
}

/**
 * Factory function to create catalog sync instance
 */
export function createCatalogSync(
  tenantId: string,
  integrationId: string,
  squareClient: any
): CatalogSync {
  return new CatalogSync(tenantId, integrationId, squareClient);
}
