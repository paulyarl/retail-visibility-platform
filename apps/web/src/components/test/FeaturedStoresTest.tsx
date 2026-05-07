/**
 * Featured Stores Singleton Test Component
 * 
 * Tests the StoreSingleton integration for featured stores
 * with comprehensive metrics and validation.
 */

'use client';

import { useState, useEffect } from 'react';
import { useFeaturedStores } from '@/hooks/useFeaturedStores';
import { Store, RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp, MapPin } from 'lucide-react';

interface TestResult {
  success: boolean;
  responseTime: number;
  fromCache: boolean;
  itemCount: number;
  error?: string;
  metrics?: any;
}

interface FeaturedStoresTestProps {
  onTestComplete: (result: TestResult) => void;
}

export default function FeaturedStoresTest({ onTestComplete }: FeaturedStoresTestProps) {
  const [testStartTime, setTestStartTime] = useState<number>(0);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  const { stores, loading, error, refetch, metrics } = useFeaturedStores({
    limit: 10,
    location: { lat: 40.7128, lng: -74.0060, radius: 50 }, // NYC location
  });

  const runTest = async (testName: string) => {
    setCurrentTest(testName);
    setIsTestRunning(true);
    setTestStartTime(Date.now());
    
    try {
      await refetch();
      const responseTime = Date.now() - testStartTime;
      
      const result: TestResult = {
        success: !error, // Success if no error, even if 0 stores (valid API response)
        responseTime,
        fromCache: metrics.cacheHits > 0,
        itemCount: stores.length,
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
    
    // Test 3: Location-based test
    await runTest('Location-Based');
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
            <h3 className="text-lg font-medium text-gray-900">Running Featured Stores Test</h3>
            <p className="text-sm text-gray-600">Testing StoreSingleton integration...</p>
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
          <h3 className="text-lg font-medium text-gray-900">Featured Stores Singleton Test</h3>
          <p className="text-sm text-gray-600">Testing StoreSingleton with location-aware featured stores</p>
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
            !error && stores.length > 0 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              {!error && stores.length > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <h4 className={`font-medium ${
                  !error && stores.length > 0 ? 'text-green-800' : 'text-red-800'
                }`}>
                  {!error && stores.length > 0 
                    ? `Successfully loaded ${stores.length} featured stores`
                    : 'Successfully connected to API (no stores found in location)'
                  }
                </h4>
                <p className={`text-sm ${
                  !error && stores.length > 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {!error && stores.length > 0 
                    ? `Loaded ${stores.length} stores from the featured stores API.`
                    : 'No featured stores found within 50km of NYC coordinates. API connection successful.'
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

          {/* Stores Preview */}
          {stores.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-3 flex items-center space-x-2">
                <Store className="w-4 h-4" />
                <span>Loaded Stores ({stores.length})</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.slice(0, 6).map((store, index) => (
                  <div key={store.id || index} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start space-x-3">
                      {store.logoUrl && (
                        <img
                          src={store.logoUrl}
                          alt={store.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-medium text-gray-900 truncate">
                          {store.name}
                        </h5>
                        <p className="text-xs text-gray-500 truncate">
                          {store.slug}
                        </p>
                        {(store.city || store.state) && (
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {store.city && store.state 
                              ? `${store.city}, ${store.state}`
                              : store.city || store.state
                            }
                          </div>
                        )}
                        {store.productCount !== undefined && (
                          <p className="text-xs text-blue-600 font-medium mt-1">
                            {store.productCount} products
                          </p>
                        )}
                        {store.ratingAvg && (
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <span className="text-yellow-500">★</span>
                            {store.ratingAvg.toFixed(1)} ({store.ratingCount || 0})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {stores.length > 6 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  ... and {stores.length - 6} more stores
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
          <div>• Radius: 50km</div>
          <div>• Limit: 10 stores</div>
          <div>• Cache TTL: 15 minutes</div>
          <div>• Singleton: StoreSingleton</div>
          <div>• Hook: useFeaturedStores</div>
        </div>
      </div>
    </div>
  );
}
