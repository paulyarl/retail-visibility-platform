/**
 * Directory Categories Singleton Test Component
 * 
 * Tests the CategorySingleton integration for directory categories
 * with comprehensive metrics and validation.
 */

'use client';

import { useState, useEffect } from 'react';
import { useDirectoryCategories } from '@/hooks/useDirectoryCategories';
import { Folder, RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp, Grid3x3 } from 'lucide-react';

interface TestResult {
  success: boolean;
  responseTime: number;
  fromCache: boolean;
  itemCount: number;
  error?: string;
  metrics?: any;
}

interface DirectoryCategoriesTestProps {
  onTestComplete: (result: TestResult) => void;
}

export default function DirectoryCategoriesTest({ onTestComplete }: DirectoryCategoriesTestProps) {
  const [testStartTime, setTestStartTime] = useState<number>(0);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  const {
    categories,
    loading,
    error,
    refetch,
    getCategoryTree,
    metrics,
  } = useDirectoryCategories({
    includeChildren: true,
    includeProductCount: true,
  });

  const runTest = async (testName: string) => {
    setCurrentTest(testName);
    setIsTestRunning(true);
    setTestStartTime(Date.now());
    
    try {
      await refetch();
      const responseTime = Date.now() - testStartTime;
      
      const result: TestResult = {
        success: !error && categories.length > 0,
        responseTime,
        fromCache: metrics?.cacheHits > 0,
        itemCount: categories.length,
        error: error ? (typeof error === 'string' ? error : 'Unknown error') : undefined,
        metrics: {
          cacheHits: metrics?.cacheHits || 0,
          cacheMisses: metrics?.cacheMisses || 0,
          totalRequests: metrics?.totalRequests || 0,
          averageResponseTime: metrics?.averageResponseTime || 0,
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
    
    // Test 3: Tree structure test
    await runTest('Tree Structure');
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
            <h3 className="text-lg font-medium text-gray-900">Running Directory Categories Test</h3>
            <p className="text-sm text-gray-600">Testing CategorySingleton integration...</p>
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

  const categoryTree = getCategoryTree();

  return (
    <div className="space-y-6">
      {/* Test Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Directory Categories Singleton Test</h3>
          <p className="text-sm text-gray-600">Testing CategorySingleton with hierarchical categories</p>
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
            !error && categories.length > 0 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              {!error && categories.length > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <h4 className={`font-medium ${
                  !error && categories.length > 0 ? 'text-green-800' : 'text-red-800'
                }`}>
                  {!error && categories.length > 0 ? '✅ Test Passed' : '❌ Test Failed'}
                </h4>
                <p className={`text-sm ${
                  !error && categories.length > 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {!error && categories.length > 0 
                    ? `Successfully loaded ${categories.length} categories`
                    : (typeof error === 'string' ? error : 'Failed to load categories')
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

          {/* Categories Preview */}
          {categories.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-3 flex items-center space-x-2">
                <Folder className="w-4 h-4" />
                <span>Loaded Categories ({categories.length})</span>
              </h4>
              
              {/* Tree Structure */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Hierarchical Structure:</h5>
                <div className="bg-white rounded border border-gray-200 p-3">
                  <div className="space-y-1">
                    {categoryTree.slice(0, 3).map((category) => (
                      <div key={category.id} className="text-sm">
                        <div className="flex items-center space-x-2">
                          <Grid3x3 className="w-3 h-3 text-gray-400" />
                          <span className="font-medium">{category.name}</span>
                          <span className="text-gray-500">({category.productCount} products)</span>
                        </div>
                        {category.children && category.children.length > 0 && (
                          <div className="ml-5 mt-1 space-y-1">
                            {category.children.slice(0, 2).map((child) => (
                              <div key={child.id} className="flex items-center space-x-2 text-xs text-gray-600">
                                <span>└─</span>
                                <span>{child.name}</span>
                                <span className="text-gray-400">({child.productCount})</span>
                              </div>
                            ))}
                            {category.children.length > 2 && (
                              <div className="text-xs text-gray-400 ml-5">
                                └─ ...and {category.children.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {categoryTree.length > 3 && (
                      <div className="text-sm text-gray-500 mt-2">
                        ...and {categoryTree.length - 3} more root categories
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid View */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.slice(0, 6).map((category, index) => (
                  <div key={category.id || index} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start space-x-3">
                      {category.imageUrl && (
                        <img
                          src={category.imageUrl}
                          alt={category.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-medium text-gray-900 truncate">
                          {category.name}
                        </h5>
                        <p className="text-xs text-gray-500 truncate">
                          {category.slug}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-blue-600 font-medium">
                            {category.productCount} products
                          </span>
                          {category.children && (
                            <span className="text-xs text-gray-400">
                              {category.children.length} subcategories
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {categories.length > 6 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  ... and {categories.length - 6} more categories
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
          <div>• Include Children: Yes</div>
          <div>• Include Product Count: Yes</div>
          <div>• Cache TTL: 15 minutes</div>
          <div>• Singleton: CategorySingleton</div>
          <div>• Hook: useDirectoryCategories</div>
        </div>
      </div>
    </div>
  );
}
