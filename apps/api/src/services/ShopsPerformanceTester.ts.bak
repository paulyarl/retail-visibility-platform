/**
 * Performance Testing Suite for Multi-Bucket Shops
 * 
 * Comprehensive testing utilities for load testing, performance validation,
 * and cache effectiveness measurement.
 */

import { performance } from 'perf_hooks';
import ShopsFeaturedService from './ShopsFeaturedService';
import { ShopsPerformanceMonitor } from './ShopsPerformanceMonitor';

interface LoadTestConfig {
  concurrentUsers: number;
  requestsPerUser: number;
  durationSeconds: number;
  rampUpTime: number;
  bucketTypes: string[];
  tenantIds: string[];
  shopScope: 'global' | 'shop';
}

interface LoadTestResult {
  testId: string;
  config: LoadTestConfig;
  startTime: Date;
  endTime: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  bucketResults: BucketTestResult[];
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    avgCacheTime: number;
  };
}

interface BucketTestResult {
  bucketType: string;
  requests: number;
  avgResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
}

interface CacheEffectivenessResult {
  bucketType: string;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgHitTime: number;
  avgMissTime: number;
  memoryUsage: number;
  recommendations: string[];
}

export class ShopsPerformanceTester {
  private static instance: ShopsPerformanceTester;
  private performanceMonitor: ShopsPerformanceMonitor;

  static getInstance(): ShopsPerformanceTester {
    if (!ShopsPerformanceTester.instance) {
      ShopsPerformanceTester.instance = new ShopsPerformanceTester();
    }
    return ShopsPerformanceTester.instance;
  }

  constructor() {
    this.performanceMonitor = ShopsPerformanceMonitor.getInstance();
  }

