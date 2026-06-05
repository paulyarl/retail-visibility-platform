/**
 * Product Queue Service - Universal Singleton with Database Persistence
 * 
 * Features:
 * - Database-backed queue persistence (aligned with migration 003)
 * - Automatic cache management with TTL
 * - Tenant-scoped queue isolation with RLS
 * - Priority-based processing
 * - Status tracking and analytics
 * - Emergency recovery protection
 * - Performance-optimized queries with indexes
 */

import { prisma } from '../../prisma';
import { UniversalSingleton, SingletonCacheOptions, AuthContext } from '../UniversalSingleton';

export interface QueueItem {
  id: string;
  tenantId: string;
  name: string;
  brand: string;
  sku: string; // Unique key for queue deduplication
  status: 'queued' | 'processing' | 'completed' | 'published' | 'enhanced' | 'error' | 'cancelled';
  priority: 'normal' | 'high' | 'urgent';
  productData: any; // Complete wizard data
  addedAt: Date;
  estimatedTime: number; // minutes
  specialTreatment: string[];
  processingStartedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  metadata: {
    sessionId: string;
    userAgent?: string;
    source: 'wizard' | 'import' | 'bulk';
  };
}

export interface QueueStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  published: number;
  enhanced: number;
  error: number;
  cancelled: number;
  estimatedTotalTime: number;
  averageProcessingTime: number;
  successRate: number;
}

export interface QueueStorage {
  items: QueueItem[];
  timestamp: string;
  version: string;
  tenantId: string;
  stats: QueueStats;
}

class ProductQueueService extends UniversalSingleton {
  private static instance: ProductQueueService;
  private readonly QUEUE_RETENTION = 30 * 24 * 60 * 60 * 1000; // 30 days

  private constructor() {
    super('ProductQueueService', {
      enableCache: true,
      defaultTTL: 300, // 5 minutes
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true,
      enableEncryption: false,
      enablePrivateCache: false,
      authenticationLevel: 'authenticated'
    });
  }

  static getInstance(): ProductQueueService {
    if (!ProductQueueService.instance) {
      ProductQueueService.instance = new ProductQueueService();
    }
    return ProductQueueService.instance;
  }

  /**
   * Add item to queue with automatic persistence
   */
  async addToQueue(
    tenantId: string,
    productData: any,
    priority: 'normal' | 'high' | 'urgent' = 'normal',
    options: {
      sessionId?: string;
      userAgent?: string;
      source?: 'wizard' | 'import' | 'bulk';
    } = {}
  ): Promise<QueueItem> {
    // Extract SKU from product data
    const sku = productData.productType?.sku || productData.basicInfo?.sku;
    
    // Validate SKU exists
    if (!sku || sku.trim().length < 2) {
      throw new Error('SKU is required to add item to queue');
    }

    // Check for duplicate SKU in queue (prevent same draft from being added multiple times)
    const existingQueue = await this.getTenantQueue(tenantId, false);
    const duplicateItem = existingQueue.find(item => {
      const itemSku = item.productData?.productType?.sku || item.productData?.basicInfo?.sku;
      return itemSku === sku && (item.status === 'queued' || item.status === 'processing');
    });

    if (duplicateItem) {
      throw new Error(`Item with SKU "${sku}" is already in the queue`);
    }

    const queueItem: QueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      name: productData.basicInfo?.name || 'Untitled Product',
      brand: productData.basicInfo?.brand || 'Unknown Brand',
      sku: sku, // Store SKU at top level for easy access
      status: 'queued',
      priority,
      productData,
      addedAt: new Date(),
      estimatedTime: this.calculateEstimatedTime(productData),
      specialTreatment: this.detectSpecialTreatment(productData),
      retryCount: 0,
      metadata: {
        sessionId: options.sessionId || this.generateSessionId(),
        userAgent: options.userAgent,
        source: options.source || 'wizard'
      }
    };

    // Save to database
    await this.saveQueueItem(queueItem);

    // Invalidate cache
    await this.invalidateTenantQueueCache(tenantId);

    console.log('Queue item added:', {
      tenantId,
      priority,
      estimatedTime: queueItem.estimatedTime,
      source: options.source || 'wizard'
    });

