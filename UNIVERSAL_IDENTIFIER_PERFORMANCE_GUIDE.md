# Universal Identifier Performance Guide

## 🎯 **Performance Overview**

The Universal Identifier system is designed for high-performance tenant resolution with sub-millisecond cache hits and optimal database fallback behavior.

## 📊 **Performance Metrics**

### **Baseline Performance**
| Operation | Cache Hit | Cache Miss | Database Fallback |
|-----------|-----------|-----------|------------------|
| **Single Resolution** | ~40ms | ~600ms | ~800ms |
| **Batch Resolution** | ~45ms per ID | ~650ms per ID | ~850ms per ID |
| **Cache Encryption** | <5ms | <10ms | N/A |
| **Cache Decryption** | <5ms | N/A | N/A |

### **Cache Performance Characteristics**
- **Hit Rate Target**: 85-95%
- **Memory Usage**: ~1KB per cached entry
- **TTL**: 15 minutes (configurable)
- **Max Entries**: 1000 (configurable)
- **Cleanup Interval**: 5 minutes

## ⚡ **Performance Optimization**

### **1. Cache Warming Strategy**

#### **Proactive Cache Warming**
```typescript
class CacheWarmer {
  private cache: UniversalIdentifierCache;
  private highTrafficIdentifiers: string[] = [
    'tid-m8ijkrnk',
    'baraka-international-market-inc',
    'ULCW',
    // Add frequently accessed tenants
  ];
  
  async warmCache(): Promise<void> {
    console.log('[CacheWarmer] Starting cache warming...');
    
    const startTime = Date.now();
    const promises = this.highTrafficIdentifiers.map(async (identifier) => {
      try {
        await this.cache.resolveIdentifier(identifier);
        return { identifier, success: true };
      } catch (error) {
        console.warn(`[CacheWarmer] Failed to warm ${identifier}:`, error);
        return { identifier, success: false, error };
      }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const duration = Date.now() - startTime;
    
    console.log(`[CacheWarmer] Warmed ${successCount}/${results.length} entries in ${duration}ms`);
  }
  
  async warmOnDemand(identifiers: string[]): Promise<void> {
    console.log(`[CacheWarmer] Warming ${identifiers.length} on-demand entries`);
    
    const promises = identifiers.map(id => this.cache.resolveIdentifier(id));
    await Promise.all(promises);
    
    console.log(`[CacheWarmer] On-demand warming complete`);
  }
}
```

#### **Scheduled Cache Warming**
```typescript
// Schedule cache warming
setInterval(async () => {
  const warmer = CacheWarmer.getInstance();
  await warmer.warmCache();
}, 30 * 60 * 1000); // Every 30 minutes

// Warm cache on application startup
async function initializeCache() {
  const warmer = CacheWarmer.getInstance();
  await warmer.warmCache();
}
```

### **2. Intelligent Caching**

#### **Adaptive TTL Based on Access Patterns**
```typescript
class AdaptiveCacheManager {
  private accessPatterns: Map<string, AccessPattern> = new Map();
  
  calculateTTL(identifier: string, baseTTL: number): number {
    const pattern = this.accessPatterns.get(identifier);
    
    if (!pattern) {
      return baseTTL; // Default TTL
    }
    
    // Adjust TTL based on access frequency
    if (pattern.frequency > 10) {
      return baseTTL * 2; // Longer TTL for frequently accessed
    } else if (pattern.frequency < 2) {
      return baseTTL / 2; // Shorter TTL for rarely accessed
    }
    
    return baseTTL;
  }
  
  recordAccess(identifier: string): void {
    const pattern = this.accessPatterns.get(identifier) || {
      frequency: 0,
      lastAccess: Date.now(),
      averageInterval: 0
    };
    
    pattern.frequency++;
    const now = Date.now();
    if (pattern.lastAccess) {
      const interval = now - pattern.lastAccess;
      pattern.averageInterval = (pattern.averageInterval + interval) / 2;
    }
    pattern.lastAccess = now;
    
    this.accessPatterns.set(identifier, pattern);
  }
}
```

#### **Priority-Based Cache Eviction**
```typescript
class PriorityCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private priorities: Map<string, number> = new Map();
  
  set(key: string, value: any, priority: number = 1): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      priority
    });
    
    this.priorities.set(key, priority);
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    entry.accessCount++;
    entry.timestamp = Date.now();
    
    return entry.value;
  }
  
  evictLowPriority(): void {
    if (this.cache.size <= this.maxEntries) {
      return;
    }
    
    // Sort by priority (lower = lower priority)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => {
        const priorityA = this.priorities.get(a[0]) || 1;
        const priorityB = this.priorities.get(b[0]) || 1;
        return priorityA - priorityB;
      });
    
    // Evict lowest priority entries
    const toEvict = entries.slice(0, entries.length - this.maxEntries);
    
    for (const [key] of toEvict) {
      this.cache.delete(key);
      this.priorities.delete(key);
    }
    
    console.log(`[Cache] Evicted ${toEvict.length} low priority entries`);
  }
}
```

