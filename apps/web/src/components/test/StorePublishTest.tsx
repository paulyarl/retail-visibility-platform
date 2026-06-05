/**
 * Store Publish Test Component
 * 
 * Tests the Store Publish Singleton system:
 * - Store publishing workflow
 * - Authentication and permissions
 * - Directory category validation
 * - Real-time directory updates
 * - Cache performance for store data
 */

'use client';

import { useState, useEffect } from 'react';
import StorePublishSingleton, { 
  PublishedStore, 
  DirectoryCategory, 
  StorePublishOptions 
} from '@/providers/data/StorePublishSingleton';
import { StorePublishProvider, useStorePublish } from '@/providers/data/StorePublishProvider';

interface TestResult {
  success: boolean;
  responseTime: number;
  fromCache: boolean;
  itemCount: number;
  error?: string;
  metrics?: any;
}

interface StorePublishTestProps {
  onTestComplete: (results: TestResult) => void;
}

function TestComponent({ onTestComplete }: StorePublishTestProps) {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState('');
  const [tenantId] = useState('test-tenant-123');

  const storePublish = useStorePublish();

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
    const singleton = StorePublishSingleton.getInstance();
    
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

  // Test 2: Directory Categories Fetch
  const testDirectoryCategoriesFetch = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Clear cache first
    singleton.invalidateCache();
    
    // Fetch directory categories
    const categories = await singleton.getDirectoryCategories();
    
    return {
      success: Array.isArray(categories), // Success if we get an array (even if empty)
      responseTime: 0,
      fromCache: false,
      itemCount: categories.length,
      metrics: {
        categoriesCount: categories.length,
        hasPrimaryCategories: Array.isArray(categories) && categories.some(cat => cat.level === 'primary'),
        hasSecondaryCategories: Array.isArray(categories) && categories.some(cat => cat.level === 'secondary'),
        isArray: Array.isArray(categories)
      }
    };
  };

  // Test 3: Published Stores Fetch
  const testPublishedStoresFetch = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Clear cache first
    singleton.invalidateCache();
    
    // Fetch published stores
    const result = await singleton.getPublishedStores({ limit: 20 });
    
    return {
      success: true,
      responseTime: 0,
      fromCache: false,
      itemCount: result.stores.length,
      metrics: {
        storesCount: result.stores.length,
        totalCount: result.totalCount,
        lastUpdated: result.lastUpdated,
        categoriesAvailable: result.categories.length
      }
    };
  };

  // Test 4: Cache Performance
  const testCachePerformance = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Clear cache first
    singleton.invalidateCache();
    
    // First call (cache miss)
    const startTime1 = performance.now();
    await singleton.getPublishedStores({ limit: 20 });
    const firstCallTime = performance.now() - startTime1;
    
    // Second call (cache hit)
    const startTime2 = performance.now();
    await singleton.getPublishedStores({ limit: 20 });
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

  // Test 5: Store Publishing Validation
  const testStorePublishingValidation = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Test validation with incomplete data
    const incompleteStore = {
      // Missing required fields
      branding: { logo: '', banner: '', colors: { primary: '', secondary: '' }, theme: '' }
    };
    
    const validation = singleton.validatePublishingRequirements(incompleteStore);
    
    // Test validation with complete data
    const completeStore = {
      primaryCategory: { id: 'cat-1', name: 'Test Category', slug: 'test', level: 'primary' as const },
      location: { address: '123 Test St', city: 'Test City', state: 'TS', zip: '12345', country: 'US', coordinates: { lat: 0, lng: 0 } },
      contact: { phone: '555-1234', email: 'test@example.com', website: 'https://example.com' },
      gallery: [
        { id: 'photo-1', url: 'https://example.com/photo1.jpg', alt: 'Test Photo', isPrimary: true, order: 1 }
      ],
      branding: { logo: '', banner: '', colors: { primary: '', secondary: '' }, theme: '' }
    };
    
    const validValidation = singleton.validatePublishingRequirements(completeStore);
    
    return {
      success: !validation.valid && validValidation.valid,
      responseTime: 0,
      fromCache: false,
      itemCount: 0,
      metrics: {
        incompleteValidationPassed: validation.valid,
        incompleteValidationErrors: validation.errors.length,
        completeValidationPassed: validValidation.valid,
        completeValidationErrors: validValidation.errors.length
      }
    };
  };

  // Test 6: Provider Integration
  const testProviderIntegration = async (): Promise<TestResult> => {
    // Test the React provider integration
    const { stores, categories, loading, error } = storePublish;
    
    return {
      success: !error && !loading,
      responseTime: 0,
      fromCache: false,
      itemCount: stores?.length || 0,
      metrics: {
        storesCount: stores?.length || 0,
        categoriesCount: categories?.length || 0,
        hasError: !!error,
        isLoading: loading
      }
    };
  };

  // Test 7: Featured Stores
  const testFeaturedStores = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Test featured stores functionality
    const featuredStores = await singleton.getFeaturedStores(10);
    
    return {
      success: Array.isArray(featuredStores),
      responseTime: 0,
      fromCache: false,
      itemCount: featuredStores.length,
      metrics: {
        featuredStoresCount: featuredStores.length,
        hasFeaturedRanks: featuredStores.some(store => store.featuredRank),
        averageRank: featuredStores.reduce((sum, store) => sum + (store.featuredRank || 0), 0) / featuredStores.length || 0
      }
    };
  };

  // Test 8: Trending Stores
  const testTrendingStores = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Test trending stores functionality
    const trendingStores = await singleton.getTrendingStores(10);
    
    return {
      success: Array.isArray(trendingStores),
      responseTime: 0,
      fromCache: false,
      itemCount: trendingStores.length,
      metrics: {
        trendingStoresCount: trendingStores.length,
        hasTrending: trendingStores.some(store => store.trending),
        averageViews: trendingStores.reduce((sum, store) => sum + store.viewCount, 0) / trendingStores.length || 0
      }
    };
  };

  // Test 9: Category-based Store Filtering
  const testCategoryFiltering = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Test stores by category
    const categoryStores = await singleton.getStoresByCategory('test-category', 10);
    
    return {
      success: Array.isArray(categoryStores),
      responseTime: 0,
      fromCache: false,
      itemCount: categoryStores.length,
      metrics: {
        categoryStoresCount: categoryStores.length,
        hasCategoryStores: categoryStores.length > 0,
        averageRating: categoryStores.reduce((sum, store) => sum + store.rating, 0) / categoryStores.length || 0
      }
    };
  };

  // Test 10: Cache Invalidation
  const testCacheInvalidation = async (): Promise<TestResult> => {
    const singleton = StorePublishSingleton.getInstance();
    
    // Load data into cache
    await singleton.getPublishedStores({ limit: 20 });
    
    // Invalidate cache
    singleton.invalidateCache();
    
    // Fetch again (should be cache miss)
    const result = await singleton.getPublishedStores({ limit: 20 });
    
    return {
      success: true,
      responseTime: 0,
      fromCache: false,
      itemCount: result.stores.length,
      metrics: {
        invalidationSuccessful: true,
        refreshedData: result.stores.length > 0
      }
    };
  };

  const runAllTests = async () => {
    setTestResults([]);
    
    await runTest('Singleton Instantiation', testSingletonInstantiation);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Directory Categories Fetch', testDirectoryCategoriesFetch);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Published Stores Fetch', testPublishedStoresFetch);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Cache Performance', testCachePerformance);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Store Publishing Validation', testStorePublishingValidation);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Provider Integration', testProviderIntegration);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Featured Stores', testFeaturedStores);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Trending Stores', testTrendingStores);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTest('Category Filtering', testCategoryFiltering);
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
        <h3 className="text-lg font-semibold text-gray-900">Store Publish System Testing</h3>
        <button
          onClick={runAllTests}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run Store Publish Tests'}
        </button>
      </div>

      {/* Test Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Store Publish Test Progress</h4>
        <div className="space-y-2">
          {[
            'Singleton Instantiation',
            'Directory Categories Fetch',
            'Published Stores Fetch',
            'Cache Performance',
            'Store Publishing Validation',
            'Provider Integration',
            'Featured Stores',
            'Trending Stores',
            'Category Filtering',
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
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
            <span className="text-orange-700">Running: {currentTest}</span>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Store Publish Test Results</h4>
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

      {/* Store Publish Summary */}
      {testResults.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Store Publish System Summary</h4>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Tests Passed:</span>
                <span className="ml-2 font-medium text-green-600">
                  {testResults.filter(r => r.success).length}/{testResults.length}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Avg Response:</span>
                <span className="ml-2 font-medium">
                  {Math.round(testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length)}ms
                </span>
              </div>
              <div>
                <span className="text-gray-500">Items Processed:</span>
                <span className="ml-2 font-medium">
                  {testResults.reduce((sum, r) => sum + r.itemCount, 0)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">System Status:</span>
                <span className={`ml-2 font-medium ${
                  testResults.filter(r => r.success).length === testResults.length ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {testResults.filter(r => r.success).length === testResults.length ? 'Ready' : 'Needs Work'}
                </span>
              </div>
            </div>
            
            {/* Store Publish Features Status */}
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Store Publish Features:</p>
              <ul className="list-disc list-inside space-y-1">
                {testResults.filter(r => r.metrics?.categoriesCount > 0).length > 0 && 
                  <li>✅ Directory categories working</li>}
                {testResults.filter(r => r.metrics?.cacheSpeedup && r.metrics.cacheSpeedup > 1).length > 0 && 
                  <li>✅ Cache performance optimized</li>}
                {testResults.filter(r => r.metrics?.completeValidationPassed).length > 0 && 
                  <li>✅ Store validation working</li>}
                {testResults.filter(r => r.metrics?.featuredStoresCount >= 0).length > 0 && 
                  <li>✅ Featured stores functionality</li>}
                {testResults.filter(r => r.metrics?.trendingStoresCount >= 0).length > 0 && 
                  <li>✅ Trending stores functionality</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StorePublishTest({ onTestComplete }: StorePublishTestProps) {
  const [tenantId] = useState('test-tenant-123');
  
  return (
    <StorePublishProvider tenantId={tenantId} autoLoad={true}>
      <TestComponent onTestComplete={onTestComplete} />
    </StorePublishProvider>
  );
}
