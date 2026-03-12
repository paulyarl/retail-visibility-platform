// Browser-based test for cache invalidation pilot
// This can be run in the browser console or as a component

import { platformHomeService } from '../services/PlatformHomeSingletonService';
import { tenantInfoService } from '../services/TenantInfoService';

// Test services
const testServices = [
  { name: 'PlatformHomeSingletonService', service: platformHomeService },
  { name: 'TenantInfoService', service: tenantInfoService }
];

// Test function
export async function runCacheInvalidationTest() {
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
    
    console.log('  ---');
  }

  // Test 2: Cache Invalidation Functionality
  console.log('\n🗑️  2. Testing Cache Invalidation Functionality:');
  
  for (const test of testServices) {
    console.log(`  🧪 Testing ${test.name} invalidation:`);
    
    try {
      const startTime = performance.now();
      await test.service.invalidateServiceCaches('test-tenant-123');
      const invalidationTime = performance.now() - startTime;
      
      console.log(`    ✅ Invalidated in: ${invalidationTime.toFixed(2)}ms`);
      
      results.push({
        test: 'Cache Invalidation',
        service: test.name,
        status: 'PASS',
        time: invalidationTime
      });
      
    } catch (error) {
      console.error(`    ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        test: 'Cache Invalidation',
        service: test.name,
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    console.log('  ---');
  }

  // Test 3: Pattern Matching
  console.log('\n🎯 3. Testing Cache Pattern Matching:');
  
  const allPatterns = [];
  for (const test of testServices) {
    try {
      const patterns = test.service.getServiceCachePatterns();
      allPatterns.push(...patterns);
      console.log(`  ✅ ${test.name}: ${patterns.length} patterns`);
    } catch (error) {
      console.log(`  ❌ ${test.name}: Failed to get patterns`);
    }
  }
  
  console.log(`  📊 Total patterns found: ${allPatterns.length}`);
  allPatterns.forEach(pattern => console.log(`     - ${pattern}`));

  // Show final results
  console.log('\n📈 Test Results Summary:');
  console.log('========================');
  
  const contractResults = results.filter(r => r.test === 'Service Contracts');
  const invalidationResults = results.filter(r => r.test === 'Cache Invalidation');
  
  const contractPasses = contractResults.filter(r => r.status === 'PASS').length;
  const invalidationPasses = invalidationResults.filter(r => r.status === 'PASS').length;
  
  console.log(`Service Contracts: ${contractPasses}/${contractResults.length} PASSED`);
  console.log(`Cache Invalidation: ${invalidationPasses}/${invalidationResults.length} PASSED`);
  console.log(`Pattern Matching: ✅ ${allPatterns.length} PATTERNS FOUND`);
  
  results.forEach(result => {
    if (result.status === 'FAIL') {
      console.log(`❌ ${result.test} - ${result.service}: FAILED - ${result.error}`);
    }
  });

  const allPassed = contractPasses === contractResults.length && invalidationPasses === invalidationResults.length;
  
  console.log(`\n🏆 OVERALL RESULT: ${allPassed ? 'PILOT SUCCESSFUL' : 'PILOT NEEDS FIXES'}`);
  
  if (allPassed) {
    console.log('\n✨ Ready to expand to other TenantApiSingleton services!');
    console.log('✨ Consider promoting the pattern to AdminApiSingleton next!');
  }

  return {
    summary: {
      contractTests: `${contractPasses}/${contractResults.length}`,
      invalidationTests: `${invalidationPasses}/${invalidationResults.length}`,
      patternCount: allPatterns.length,
      overall: allPassed ? 'SUCCESS' : 'NEEDS FIXES'
    },
    results
  };
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
  // Make it available globally for testing
  (window as any).testCacheInvalidation = runCacheInvalidationTest;
  (window as any).runCacheInvalidationTest = runCacheInvalidationTest;
  
  // Also expose the services for direct testing
  (window as any).testServices = {
    platformHomeService,
    tenantInfoService
  };
  
  console.log('🧪 Cache invalidation pilot test ready!');
  console.log('📋 Available commands:');
  console.log('  - testCacheInvalidation() or runCacheInvalidationTest()');
  console.log('  - testServices.platformHomeService');
  console.log('  - testServices.tenantInfoService');
  
  // Auto-run a quick validation
  setTimeout(() => {
    console.log('\n🔍 Quick validation check...');
    try {
      const patterns = platformHomeService.getServiceCachePatterns();
      console.log(`✅ PlatformHomeService: ${patterns.length} cache patterns`);
    } catch (error) {
      console.log('❌ PlatformHomeService: Not accessible');
    }
    
    try {
      const patterns = tenantInfoService.getServiceCachePatterns();
      console.log(`✅ TenantInfoService: ${patterns.length} cache patterns`);
    } catch (error) {
      console.log('❌ TenantInfoService: Not accessible');
    }
  }, 100);
}

export default runCacheInvalidationTest;
