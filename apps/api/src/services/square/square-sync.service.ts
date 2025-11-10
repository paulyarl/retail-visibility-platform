/**
 * Square Sync Service
 * Orchestrates bidirectional sync between Square and Platform
 * Phase 3: Sync Service Implementation
 */

const { SquareClient } = require('square') as any;
import { squareIntegrationRepository } from './square-integration.repository';
import { createSquareClient } from './square-client';

export interface SyncOptions {
  direction?: 'to_square' | 'from_square' | 'bidirectional';
  syncType?: 'catalog' | 'inventory' | 'full';
  batchSize?: number;
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errors: SyncError[];
  duration: number;
  syncLogId?: string;
}

export interface SyncError {
  itemId?: string;
  itemName?: string;
  error: string;
  code?: string;
}

export interface SyncProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentItem?: string;
  stage: 'fetching' | 'transforming' | 'syncing' | 'complete' | 'error';
}

export class SquareSyncService {
  private tenantId: string;
  private integrationId: string;
  private squareClient: any;
  private progressCallback?: (progress: SyncProgress) => void;

  constructor(tenantId: string, integrationId: string, squareClient: any) {
    this.tenantId = tenantId;
    this.integrationId = integrationId;
    this.squareClient = squareClient;
  }

  /**
   * Set progress callback for real-time updates
   */
  onProgress(callback: (progress: SyncProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * Update progress
   */
  private updateProgress(progress: Partial<SyncProgress>) {
    if (this.progressCallback) {
      this.progressCallback(progress as SyncProgress);
    }
  }

  /**
   * Sync products from Square to Platform
   */
  async syncFromSquare(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSucceeded = 0;
    let itemsFailed = 0;

    try {
      console.log('[SquareSync] Starting sync from Square to Platform');
      this.updateProgress({ stage: 'fetching', total: 0, processed: 0, succeeded: 0, failed: 0 });

      // Create sync log
      const syncLog = await squareIntegrationRepository.createSyncLog({
        tenantId: this.tenantId,
        integrationId: this.integrationId,
        syncType: options.syncType || 'catalog',
        direction: 'from_square',
        operation: 'sync',
        status: 'pending',
        itemsAffected: 0,
      });

      // Fetch products from Square
      const products = await this.fetchSquareProducts();
      this.updateProgress({ stage: 'transforming', total: products.length, processed: 0, succeeded: 0, failed: 0 });

      // Process each product
      for (const product of products) {
        try {
          itemsProcessed++;
          this.updateProgress({ 
            stage: 'syncing', 
            total: products.length, 
            processed: itemsProcessed,
            succeeded: itemsSucceeded,
            failed: itemsFailed,
            currentItem: product.name 
          });

          if (!options.dryRun) {
            await this.importSquareProduct(product);
          }
          
          itemsSucceeded++;
        } catch (error: any) {
          itemsFailed++;
          errors.push({
            itemId: product.id,
            itemName: product.name,
            error: error.message,
            code: error.code,
          });
          console.error(`[SquareSync] Failed to import product ${product.name}:`, error);
        }
      }

      // Update sync log
      await squareIntegrationRepository.createSyncLog({
        tenantId: this.tenantId,
        integrationId: this.integrationId,
        syncType: options.syncType || 'catalog',
        direction: 'from_square',
        operation: 'sync',
        status: itemsFailed === 0 ? 'success' : 'error',
        itemsAffected: itemsSucceeded,
        errorMessage: errors.length > 0 ? `${errors.length} items failed` : undefined,
        durationMs: Date.now() - startTime,
      });

      this.updateProgress({ stage: 'complete', total: products.length, processed: itemsProcessed, succeeded: itemsSucceeded, failed: itemsFailed });

      return {
        success: itemsFailed === 0,
        itemsProcessed,
        itemsSucceeded,
        itemsFailed,
        errors,
        duration: Date.now() - startTime,
        syncLogId: syncLog.id,
      };
    } catch (error: any) {
      console.error('[SquareSync] Sync from Square failed:', error);
      this.updateProgress({ stage: 'error', total: 0, processed: 0, succeeded: 0, failed: 0 });
      
      throw new Error(`Sync from Square failed: ${error.message}`);
    }
  }

  /**
   * Sync products from Platform to Square
   */
  async syncToSquare(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSucceeded = 0;
    let itemsFailed = 0;

    try {
      console.log('[SquareSync] Starting sync from Platform to Square');
      this.updateProgress({ stage: 'fetching', total: 0, processed: 0, succeeded: 0, failed: 0 });

      // Create sync log
      const syncLog = await squareIntegrationRepository.createSyncLog({
        tenantId: this.tenantId,
        integrationId: this.integrationId,
        syncType: options.syncType || 'catalog',
        direction: 'to_square',
        operation: 'sync',
        status: 'pending',
        itemsAffected: 0,
      });

      // Fetch products from Platform
      const products = await this.fetchPlatformProducts();
      this.updateProgress({ stage: 'transforming', total: products.length, processed: 0, succeeded: 0, failed: 0 });

      // Process each product
      for (const product of products) {
        try {
          itemsProcessed++;
          this.updateProgress({ 
            stage: 'syncing', 
            total: products.length, 
            processed: itemsProcessed,
            succeeded: itemsSucceeded,
            failed: itemsFailed,
            currentItem: product.name 
          });

          if (!options.dryRun) {
            await this.exportPlatformProduct(product);
          }
          
          itemsSucceeded++;
        } catch (error: any) {
          itemsFailed++;
          errors.push({
            itemId: product.id,
            itemName: product.name,
            error: error.message,
            code: error.code,
          });
          console.error(`[SquareSync] Failed to export product ${product.name}:`, error);
        }
      }

      // Update sync log
      await squareIntegrationRepository.createSyncLog({
        tenantId: this.tenantId,
        integrationId: this.integrationId,
        syncType: options.syncType || 'catalog',
        direction: 'to_square',
        operation: 'sync',
        status: itemsFailed === 0 ? 'success' : 'error',
        itemsAffected: itemsSucceeded,
        errorMessage: errors.length > 0 ? `${errors.length} items failed` : undefined,
        durationMs: Date.now() - startTime,
      });

      this.updateProgress({ stage: 'complete', total: products.length, processed: itemsProcessed, succeeded: itemsSucceeded, failed: itemsFailed });

      return {
        success: itemsFailed === 0,
        itemsProcessed,
        itemsSucceeded,
        itemsFailed,
        errors,
        duration: Date.now() - startTime,
        syncLogId: syncLog.id,
      };
    } catch (error: any) {
      console.error('[SquareSync] Sync to Square failed:', error);
      this.updateProgress({ stage: 'error', total: 0, processed: 0, succeeded: 0, failed: 0 });
      
      throw new Error(`Sync to Square failed: ${error.message}`);
    }
  }

  /**
   * Bidirectional sync
   */
  async syncBidirectional(options: SyncOptions = {}): Promise<SyncResult> {
    console.log('[SquareSync] Starting bidirectional sync');
    
    // Sync from Square first (import)
    const fromSquareResult = await this.syncFromSquare(options);
    
    // Then sync to Square (export)
    const toSquareResult = await this.syncToSquare(options);

    // Combine results
    return {
      success: fromSquareResult.success && toSquareResult.success,
      itemsProcessed: fromSquareResult.itemsProcessed + toSquareResult.itemsProcessed,
      itemsSucceeded: fromSquareResult.itemsSucceeded + toSquareResult.itemsSucceeded,
      itemsFailed: fromSquareResult.itemsFailed + toSquareResult.itemsFailed,
      errors: [...fromSquareResult.errors, ...toSquareResult.errors],
      duration: fromSquareResult.duration + toSquareResult.duration,
    };
  }

  /**
   * Fetch products from Square Catalog API
   */
  private async fetchSquareProducts(): Promise<any[]> {
    try {
      console.log('[SquareSync] Fetching products from Square');
      
      // TODO: Implement actual Square API call
      // const response = await this.squareClient.getCatalogApi().listCatalog({
      //   types: 'ITEM',
      // });
      
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('[SquareSync] Failed to fetch Square products:', error);
      throw error;
    }
  }

  /**
   * Fetch products from Platform database
   */
  private async fetchPlatformProducts(): Promise<any[]> {
    try {
      console.log('[SquareSync] Fetching products from Platform');
      
      // TODO: Implement actual Platform database query
      // const products = await prisma.inventoryItem.findMany({
      //   where: { tenantId: this.tenantId },
      // });
      
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('[SquareSync] Failed to fetch Platform products:', error);
      throw error;
    }
  }

  /**
   * Import a Square product to Platform
   */
  private async importSquareProduct(product: any): Promise<void> {
    try {
      console.log(`[SquareSync] Importing product: ${product.name}`);
      
      // TODO: Implement product import logic
      // 1. Transform Square product to Platform format
      // 2. Check for existing product
      // 3. Resolve conflicts
      // 4. Create/update in Platform
      // 5. Create product mapping
      
    } catch (error) {
      console.error(`[SquareSync] Failed to import product ${product.name}:`, error);
      throw error;
    }
  }

  /**
   * Export a Platform product to Square
   */
  private async exportPlatformProduct(product: any): Promise<void> {
    try {
      console.log(`[SquareSync] Exporting product: ${product.name}`);
      
      // TODO: Implement product export logic
      // 1. Transform Platform product to Square format
      // 2. Check for existing product in Square
      // 3. Resolve conflicts
      // 4. Create/update in Square
      // 5. Update product mapping
      
    } catch (error) {
      console.error(`[SquareSync] Failed to export product ${product.name}:`, error);
      throw error;
    }
  }
}

/**
 * Factory function to create sync service for a tenant
 */
export async function createSquareSyncService(tenantId: string): Promise<SquareSyncService> {
  // Get integration
  const integration = await squareIntegrationRepository.getIntegrationByTenantId(tenantId);
  if (!integration) {
    throw new Error(`No Square integration found for tenant ${tenantId}`);
  }

  // Create Square client
  const squareClient = createSquareClient({
    access_token: integration.access_token,
    mode: integration.mode as 'sandbox' | 'production',
  });

  return new SquareSyncService(tenantId, integration.id, squareClient);
}

// Export singleton instance creator
export const squareSyncService = {
  create: createSquareSyncService,
};
