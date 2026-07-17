import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

export class StockService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Decrement stock for items in an order after successful payment
   * @param orderId - The order ID to process stock for
   */
  async decrementStockForOrder(orderId: string): Promise<void> {
    try {
      console.log(`[StockService] Decrementing stock for order: ${orderId}`);

      // Get all order items with their variant and inventory item information
      const orderItems = await this.prisma.order_items.findMany({
        where: { order_id: orderId },
        include: {
          // Include variant information if available
          product_variants: true,
          inventory_items: true,
        },
      });

      console.log(`[StockService] Found ${orderItems.length} items to process`);

      for (const item of orderItems) {
        // Skip stock operations for digital and service products
        const productType = item.product_type || item.inventory_items?.product_type;
        if (productType === 'digital' || productType === 'service') {
          console.log(`[StockService] Skipping stock decrement for ${productType} item ${item.sku}`);
          continue;
        }

        const quantity = item.quantity;
        let stockUpdated = false;

        // Try to update variant stock first (if this is a variant item)
        if (item.variant_id && item.product_variants) {
          const variant = await this.prisma.product_variants.findUnique({
            where: { id: item.variant_id },
          });

          if (variant) {
            const newStock = Math.max(0, variant.stock - quantity);
            await this.prisma.product_variants.update({
              where: { id: variant.id },
              data: { 
                stock: newStock,
                updated_at: new Date(),
              },
            });
            
            console.log(`[StockService] Updated variant ${variant.sku} stock: ${variant.stock} -> ${newStock}`);
            stockUpdated = true;
          }
        }

        // If no variant was updated, try to update the main inventory item stock
        if (!stockUpdated && item.inventory_item_id) {
          const inventoryItem = await this.prisma.inventory_items.findUnique({
            where: { id: item.inventory_item_id },
          });

          if (inventoryItem) {
            const newStock = Math.max(0, inventoryItem.stock - quantity);
            await this.prisma.inventory_items.update({
              where: { id: inventoryItem.id },
              data: { 
                stock: newStock,
                updated_at: new Date(),
              },
            });
            
            console.log(`[StockService] Updated inventory item ${inventoryItem.sku} stock: ${inventoryItem.stock} -> ${newStock}`);
            stockUpdated = true;
          }
        }

        if (!stockUpdated) {
          console.warn(`[StockService] Could not find stock item for order item ${item.id} (variant_id: ${item.variant_id}, inventory_item_id: ${item.inventory_item_id})`);
        }
      }

      console.log(`[StockService] Stock decrement completed for order: ${orderId}`);
    } catch (error) {
      logger.error(`[StockService] Error decrementing stock for order ${orderId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Restore stock for items in an order (used for cancellations/refunds)
   * @param orderId - The order ID to restore stock for
   */
  async restoreStockForOrder(orderId: string): Promise<void> {
    try {
      console.log(`[StockService] Restoring stock for order: ${orderId}`);

      const orderItems = await this.prisma.order_items.findMany({
        where: { order_id: orderId },
        include: {
          product_variants: true,
          inventory_items: true,
        },
      });

      for (const item of orderItems) {
        // Skip stock restoration for digital and service products
        const productType = item.product_type || item.inventory_items?.product_type;
        if (productType === 'digital' || productType === 'service') {
          console.log(`[StockService] Skipping stock restore for ${productType} item ${item.sku}`);
          continue;
        }

        const quantity = item.quantity;
        let stockRestored = false;

        // Try to restore variant stock first
        if (item.variant_id && item.product_variants) {
          const variant = await this.prisma.product_variants.findUnique({
            where: { id: item.variant_id },
          });

          if (variant) {
            const newStock = variant.stock + quantity;
            await this.prisma.product_variants.update({
              where: { id: variant.id },
              data: { 
                stock: newStock,
                updated_at: new Date(),
              },
            });
            
            console.log(`[StockService] Restored variant ${variant.sku} stock: ${variant.stock} -> ${newStock}`);
            stockRestored = true;
          }
        }

        // If no variant was restored, try to restore the main inventory item stock
        if (!stockRestored && item.inventory_item_id) {
          const inventoryItem = await this.prisma.inventory_items.findUnique({
            where: { id: item.inventory_item_id },
          });

          if (inventoryItem) {
            const newStock = inventoryItem.stock + quantity;
            await this.prisma.inventory_items.update({
              where: { id: inventoryItem.id },
              data: { 
                stock: newStock,
                updated_at: new Date(),
              },
            });
            
            console.log(`[StockService] Restored inventory item ${inventoryItem.sku} stock: ${inventoryItem.stock} -> ${newStock}`);
            stockRestored = true;
          }
        }

        if (!stockRestored) {
          console.warn(`[StockService] Could not find stock item to restore for order item ${item.id}`);
        }
      }

      console.log(`[StockService] Stock restoration completed for order: ${orderId}`);
    } catch (error) {
      logger.error(`[StockService] Error restoring stock for order ${orderId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Check if sufficient stock is available for an order
   * @param orderId - The order ID to check stock for
   * @returns Object indicating if stock is sufficient and any issues
   */
  async checkStockAvailability(orderId: string): Promise<{
    sufficient: boolean;
    issues: Array<{
      itemSku: string;
      variantName?: string;
      requested: number;
      available: number;
    }>;
  }> {
    try {
      const orderItems = await this.prisma.order_items.findMany({
        where: { order_id: orderId },
        include: {
          product_variants: true,
          inventory_items: true,
        },
      });

      const issues: Array<{
        itemSku: string;
        variantName?: string;
        requested: number;
        available: number;
      }> = [];

      for (const item of orderItems) {
        // Skip stock check for digital and service products
        const productType = item.product_type || item.inventory_items?.product_type;
        if (productType === 'digital' || productType === 'service') {
          continue;
        }

        const requested = item.quantity;
        let available = 0;
        let itemSku = '';
        let variantName = '';

        // Check variant stock first
        if (item.variant_id && item.product_variants) {
          available = item.product_variants.stock;
          itemSku = item.product_variants.sku;
          variantName = item.product_variants.variant_name;
        } else if (item.inventory_items) {
          available = item.inventory_items.stock;
          itemSku = item.inventory_items.sku;
        }

        if (available < requested) {
          issues.push({
            itemSku,
            variantName,
            requested,
            available,
          });
        }
      }

      return {
        sufficient: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error(`[StockService] Error checking stock availability for order ${orderId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }
}

// Singleton instance
let stockServiceInstance: StockService | null = null;

export function getStockService(prisma: PrismaClient): StockService {
  if (!stockServiceInstance) {
    stockServiceInstance = new StockService(prisma);
  }
  return stockServiceInstance;
}
