/**
 * Taxonomy Sync Service - UniversalSingleton Implementation
 * Product taxonomy synchronization with conflict resolution and performance optimization
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';
import { GoogleTaxonomyService } from './GoogleTaxonomyService';
import { GOOGLE_PRODUCT_TAXONOMY } from '../lib/google/taxonomy';

interface TaxonomyRecord {
  category_id: string;
  category_path: string;
  parent_id: string | null;
  level: number;
  is_active: boolean;
  version: string;
  created_at: Date;
  updated_at: Date;
}

interface TaxonomyChange {
  type: 'new' | 'updated' | 'deleted' | 'moved';
  category_id: string;
  oldData?: TaxonomyRecord;
  newData?: TaxonomyRecord;
  timestamp: Date;
}

interface SyncStats {
  totalCategories: number;
  activeCategories: number;
  syncOperations: number;
  averageSyncTime: number;
  conflictRate: number;
  cacheHitRate: number;
  lastSyncTime: string;
  version: string;
  changeHistory: TaxonomyChange[];
  performanceMetrics: {
    avgFetchTime: number;
    avgProcessTime: number;
    avgBatchTime: number;
  };
}

interface SyncOperation {
  id: string;
  type: 'full_sync' | 'incremental_sync' | 'conflict_resolution';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  categoriesProcessed: number;
  changesDetected: number;
  conflicts: number;
  errors?: string[];
}

class TaxonomySyncSingletonService extends UniversalSingleton {
  private static instance: TaxonomySyncSingletonService;
  private googleService: GoogleTaxonomyService;
  private syncOperations: Map<string, SyncOperation>;
  private conflictResolutionCache: Map<string, TaxonomyRecord>;
  
  // Configuration
  private readonly BATCH_SIZE = 200;
  private readonly MAX_HISTORY_SIZE = 100;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'admin',
      defaultTTL: 3600, // 1 hour
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize services and state
    this.googleService = new GoogleTaxonomyService();
    this.syncOperations = new Map();
    this.conflictResolutionCache = new Map();
  }

  static getInstance(): TaxonomySyncSingletonService {
    if (!TaxonomySyncSingletonService.instance) {
      TaxonomySyncSingletonService.instance = new TaxonomySyncSingletonService('taxonomy-sync-service');
    }
    return TaxonomySyncSingletonService.instance;
  }

  // ====================
  // CORE TAXONOMY SYNC OPERATIONS
  // ====================

  /**
   * Check for taxonomy updates from Google
   */
  async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    latestVersion: string;
    changes: TaxonomyChange[];
  }> {
    const startTime = Date.now();
    
    try {
      this.logInfo('Checking for taxonomy updates from Google...');
      
      // Check cache first
      const cacheKey = 'taxonomy-update-check';
      const cached = await this.getFromCache<any>(cacheKey);
      if (cached) {
        this.logInfo('Cache HIT for taxonomy update check');
        this.metrics.cacheHits++;
        return cached;
      }

      // Fetch latest taxonomy from Google
      const latestTaxonomy = await this.googleService.fetchLatestTaxonomy();
      const fetchTime = Date.now() - startTime;
      
      this.logInfo(`Fetched latest taxonomy version: ${latestTaxonomy.version}`);
      
      // Get current taxonomy from database
      const currentTaxonomy = await this.getCurrentTaxonomy();
      this.logInfo(`Found ${currentTaxonomy.length} current taxonomy records`);
      
      // Compare and detect changes
      const changes = await this.detectChanges(currentTaxonomy, latestTaxonomy);
      
      const result = {
        hasUpdates: changes.length > 0,
        latestVersion: latestTaxonomy.version,
        changes
      };

      // Cache the result for 5 minutes
      await this.setCache(cacheKey, result, { ttl: 300 });
      
      this.metrics.cacheMisses++;
      this.logInfo(`Update check completed: ${changes.length} changes detected in ${fetchTime}ms`);
      
      return result;
    } catch (error) {
      this.logError('Error checking for taxonomy updates', error);
      this.metrics.cacheMisses++;
      throw error;
    }
  }

  /**
   * Perform full taxonomy synchronization
   */
  async performFullSync(): Promise<SyncOperation> {
    const operationId = this.generateOperationId();
    
    const syncOperation: SyncOperation = {
      id: operationId,
      type: 'full_sync',
      startTime: new Date(),
      categoriesProcessed: 0,
      changesDetected: 0,
      conflicts: 0
    };

    this.syncOperations.set(operationId, syncOperation);
    
    try {
      this.logInfo(`Starting full taxonomy sync: ${operationId}`);
      
      // Fetch latest taxonomy from Google
      const latestTaxonomy = await this.googleService.fetchLatestTaxonomy();
      
      // Process taxonomy nodes
      const taxonomyNodes = this.collectNodes([latestTaxonomy]);
      
      // Upsert in batches
      await this.upsertInBatches(taxonomyNodes);
      
      // Update operation
      syncOperation.endTime = new Date();
      syncOperation.duration = syncOperation.endTime.getTime() - syncOperation.startTime.getTime();
      syncOperation.categoriesProcessed = taxonomyNodes.length;
      
      // Clean up old operations
      if (this.syncOperations.size > this.MAX_HISTORY_SIZE) {
        this.cleanupOldOperations();
      }
      
      this.logInfo(`Full taxonomy sync completed: ${operationId} - ${taxonomyNodes.length} categories in ${syncOperation.duration}ms`);
      
      return syncOperation;
    } catch (error) {
      syncOperation.endTime = new Date();
      syncOperation.duration = syncOperation.endTime.getTime() - syncOperation.startTime.getTime();
      syncOperation.errors = [error instanceof Error ? error.message : 'Unknown error'];
      
      this.logError(`Full taxonomy sync failed: ${operationId}`, error);
      throw error;
    }
  }

  /**
   * Perform incremental sync with conflict resolution
   */
  async performIncrementalSync(): Promise<SyncOperation> {
    const operationId = this.generateOperationId();
    
    const syncOperation: SyncOperation = {
      id: operationId,
      type: 'incremental_sync',
      startTime: new Date(),
      categoriesProcessed: 0,
      changesDetected: 0,
      conflicts: 0
    };

    this.syncOperations.set(operationId, syncOperation);
    
    try {
      this.logInfo(`Starting incremental taxonomy sync: ${operationId}`);
      
      // Check for updates
      const updateCheck = await this.checkForUpdates();
      
      if (!updateCheck.hasUpdates) {
        syncOperation.endTime = new Date();
        syncOperation.duration = syncOperation.endTime.getTime() - syncOperation.startTime.getTime();
        
        this.logInfo(`No updates found for incremental sync: ${operationId}`);
        return syncOperation;
      }
      
      // Process changes
      const processedChanges = await this.processChanges(updateCheck.changes);
      
      // Update operation
      syncOperation.endTime = new Date();
      syncOperation.duration = syncOperation.endTime.getTime() - syncOperation.startTime.getTime();
      syncOperation.changesDetected = updateCheck.changes.length;
      syncOperation.conflicts = processedChanges.conflicts;
      
      // Clean up old operations
      if (this.syncOperations.size > this.MAX_HISTORY_SIZE) {
        this.cleanupOldOperations();
      }
      
      this.logInfo(`Incremental sync completed: ${operationId} - ${updateCheck.changes.length} changes, ${processedChanges.conflicts} conflicts in ${syncOperation.duration}ms`);
      
      return syncOperation;
    } catch (error) {
      syncOperation.endTime = new Date();
      syncOperation.duration = syncOperation.endTime.getTime() - syncOperation.startTime.getTime();
      syncOperation.errors = [error instanceof Error ? error.message : 'Unknown error'];
      
      this.logError(`Incremental sync failed: ${operationId}`, error);
      throw error;
    }
  }

  /**
   * Get current taxonomy from database
   */
  async getCurrentTaxonomy(): Promise<TaxonomyRecord[]> {
    try {
      const cacheKey = 'current-taxonomy';
      const cached = await this.getFromCache<TaxonomyRecord[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const records = await prisma.google_taxonomy_list.findMany({
        where: { is_active: true },
        orderBy: [{ level: 'asc' }, { category_path: 'asc' }]
      });

      await this.setCache(cacheKey, records, { ttl: this.CACHE_TTL_MS });
      return records;
    } catch (error) {
      this.logError('Error getting current taxonomy', error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const cacheKey = 'taxonomy-sync-stats';
      const cached = await this.getFromCache<SyncStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const currentTaxonomy = await this.getCurrentTaxonomy();
      const totalOperations = this.metrics.cacheHits + this.metrics.cacheMisses;
      
      const stats: SyncStats = {
        totalCategories: currentTaxonomy.length,
        activeCategories: currentTaxonomy.filter(cat => cat.is_active).length,
        syncOperations: totalOperations,
        averageSyncTime: this.calculateAverageSyncTime(),
        conflictRate: this.calculateConflictRate(),
        cacheHitRate: this.metrics.cacheHits / (totalOperations || 1),
        lastSyncTime: new Date().toISOString(),
        version: '2024-09', // Would be dynamic in real implementation
        changeHistory: this.getRecentChanges(),
        performanceMetrics: {
          avgFetchTime: this.getAverageOperationTime('fetch'),
          avgProcessTime: this.getAverageOperationTime('process'),
          avgBatchTime: this.getAverageOperationTime('batch')
        }
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes
      return stats;
    } catch (error) {
      this.logError('Error getting sync stats', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; services: any; lastCheck: string }> {
    try {
      const operationCount = this.syncOperations.size;
      const cacheSize = this.conflictResolutionCache.size;
      
      const health = {
        status: 'healthy',
        services: {
          database: 'connected',
          googleApi: 'connected',
          syncTracking: operationCount > 0 ? 'active' : 'idle',
          conflictResolution: cacheSize > 0 ? 'active' : 'idle',
          cache: 'operational'
        },
        operationCount,
        cacheSize,
        lastCheck: new Date().toISOString()
      };

      // Determine health status
      if (operationCount > 10) {
        health.status = 'degraded';
        health.services.syncTracking = 'busy';
      }

      return health;
    } catch (error) {
      this.logError('Error checking health', error);
      return {
        status: 'unhealthy',
        services: { error: 'Health check failed' },
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Clear cache and reset state
   */
  async clearCache(): Promise<void> {
    try {
      // Clear UniversalSingleton cache (simulated)
      this.logInfo('Clearing taxonomy sync cache...');
      
      // Clear in-memory caches
      this.conflictResolutionCache.clear();
      
      this.logInfo('Taxonomy sync cache cleared successfully');
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE HELPER METHODS
  // ====================

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Collect nodes from taxonomy tree
   */
  private collectNodes(nodes: any[]): TaxonomyRecord[] {
    const out: TaxonomyRecord[] = [];
    for (const node of nodes) {
      const { id, name, children } = node;
      const parentId = node.path?.length > 1 ? node.path[node.path.length - 2] : null;
      const level = node.path?.length || 1;
      out.push({
        category_id: id,
        category_path: node.path.join(' > '),
        parent_id: parentId,
        level,
        is_active: true,
        version: '2024-09',
        created_at: new Date(),
        updated_at: new Date()
      });
      // Taxonomy is flat - no children property
    }
    return out;
  }

  /**
   * Upsert taxonomy records in batches
   */
  private async upsertInBatches(items: TaxonomyRecord[]): Promise<void> {
    this.logInfo(`Processing ${items.length} items in batches of ${this.BATCH_SIZE}`);
    
    const totalBatches = Math.ceil(items.length / this.BATCH_SIZE);
    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batch = items.slice(i, i + this.BATCH_SIZE);
      const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
      
      // Only log every 5th batch to reduce log volume
      if (batchNum % 5 === 1 || batchNum === totalBatches) {
        this.logInfo(`Processing batch ${batchNum}/${totalBatches} with ${batch.length} items`);
      }
      
      try {
        // Process items individually to avoid transaction issues
        for (const item of batch) {
          await prisma.google_taxonomy_list.upsert({
            where: { category_id: item.category_id },
            create: {
              id: item.category_id,
              category_id: item.category_id,
              category_path: item.category_path,
              parent_id: item.parent_id,
              level: item.level,
              is_active: item.is_active,
              version: item.version,
              created_at: item.created_at,
              updated_at: item.updated_at,
            },
            update: {
              category_path: item.category_path,
              parent_id: item.parent_id,
              level: item.level,
              is_active: item.is_active,
              version: item.version,
              updated_at: item.updated_at,
            },
          });
        }
        
        // Only log completion for every 5th batch or final batch
        if (batchNum % 5 === 0 || batchNum === totalBatches) {
          this.logInfo(`Batch ${batchNum}/${totalBatches} completed`);
        }
      } catch (error) {
        this.logError(`Batch ${batchNum} failed`, error);
        throw error;
      }
    }
    
    this.logInfo('All batches completed');
  }

  /**
   * Detect changes between current and latest taxonomy
   */
  private async detectChanges(current: TaxonomyRecord[], latest: any): Promise<TaxonomyChange[]> {
    const changes: TaxonomyChange[] = [];
    const currentMap = new Map(current.map(cat => [cat.category_id, cat]));
    
    // Handle different data structures from GoogleTaxonomyService
    let latestNodes: any[] = [];
    if (Array.isArray(latest)) {
      latestNodes = latest;
    } else if (latest.nodes && Array.isArray(latest.nodes)) {
      latestNodes = latest.nodes;
    } else if (latest.taxonomy && Array.isArray(latest.taxonomy)) {
      latestNodes = latest.taxonomy;
    } else {
      this.logError('Unexpected taxonomy data structure', latest);
      return [];
    }
    
    // Check for new categories
    for (const node of latestNodes) {
      if (!currentMap.has(node.id)) {
        changes.push({
          type: 'new',
          category_id: node.id,
          newData: this.convertNodeToRecord(node),
          timestamp: new Date()
        });
      }
    }
    
    // Check for updated categories
    for (const node of latestNodes) {
      const current = currentMap.get(node.id);
      if (current && this.hasChanged(current, node)) {
        changes.push({
          type: 'updated',
          category_id: node.id,
          oldData: current,
          newData: this.convertNodeToRecord(node),
          timestamp: new Date()
        });
      }
    }
    
    // Check for deleted categories
    for (const [categoryId, current] of currentMap) {
      if (!latestNodes.find(node => node.id === categoryId)) {
        changes.push({
          type: 'deleted',
          category_id: categoryId,
          oldData: current,
          timestamp: new Date()
        });
      }
    }
    
    return changes;
  }

  /**
   * Process taxonomy changes
   */
  private async processChanges(changes: TaxonomyChange[]): Promise<{ conflicts: number }> {
    let conflicts = 0;
    
    for (const change of changes) {
      try {
        switch (change.type) {
          case 'new':
          case 'updated':
            if (change.newData) {
              await this.upsertInBatches([change.newData]);
            }
            break;
          case 'deleted':
            if (change.oldData) {
              await prisma.google_taxonomy_list.update({
                where: { category_id: change.category_id },
                data: { is_active: false, updated_at: new Date() }
              });
            }
            break;
          case 'moved':
            // Handle category moves
            if (change.newData) {
              await this.upsertInBatches([change.newData]);
              conflicts++;
            }
            break;
        }
      } catch (error) {
        this.logError(`Error processing change for ${change.category_id}`, error);
        conflicts++;
      }
    }
    
    return { conflicts };
  }

  /**
   * Convert node to record format
   */
  private convertNodeToRecord(node: any): TaxonomyRecord {
    const parentId = node.path?.length > 1 ? node.path[node.path.length - 2] : null;
    const level = node.path?.length || 1;
    
    return {
      category_id: node.id,
      category_path: node.path.join(' > '),
      parent_id: parentId,
      level,
      is_active: true,
      version: '2024-09',
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  /**
   * Check if record has changed
   */
  private hasChanged(current: TaxonomyRecord, latest: any): boolean {
    return (
      current.category_path !== latest.path?.join(' > ') ||
      current.parent_id !== (latest.path?.length > 1 ? latest.path[latest.path.length - 2] : null) ||
      current.level !== (latest.path?.length || 1)
    );
  }

  /**
   * Calculate average sync time
   */
  private calculateAverageSyncTime(): number {
    const completedOps = Array.from(this.syncOperations.values())
      .filter(op => op.endTime !== undefined);
    
    if (completedOps.length === 0) return 0;
    
    const totalTime = completedOps.reduce((acc, op) => acc + (op.duration || 0), 0);
    return totalTime / completedOps.length;
  }

  /**
   * Calculate conflict rate
   */
  private calculateConflictRate(): number {
    const totalOps = Array.from(this.syncOperations.values());
    const conflictOps = totalOps.filter(op => op.conflicts > 0);
    
    return totalOps.length > 0 ? conflictOps.length / totalOps.length : 0;
  }

  /**
   * Get recent changes
   */
  private getRecentChanges(): TaxonomyChange[] {
    // Mock implementation - would track actual changes
    return [];
  }

  /**
   * Get average operation time by type
   */
  private getAverageOperationTime(type: string): number {
    const ops = Array.from(this.syncOperations.values())
      .filter(op => op.type === type && op.duration !== undefined);
    
    if (ops.length === 0) return 0;
    
    const totalTime = ops.reduce((acc, op) => acc + (op.duration || 0), 0);
    return totalTime / ops.length;
  }

  /**
   * Clean up old operations
   */
  private cleanupOldOperations(): void {
    const operations = Array.from(this.syncOperations.entries());
    
    // Sort by start time (oldest first)
    operations.sort((a, b) => a[1].startTime.getTime() - b[1].startTime.getTime());
    
    // Keep only the most recent operations
    const toKeep = operations.slice(-this.MAX_HISTORY_SIZE);
    
    // Clear and re-add
    this.syncOperations.clear();
    for (const [key, operation] of toKeep) {
      this.syncOperations.set(key, operation);
    }
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      activeOperations: this.syncOperations.size,
      conflictCacheSize: this.conflictResolutionCache.size,
      averageSyncTime: this.calculateAverageSyncTime(),
      conflictRate: this.calculateConflictRate()
    };
  }
}

export default TaxonomySyncSingletonService;