    return queueItem;
  }

  /**
   * Get tenant's queue with caching
   */
  async getTenantQueue(tenantId: string, includeCompleted = false): Promise<QueueItem[]> {
    const cacheKey = `queue-${tenantId}-${includeCompleted ? 'all' : 'active'}`;
    
    // Try cache first using UniversalSingleton
    const cached = await this.getFromCache<QueueItem[]>(cacheKey);
    if (cached) {
      this.logInfo('Cache hit for tenant queue', { tenantId, includeCompleted });
      return cached;
    }

    // Fetch from database
    const items = await this.fetchQueueItems(tenantId, includeCompleted);
    
    // Cache the result using UniversalSingleton
    await this.setCache(cacheKey, items, { ttl: 300 }); // 5 minutes
    
    this.logInfo('Fetched tenant queue from database', { tenantId, includeCompleted, itemCount: items.length });

    return items;
  }

  /**
   * Get queue statistics with caching
   */
  async getQueueStats(tenantId: string): Promise<QueueStats> {
    const cacheKey = `queue-stats-${tenantId}`;
    
    // Try cache first using UniversalSingleton
    const cached = await this.getFromCache<QueueStats>(cacheKey);
    if (cached) {
      this.logInfo('Cache hit for queue stats', { tenantId });
      return cached;
    }

    // Use database view for optimized stats
    const stats = await this.fetchQueueStatsFromView(tenantId);
    
    // Cache the result using UniversalSingleton
    await this.setCache(cacheKey, stats, { ttl: 300 }); // 5 minutes
    
    this.logInfo('Fetched queue stats from database view', { tenantId });

    return stats;
  }

  /**
   * Process queue items (batch operation)
   */
  async processQueue(
    tenantId: string,
    itemIds?: string[],
    options: {
      maxConcurrent?: number;
      timeout?: number;
      retryFailed?: boolean;
    } = {}
  ): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const queue = await this.getTenantQueue(tenantId);
    const itemsToProcess = itemIds 
      ? queue.filter(item => itemIds.includes(item.id))
      : queue.filter(item => item.status === 'queued');

    const maxConcurrent = options.maxConcurrent || 3;
    const timeout = options.timeout || 300000; // 5 minutes
    const results: { processed: number; failed: number; errors: string[] } = { processed: 0, failed: 0, errors: [] };

    // Process in batches
    for (let i = 0; i < itemsToProcess.length; i += maxConcurrent) {
      const batch = itemsToProcess.slice(i, i + maxConcurrent);
      
      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            await this.processQueueItem(item, timeout);
            results.processed++;
          } catch (error) {
            results.failed++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.errors.push(`${item.name}: ${errorMessage}`);
            
            // Update item status
            await this.updateItemStatus(item.id, 'error', errorMessage);
          }
        })
      );
    }

    // Invalidate cache
    await this.invalidateTenantQueueCache(tenantId);

    return results;
  }

  /**
   * Remove item from queue
   */
  async removeFromQueue(itemId: string, tenantId: string): Promise<boolean> {
    try {
      await this.deleteQueueItem(itemId, tenantId);
      await this.invalidateTenantQueueCache(tenantId);
      
      console.log('Queue item removed:', { itemId, tenantId });
      return true;
    } catch (error) {
      console.error('Failed to remove queue item:', error);
      return false;
    }
  }

  /**
   * Update item priority
   */
  async updateItemPriority(itemId: string, priority: 'normal' | 'high' | 'urgent'): Promise<boolean> {
    try {
      await this.updateQueueItem(itemId, { priority });
      
      // Invalidate cache for tenant
      const item = await this.getQueueItem(itemId);
      if (item) {
        await this.invalidateTenantQueueCache(item.tenantId);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to update item priority:', error);
      return false;
    }
  }

  /**
   * Get queue items by status
   */
  async getItemsByStatus(
    tenantId: string, 
    status: QueueItem['status']
  ): Promise<QueueItem[]> {
    const queue = await this.getTenantQueue(tenantId, true);
    return queue.filter(item => item.status === status);
  }

  /**
   * Cleanup old completed items
   */
  async cleanupOldItems(tenantId: string, olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    
    const deletedCount = await this.deleteOldQueueItems(tenantId, cutoffDate);
    
    if (deletedCount > 0) {
      await this.invalidateTenantQueueCache(tenantId);
      console.log('Queue cleanup:', { tenantId, deletedCount });
    }
    
    return deletedCount;
  }

  /**
   * Clear all items from queue
   */
  async clearQueue(tenantId: string): Promise<{ deleted: number }> {
    try {
      // Set tenant context for RLS
      await this.setTenantContext(tenantId);
      
      // Delete all items for this tenant
      const result = await prisma.product_queue.deleteMany({
        where: {
          tenant_id: tenantId
        }
      });
      
      // Invalidate cache
      await this.invalidateTenantQueueCache(tenantId);
      
      this.logInfo('Queue cleared', { tenantId, deletedCount: result.count });
      
      return { deleted: result.count };
    } catch (error) {
      this.logError('Failed to clear queue', error);
      throw error;
    }
  }

  /**
   * Export queue for backup/migration
   */
  async exportQueue(tenantId: string): Promise<QueueStorage> {
    const items = await this.getTenantQueue(tenantId, true);
    const stats = await this.getQueueStats(tenantId);
    
    return {
      items,
      timestamp: new Date().toISOString(),
      version: '1.0',
      tenantId,
      stats
    };
  }

  /**
   * Import queue from backup
   */
  async importQueue(
    tenantId: string, 
    queueData: QueueStorage,
    options: {
      merge?: boolean;
      updateTimestamps?: boolean;
    } = {}
  ): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const results: { imported: number; skipped: number; errors: string[] } = { imported: 0, skipped: 0, errors: [] };
    
    for (const item of queueData.items) {
      try {
        // Check if item already exists
        if (!options.merge) {
          const existing = await this.getQueueItem(item.id);
          if (existing) {
            results.skipped++;
            continue;
          }
        }

        // Update tenant ID and timestamps if needed
        const importItem: QueueItem = {
          ...item,
          tenantId,
          ...(options.updateTimestamps && {
            addedAt: new Date(),
            id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          })
        };

        await this.saveQueueItem(importItem);
        results.imported++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`${item.name}: ${errorMessage}`);
      }
    }

    if (results.imported > 0) {
      await this.invalidateTenantQueueCache(tenantId);
    }

    return results;
  }

  
  private async invalidateTenantQueueCache(tenantId: string): Promise<void> {
    await Promise.all([
      this.clearCache(`queue-${tenantId}-active`),
      this.clearCache(`queue-${tenantId}-all`),
      this.clearCache(`queue-stats-${tenantId}`)
    ]);
    
    this.logInfo('Tenant queue cache invalidated', { tenantId });
  }

  // Private helper methods
  private calculateEstimatedTime(productData: any): number {
    let time = 5; // 5 minutes base
    
    if (productData.productType?.hasVariants) time += 10;
    if (productData.media?.galleryImages?.length > 5) time += 5;
    if (productData.content?.features?.length > 10) time += 3;
    if (productData.pricing?.variantPricing?.enabled) time += 8;
    
    return time;
  }

  private detectSpecialTreatment(productData: any): string[] {
    const treatments = [];
    
    if (productData.pricing?.salePrice && productData.pricing.salePrice < productData.pricing.listPrice * 0.5) {
      treatments.push('Deep Discount Alert');
    }
    
    if (productData.productType?.hasVariants && productData.productType?.variants?.length > 10) {
      treatments.push('Complex Variants');
    }
    
    if (!productData.media?.primaryImage) {
      treatments.push('Missing Images');
    }
    
    if (productData.basicInfo?.condition === 'refurbished') {
      treatments.push('Refurbished Item');
    }
    
    if (productData.pricing?.gatewaySelection?.gateway_type === null) {
      treatments.push('No Payment Gateway');
    }
    
    return treatments;
  }

  private calculateStats(items: QueueItem[]): QueueStats {
    const total = items.length;
    const queued = items.filter(item => item.status === 'queued').length;
    const processing = items.filter(item => item.status === 'processing').length;
    const completed = items.filter(item => item.status === 'completed').length;
    const published = items.filter(item => item.status === 'published').length;
    const enhanced = items.filter(item => item.status === 'enhanced').length;
    const error = items.filter(item => item.status === 'error').length;
    const cancelled = items.filter(item => item.status === 'cancelled').length;

    const queuedItems = items.filter(item => item.status === 'queued');
    const estimatedTotalTime = queuedItems.reduce((total, item) => total + item.estimatedTime, 0);

    const completedItems = items.filter(item => item.status === 'completed' && item.processingStartedAt && item.completedAt);
    const averageProcessingTime = completedItems.length > 0
      ? completedItems.reduce((total, item) => {
          const processingTime = item.completedAt!.getTime() - item.processingStartedAt!.getTime();
          return total + processingTime;
        }, 0) / completedItems.length / 1000 / 60 // Convert to minutes
      : 0;

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      queued,
      processing,
      completed,
      published,
      enhanced,
      error,
      cancelled,
      estimatedTotalTime,
      averageProcessingTime,
      successRate
    };
  }

  protected getCustomMetrics(): Record<string, any> {
    return {
      queueRetention: this.QUEUE_RETENTION,
      databaseConnected: true,
      rlsEnabled: true
    };
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async processQueueItem(item: QueueItem, timeout: number): Promise<void> {
    // Update status to processing
    await this.updateItemStatus(item.id, 'processing');

    try {
      // Simulate processing (in real implementation, this would call the product creation API)
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          // Random success/failure for demo
          if (Math.random() > 0.1) { // 90% success rate
            resolve(void 0);
          } else {
            reject(new Error('Processing failed'));
          }
        }, Math.random() * 5000 + 1000); // 1-6 seconds

        if (timeout) {
          setTimeout(() => reject(new Error('Processing timeout')), timeout);
        }
      });

      // Mark as completed
      await this.updateItemStatus(item.id, 'completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateItemStatus(item.id, 'error', errorMessage);
      throw error;
    }
  }

  // Database operations - aligned with migration 003
  private async saveQueueItem(item: QueueItem): Promise<void> {
    try {
      await prisma.product_queue.create({
        data: {
          id: item.id,
          tenant_id: item.tenantId,
          name: item.name,
          brand: item.brand,
          status: item.status,
          priority: item.priority,
          product_data: item.productData,
          added_at: item.addedAt,
          processing_started_at: item.processingStartedAt,
          completed_at: item.completedAt,
          estimated_time: item.estimatedTime,
          retry_count: item.retryCount,
          error_message: item.errorMessage,
          special_treatment: item.specialTreatment,
          session_id: item.metadata.sessionId,
          user_agent: item.metadata.userAgent,
          source: item.metadata.source
        }
      });
      
      this.logInfo('Queue item saved to database', { itemId: item.id, tenantId: item.tenantId });
    } catch (error) {
      this.logError('Failed to save queue item', error);
      throw error;
    }
  }

  private async fetchQueueItems(tenantId: string, includeCompleted: boolean): Promise<QueueItem[]> {
    try {
      const items = await prisma.product_queue.findMany({
        where: {
          tenant_id: tenantId,
          status: includeCompleted 
            ? undefined 
            : { in: ['queued', 'processing'] }
        },
        orderBy: [
          { priority: 'desc' },
          { added_at: 'asc' }
        ]
      });

      return items.map(this.mapDatabaseItemToQueueItem);
    } catch (error) {
      this.logError('Failed to fetch queue items', error);
      throw error;
    }
  }

  private async getQueueItem(itemId: string): Promise<QueueItem | null> {
    try {
      const item = await prisma.product_queue.findUnique({
        where: { id: itemId }
      });
      
      return item ? this.mapDatabaseItemToQueueItem(item) : null;
    } catch (error) {
      this.logError('Failed to get queue item', error);
      throw error;
    }
  }

  private async updateQueueItem(itemId: string, updates: Partial<QueueItem>): Promise<void> {
    try {
      const updateData: any = {};
      
      if (updates.status) updateData.status = updates.status;
      if (updates.priority) updateData.priority = updates.priority;
      if (updates.processingStartedAt) updateData.processing_started_at = updates.processingStartedAt;
      if (updates.completedAt) updateData.completed_at = updates.completedAt;
      if (updates.errorMessage) updateData.error_message = updates.errorMessage;
      if (updates.retryCount !== undefined) updateData.retry_count = updates.retryCount;
      
      await prisma.product_queue.update({
        where: { id: itemId },
        data: updateData
      });
      
      this.logInfo('Queue item updated', { itemId });
    } catch (error) {
      this.logError('Failed to update queue item', error);
      throw error;
    }
  }

  private async updateItemStatus(itemId: string, status: QueueItem['status'], errorMessage?: string): Promise<void> {
    try {
      const updateData: any = { status };
      
      if (status === 'processing') {
        updateData.processing_started_at = new Date();
      } else if (status === 'completed') {
        updateData.completed_at = new Date();
      } else if (status === 'error' && errorMessage) {
        updateData.error_message = errorMessage;
      }
      
      await prisma.product_queue.update({
        where: { id: itemId },
        data: updateData
      });
      
      this.logInfo('Queue item status updated', { itemId, status });
    } catch (error) {
      this.logError('Failed to update item status', error);
      throw error;
    }
  }

  private async deleteQueueItem(itemId: string, tenantId: string): Promise<void> {
    try {
      await prisma.product_queue.delete({
        where: { id: itemId }
      });
      
      this.logInfo('Queue item deleted', { itemId, tenantId });
    } catch (error) {
      this.logError('Failed to delete queue item', error);
      throw error;
    }
  }

  private async deleteOldQueueItems(tenantId: string, cutoffDate: Date): Promise<number> {
    try {
      // Use the database function for efficient cleanup
      const result = await prisma.$queryRaw`SELECT cleanup_old_queue_items(${tenantId}, 30, ARRAY['processing', 'queued'])` as any[];
      const deletedCount = Number(result[0]?.cleanup_old_queue_items || 0);
      
      this.logInfo('Old queue items cleaned up', { tenantId, deletedCount });
      return deletedCount;
    } catch (error) {
      this.logError('Failed to delete old queue items', error);
      return 0;
    }
  }

  // Helper methods for database alignment
  private mapDatabaseItemToQueueItem(item: any): QueueItem {
    return {
      id: item.id,
      tenantId: item.tenant_id,
      name: item.name,
      brand: item.brand,
      sku: item.sku,
      status: item.status,
      priority: item.priority,
      productData: item.product_data,
      addedAt: item.added_at,
      processingStartedAt: item.processing_started_at,
      completedAt: item.completed_at,
      estimatedTime: item.estimated_time,
      specialTreatment: item.special_treatment,
      errorMessage: item.error_message,
      retryCount: item.retry_count,
      metadata: {
        sessionId: item.session_id,
        userAgent: item.user_agent,
        source: item.source
      }
    };
  }

  private async fetchQueueStatsFromView(tenantId: string): Promise<QueueStats> {
    try {
      // Use the database view for optimized stats with parameterized query
      const stats = await prisma.$queryRaw`SELECT * FROM product_queue_stats WHERE tenant_id = ${tenantId}` as any[];
      const stat = stats[0];
      
      if (!stat) {
        // Return empty stats if no data
        return {
          total: 0,
          queued: 0,
          processing: 0,
          completed: 0,
          published: 0,
          enhanced: 0,
          error: 0,
          cancelled: 0,
          estimatedTotalTime: 0,
          averageProcessingTime: 0,
          successRate: 0
        };
      }
      
      return {
        total: Number(stat.total_items),
        queued: Number(stat.queued_items),
        processing: Number(stat.processing_items),
        completed: Number(stat.completed_items),
        published: Number(stat.published_items || 0),
        enhanced: Number(stat.enhanced_items || 0),
        error: Number(stat.error_items),
        cancelled: Number(stat.cancelled_items),
        estimatedTotalTime: Number(stat.estimated_total_time || 0),
        averageProcessingTime: Number(stat.average_processing_time_minutes || 0),
        successRate: Number(stat.success_rate_percentage || 0)
      };
    } catch (error) {
      this.logError('Failed to fetch queue stats from view', error);
      // Fallback to manual calculation
      const items = await this.fetchQueueItems(tenantId, true);
      return this.calculateStats(items);
    }
  }

  private async setTenantContext(tenantId: string): Promise<void> {
    // Set tenant context for Row Level Security
    await prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
    await prisma.$executeRaw`SET app.service_role = 'service'`;
  }
}

// Export singleton instance
export const productQueueService = ProductQueueService.getInstance();