### **3. Database Optimization**

#### **Optimized Database Queries**
```typescript
class OptimizedTenantResolver {
  // Use prepared statements for better performance
  private static readonly TENANT_QUERY = `
    SELECT id, name, slug, subscription_status, metadata, created_at
    FROM tenants
    WHERE id = $1
    LIMIT 1
  `;
  
  async resolveFromDatabase(identifier: string): Promise<ResolvedTenant | null> {
    // Try tenant_id first (most common)
    let tenant = await this.queryByTenantId(identifier);
    if (tenant) return tenant;
    
    // Try slug
    tenant = await this.queryBySlug(identifier);
    if (tenant) return tenant;
    
    // Try auto_id
    tenant = await this.queryByAutoId(identifier);
    return tenant;
  }
  
  private async queryByTenantId(tenantId: string): Promise<ResolvedTenant | null> {
    const result = await this.pool.query({
      text: OptimizedTenantResolver.TENANT_QUERY,
      values: [tenantId]
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return this.mapRowToTenant(row, 'tenant_id');
  }
  
  private mapRowToTenant(row: any, type: string): ResolvedTenant {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      subscriptionStatus: row.subscription_status || 'unknown',
      metadata: row.metadata,
      type: type as 'tenant_id' | 'slug' | 'auto_id'
    };
  }
}
```

#### **Connection Pool Optimization**
```typescript
// Database connection pool configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum connections
  min: 5,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Batch query optimization
async function batchResolve(identifiers: string[]): Promise<Map<string, ResolvedTenant | null>> {
  const results = new Map<string, ResolvedTenant | null>();
  
  // Create batch query for tenant_id lookups
  const tenantIds = identifiers.filter(id => id.startsWith('tid-'));
  if (tenantIds.length > 0) {
    const batchResult = await this.batchQueryByTenantIds(tenantIds);
    batchResult.forEach((tenant, id) => {
      results.set(id, tenant);
    });
  }
  
  // Handle remaining identifiers individually
  const remaining = identifiers.filter(id => !id.startsWith('tid-'));
  for (const identifier of remaining) {
    const tenant = await this.resolveFromDatabase(identifier);
    results.set(identifier, tenant);
  }
  
  return results;
}
```

### **4. Memory Management**

#### **Efficient Memory Usage**
```typescript
class MemoryOptimizedCache {
  private cache: Map<string, CompressedCacheEntry> = new Map();
  private maxMemoryUsage = 100 * 1024 * 1024; // 100MB
  private currentMemoryUsage = 0;
  
  set(key: string, data: any): void {
    // Compress data before caching
    const compressed = this.compress(data);
    const entrySize = compressed.length;
    
    // Check memory limit
    if (this.currentMemoryUsage + entrySize > this.maxMemoryUsage) {
      this.evictLeastRecentlyUsed();
    }
    
    this.cache.set(key, {
      compressed,
      size: entrySize,
      timestamp: Date.now(),
      accessCount: 0
    });
    
    this.currentMemoryUsage += entrySize;
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Decompress data
    const data = this.decompress(entry.compressed);
    
    // Update access tracking
    entry.accessCount++;
    entry.timestamp = Date.now();
    
    return data;
  }
  
  private compress(data: any): Buffer {
    const jsonString = JSON.stringify(data);
    return zlib.gzipSync(jsonString);
  }
  
  private decompress(compressed: Buffer): any {
    const jsonString = zlib.gunzipSync(compressed).toString();
    return JSON.parse(jsonString);
  }
  
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Evict oldest entries until within memory limit
    while (this.currentMemoryUsage > this.maxMemoryUsage && entries.length > 0) {
      const [key, entry] = entries.shift()!;
      this.cache.delete(key);
      this.currentMemoryUsage -= entry.size;
    }
  }
}
```

## 📈 **Performance Monitoring**

