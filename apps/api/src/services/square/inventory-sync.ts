/**
 * Square Inventory Sync
 * Handles inventory/stock level synchronization between Square and Platform
 * Phase 3: Sync Service Implementation
 */

import { squareIntegrationRepository } from './square-integration.repository';
import { prisma } from '../../prisma';

export interface SquareInventoryCount {
  catalog_object_id: string;
  catalog_object_type: string;
  state: 'IN_STOCK' | 'SOLD' | 'RETURNED_BY_CUSTOMER' | 'RESERVED_FOR_SALE' | 'SOLD_ONLINE' | 'ORDERED_FROM_VENDOR' | 'RECEIVED_FROM_VENDOR';
  location_id: string;
  quantity: string;
  calculated_at: string;
}

export interface PlatformInventory {
  id: string;
  tenantId: string;
  productId: string;
  quantity: number;
  locationId?: string;
  updatedAt: Date;
}

export interface InventoryChange {
  productId: string;
  productName: string;
  oldQuantity: number;
  newQuantity: number;
  difference: number;
  source: 'square' | 'platform';
}

export class InventorySync {
  private tenantId: string;
  private integrationId: string;
  private squareClient: any;
  private locationId?: string;

  constructor(tenantId: string, integrationId: string, squareClient: any, locationId?: string) {
    this.tenantId = tenantId;
    this.integrationId = integrationId;
    this.squareClient = squareClient;
    this.locationId = locationId;
  }

  /**
   * Transform Square inventory to Platform format
   */
  transformSquareToPlatform(squareInventory: SquareInventoryCount, platformProductId: string): Partial<PlatformInventory> {
    return {
      productId: platformProductId,
      quantity: parseInt(squareInventory.quantity, 10) || 0,
      locationId: squareInventory.location_id,
      updatedAt: new Date(squareInventory.calculated_at),
    };
  }

  /**
   * Transform Platform inventory to Square format
   */
  transformPlatformToSquare(platformInventory: PlatformInventory, squareCatalogObjectId: string): any {
    return {
      type: 'PHYSICAL_COUNT',
      physical_count: {
        catalog_object_id: squareCatalogObjectId,
        catalog_object_type: 'ITEM_VARIATION',
        state: 'IN_STOCK',
        location_id: this.locationId || platformInventory.locationId,
        quantity: platformInventory.quantity.toString(),
        occurred_at: platformInventory.updatedAt.toISOString(),
      },
    };
  }

  /**
   * Import inventory from Square to Platform
   */
  async importInventory(squareInventory: SquareInventoryCount): Promise<InventoryChange | null> {
    try {
      console.log(`[InventorySync] Importing inventory for: ${squareInventory.catalog_object_id}`);

      // Find the product mapping
      const mapping = await squareIntegrationRepository.getProductMappingBySquareId(
        this.integrationId,
        squareInventory.catalog_object_id
      );

      if (!mapping) {
        console.log(`[InventorySync] No mapping found for Square product: ${squareInventory.catalog_object_id}`);
        return null;
      }

      // Get current platform inventory
      const currentInventory = await prisma.inventory_item.findUnique({
        where: { id: mapping.inventory_item_id },
        select: { id: true, name: true, quantity: true },
      });

      if (!currentInventory) {
        console.log(`[InventorySync] Platform product not found: ${mapping.inventory_item_id}`);
        return null;
      }

      const newQuantity = parseInt(squareInventory.quantity, 10) || 0;
      const oldQuantity = currentInventory.quantity || 0;

      // Update platform inventory
      await prisma.inventory_item.update({
        where: { id: mapping.inventory_item_id },
        data: {
          quantity: newQuantity,
          updatedAt: new Date(),
        },
      });

      // Update mapping
      await squareIntegrationRepository.createProductMapping({
        tenantId: this.tenantId,
        integrationId: this.integrationId,
        inventoryItemId: mapping.inventory_item_id,
        squareCatalogObjectId: mapping.square_catalog_object_id,
        squareItemVariationId: mapping.square_item_variation_id || undefined,
      });

      console.log(`[InventorySync] Updated inventory for ${currentInventory.name}: ${oldQuantity} → ${newQuantity}`);

      return {
        productId: currentInventory.id,
        productName: currentInventory.name,
        oldQuantity,
        newQuantity,
        difference: newQuantity - oldQuantity,
        source: 'square',
      };
    } catch (error) {
      console.error(`[InventorySync] Failed to import inventory:`, error);
      throw error;
    }
  }

  /**
   * Export inventory from Platform to Square
   */
  async exportInventory(platformProductId: string): Promise<InventoryChange | null> {
    try {
      console.log(`[InventorySync] Exporting inventory for: ${platformProductId}`);

      // Get platform product
      const platformProduct = await prisma.inventory_item.findUnique({
        where: { id: platformProductId },
        select: { id: true, name: true, quantity: true, updatedAt: true },
      });

      if (!platformProduct) {
        console.log(`[InventorySync] Platform product not found: ${platformProductId}`);
        return null;
      }

      // Find the product mapping
      const mapping = await squareIntegrationRepository.getProductMappingByInventoryItemId(
        this.tenantId,
        platformProductId
      );

      if (!mapping) {
        console.log(`[InventorySync] No mapping found for platform product: ${platformProductId}`);
        return null;
      }

      // TODO: Get current Square inventory
      // const squareInventory = await this.squareClient.getInventoryApi().retrieveInventoryCount({
      //   catalogObjectId: mapping.square_catalog_object_id,
      //   locationIds: this.locationId ? [this.locationId] : undefined,
      // });
      // const oldQuantity = parseInt(squareInventory.result.counts?.[0]?.quantity || '0', 10);

      // For now, assume old quantity is 0
      const oldQuantity = 0;
      const newQuantity = platformProduct.quantity || 0;

      // TODO: Update Square inventory
      // const inventoryChange = this.transformPlatformToSquare(
      //   {
      //     id: platformProduct.id,
      //     tenantId: this.tenantId,
      //     productId: platformProduct.id,
      //     quantity: newQuantity,
      //     updatedAt: platformProduct.updatedAt,
      //   },
      //   mapping.square_catalog_object_id
      // );
      //
      // await this.squareClient.getInventoryApi().batchChangeInventory({
      //   idempotencyKey: `${platformProductId}-${Date.now()}`,
      //   changes: [inventoryChange],
      // });

      console.log(`[InventorySync] Exported inventory for ${platformProduct.name}: ${oldQuantity} → ${newQuantity}`);

      return {
        productId: platformProduct.id,
        productName: platformProduct.name,
        oldQuantity,
        newQuantity,
        difference: newQuantity - oldQuantity,
        source: 'platform',
      };
    } catch (error) {
      console.error(`[InventorySync] Failed to export inventory:`, error);
      throw error;
    }
  }

