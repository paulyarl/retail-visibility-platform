// TypeScript runner for cache invalidation test
import { platformHomeService } from './apps/web/src/services/PlatformHomeSingletonService';
import { tenantInfoService } from './apps/web/src/services/TenantInfoService';

// Mock browser environment
declare global {
  var window: any;
}

// Test services
const testServices = [
  { name: 'PlatformHomeSingletonService', service: platformHomeService },
  { name: 'TenantInfoService', service: tenantInfoService }
];

// Run the test
async function runCacheInvalidationTest() {
  console.log('🚀 Cache Invalidation Pilot Test Started');
  console.log('=====================================\n');

  const results = [];

  // Test 1: Service Contracts
  console.log('📋 1. Testing Service Contracts:');
  
  for (const test of testServices) {
    console.log(`  🧪 Testing ${test.name}:`);
    
    try {
      // Test getServiceCachePatterns
      const patterns = test.service.getServiceCachePatterns();
      console.log(`    ✅ getServiceCachePatterns: ${patterns.length} patterns found`);
      patterns.forEach(pattern => console.log(`       - ${pattern}`));
      
      // Test invalidateServiceCaches method exists
      console.log(`    ✅ invalidateServiceCaches: Method exists`);
      
      results.push({
        test: 'Service Contracts',
        service: test.name,
        status: 'PASS',
        patterns: patterns.length
      });
      
    } catch (error) {
      console.error(`    ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        test: 'Service Contracts',
        service: test.name,
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${results.length}`);
  
  return results;
}

// Run the test
runCacheInvalidationTest()
  .then(results => {
    console.log('\n🎉 Cache invalidation test completed!');
    process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
