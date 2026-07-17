// Browser-based test for adaptive compression
// This can be run in the browser console or as a component

import contextCacheManager, { AppContext } from './contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

// Test data
const testData = {
  small: { message: "Hello World" },
  medium: { 
    products: Array.from({ length: 50 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      description: `Description for product ${i}`.repeat(5),
      price: Math.random() * 100
    }))
  },
  large: {
    catalog: Array.from({ length: 200 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      description: `Very detailed description for product ${i}`.repeat(20),
      specs: {
        weight: Math.random() * 10,
        features: Array.from({ length: 10 }, (_, j) => `Feature ${j}`)
      }
    }))
  }
};

// Test function
export async function runCompressionTest() {
  console.log('🚀 Adaptive Compression Test Started');
  console.log('=====================================\n');

  const results = [];

  // Test each context
  const tests = [
    { 
      context: AppContext.PRODUCT, 
      name: 'PRODUCT (Level 9, Max Compression)', 
      data: testData.large 
    },
    { 
      context: AppContext.TENANT, 
      name: 'TENANT (Level 6, Balanced)', 
      data: testData.medium 
    },
    { 
      context: AppContext.STORE, 
      name: 'STORE (Level 4, Fast)', 
      data: testData.medium 
    },
    { 
      context: AppContext.ADMIN, 
      name: 'ADMIN (No Compression)', 
      data: testData.small 
    }
  ];

  for (const test of tests) {
    console.log(`📊 Testing ${test.name}:`);
    
    const originalSize = JSON.stringify(test.data).length;
    console.log(`  Original size: ${originalSize.toLocaleString()} bytes`);
    
    try {
      // Store data (this will trigger compression)
      const startTime = performance.now();
      await contextCacheManager.set(test.context, 'test-key', test.data);
      const storeTime = performance.now() - startTime;
      
      // Retrieve data (this will trigger decompression)
      const retrieveStart = performance.now();
      const retrieved = await contextCacheManager.get(test.context, 'test-key');
      const retrieveTime = performance.now() - retrieveStart;
      
      // Verify data integrity
      const integrity = JSON.stringify(retrieved) === JSON.stringify(test.data);
      
      console.log(`  ✅ Stored in: ${storeTime.toFixed(2)}ms`);
      console.log(`  ✅ Retrieved in: ${retrieveTime.toFixed(2)}ms`);
      console.log(`  ✅ Data integrity: ${integrity ? 'PASS' : 'FAIL'}`);
      
      results.push({
        context: test.name,
        originalSize,
        storeTime,
        retrieveTime,
        integrity
      });
      
    } catch (error) {
      clientLogger.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        context: test.name,
        originalSize,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    console.log('---');
  }

  // Show final results
  console.log('\n📈 Test Results Summary:');
  console.log('========================');
  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.context}: FAILED - ${result.error}`);
    } else {
      console.log(`✅ ${result.context}: SUCCESS`);
      console.log(`   Size: ${result.originalSize.toLocaleString()} bytes`);
      console.log(`   Store: ${result.storeTime?.toFixed(2) ?? 'N/A'}ms, Retrieve: ${result.retrieveTime?.toFixed(2) ?? 'N/A'}ms`);
    }
  });

  // Show cache stats
  console.log('\n📊 Cache Statistics:');
  console.log('===================');
  const stats = contextCacheManager.getStats();
  Object.entries(stats).forEach(([context, stat]) => {
    if (stat.size > 0) {
      console.log(`${context}: ${stat.size} entries, ${stat.hits} hits, ${stat.misses} misses`);
    }
  });

  return results;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
  // Make it available globally for testing
  (window as any).testAdaptiveCompression = runCompressionTest;
  console.log('🧪 Adaptive compression test ready! Run testAdaptiveCompression() in console');
}

export default runCompressionTest;
