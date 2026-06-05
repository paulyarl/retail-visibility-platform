/**
 * Cache Metrics and Monitoring System
 * 
 * Provides comprehensive monitoring for the Universal Identifier Cache
 * including performance metrics, health checks, and analytics.
 */

export interface DetailedCacheMetrics {
  // Basic metrics
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  
  // Cache size metrics
  encryptedEntries: number;
  totalMemoryUsage: number;
  avgEntrySize: number;
  
  // Performance metrics
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  
  // Identifier type metrics
  tenantIdHits: number;
  slugHits: number;
  autoIdHits: number;
  
  // Time-based metrics
  lastReset: number;
  uptime: number;
  entriesPerMinute: number;
  
  // Health metrics
  errorRate: number;
  corruptionRate: number;
  evictionRate: number;
  corruptionCount: number;
}

export interface CacheHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  score: number; // 0-100
}

export interface CacheAnalytics {
  topIdentifiers: Array<{
    identifier: string;
    accessCount: number;
    lastAccessed: number;
    type: string;
  }>;
  evictionCandidates: Array<{
    identifier: string;
    lastAccessed: number;
    accessCount: number;
    size: number;
  }>;
  performanceTrends: Array<{
    timestamp: number;
    hitRate: number;
    avgResponseTime: number;
  }>;
}

/**
 * Cache Metrics Collector
 */
export class CacheMetricsCollector {
  private responseTimes: number[] = [];
  private maxResponseTimeHistory = 1000; // Keep last 1000 measurements
  private identifierTypeCounts = {
    tenant_id: 0,
    slug: 0,
    auto_id: 0
  };
  private errorCount = 0;
  private corruptionCount = 0;
  private evictionCount = 0;
  private startTime = Date.now();

  /**
   * Record cache hit
   */
  recordHit(responseTime: number, identifierType: 'tenant_id' | 'slug' | 'auto_id'): void {
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
    
    this.identifierTypeCounts[identifierType]++;
  }

  /**
   * Record cache miss
   */
  recordMiss(): void {
    // Misses are tracked in the main cache metrics
  }

  /**
   * Record error
   */
  recordError(): void {
    this.errorCount++;
  }

  /**
   * Record corruption
   */
  recordCorruption(): void {
    this.corruptionCount++;
  }

  /**
   * Record eviction
   */
  recordEviction(): void {
    this.evictionCount++;
  }

  /**
   * Get detailed metrics
   */
  getDetailedMetrics(baseMetrics: any, cacheSize: number): DetailedCacheMetrics {
    const totalRequests = baseMetrics.hits + baseMetrics.misses;
    const now = Date.now();
    const uptime = now - this.startTime;

    // Calculate percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p50 = this.getPercentile(sortedTimes, 50);
    const p95 = this.getPercentile(sortedTimes, 95);
    const p99 = this.getPercentile(sortedTimes, 99);

    return {
      ...baseMetrics,
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      maxResponseTime: Math.max(...this.responseTimes, 0),
      minResponseTime: Math.min(...this.responseTimes, 0),
      avgEntrySize: cacheSize > 0 ? baseMetrics.totalMemoryUsage / cacheSize : 0,
      tenantIdHits: this.identifierTypeCounts.tenant_id,
      slugHits: this.identifierTypeCounts.slug,
      autoIdHits: this.identifierTypeCounts.auto_id,
      uptime,
      entriesPerMinute: uptime > 0 ? (cacheSize * 60000) / uptime : 0,
      errorRate: totalRequests > 0 ? this.errorCount / totalRequests : 0,
      corruptionRate: totalRequests > 0 ? this.corruptionCount / totalRequests : 0,
      evictionRate: cacheSize > 0 ? this.evictionCount / cacheSize : 0,
      corruptionCount: this.corruptionCount
    };
  }