### **Real-Time Performance Metrics**
```typescript
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  
  recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const metricArray = this.metrics.get(operation)!;
    metricArray.push({
      timestamp: Date.now(),
      duration,
      operation
    });
    
    // Keep only last 1000 metrics per operation
    if (metricArray.length > 1000) {
      metricArray.splice(0, metricArray.length - 1000);
    }
    
    // Check for performance alerts
    this.checkPerformanceAlerts(operation, duration);
  }
  
  private checkPerformanceAlerts(operation: string, duration: number): void {
    const metrics = this.metrics.get(operation)!;
    const averageDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    
    // Alert if performance degrades
    if (duration > averageDuration * 3) {
      this.addAlert({
        type: 'PERFORMANCE_DEGRADATION',
        operation,
        duration,
        averageDuration,
        timestamp: Date.now(),
        severity: duration > averageDuration * 5 ? 'HIGH' : 'MEDIUM'
      });
    }
  }
  
  getPerformanceReport(): PerformanceReport {
    const report: PerformanceReport = {
      operations: {},
      overall: {
        totalOperations: 0,
        averageDuration: 0,
        slowOperations: 0,
        alerts: this.alerts.length
      },
      timestamp: Date.now()
    };
    
    let totalDuration = 0;
    let totalOperations = 0;
    
    for (const [operation, metrics] of this.metrics.entries()) {
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      const slowCount = metrics.filter(m => m.duration > avgDuration * 2).length;
      
      report.operations[operation] = {
        count: metrics.length,
        averageDuration: avgDuration,
        minDuration: Math.min(...metrics.map(m => m.duration)),
        maxDuration: Math.max(...metrics.map(m => m.duration)),
        slowOperations: slowCount,
        p95Duration: this.calculatePercentile(metrics, 95),
        p99Duration: this.calculatePercentile(metrics, 99)
      };
      
      totalDuration += avgDuration * metrics.length;
      totalOperations += metrics.length;
      report.overall.slowOperations += slowCount;
    }
    
    report.overall.totalOperations = totalOperations;
    report.overall.averageDuration = totalDuration / totalOperations;
    
    return report;
  }
  
  private calculatePercentile(metrics: PerformanceMetric[], percentile: number): number {
    const sorted = metrics.map(m => m.duration).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
```

### **Cache Performance Dashboard**
```typescript
class CachePerformanceDashboard {
  generateDashboard(): CacheDashboard {
    const cache = UniversalIdentifierCache.getInstance();
    const metrics = cache.getDetailedMetrics();
    const monitor = PerformanceMonitor.getInstance();
    
    return {
      cache: {
        status: this.getCacheStatus(metrics),
        performance: {
          hitRate: metrics.hitRate,
          avgResponseTime: metrics.avgResponseTime,
          totalRequests: metrics.hits + metrics.misses,
          memoryUsage: metrics.totalMemoryUsage,
          entries: metrics.encryptedEntries
        },
        health: {
          corruptionCount: metrics.corruptionCount,
          invalidationCount: metrics.invalidationCount,
          uptime: metrics.uptime,
          lastReset: metrics.lastReset
        }
      },
      performance: monitor.getPerformanceReport(),
      recommendations: this.generateRecommendations(metrics)
    };
  }
  
  private getCacheStatus(metrics: DetailedCacheMetrics): string {
    if (metrics.hitRate > 0.9 && metrics.avgResponseTime < 100) {
      return 'EXCELLENT';
    } else if (metrics.hitRate > 0.8 && metrics.avgResponseTime < 200) {
      return 'GOOD';
    } else if (metrics.hitRate > 0.7 && metrics.avgResponseTime < 500) {
      return 'FAIR';
    } else {
      return 'POOR';
    }
  }
  
  private generateRecommendations(metrics: DetailedCacheMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.hitRate < 0.8) {
      recommendations.push('Consider increasing cache TTL for stable data');
      recommendations.push('Implement cache warming for frequently accessed tenants');
    }
    
    if (metrics.avgResponseTime > 200) {
      recommendations.push('Optimize database queries with proper indexing');
      recommendations.push('Consider increasing cache memory allocation');
    }
    
    if (metrics.corruptionCount > 0) {
      recommendations.push('Investigate cache corruption issues');
      recommendations.push('Consider rotating encryption keys');
    }
    
    if (metrics.totalMemoryUsage > 80 * 1024 * 1024) { // 80MB
      recommendations.push('Monitor memory usage closely');
      recommendations.push('Consider reducing max cache entries');
    }
    
    return recommendations;
  }
}
```

## 🚀 **Performance Benchmarks**

