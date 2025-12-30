/**
 * Test script for local storage caching functionality
 * Run in browser console to verify caching works
 */

import { CachedTenantService } from './cached-tenant-service';
import { LocalStorageCache } from './local-storage-cache';

// Extend window interface for test functions
declare global {
  interface Window {
    testLocalStorageCache: {
      testBasicCache: () => void;
      testTenantService: () => Promise<void>;
      testCacheInvalidation: () => void;
      runAllTests: () => Promise<void>;
    };
  }
}

// Test tenant ID
const TEST_TENANT_ID = 'tid-r6cccpag';

// Test functions for browser console
window.testLocalStorageCache = {
  // Test basic cache operations
  testBasicCache: async () => {
    console.log('🧪 Testing LocalStorage Cache...');

    try {
      // Test set/get
      LocalStorageCache.set('test-key', { message: 'Hello World' }, { ttl: 60000 });
      const retrieved = LocalStorageCache.get('test-key');
      console.log('✅ Set/Get:', retrieved);

      // Test tenant-scoped cache
      LocalStorageCache.set('tenant-data', { tenantId: TEST_TENANT_ID }, { tenantId: TEST_TENANT_ID });
      const tenantData = await LocalStorageCache.get('tenant-data', { tenantId: TEST_TENANT_ID });
      console.log('✅ Tenant-scoped cache:', tenantData);

      // Test cache stats
      const stats = LocalStorageCache.getStats();
      console.log('✅ Cache stats:', stats);

      console.log('🎉 Basic cache test complete!');
    } catch (error) {
      console.error('❌ Basic cache test failed:', error);
    }
  },

  // Test tenant service caching (requires authentication)
  testTenantService: async () => {
    console.log('🧪 Testing CachedTenantService...');

    try {
      // Test cache miss (first call)
      console.log('📡 Fetching tenant data (should be cache miss)...');
      const startTime = Date.now();
      const data1 = await CachedTenantService.getTenantData(TEST_TENANT_ID);
      const firstCallTime = Date.now() - startTime;
      console.log('✅ First call (API):', firstCallTime + 'ms', data1?.tenant?.name);

      // Test cache hit (second call)
      console.log('💾 Fetching tenant data (should be cache hit)...');
      const startTime2 = Date.now();
      const data2 = await CachedTenantService.getTenantData(TEST_TENANT_ID);
      const secondCallTime = Date.now() - startTime2;
      console.log('✅ Second call (cache):', secondCallTime + 'ms', data2?.tenant?.name);

      // Compare performance
      console.log(`🚀 Performance: API call ${firstCallTime}ms vs Cache ${secondCallTime}ms (${Math.round((firstCallTime - secondCallTime) / firstCallTime * 100)}% faster)`);

      // Test cache stats
      const cacheStats = CachedTenantService.getCacheStats(TEST_TENANT_ID);
      console.log('✅ Cache stats for tenant:', cacheStats);

    } catch (error) {
      console.error('❌ Tenant service test failed:', error);
    }

    console.log('🎉 Tenant service test complete!');
  },

  // Test cache invalidation
  testCacheInvalidation: async () => {
    console.log('🧪 Testing cache invalidation...');

    try {
      // Set some data
      LocalStorageCache.set('test-invalidate', { data: 'will be cleared' }, { tenantId: TEST_TENANT_ID });
      console.log('✅ Set test data');

      // Check it exists
      const before = await LocalStorageCache.get('test-invalidate', { tenantId: TEST_TENANT_ID });
      console.log('✅ Data exists:', !!before);

      // Clear tenant cache
      CachedTenantService.invalidateTenantCache(TEST_TENANT_ID);
      console.log('🗑️ Invalidated tenant cache');

      // Check it's gone
      const after = await LocalStorageCache.get('test-invalidate', { tenantId: TEST_TENANT_ID });
      console.log('✅ Data cleared:', !after);

      console.log('🎉 Cache invalidation test complete!');
    } catch (error) {
      console.error('❌ Cache invalidation test failed:', error);
    }
  },

  // Run all tests
  runAllTests: async () => {
    console.log('🚀 Running all cache tests...\n');

    try {
      window.testLocalStorageCache.testBasicCache();
      console.log('');

      await window.testLocalStorageCache.testTenantService();
      console.log('');

      window.testLocalStorageCache.testCacheInvalidation();
      console.log('');

      console.log('🎊 All tests completed!');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }
};

console.log('🧪 Cache test functions loaded!');
console.log('Run window.testLocalStorageCache.runAllTests() to test everything');
console.log('Or run individual tests:');
console.log('- window.testLocalStorageCache.testBasicCache()');
console.log('- window.testLocalStorageCache.testTenantService()');
console.log('- window.testLocalStorageCache.testCacheInvalidation()');