  /**
   * Get cache health status
   */
  getHealthStatus(metrics: DetailedCacheMetrics): CacheHealthStatus {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Hit rate check
    if (metrics.hitRate < 0.8) {
      issues.push(`Low hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
      recommendations.push('Consider cache warming or increasing TTL');
      score -= 20;
    }

    // Response time check
    if (metrics.avgResponseTime > 10) {
      issues.push(`High average response time: ${metrics.avgResponseTime.toFixed(2)}ms`);
      recommendations.push('Check for cache bottlenecks or encryption overhead');
      score -= 15;
    }

    // Memory usage check
    if (metrics.totalMemoryUsage > 100 * 1024 * 1024) { // 100MB
      issues.push(`High memory usage: ${(metrics.totalMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
      recommendations.push('Consider reducing TTL or implementing LRU eviction');
      score -= 10;
    }

    // Error rate check
    if (metrics.errorRate > 0.01) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
      recommendations.push('Investigate encryption/decryption errors');
      score -= 25;
    }

    // Corruption check
    if (metrics.corruptionRate > 0) {
      issues.push(`Cache corruption detected: ${metrics.corruptionCount} instances`);
      recommendations.push('Investigate data integrity issues');
      score -= 30;
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (score < 70) status = 'critical';
    else if (score < 85) status = 'warning';

    return {
      status,
      issues,
      recommendations,
      score: Math.max(0, score)
    };
  }

  /**
   * Get cache analytics
   */
  getAnalytics(cacheEntries: Map<string, any>): CacheAnalytics {
    // Top identifiers by access count
    const topIdentifiers = Array.from(cacheEntries.entries())
      .map(([identifier, entry]) => ({
        identifier,
        accessCount: entry.accessCount || 0,
        lastAccessed: entry.lastAccessed || 0,
        type: entry.data?.type || 'unknown'
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    // Eviction candidates (least recently used)
    const now = Date.now();
    const evictionCandidates = Array.from(cacheEntries.entries())
      .map(([identifier, entry]) => ({
        identifier,
        lastAccessed: entry.lastAccessed || 0,
        accessCount: entry.accessCount || 0,
        size: entry.data?.length || 0
      }))
      .filter(entry => now - entry.lastAccessed > 30 * 60 * 1000) // Older than 30 minutes
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, 20);

    // Performance trends (mock data for now)
    const performanceTrends = this.generatePerformanceTrends();

    return {
      topIdentifiers,
      evictionCandidates,
      performanceTrends
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.responseTimes = [];
    this.identifierTypeCounts = { tenant_id: 0, slug: 0, auto_id: 0 };
    this.errorCount = 0;
    this.corruptionCount = 0;
    this.evictionCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Get percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.floor((percentile / 100) * sortedArray.length);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  /**
   * Generate performance trends (mock implementation)
   */
  private generatePerformanceTrends(): Array<{
    timestamp: number;
    hitRate: number;
    avgResponseTime: number;
  }> {
    const trends = [];
    const now = Date.now();
    
    for (let i = 24; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000); // Last 24 hours
      trends.push({
        timestamp,
        hitRate: 0.85 + Math.random() * 0.1, // Mock hit rate
        avgResponseTime: 1 + Math.random() * 2 // Mock response time
      });
    }
    
    return trends;
  }
}

/**
 * Cache Monitoring Dashboard
 */
export class CacheMonitoringDashboard {
  private metricsCollector: CacheMetricsCollector;

  constructor() {
    this.metricsCollector = new CacheMetricsCollector();
  }

  /**
   * Get comprehensive dashboard data
   */
  getDashboardData(baseMetrics: any, cacheEntries: Map<string, any>): {
    metrics: DetailedCacheMetrics;
    health: CacheHealthStatus;
    analytics: CacheAnalytics;
    timestamp: number;
  } {
    const detailedMetrics = this.metricsCollector.getDetailedMetrics(
      baseMetrics,
      cacheEntries.size
    );

    const health = this.metricsCollector.getHealthStatus(detailedMetrics);
    const analytics = this.metricsCollector.getAnalytics(cacheEntries);

    return {
      metrics: detailedMetrics,
      health,
      analytics,
      timestamp: Date.now()
    };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(baseMetrics: any, cacheEntries: Map<string, any>): string {
    const dashboard = this.getDashboardData(baseMetrics, cacheEntries);
    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Get cache analytics
   */
  getAnalytics(cacheEntries: Map<string, any>): CacheAnalytics {
    return this.metricsCollector.getAnalytics(cacheEntries);
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): CacheMetricsCollector {
    return this.metricsCollector;
  }
}