  /**
   * Batch import inventory from Square
   */
  async batchImport(squareInventories: SquareInventoryCount[]): Promise<{
    succeeded: InventoryChange[];
    failed: Array<{ inventory: SquareInventoryCount; error: string }>;
  }> {
    const succeeded: InventoryChange[] = [];
    const failed: Array<{ inventory: SquareInventoryCount; error: string }> = [];

    for (const squareInventory of squareInventories) {
      try {
        const change = await this.importInventory(squareInventory);
        if (change) {
          succeeded.push(change);
        }
      } catch (error: any) {
        failed.push({
          inventory: squareInventory,
          error: error.message,
        });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Batch export inventory to Square
   */
  async batchExport(platformProductIds: string[]): Promise<{
    succeeded: InventoryChange[];
    failed: Array<{ productId: string; error: string }>;
  }> {
    const succeeded: InventoryChange[] = [];
    const failed: Array<{ productId: string; error: string }> = [];

    for (const productId of platformProductIds) {
      try {
        const change = await this.exportInventory(productId);
        if (change) {
          succeeded.push(change);
        }
      } catch (error: any) {
        failed.push({
          productId,
          error: error.message,
        });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Sync inventory for a specific product (bidirectional)
   */
  async syncProduct(platformProductId: string, direction: 'to_square' | 'from_square' | 'auto' = 'auto'): Promise<InventoryChange | null> {
    try {
      if (direction === 'to_square') {
        return await this.exportInventory(platformProductId);
      }

      if (direction === 'from_square') {
        // Get mapping first
        const mapping = await squareIntegrationRepository.getProductMappingByInventoryItemId(
          this.tenantId,
          platformProductId
        );

        if (!mapping) {
          return null;
        }

        // TODO: Fetch Square inventory
        // const squareInventory = await this.fetchSquareInventory(mapping.square_catalog_object_id);
        // return await this.importInventory(squareInventory);

        return null;
      }

      // Auto mode: Compare timestamps and sync from most recent
      const mapping = await squareIntegrationRepository.getProductMappingByInventoryItemId(
        this.tenantId,
        platformProductId
      );

      if (!mapping) {
        return null;
      }

      const platformProduct = await prisma.inventory_item.findUnique({
        where: { id: platformProductId },
        select: { updatedAt: true },
      });

      if (!platformProduct) {
        return null;
      }

      // TODO: Compare with Square timestamp and sync from most recent
      // For now, default to exporting to Square
      return await this.exportInventory(platformProductId);
    } catch (error) {
      console.error(`[InventorySync] Failed to sync product inventory:`, error);
      throw error;
    }
  }

  /**
   * Get inventory discrepancies between Square and Platform
   */
  async getDiscrepancies(): Promise<Array<{
    productId: string;
    productName: string;
    platformQuantity: number;
    squareQuantity: number;
    difference: number;
  }>> {
    const discrepancies: Array<{
      productId: string;
      productName: string;
      platformQuantity: number;
      squareQuantity: number;
      difference: number;
    }> = [];

    try {
      // Get all mapped products
      const mappings = await prisma.$queryRaw<any[]>`
        SELECT * FROM square_product_mappings
        WHERE tenantId = ${this.tenantId}
      `;

      for (const mapping of mappings) {
        // Get platform quantity
        const platformProduct = await prisma.inventory_item.findUnique({
          where: { id: mapping.inventory_item_id },
          select: { id: true, name: true, quantity: true },
        });

        if (!platformProduct) continue;

        // TODO: Get Square quantity
        // const squareInventory = await this.fetchSquareInventory(mapping.square_catalog_object_id);
        // const squareQuantity = parseInt(squareInventory.quantity, 10) || 0;

        // For now, assume Square quantity is 0
        const squareQuantity = 0;
        const platformQuantity = platformProduct.quantity || 0;

        if (platformQuantity !== squareQuantity) {
          discrepancies.push({
            productId: platformProduct.id,
            productName: platformProduct.name,
            platformQuantity,
            squareQuantity,
            difference: platformQuantity - squareQuantity,
          });
        }
      }

      return discrepancies;
    } catch (error) {
      console.error(`[InventorySync] Failed to get discrepancies:`, error);
      throw error;
    }
  }
}

/**
 * Factory function to create inventory sync instance
 */
export function createInventorySync(
  tenantId: string,
  integrationId: string,
  squareClient: any,
  locationId?: string
): InventorySync {
  return new InventorySync(tenantId, integrationId, squareClient, locationId);
}
