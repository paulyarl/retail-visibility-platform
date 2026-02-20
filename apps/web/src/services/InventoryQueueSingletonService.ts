/**
 * Inventory Queue Singleton Service
 * 
 * Handles inventory queue operations with automatic caching and error handling.
 * Extends UniversalSingleton for authenticated requests.
 * 
 * Features:
 * - Queue management (add, update, remove items)
 * - Queue statistics and monitoring
 * - Bulk operations and cleanup
 * - Export functionality
 * - Priority management
 * - Automatic caching with appropriate TTLs
 * - Error handling and logging
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface QueueItem {
  id: string;
  tenantId: string;
  name: string;
  brand: string;
  status: 'queued' | 'processing' | 'completed' | 'error' | 'cancelled';
  priority: 'normal' | 'high' | 'urgent';
  productData: any;
  addedAt: string;
  estimatedTime: number;
  specialTreatment: string[];
  processingStartedAt?: string;
  completedAt?: string;
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
  error: number;
  cancelled: number;
  estimatedTotalTime: number;
  averageProcessingTime: number;
  successRate: number;
}

export interface QueueOperation {
  action: 'clear' | 'clear_completed' | 'clear_failed' | 'cancel' | 'delete';
  timestamp: string;
}

class InventoryQueueSingletonService extends TenantApiSingleton {
  private static instance: InventoryQueueSingletonService;
  
  // Different TTLs for different data types
  private readonly CACHE_TTL_SHORT = 2 * 60 * 1000; // 2 minutes for real-time queue data
  private readonly CACHE_TTL_MEDIUM = 5 * 60 * 1000; // 5 minutes for stats
  private readonly CACHE_TTL_LONG = 15 * 60 * 1000; // 15 minutes for historical data

  static getInstance(): InventoryQueueSingletonService {
    if (!InventoryQueueSingletonService.instance) {
      InventoryQueueSingletonService.instance = new InventoryQueueSingletonService();
    }
    return InventoryQueueSingletonService.instance;
  }

  constructor() {
    super('InventoryQueueSingletonService');
  }

  /**
   * Add items to queue
   * Authenticated endpoint for queue management
   */
  async addToQueue(tenantId: string, items: any[], priority: 'normal' | 'high' | 'urgent' = 'normal'): Promise<any> {
    try {
      if (!tenantId || !items || items.length === 0) {
        throw new Error('Tenant ID and items are required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            items,
            priority
          })
        },
        `add-to-queue-${tenantId}`,
        this.CACHE_TTL_SHORT
      );

      // Invalidate cache for queue data after adding items
      this.invalidateCache(`queue-items-${tenantId}`);
      this.invalidateCache(`queue-stats-${tenantId}`);

      return response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to add items to queue:', error);
      return null;
    }
  }

  /**
   * Get queue items with optional filters
   * Authenticated endpoint for queue monitoring
   */
  async getQueueItems(tenantId: string, options: {
    includeCompleted?: boolean;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<QueueItem[] | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const searchParams = new URLSearchParams();
    if (options.includeCompleted) searchParams.append('includeCompleted', 'true');
    if (options.status) searchParams.append('status', options.status);
    if (options.limit) searchParams.append('limit', options.limit.toString());
    if (options.offset) searchParams.append('offset', options.offset.toString());

    const response = await this.makeDefaultRequest<QueueItem[]>(
      `/api/queue/${tenantId}?${searchParams.toString()}`,
      {},
      `queue-items-${tenantId}-${JSON.stringify(options)}`,
      this.CACHE_TTL_SHORT
    );

    if (!response.success) {
      console.error('[InventoryQueueSingleton] Failed to get queue items:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get queue statistics
   * Authenticated endpoint for queue monitoring
   */
  async getQueueStats(tenantId: string): Promise<QueueStats | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<QueueStats>(
      `/api/queue/${tenantId}?stats=true`,
      {},
      `queue-stats-${tenantId}`,
      this.CACHE_TTL_MEDIUM
    );

    if (!response.success) {
      console.error('[InventoryQueueSingleton] Failed to get queue stats:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Update item status
   * Authenticated endpoint for queue management
   */
  async updateItemStatus(tenantId: string, itemId: string, status: string): Promise<boolean> {
    try {
      if (!tenantId || !itemId || !status) {
        throw new Error('Tenant ID, item ID, and status are required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status })
        },
        `update-item-status-${tenantId}-${itemId}`,
        this.CACHE_TTL_SHORT
      );

      // Invalidate cache for queue data after updating item
      this.invalidateCache(`queue-items-${tenantId}`);
      this.invalidateCache(`queue-stats-${tenantId}`);

      return !!response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to update item status:', error);
      return false;
    }
  }

  /**
   * Remove item from queue
   * Authenticated endpoint for queue management
   */
  async removeFromQueue(tenantId: string, itemId?: string): Promise<boolean> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const searchParams = new URLSearchParams();
      if (itemId) searchParams.append('itemId', itemId);

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}?${searchParams.toString()}`,
        {
          method: 'DELETE'
        },
        `remove-from-queue-${tenantId}${itemId ? `-${itemId}` : ''}`,
        this.CACHE_TTL_SHORT
      );

      // Invalidate cache for queue data after removing items
      this.invalidateCache(`queue-items-${tenantId}`);
      this.invalidateCache(`queue-stats-${tenantId}`);

      return !!response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to remove from queue:', error);
      return false;
    }
  }

  /**
   * Clear queue with action
   * Authenticated endpoint for queue management
   */
  async clearQueue(tenantId: string, action: 'clear' | 'clear_completed' | 'clear_failed' | 'cancel' | 'delete'): Promise<boolean> {
    try {
      if (!tenantId || !action) {
        throw new Error('Tenant ID and action are required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}`,
        {
          method: 'DELETE',
          body: JSON.stringify({ action })
        },
        `clear-queue-${tenantId}-${action}`,
        this.CACHE_TTL_SHORT
      );

      // Invalidate cache for queue data after clearing
      this.invalidateCache(`queue-items-${tenantId}`);
      this.invalidateCache(`queue-stats-${tenantId}`);

      return !!response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to clear queue:', error);
      return false;
    }
  }

  /**
   * Update item priority
   * Authenticated endpoint for queue management
   */
  async updateItemPriority(tenantId: string, itemId: string, priority: 'normal' | 'high' | 'urgent'): Promise<boolean> {
    try {
      if (!tenantId || !itemId || !priority) {
        throw new Error('Tenant ID, item ID, and priority are required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            action: 'update_priority',
            itemId,
            priority
          })
        },
        `update-priority-${tenantId}-${itemId}`,
        this.CACHE_TTL_SHORT
      );

      // Invalidate cache for queue data after updating priority
      this.invalidateCache(`queue-items-${tenantId}`);

      return !!response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to update item priority:', error);
      return false;
    }
  }

  /**
   * Process queue items
   * Authenticated endpoint for queue processing
   */
  async processQueue(tenantId: string, options: {
    itemIds?: string[];
    maxConcurrent?: number;
    timeout?: number;
    retryFailed?: boolean;
    priority?: 'normal' | 'high' | 'urgent';
  } = {}): Promise<boolean> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            action: 'process',
            ...options
          })
        },
        `process-queue-${tenantId}`,
        this.CACHE_TTL_SHORT
      );

      // Invalidate cache for queue data after processing
      this.invalidateCache(`queue-items-${tenantId}`);
      this.invalidateCache(`queue-stats-${tenantId}`);

      return !!response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to process queue:', error);
      return false;
    }
  }

  /**
   * Cleanup old items
   * Authenticated endpoint for queue maintenance
   */
  async cleanupOldItems(tenantId: string, olderThanDays: number = 7): Promise<boolean> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}?cleanup=true&olderThanDays=${olderThanDays}`,
        {
          method: 'DELETE'
        },
        `cleanup-queue-${tenantId}`,
        this.CACHE_TTL_LONG
      );

      // Invalidate cache for queue data after cleanup
      this.invalidateCache(`queue-items-${tenantId}`);
      this.invalidateCache(`queue-stats-${tenantId}`);

      return !!response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to cleanup old items:', error);
      return false;
    }
  }

  /**
   * Export queue data
   * Authenticated endpoint for data export
   */
  async exportQueue(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/queue/${tenantId}/export`,
        {},
        `export-queue-${tenantId}`,
        this.CACHE_TTL_LONG
      );

      return response;
    } catch (error) {
      console.error('[InventoryQueueSingleton] Failed to export queue:', error);
      return null;
    }
  }
}

// Export singleton instance
export const inventoryQueueService = InventoryQueueSingletonService.getInstance();
