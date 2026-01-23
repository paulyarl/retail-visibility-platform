/**
 * Featured Products Singleton Test Component
 * 
 * Tests the ProductSingleton integration for featured products
 * with comprehensive metrics and validation.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRandomFeaturedProducts } from '@/providers/data/ProductSingleton';
import { Package, RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface TestResult {
  success: boolean;
  responseTime: number;
  fromCache: boolean;
  itemCount: number;
  error?: string;
  metrics?: any;
}

interface FeaturedProductsTestProps {
  onTestComplete: (result: TestResult) => void;
}

export default function FeaturedProductsTest({ onTestComplete }: FeaturedProductsTestProps) {
  const [testStartTime, setTestStartTime] = useState<number>(0);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  const { products, loading, error, refetch, metrics, fromCache } = useRandomFeaturedProducts(
    { lat: 40.7128, lng: -74.0060 }, // NYC location
    10 // limit
  );

  const runTest = async (testName: string) => {
    setCurrentTest(testName);
    setIsTestRunning(true);
    setTestStartTime(Date.now());
    
    try {
      await refetch();
      const responseTime = Date.now() - testStartTime;
      
      const result: TestResult = {
        success: !error && products.length > 0,
        responseTime,
        fromCache: fromCache || false,
        itemCount: products.length,
        error: error ? (typeof error === 'string' ? error : 'Unknown error') : undefined,
        metrics: {
          cacheHits: metrics.cacheHits,
          cacheMisses: metrics.cacheMisses,
          totalRequests: metrics.totalRequests,
          averageResponseTime: metrics.averageResponseTime,
        }
      };
      
      setTestCompleted(true);
      onTestComplete(result);
    } catch (err) {
      const responseTime = Date.now() - testStartTime;
      const result: TestResult = {
        success: false,
        responseTime,
        fromCache: false,
        itemCount: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      
      setTestCompleted(true);
      onTestComplete(result);
    } finally {
      setIsTestRunning(false);
    }
  };

  const runMultipleTests = async () => {
    // Test 1: Initial load
    await runTest('Initial Load');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Cache hit
    await runTest('Cache Hit');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Refetch
    await runTest('Refetch');
  };

  useEffect(() => {
    // Auto-run test on component mount
    runMultipleTests();
  }, []);

  if (loading && !testCompleted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Running Featured Products Test</h3>
            <p className="text-sm text-gray-600">Testing ProductSingleton integration...</p>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Current test: {currentTest}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Featured Products Singleton Test</h3>
          <p className="text-sm text-gray-600">Testing ProductSingleton with location-aware featured products</p>
        </div>
        <button
          onClick={runMultipleTests}
          disabled={isTestRunning}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isTestRunning ? 'animate-spin' : ''}`} />
          <span>Re-run Tests</span>
        </button>
      </div>

      {/* Test Results */}
      {testCompleted && (
        <div className="space-y-4">
          {/* Success/Error Status */}
          <div className={`rounded-lg p-4 ${
            !error && products.length > 0 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              {!error && products.length > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <h4 className={`font-medium ${
                  !error && products.length > 0 ? 'text-green-800' : 'text-red-800'
                }`}>
                  {!error && products.length > 0 ? '✅ Test Passed' : '❌ Test Failed'}
                </h4>
                <p className={`text-sm ${
                  !error && products.length > 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {!error && products.length > 0 
                    ? `Successfully loaded ${products.length} featured products`
                    : (typeof error === 'string' ? error : 'Failed to load products')
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          {metrics && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-3 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4" />
                <span>Performance Metrics</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Cache Hits:</span>
                  <span className="ml-2 font-medium">{metrics.cacheHits}</span>
                </div>
                <div>
                  <span className="text-blue-600">Cache Misses:</span>
                  <span className="ml-2 font-medium">{metrics.cacheMisses}</span>
                </div>
                <div>
                  <span className="text-blue-600">Hit Rate:</span>
                  <span className="ml-2 font-medium">
                    {metrics.totalRequests > 0 
                      ? `${((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </span>
                </div>
                <div>
                  <span className="text-blue-600">Avg Response:</span>
                  <span className="ml-2 font-medium">{metrics.averageResponseTime.toFixed(0)}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Products Preview */}
          {products.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-3 flex items-center space-x-2">
                <Package className="w-4 h-4" />
                <span>Loaded Products ({products.length})</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.slice(0, 6).map((product, index) => (
                  <div key={`${product.id}-${index}`} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start space-x-3">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </h5>
                        <p className="text-xs text-gray-500 truncate">
                          {product.tenantId || 'Unknown tenant'}
                        </p>
                        {product.priceCents && (
                          <p className="text-sm font-medium text-green-600">
                            ${(product.priceCents / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {products.length > 6 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  ... and {products.length - 6} more products
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">Test Configuration</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <div>• Location: New York City (40.7128°N, 74.0060°W)</div>
          <div>• Limit: 10 products</div>
          <div>• Cache TTL: 15 minutes</div>
          <div>• Singleton: ProductSingleton</div>
          <div>• Hook: useRandomFeaturedProducts</div>
        </div>
      </div>
    </div>
  );
}