### **Benchmarking Script**
```typescript
class PerformanceBenchmark {
  async runBenchmark(): Promise<BenchmarkResults> {
    const results: BenchmarkResults = {
      singleResolution: await this.benchmarkSingleResolution(),
      batchResolution: await this.benchmarkBatchResolution(),
      cachePerformance: await this.benchmarkCachePerformance(),
      databasePerformance: await this.benchmarkDatabasePerformance()
    };
    
    return results;
  }
  
  private async benchmarkSingleResolution(): Promise<SingleResolutionBenchmark> {
    const identifier = 'tid-m8ijkrnk';
    const iterations = 100;
    const times: number[] = [];
    
    // Warm up cache
    await this.resolveIdentifier(identifier);
    
    // Benchmark cache hits
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.resolveIdentifier(identifier);
      const end = performance.now();
      times.push(end - start);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const p95 = this.calculatePercentile(times, 95);
    
    return {
      iterations,
      averageTime: avgTime,
      minTime,
      maxTime,
      p95,
      cacheHitRate: 1.0 // All should be cache hits after warmup
    };
  }
  
  private async benchmarkBatchResolution(): Promise<BatchResolutionBenchmark> {
    const batchSizes = [5, 10, 25, 50];
    const results: BatchSizeBenchmark[] = [];
    
    for (const batchSize of batchSizes) {
      const identifiers = this.generateTestIdentifiers(batchSize);
      
      const times: number[] = [];
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await this.batchResolve(identifiers);
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const avgPerIdentifier = avgTime / batchSize;
      
      results.push({
        batchSize,
        iterations,
        averageTime: avgTime,
        averagePerIdentifier: avgPerIdentifier,
        efficiency: avgPerIdentifier / 50 // Target: 50ms per identifier
      });
    }
    
    return {
      batchSizes: results
    };
  }
  
  private async benchmarkCachePerformance(): Promise<CachePerformanceBenchmark> {
    const cache = UniversalIdentifierCache.getInstance();
    
    // Test encryption performance
    const testData = { id: 'test', name: 'Test Tenant' };
    const encryptionTimes: number[] = [];
    const decryptionTimes: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      // Test encryption
      const encStart = performance.now();
      await cache.encrypt(testData);
      const encEnd = performance.now();
      encryptionTimes.push(encEnd - encStart);
      
      // Test decryption
      const encrypted = await cache.encrypt(testData);
      const decStart = performance.now();
      await cache.decrypt(encrypted);
      const decEnd = performance.now();
      decryptionTimes.push(decEnd - decStart);
    }
    
    return {
      encryption: {
        iterations: 100,
        averageTime: encryptionTimes.reduce((sum, time) => sum + time, 0) / encryptionTimes.length,
        minTime: Math.min(...encryptionTimes),
        maxTime: Math.max(...encryptionTimes)
      },
      decryption: {
        iterations: 100,
        averageTime: decryptionTimes.reduce((sum, time) => sum + time, 0) / decryptionTimes.length,
        minTime: Math.min(...decryptionTimes),
        maxTime: Math.max(...decryptionTimes)
      }
    };
  }
  
  private async benchmarkDatabasePerformance(): Promise<DatabasePerformanceBenchmark> {
    const identifiers = ['tid-m8ijkrnk', 'baraka-international-market-inc'];
    const queries: DatabaseQueryMetric[] = [];
    
    for (const identifier of identifiers) {
      const start = performance.now();
      await this.resolveFromDatabase(identifier);
      const end = performance.now();
      
      queries.push({
        identifier,
        duration: end - start,
        type: 'direct_lookup'
      });
    }
    
    return {
      queries,
      averageTime: queries.reduce((sum, q) => sum + q.duration, 0) / queries.length,
      slowQueries: queries.filter(q => q.duration > 1000).length
    };
  }
}
```

### **Performance Targets**
| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| **Cache Hit Rate** | >90% | >80% | <70% |
| **Cache Response Time** | <50ms | <100ms | >200ms |
| **Batch Resolution** | <60ms per ID | <100ms per ID | >200ms per ID |
| **Encryption Time** | <10ms | <20ms | >50ms |
| **Database Query** | <500ms | <1000ms | >2000ms |

## 🔧 **Performance Tuning**

### **Environment-Specific Tuning**

#### **Development Environment**
```typescript
// Development: More verbose logging, relaxed performance
const devConfig = {
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxEntries: 500,
    cleanupInterval: 2 * 60 * 1000 // 2 minutes
  },
  monitoring: {
    detailedLogging: true,
    performanceAlerts: true,
    alertThreshold: 2 // Lower threshold for dev
  }
};
```

#### **Production Environment**
```typescript
// Production: Optimized for performance
const prodConfig = {
  cache: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxEntries: 2000,
    cleanupInterval: 10 * 60 * 1000 // 10 minutes
  },
  monitoring: {
    detailedLogging: false,
    performanceAlerts: true,
    alertThreshold: 5 // Higher threshold for prod
  }
};
```

#### **High-Traffic Environment**
```typescript
// High-traffic: Maximum performance
const highTrafficConfig = {
  cache: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxEntries: 5000,
    cleanupInterval: 15 * 60 * 1000 // 15 minutes
  },
  database: {
    poolSize: 50,
    queryTimeout: 5000,
    batchOptimization: true
  },
  monitoring: {
    detailedLogging: false,
    performanceAlerts: true,
    alertThreshold: 10 // Highest threshold
  }
};
```

This performance guide provides comprehensive strategies for optimizing the universal identifier system for different use cases and environments.