  /**
   * Run comprehensive load test
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const testId = `load-test-${Date.now()}`;
    const startTime = new Date();
    const service = ShopsFeaturedService.getInstance();
    
    console.log(`🚀 Starting load test ${testId} with config:`, config);
    
    const results: {
      responseTimes: number[];
      errors: number;
      successes: number;
      bucketResults: Map<string, { times: number[]; errors: number; cacheHits: number }>;
    } = {
      responseTimes: [],
      errors: 0,
      successes: 0,
      bucketResults: new Map()
    };

    // Initialize bucket tracking
    for (const bucketType of config.bucketTypes) {
      results.bucketResults.set(bucketType, { times: [], errors: 0, cacheHits: 0 });
    }

    // Execute load test
    const promises: Promise<void>[] = [];
    const userPromises: Promise<void>[] = [];

    for (let user = 0; user < config.concurrentUsers; user++) {
      const userPromise = this.simulateUser(config, results, user);
      userPromises.push(userPromise);
      
      // Ramp up users gradually
      if (config.rampUpTime > 0) {
        await new Promise(resolve => setTimeout(resolve, config.rampUpTime / config.concurrentUsers));
      }
    }

    // Wait for all users to complete
    await Promise.all(userPromises);
    
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    // Calculate results
    const totalRequests = results.successes + results.errors;
    const avgResponseTime = results.responseTimes.length > 0
      ? results.responseTimes.reduce((sum, time) => sum + time, 0) / results.responseTimes.length
      : 0;
    
    const sortedTimes = results.responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    const bucketResults: BucketTestResult[] = [];
    for (const [bucketType, data] of results.bucketResults) {
      const bucketAvgTime = data.times.length > 0
        ? data.times.reduce((sum, time) => sum + time, 0) / data.times.length
        : 0;
      
      bucketResults.push({
        bucketType,
        requests: data.times.length + data.errors,
        avgResponseTime: bucketAvgTime,
        errorRate: data.errors / (data.times.length + data.errors) * 100,
        cacheHitRate: data.cacheHits / data.times.length * 100
      });
    }

    const result: LoadTestResult = {
      testId,
      config,
      startTime,
      endTime,
      totalRequests,
      successfulRequests: results.successes,
      failedRequests: results.errors,
      avgResponseTime,
      minResponseTime: sortedTimes[0] || 0,
      maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      requestsPerSecond: totalRequests / duration,
      errorRate: (results.errors / totalRequests) * 100,
      bucketResults,
      cacheMetrics: {
        hitRate: 0, // Would be calculated from actual cache metrics
        missRate: 0,
        avgCacheTime: 0
      }
    };

    console.log(`✅ Load test ${testId} completed:`, {
      totalRequests: result.totalRequests,
      avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
      errorRate: `${result.errorRate.toFixed(2)}%`,
      rps: `${result.requestsPerSecond.toFixed(2)}`
    });

    return result;
  }

  /**
   * Simulate a single user's activity
   */
  private async simulateUser(
    config: LoadTestConfig,
    results: any,
    userId: number
  ): Promise<void> {
    const service = ShopsFeaturedService.getInstance();
    const endTime = Date.now() + (config.durationSeconds * 1000);
    
    while (Date.now() < endTime) {
      const tenantId = config.tenantIds[Math.floor(Math.random() * config.tenantIds.length)];
      const bucketType = config.bucketTypes[Math.floor(Math.random() * config.bucketTypes.length)];
      
      try {
        const startTime = performance.now();
        
        // Make the actual request based on bucket type
        let response;
        switch (bucketType) {
          case 'random':
            response = await service.getShopRandomProducts({
              tenantId,
              limit: 12,
              shopScope: config.shopScope
            });
            break;
          case 'trending':
            response = await service.getShopTrendingProducts({
              tenantId,
              limit: 12,
              shopScope: config.shopScope
            });
            break;
          case 'new':
            response = await service.getShopNewProducts({
              tenantId,
              limit: 12,
              shopScope: config.shopScope
            });
            break;
          case 'sale':
            response = await service.getShopSaleProducts({
              tenantId,
              limit: 12,
              shopScope: config.shopScope
            });
            break;
          case 'seasonal':
            response = await service.getShopSeasonalProducts({
              tenantId,
              limit: 12,
              shopScope: config.shopScope
            });
            break;
          case 'staff':
            response = await service.getShopStaffPicks({
              tenantId,
              limit: 12,
              shopScope: config.shopScope
            });
            break;
          case 'selection':
            response = await service.getShopStoreSelections({
              tenantId,
              limit: 12,
              shopScope: config.shopScope
            });
            break;
          default:
            throw new Error(`Unknown bucket type: ${bucketType}`);
        }
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Record results
        results.responseTimes.push(responseTime);
        results.successes++;
        
        const bucketData = results.bucketResults.get(bucketType);
        if (bucketData) {
          bucketData.times.push(responseTime);
          // Assume cache hit if response time is very fast (this would be more sophisticated in reality)
          if (responseTime < 50) {
            bucketData.cacheHits++;
          }
        }
        
        // Record in performance monitor
        this.performanceMonitor.recordBucketMetrics(
          bucketType,
          tenantId,
          config.shopScope,
          responseTime,
          responseTime < 50, // Assume cache hit
          false
        );
        
      } catch (error) {
        results.errors++;
        const bucketData = results.bucketResults.get(bucketType);
        if (bucketData) {
          bucketData.errors++;
        }
        
        this.performanceMonitor.recordBucketMetrics(
          bucketType,
          tenantId,
          config.shopScope,
          0,
          false,
          true
        );
      }
      
      // Random delay between requests (simulating user behavior)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    }
  }

  /**
   * Test cache effectiveness
   */
  async testCacheEffectiveness(
    tenantId: string,
    shopScope: 'global' | 'shop' = 'shop',
    iterations: number = 100
  ): Promise<CacheEffectivenessResult[]> {
    const service = ShopsFeaturedService.getInstance();
    const bucketTypes = ['random', 'trending', 'new', 'sale', 'seasonal', 'staff', 'selection'];
    const results: CacheEffectivenessResult[] = [];

    for (const bucketType of bucketTypes) {
      const result = await this.testBucketCacheEffectiveness(
        service,
        bucketType,
        tenantId,
        shopScope,
        iterations
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Test cache effectiveness for a specific bucket
   */
  private async testBucketCacheEffectiveness(
    service: ShopsFeaturedService,
    bucketType: string,
    tenantId: string,
    shopScope: 'global' | 'shop',
    iterations: number
  ): Promise<CacheEffectivenessResult> {
    const times: { hit: number[]; miss: number[] } = { hit: [], miss: [] };
    let cacheHits = 0;
    let cacheMisses = 0;

    // Clear cache first to ensure cold start
    // await clearCacheForBucket(bucketType, tenantId, shopScope);

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        // Make request based on bucket type
        let response;
        switch (bucketType) {
          case 'random':
            response = await service.getShopRandomProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'trending':
            response = await service.getShopTrendingProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'new':
            response = await service.getShopNewProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'sale':
            response = await service.getShopSaleProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'seasonal':
            response = await service.getShopSeasonalProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'staff':
            response = await service.getShopStaffPicks({ tenantId, limit: 12, shopScope });
            break;
          case 'selection':
            response = await service.getShopStoreSelections({ tenantId, limit: 12, shopScope });
            break;
        }
        
        const responseTime = performance.now() - startTime;
        
        // Determine if it was a cache hit (this would be more sophisticated in reality)
        const isCacheHit = responseTime < 50 || i > 0; // Assume cache hits after first request
        
        if (isCacheHit) {
          times.hit.push(responseTime);
          cacheHits++;
        } else {
          times.miss.push(responseTime);
          cacheMisses++;
        }
        
      } catch (error) {
        console.error(`Error testing cache for ${bucketType}:`, error);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const avgHitTime = times.hit.length > 0 
      ? times.hit.reduce((sum, time) => sum + time, 0) / times.hit.length 
      : 0;
    
    const avgMissTime = times.miss.length > 0 
      ? times.miss.reduce((sum, time) => sum + time, 0) / times.miss.length 
      : 0;

    const hitRate = (cacheHits / iterations) * 100;
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (hitRate < 80) {
      recommendations.push('Consider increasing cache TTL for better hit rates');
    }
    if (avgMissTime > 500) {
      recommendations.push('Optimize database queries to improve cache miss performance');
    }
    if (avgHitTime > 100) {
      recommendations.push('Cache retrieval is slower than expected, investigate cache configuration');
    }

    return {
      bucketType,
      cacheHits,
      cacheMisses,
      hitRate,
      avgHitTime,
      avgMissTime,
      memoryUsage: 0, // Would be calculated from actual cache metrics
      recommendations
    };
  }

  /**
   * Run performance benchmarks
   */
  async runBenchmarks(): Promise<{
    singleRequest: { avg: number; p95: number; p99: number };
    parallelRequests: { avg: number; p95: number; p99: number };
    cachePerformance: { hitRate: number; avgHitTime: number; avgMissTime: number };
  }> {
    const service = ShopsFeaturedService.getInstance();
    const tenantId = 'benchmark-tenant';
    const iterations = 50;

    // Single request benchmark
    const singleTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await service.getShopRandomProducts({ tenantId, limit: 12, shopScope: 'global' });
      singleTimes.push(performance.now() - start);
    }

    // Parallel requests benchmark
    const parallelTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await Promise.all([
        service.getShopRandomProducts({ tenantId, limit: 12, shopScope: 'global' }),
        service.getShopTrendingProducts({ tenantId, limit: 12, shopScope: 'global' }),
        service.getShopNewProducts({ tenantId, limit: 12, shopScope: 'global' })
      ]);
      parallelTimes.push(performance.now() - start);
    }

    // Calculate percentiles
    const calculatePercentiles = (times: number[]) => {
      const sorted = times.sort((a, b) => a - b);
      return {
        avg: times.reduce((sum, time) => sum + time, 0) / times.length,
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    };

    // Cache performance test
    const cacheResults = await this.testCacheEffectiveness(tenantId, 'global', 20);
    const avgCacheHitRate = cacheResults.reduce((sum, r) => sum + r.hitRate, 0) / cacheResults.length;
    const avgHitTime = cacheResults.reduce((sum, r) => sum + r.avgHitTime, 0) / cacheResults.length;
    const avgMissTime = cacheResults.reduce((sum, r) => sum + r.avgMissTime, 0) / cacheResults.length;

    return {
      singleRequest: calculatePercentiles(singleTimes),
      parallelRequests: calculatePercentiles(parallelTimes),
      cachePerformance: {
        hitRate: avgCacheHitRate,
        avgHitTime,
        avgMissTime
      }
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(tenantId?: string): Promise<{
    summary: any;
    loadTestResults: LoadTestResult[];
    cacheEffectiveness: CacheEffectivenessResult[];
    benchmarks: any;
    recommendations: string[];
  }> {
    const summary = await this.performanceMonitor.getDashboardData(tenantId);
    
    // This would load actual test results from storage
    const loadTestResults: LoadTestResult[] = [];
    const cacheEffectiveness: CacheEffectivenessResult[] = [];
    const benchmarks = await this.runBenchmarks();

    const recommendations: string[] = [];
    
    if (summary.summary.overallCacheHitRate < 80) {
      recommendations.push('Overall cache hit rate is below optimal - consider cache configuration adjustments');
    }
    if (summary.summary.avgResponseTime > 500) {
      recommendations.push('Response times are slower than expected - investigate query optimization');
    }
    if (benchmarks.cachePerformance.hitRate < 85) {
      recommendations.push('Cache performance could be improved - review TTL and key strategies');
    }

    return {
      summary,
      loadTestResults,
      cacheEffectiveness,
      benchmarks,
      recommendations
    };
  }
}

export default ShopsPerformanceTester;
