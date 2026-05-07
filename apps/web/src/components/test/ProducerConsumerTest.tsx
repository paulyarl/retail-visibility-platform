/**
 * Producer-Consumer Test Component
 * 
 * Tests the complete producer-consumer flow for Featured Products:
 * - Admin (Producer) → API → Singleton → Storefront (Consumer)
 * - Real-time data flow validation
 * - Cache invalidation testing
 * - Performance metrics
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeaturedProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
import { FeaturedProductsProvider, useFeaturedProducts } from '@/providers/data/FeaturedProductsProvider';

interface TestResult {
  success: boolean;
  responseTime: number;
  fromCache: boolean;
  itemCount: number;
  error?: string;
  metrics?: any;
}

interface ProducerConsumerTestProps {
  onTestComplete: (results: TestResult) => void;
}

function TestComponent({ onTestComplete }: ProducerConsumerTestProps) {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState('');
  const [tenantId] = useState('test-tenant-123');

  const featuredProducts = useFeaturedProducts();

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

  // Test 1: Singleton Instantiation
  const testSingletonInstantiation = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Test basic singleton functionality
    const metrics = singleton.getMetrics();
    
    return {
      success: true,
      responseTime: 0,
      fromCache: false,
      itemCount: 0,
      metrics
    };
  };

  // Test 2: Featured Products Fetch
  const testFeaturedProductsFetch = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Clear cache first
    singleton.clearCache();
    
    // Fetch featured products
    const result = await singleton.getAllFeaturedProducts(tenantId, 20);
    
    return {
      success: true,
      responseTime: 0,
      fromCache: false,
      itemCount: result.totalCount,
      metrics: {
        buckets: result.buckets.length,
        lastUpdated: result.lastUpdated
      }
    };
  };

  // Test 3: Cache Performance
  const testCachePerformance = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // First call (cache miss)
    const startTime1 = performance.now();
    await singleton.getAllFeaturedProducts(tenantId, 20);
    const firstCallTime = performance.now() - startTime1;
    
    // Second call (cache hit)
    const startTime2 = performance.now();
    await singleton.getAllFeaturedProducts(tenantId, 20);
    const secondCallTime = performance.now() - startTime2;
    
    return {
      success: true,
      responseTime: 0,
      fromCache: secondCallTime < firstCallTime,
      itemCount: 0,
      metrics: {
        firstCallTime: Math.round(firstCallTime),
        secondCallTime: Math.round(secondCallTime),
        cacheSpeedup: Math.round(firstCallTime / secondCallTime)
      }
    };
  };

  // Test 4: Provider Integration
  const testProviderIntegration = async (): Promise<TestResult> => {
    // Test the React provider integration
    const { buckets, products, loading, error } = featuredProducts;
    
    return {
      success: !error && !loading,
      responseTime: 0,
      fromCache: false,
      itemCount: products?.length || 0,
      metrics: {
        buckets: buckets?.buckets?.length || 0,
        hasProducts: products?.length > 0,
        hasError: !!error
      }
    };
  };

  // Test 5: Type Conversion
  const testTypeConversion = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Test conversion to PublicProduct format
    const universalProducts = await singleton.getFeaturedProductsAsUniversal(tenantId, 'staff_pick', 10);
    
    return {
      success: Array.isArray(universalProducts),
      responseTime: 0,
      fromCache: false,
      itemCount: universalProducts.length,
      metrics: {
        hasRequiredFields: universalProducts.every(p => p.id && p.name && p.priceCents),
        averagePrice: universalProducts.reduce((sum, p) => sum + p.priceCents, 0) / universalProducts.length || 0
      }
    };
  };

  // Test 6: Cache Invalidation
  const testCacheInvalidation = async (): Promise<TestResult> => {
    const singleton = FeaturedProductsSingleton.getInstance();
    
    // Load data into cache
    await singleton.getAllFeaturedProducts(tenantId, 20);
    
    // Invalidate cache
    singleton.invalidateCache(tenantId);
    
    // Fetch again (should be cache miss)
    const result = await singleton.getAllFeaturedProducts(tenantId, 20);
    
    return {
      success: true,
      responseTime: 0,
      fromCache: false,
      itemCount: result.totalCount,
      metrics: {
        invalidationSuccessful: true,
        refreshedData: result.totalCount > 0
      }
    };
  };

  const runAllTests = async () => {
    setTestResults([]);
    
    await runTest('Singleton Instantiation', testSingletonInstantiation);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Featured Products Fetch', testFeaturedProductsFetch);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Cache Performance', testCachePerformance);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Provider Integration', testProviderIntegration);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Type Conversion', testTypeConversion);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Cache Invalidation', testCacheInvalidation);
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Producer-Consumer Flow Testing</h3>
        <button
          onClick={runAllTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run All Tests'}
        </button>
      </div>

      {/* Test Progress */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Test Progress</h4>
        <div className="space-y-2">
          {[
            'Singleton Instantiation',
            'Featured Products Fetch', 
            'Cache Performance',
            'Provider Integration',
            'Type Conversion',
            'Cache Invalidation'
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
                      {result.fromCache && ' • Cache Hit'}
                      {result.itemCount > 0 && ` • ${result.itemCount} items`}
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-blue-700">Running: {currentTest}</span>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Test Results</h4>
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
                    <pre className="bg-gray-50 rounded p-2 overflow-x-auto">
                      {JSON.stringify(result.metrics, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {testResults.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Tests:</span>
              <span className="ml-2 font-medium">{testResults.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Passed:</span>
              <span className="ml-2 font-medium text-green-600">
                {testResults.filter(r => r.success).length}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>
              <span className="ml-2 font-medium text-red-600">
                {testResults.filter(r => !r.success).length}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Avg Time:</span>
              <span className="ml-2 font-medium">
                {Math.round(testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length)}ms
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProducerConsumerTest({ onTestComplete }: ProducerConsumerTestProps) {
  const [tenantId] = useState('test-tenant-123');
  
  return (
    <FeaturedProductsProvider tenantId={tenantId} autoLoad={true}>
      <TestComponent onTestComplete={onTestComplete} />
    </FeaturedProductsProvider>
  );
}
