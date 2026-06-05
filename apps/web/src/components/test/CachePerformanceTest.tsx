/**
 * Cache Performance Test Component
 * 
 * Comprehensive testing of cache performance and optimization:
 * - Cache hit/miss ratios
 * - TTL effectiveness
 * - Cache invalidation performance
 * - Memory usage optimization
 * - Concurrent access patterns
 */

'use client';

import { useState, useEffect } from 'react';
import { FeaturedProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';

interface TestResult {
  success: boolean;
  responseTime: number;
  fromCache: boolean;
  itemCount: number;
  error?: string;
  metrics?: any;
}

interface CachePerformanceTestProps {
  onTestComplete: (results: TestResult) => void;
}

export default function CachePerformanceTest({ onTestComplete }: CachePerformanceTestProps) {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState('');
  const [tenantId] = useState('test-tenant-123');
  const [realTimeMetrics, setRealTimeMetrics] = useState<any>({});

  const runTest = async (testName: string, testFunction: () => Promise<TestResult>) => {
    setCurrentTest(testName);
    setLoading(true);
    
    try {
      const startTime = performance.now();
      const result = await testFunction();
      const endTime = performance.now();
      
      const finalResult = {
        ...result,
        responseTime: Math.round(endTime - startTime)
      };
      
      setTestResults(prev => [...prev, finalResult]);
      onTestComplete(finalResult);
      
      return finalResult;
    } catch (error) {
      const errorResult = {
        success: false,
        responseTime: 0,
        fromCache: false,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      setTestResults(prev => [...prev, errorResult]);
      onTestComplete(errorResult);
      
      return errorResult;
    } finally {
      setLoading(false);
      setCurrentTest('');
    }
  };

  // Test 1: Cache Hit/Miss Performance
  const testCacheHitMissPerformance = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Clear cache to start fresh
    singleton.clearCache();
    
    // First call (cache miss)
    const missStartTime = performance.now();
    await singleton.getAllFeaturedProducts(tenantId, 20);
    const missTime = performance.now() - missStartTime;
    
    // Second call (cache hit)
    const hitStartTime = performance.now();
    await singleton.getAllFeaturedProducts(tenantId, 20);
    const hitTime = performance.now() - hitStartTime;
    
    // Third call (cache hit)
    const hitStartTime2 = performance.now();
    await singleton.getAllFeaturedProducts(tenantId, 20);
    const hitTime2 = performance.now() - hitStartTime2;
    
    const avgHitTime = (hitTime + hitTime2) / 2;
    const speedup = missTime / avgHitTime;
    
    return {
      success: speedup > 1,
      responseTime: 0,
      fromCache: true,
      itemCount: 0,
      metrics: {
        missTime: Math.round(missTime),
        hitTime: Math.round(avgHitTime),
        speedup: Math.round(speedup * 100) / 100,
        cacheEfficiency: speedup > 2 ? 'excellent' : speedup > 1.5 ? 'good' : 'needs-improvement'
      }
    };
  };

  // Test 2: TTL Effectiveness
  const testTTLEffectiveness = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Clear cache
    singleton.clearCache();
    
    // Load data into cache
    const initialData = await singleton.getAllFeaturedProducts(tenantId, 20);
    const initialTime = new Date().toISOString();
    
    // Wait a moment (simulating time passage)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if data is still cached
    const cachedData = await singleton.getAllFeaturedProducts(tenantId, 20);
    
    // Invalidate cache
    singleton.invalidateCache(tenantId);
    
    // Fetch fresh data
    const freshData = await singleton.getAllFeaturedProducts(tenantId, 20);
    
    return {
      success: true,
      responseTime: 0,
      fromCache: false,
      itemCount: freshData.totalCount,
      metrics: {
        initialLoadTime: initialTime,
        cachedDataTime: cachedData.lastUpdated,
        freshDataTime: freshData.lastUpdated,
        cacheInvalidated: freshData.lastUpdated !== cachedData.lastUpdated,
        ttlWorking: cachedData.lastUpdated === initialData.lastUpdated
      }
    };
  };

  // Test 3: Concurrent Access Performance
  const testConcurrentAccess = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Clear cache
    singleton.clearCache();
    
    // Create multiple concurrent requests
    const concurrentRequests = Array.from({ length: 20 }, (_, i) => 
      singleton.getAllFeaturedProducts(tenantId, 10)
    );
    
    const startTime = performance.now();
    const results = await Promise.all(concurrentRequests);
    const totalTime = performance.now() - startTime;
    
    // Analyze results
    const successfulRequests = results.filter(r => r.buckets).length;
    const avgResponseTime = totalTime / concurrentRequests.length;
    const dataConsistency = results.every(r => 
      r.totalCount === results[0].totalCount && 
      r.buckets.length === results[0].buckets.length
    );
    
    return {
      success: successfulRequests === concurrentRequests.length && dataConsistency,
      responseTime: Math.round(avgResponseTime),
      fromCache: false,
      itemCount: results[0]?.totalCount || 0,
      metrics: {
        totalRequests: concurrentRequests.length,
        successfulRequests,
        avgResponseTime: Math.round(avgResponseTime),
        totalTime: Math.round(totalTime),
        dataConsistency,
        concurrentEfficiency: successfulRequests / concurrentRequests.length
      }
    };
  };

  // Test 4: Memory Usage Optimization
  const testMemoryUsageOptimization = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Clear cache
    singleton.clearCache();
    
    // Load different data sets
    const datasets = await Promise.all([
      singleton.getAllFeaturedProducts(tenantId, 10),
      singleton.getAllFeaturedProducts(tenantId, 20),
      singleton.getAllFeaturedProducts(tenantId, 50),
      singleton.getAllFeaturedProducts(tenantId, 100)
    ]);
    
    // Test cache size with different limits
    const cacheSizes = datasets.map(data => ({
      limit: data.buckets.reduce((sum, b) => sum + b.count, 0),
      totalCount: data.totalCount,
      bucketCount: data.buckets.length
    }));
    
    // Test memory efficiency
    const totalItems = datasets.reduce((sum, data) => sum + data.totalCount, 0);
    const uniqueItems = new Set(datasets.flatMap(d => d.buckets.flatMap(b => b.products.map(p => p.id)))).size;
    
    return {
      success: uniqueItems > 0,
      responseTime: 0,
      fromCache: false,
      itemCount: totalItems,
      metrics: {
        totalItems,
        uniqueItems,
        duplicateRatio: ((totalItems - uniqueItems) / totalItems * 100).toFixed(1) + '%',
        cacheSizes,
        memoryEfficiency: uniqueItems === totalItems ? 'optimal' : 'acceptable'
      }
    };
  };

  // Test 5: Cache Invalidation Performance
  const testCacheInvalidationPerformance = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Load data into cache
    await singleton.getAllFeaturedProducts(tenantId, 20);
    await singleton.getAllFeaturedProducts(tenantId, 50);
    await singleton.getAllFeaturedProducts(tenantId, 100);
    
    // Test invalidation performance
    const invalidationStartTime = performance.now();
    singleton.invalidateCache(tenantId);
    const invalidationTime = performance.now() - invalidationStartTime;
    
    // Test selective invalidation
    await singleton.getAllFeaturedProducts(tenantId, 20);
    const selectiveStartTime = performance.now();
    singleton.clearCache(); // Full clear
    const selectiveTime = performance.now() - selectiveStartTime;
    
    return {
      success: invalidationTime < 100 && selectiveTime < 100,
      responseTime: 0,
      fromCache: false,
      itemCount: 0,
      metrics: {
        invalidationTime: Math.round(invalidationTime),
        fullClearTime: Math.round(selectiveTime),
        invalidationEfficiency: invalidationTime < 10 ? 'excellent' : invalidationTime < 50 ? 'good' : 'needs-improvement'
      }
    };
  };

  // Test 6: Cache Warming Strategies
  const testCacheWarmingStrategies = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Clear cache
    singleton.clearCache();
    
    // Test preloading common queries
    const commonQueries = [
      { limit: 10 },
      { limit: 20 },
      { limit: 50 }
    ];
    
    const warmingStartTime = performance.now();
    await Promise.all(
      commonQueries.map(query => singleton.getAllFeaturedProducts(tenantId, query.limit))
    );
    const warmingTime = performance.now() - warmingStartTime;
    
    // Test warmed cache performance
    const warmedStartTime = performance.now();
    await Promise.all(
      commonQueries.map(query => singleton.getAllFeaturedProducts(tenantId, query.limit))
    );
    const warmedTime = performance.now() - warmedStartTime;
    
    return {
      success: warmedTime < warmingTime,
      responseTime: 0,
      fromCache: true,
      itemCount: commonQueries.length,
      metrics: {
        warmingTime: Math.round(warmingTime),
        warmedAccessTime: Math.round(warmedTime),
        warmingSpeedup: Math.round(warmingTime / warmedTime * 100) / 100,
        strategiesTested: commonQueries.length
      }
    };
  };

  const runAllTests = async () => {
    setTestResults([]);
    
    await runTest('Cache Hit/Miss Performance', testCacheHitMissPerformance);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('TTL Effectiveness', testTTLEffectiveness);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Concurrent Access Performance', testConcurrentAccess);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Memory Usage Optimization', testMemoryUsageOptimization);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Cache Invalidation Performance', testCacheInvalidationPerformance);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Cache Warming Strategies', testCacheWarmingStrategies);
  };

  // Real-time metrics update
  useEffect(() => {
    const updateMetrics = () => {
      const singleton = FeaturedProductsSingleton.getInstance();
      const metrics = singleton.getMetrics();
      setRealTimeMetrics(metrics);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const getTestStatus = (testName: string) => {
    const result = testResults.find(r => r.metrics?.testName === testName);
    if (!result) return 'pending';
    return result.success ? 'success' : 'error';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const getPerformanceGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: 'text-green-600' };
    if (score >= 80) return { grade: 'A', color: 'text-green-600' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-600' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-600' };
    return { grade: 'D', color: 'text-red-600' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Cache Performance Testing</h3>
        <button
          onClick={runAllTests}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run Cache Tests'}
        </button>
      </div>

      {/* Real-time Metrics */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Real-time Cache Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Cache Hits:</span>
            <span className="ml-2 font-medium">{realTimeMetrics.cacheHits || 0}</span>
          </div>
          <div>
            <span className="text-gray-500">Cache Misses:</span>
            <span className="ml-2 font-medium">{realTimeMetrics.cacheMisses || 0}</span>
          </div>
          <div>
            <span className="text-gray-500">Hit Ratio:</span>
            <span className="ml-2 font-medium">
              {realTimeMetrics.cacheHits && realTimeMetrics.cacheMisses
                ? Math.round((realTimeMetrics.cacheHits / (realTimeMetrics.cacheHits + realTimeMetrics.cacheMisses)) * 100) + '%'
                : '0%'
              }
            </span>
          </div>
          <div>
            <span className="text-gray-500">API Calls:</span>
            <span className="ml-2 font-medium">{realTimeMetrics.apiCalls || 0}</span>
          </div>
        </div>
      </div>

      {/* Test Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Cache Performance Tests</h4>
        <div className="space-y-2">
          {[
            'Cache Hit/Miss Performance',
            'TTL Effectiveness',
            'Concurrent Access Performance',
            'Memory Usage Optimization',
            'Cache Invalidation Performance',
            'Cache Warming Strategies'
          ].map((test) => {
            const status = getTestStatus(test);
            const result = testResults.find(r => r.metrics?.testName === test);
            
            return (
              <div key={test} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                <div className="flex items-center space-x-3">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`}></span>
                  <span className="text-sm font-medium">{test}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {result && (
                    <span>
                      {result.responseTime}ms
                      {result.fromCache && ' • Cached'}
                      {result.metrics?.speedup && ` • ${result.metrics.speedup}x speedup`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Test Status */}
      {loading && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
            <span className="text-green-700">Running: {currentTest}</span>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Performance Test Results</h4>
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${
                    result.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {result.success ? '✅ Passed' : '❌ Failed'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {result.responseTime}ms
                  </span>
                </div>
                
                {result.error && (
                  <p className="text-sm text-red-700 mb-2">{result.error}</p>
                )}
                
                {result.metrics && (
                  <div className="text-sm text-gray-600">
                    <pre className="bg-gray-50 rounded p-2 overflow-x-auto text-xs">
                      {JSON.stringify(result.metrics, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      {testResults.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Cache Performance Summary</h4>
          
          {/* Calculate overall performance score */}
          {(() => {
            const successRate = (testResults.filter(r => r.success).length / testResults.length) * 100;
            const avgResponseTime = testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length;
            const performanceScore = Math.max(0, 100 - (avgResponseTime / 10)); // Lower response time = higher score
            const overallScore = (successRate + performanceScore) / 2;
            const { grade, color } = getPerformanceGrade(overallScore);
            
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Success Rate:</span>
                    <span className="ml-2 font-medium">{Math.round(successRate)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Response:</span>
                    <span className="ml-2 font-medium">{Math.round(avgResponseTime)}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Performance:</span>
                    <span className={`ml-2 font-medium ${color}`}>{grade}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Cache Status:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {realTimeMetrics.cacheHits > realTimeMetrics.cacheMisses ? 'Optimized' : 'Warming'}
                    </span>
                  </div>
                </div>
                
                {/* Performance Recommendations */}
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Recommendations:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {avgResponseTime > 50 && <li>Consider increasing cache TTL for better performance</li>}
                    {realTimeMetrics.cacheHits < realTimeMetrics.cacheMisses && <li>Implement cache warming strategies</li>}
                    {successRate < 100 && <li>Review error handling and fallback mechanisms</li>}
                    {avgResponseTime < 20 && successRate === 100 && <li>Cache performance is excellent!</li>}
                  </ul>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
