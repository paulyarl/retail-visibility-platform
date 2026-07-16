/**
 * 🎯 Enhanced Cache Manager with Storage Type Registry
 * 
 * Tracks which storage type was used for each key for efficient lookups
 * without requiring requests to know about storage types.
 */

import { UniversalStorageManager, StorageType, UniversalCacheOptions, CacheEntry } from './universalStorageManager';
import { AppContext, CacheIsolation } from './contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

interface StorageRegistry {
  [key: string]: {
    storageType: StorageType;
    timestamp: number;
    context: AppContext;
    fallbacks: StorageType[];
  };
}

interface EnhancedCacheEntry<T> extends CacheEntry<T> {
  storageRegistry?: {
    primary: StorageType;
    fallbacks: StorageType[];
  };
}

// ==================== ENHANCED STORAGE MANAGER ====================

export class EnhancedStorageManager extends UniversalStorageManager {
  private storageRegistry: StorageRegistry = {};
  private registryCache: Map<string, StorageType[]> = new Map();

  constructor(options: UniversalCacheOptions = {}) {
    super(options);
    
    // 🔄 Load existing registry from storage
    this.loadStorageRegistry();
  }

  // ==================== ENHANCED SET WITH REGISTRY TRACKING ====================

  /**
   * 📦 Enhanced set with storage type registry tracking
   */
  async set<T>(key: string, data: T, options: UniversalCacheOptions = {}): Promise<void> {
    // 🎯 Determine context and storage strategy
    const context = (this as any).extractContextFromKey(key);
    const baseStrategy = (this as any).contextStorageConfig[context];
    const strategy = { ...baseStrategy, ...options.storageStrategy };

    // 🔄 Override if force storage specified
    if (options.forceStorage) {
      strategy.primary = options.forceStorage;
    }

    // 📊 Process data (compression, encryption)
    let processedData = data;
    if (strategy.compression) {
      processedData = await (this as any).compressData(processedData);
    }
    if (strategy.encryption) {
      // Simple resolved options for now
      const resolvedOptions = { userId: options.userId };
      processedData = await (this as any).encryptData(processedData, resolvedOptions.userId);
    }

    // 📦 Create enhanced cache entry with registry info
    const entry: EnhancedCacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl: options.ttl || strategy.ttl,
      encrypted: strategy.encryption,
      userId: options.userId,
      storageType: strategy.primary,
      compression: strategy.compression,
      httpOnly: options.httpOnly || strategy.httpOnly,
      secure: options.secure || strategy.secure,
      crossTab: options.crossTab || strategy.crossTab,
      storageRegistry: {
        primary: strategy.primary,
        fallbacks: strategy.fallbacks
      }
    };

    // 🚀 Store using universal storage strategy
    await (this as any).storeWithUniversalStrategy(key, entry, strategy);
    
    // 📝 Update storage registry
    this.updateStorageRegistry(key, strategy.primary, context, strategy.fallbacks);
    
