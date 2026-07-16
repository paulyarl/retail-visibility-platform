/**
 * Cache Test Utilities
 * Browser-compatible test functions for local storage caching
 */

import { CachedTenantService } from '@/lib/cache/cached-tenant-service';
import { LocalStorageCache } from '@/lib/cache/local-storage-cache';
import { clientLogger } from '@/lib/client-logger';

// Test tenant ID - change this to match your test tenant
const TEST_TENANT_ID = 'tid-r6cccpag';

export const cacheTestUtils = {
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
      return true;
    } catch (error) {
      clientLogger.error('❌ Basic cache test failed:', { detail: error });
      return false;
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

      console.log('🎉 Tenant service test complete!');
      return true;
    } catch (error) {
      clientLogger.error('❌ Tenant service test failed:', { detail: error });
      return false;
    }
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
      return true;
    } catch (error) {
      clientLogger.error('❌ Cache invalidation test failed:', { detail: error });
      return false;
    }
  },

  // Run all tests
  runAllTests: async () => {
    console.log('🧪 Running All Cache Tests...\n');

    try {
      const basicResult = await cacheTestUtils.testBasicCache();
      console.log('\n');

      const tenantResult = await cacheTestUtils.testTenantService();
      console.log('\n');

      const invalidationResult = await cacheTestUtils.testCacheInvalidation();
      console.log('\n');

      const allPassed = basicResult && tenantResult && invalidationResult;
      console.log(`🎯 Test Summary: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
      console.log(`   Basic Cache: ${basicResult ? '✅' : '❌'}`);
      console.log(`   Tenant Service: ${tenantResult ? '✅' : '❌'}`);
      console.log(`   Cache Invalidation: ${invalidationResult ? '✅' : '❌'}`);

      return allPassed;
    } catch (error) {
      clientLogger.error('❌ Test suite failed:', { detail: error });
      return false;
    }
  },

  // Utility functions
  getCacheStats: (tenantId?: string) => {
    return CachedTenantService.getCacheStats(tenantId);
  },

  invalidateTenantCache: (tenantId: string) => {
    CachedTenantService.invalidateTenantCache(tenantId);
  },

  invalidateAllCaches: () => {
    CachedTenantService.invalidateAllCaches();
  }
};

// Make available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).cacheTestUtils = cacheTestUtils;
  console.log('🧪 Cache test utilities loaded!');
  console.log('Available functions:');
  console.log('- cacheTestUtils.testBasicCache()');
  console.log('- await cacheTestUtils.testTenantService()');
  console.log('- cacheTestUtils.testCacheInvalidation()');
  console.log('- await cacheTestUtils.runAllTests()');
  console.log('- cacheTestUtils.getCacheStats()');
  console.log('- cacheTestUtils.invalidateTenantCache(tenantId)');
}