    // 🧹 Cleanup based on context priority
    await (this as any).cleanupByContext(context, strategy);
  }

  // ==================== ENHANCED GET WITH REGISTRY LOOKUP ====================

  /**
   * 🔍 Enhanced get with efficient storage type lookup
   */
  async get<T>(key: string, options: UniversalCacheOptions = {}): Promise<T | null> {
    // 🎯 Determine context
    const context = (this as any).extractContextFromKey(key);

    // 📊 Try memory first (fastest)
    const memoryEntry = (this as any).cache.get(key);
    if (memoryEntry && (this as any).isValidEntry(memoryEntry)) {
      // console.log(`[EnhancedStorageManager] Memory HIT for ${context}:${key}`);
      return await (this as any).processEntryForRetrieval(memoryEntry, options);
    }

    // 🎯 Check storage registry for efficient lookup
    const registryEntry = this.storageRegistry[key];
    const storageTypesToCheck = this.getStorageTypesToCheck(registryEntry, context);

    // 📊 Try storage types in optimal order
    for (const storageType of storageTypesToCheck) {
      try {
        const entry = await (this as any).getFromStorage(key, storageType);
        if (entry && (this as any).isValidEntry(entry)) {
          // ✅ Found data!
          // console.log(`[EnhancedStorageManager] ${storageType} HIT for ${context}:${key}`);
          
          // 🔄 Cache in memory for faster access
          (this as any).cache.set(key, entry);
          
          // 📝 Update registry if needed
          if (!registryEntry || registryEntry.storageType !== storageType) {
            this.updateStorageRegistry(key, storageType, context, []);
          }
          
          return await (this as any).processEntryForRetrieval(entry, options);
        }
      } catch (error) {
        clientLogger.warn(`[EnhancedStorageManager] ${storageType} access failed:`, { detail: error });
        continue; // Try next storage type
      }
    }

    // ❌ Not found anywhere
    // console.log(`[EnhancedStorageManager] MISS for ${context}:${key}`);
    return null;
  }

  // ==================== STORAGE REGISTRY MANAGEMENT ====================

  /**
   * 📝 Update storage registry with key location
   */
  private updateStorageRegistry(
    key: string, 
    storageType: StorageType, 
    context: AppContext, 
    fallbacks: StorageType[]
  ): void {
    this.storageRegistry[key] = {
      storageType,
      timestamp: Date.now(),
      context,
      fallbacks
    };

    // 🔄 Persist registry to storage for cross-session tracking
    this.persistStorageRegistry();
  }

  /**
   * 📖 Get optimal storage types to check for a key
   */
  private getStorageTypesToCheck(
    registryEntry: StorageRegistry[string], 
    context: AppContext
  ): StorageType[] {
    // 🎯 If we have registry info, use it for efficient lookup
    if (registryEntry) {
      const typesToCheck = [registryEntry.storageType, ...registryEntry.fallbacks];
      // console.log(`[EnhancedStorageManager] Registry lookup: ${typesToCheck.join(' → ')}`);
      return typesToCheck;
    }

    // 🔄 If no registry info, use context-based strategy
    const strategy = (this as any).contextStorageConfig[context];
    const typesToCheck = [strategy.primary, ...strategy.fallbacks];
    // console.log(`[EnhancedStorageManager] Context-based lookup: ${typesToCheck.join(' → ')}`);
    return typesToCheck;
  }

  /**
   * 💾 Persist storage registry to persistent storage
   */
  private async persistStorageRegistry(): Promise<void> {
    try {
      const registryData = JSON.stringify(this.storageRegistry);
      
      // Try to store in the most reliable storage type available
      if ((this as any).capabilities[StorageType.LOCAL_STORAGE]) {
        localStorage.setItem('storage-registry', registryData);
      } else if ((this as any).capabilities[StorageType.SESSION_STORAGE]) {
        sessionStorage.setItem('storage-registry', registryData);
      } else if ((this as any).capabilities[StorageType.COOKIES]) {
        // Split into multiple cookies if needed
        const chunks = this.chunkString(registryData, 3000); // 3KB chunks
        chunks.forEach((chunk, index) => {
          document.cookie = `registry-chunk-${index}=${encodeURIComponent(chunk)}; path=/`;
        });
      }
    } catch (error) {
      clientLogger.warn('[EnhancedStorageManager] Failed to persist storage registry:', { detail: error });
    }
  }

  /**
   * 📖 Load storage registry from persistent storage
   */
  private async loadStorageRegistry(): Promise<void> {
    try {
      let registryData: string | null = null;

      // Try to load from the most reliable storage type
      if ((this as any).capabilities[StorageType.LOCAL_STORAGE]) {
        registryData = localStorage.getItem('storage-registry');
      } else if ((this as any).capabilities[StorageType.SESSION_STORAGE]) {
        registryData = sessionStorage.getItem('storage-registry');
      } else if ((this as any).capabilities[StorageType.COOKIES]) {
        // Reconstruct from cookie chunks
        const chunks: string[] = [];
        let index = 0;
        while (true) {
          const chunk = document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .find(cookie => cookie.startsWith(`registry-chunk-${index}=`));
          
          if (!chunk) break;
          
          chunks.push(decodeURIComponent(chunk.split('=')[1]));
          index++;
        }
        registryData = chunks.join('');
      }

      if (registryData) {
        const parsedRegistry = JSON.parse(registryData);
        this.storageRegistry = parsedRegistry;
        // console.log(`[EnhancedStorageManager] Loaded ${Object.keys(this.storageRegistry).length} registry entries`);
      }
    } catch (error) {
      clientLogger.warn('[EnhancedStorageManager] Failed to load storage registry:', { detail: error });
    }
  }

  /**
   * ✂️ Helper to chunk strings for cookie storage
   */
  private chunkString(str: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // ==================== ENHANCED REMOVE WITH REGISTRY CLEANUP ====================

  /**
   * 🗑️ Enhanced remove with registry cleanup
   */
  async remove(key: string): Promise<void> {
    // 🗑️ Remove from all storage types (inherited behavior)
    await super.remove(key);

    // 🧹 Clean up registry entry
    delete this.storageRegistry[key];
    
    // 🔄 Persist updated registry
    await this.persistStorageRegistry();
  }

  /**
   * 🧹 Enhanced clear with registry cleanup
   */
  async clear(): Promise<void> {
    // 🧹 Clear all storage types (inherited behavior)
    await super.clear();

    // 🧹 Clear registry
    this.storageRegistry = {};
    
    // 🔄 Persist empty registry
    await this.persistStorageRegistry();
  }

  // ==================== REGISTRY ANALYSIS METHODS ====================

  /**
   * 📊 Get storage registry statistics
   */
  public getRegistryStats(): {
    totalEntries: number;
    storageTypeDistribution: Record<StorageType, number>;
    contextDistribution: Record<AppContext, number>;
    averageAge: number;
  } {
    const stats = {
      totalEntries: Object.keys(this.storageRegistry).length,
      storageTypeDistribution: {} as Record<StorageType, number>,
      contextDistribution: {} as Record<AppContext, number>,
      averageAge: 0
    };

    let totalAge = 0;
    const now = Date.now();

    for (const key in this.storageRegistry) {
      const entry = this.storageRegistry[key];
      
      // Count storage types
      stats.storageTypeDistribution[entry.storageType] = 
        (stats.storageTypeDistribution[entry.storageType] || 0) + 1;

      // Count contexts
      stats.contextDistribution[entry.context] = 
        (stats.contextDistribution[entry.context] || 0) + 1;

      // Calculate age
      totalAge += now - entry.timestamp;
    }

    stats.averageAge = stats.totalEntries > 0 ? totalAge / stats.totalEntries : 0;

    return stats;
  }

  /**
   * 🔍 Find keys by storage type
   */
  public getKeysByStorageType(storageType: StorageType): string[] {
    const keys: string[] = [];
    for (const key in this.storageRegistry) {
      if (this.storageRegistry[key].storageType === storageType) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * 🔍 Find keys by context
   */
  public getKeysByContext(context: AppContext): string[] {
    const keys: string[] = [];
    for (const key in this.storageRegistry) {
      if (this.storageRegistry[key].context === context) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * 🔍 Get storage type for a specific key
   */
  public getStorageTypeForKey(key: string): StorageType | null {
    const entry = this.storageRegistry[key];
    return entry ? entry.storageType : null;
  }

  /**
   * 🧹 Cleanup old registry entries
   */
  public async cleanupRegistry(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (const key in this.storageRegistry) {
      if (now - this.storageRegistry[key].timestamp > maxAge) {
        keysToRemove.push(key);
      }
    }

    // Remove old entries
    for (const key of keysToRemove) {
      delete this.storageRegistry[key];
    }

    // Persist cleaned registry
    await this.persistStorageRegistry();

    // console.log(`[EnhancedStorageManager] Cleaned up ${keysToRemove.length} old registry entries`);
    return keysToRemove.length;
  }

  // ==================== ENHANCED STATISTICS ====================

  /**
   * 📊 Get comprehensive statistics including registry
   */
  public getEnhancedStats(): any {
    const baseStats = this.getStats();
    const registryStats = this.getRegistryStats();

    return {
      ...baseStats,
      registry: registryStats,
      storageEfficiency: this.calculateStorageEfficiency()
    };
  }

  /**
   * 📈 Calculate storage efficiency metrics
   */
  private calculateStorageEfficiency(): {
    hitRate: number;
    missRate: number;
    fallbackRate: number;
    storageTypeUtilization: Record<StorageType, number>;
  } {
    // This would require tracking hit/miss statistics over time
    // For now, return basic utilization based on registry
    const utilization: Record<StorageType, number> = {} as Record<StorageType, number>;
    const totalEntries = Object.keys(this.storageRegistry).length;

    for (const key in this.storageRegistry) {
      const entry = this.storageRegistry[key];
      utilization[entry.storageType] = (utilization[entry.storageType] || 0) + 1;
    }

    // Convert to percentages
    for (const storageType in utilization) {
      utilization[storageType as StorageType] = (utilization[storageType as StorageType] / totalEntries) * 100;
    }

    return {
      hitRate: 0, // Would need to track actual hits
      missRate: 0, // Would need to track actual misses
      fallbackRate: 0, // Would need to track fallback usage
      storageTypeUtilization: utilization
    };
  }
}

// ==================== EXPORTS ====================

export default EnhancedStorageManager;
export type { StorageRegistry, EnhancedCacheEntry };
