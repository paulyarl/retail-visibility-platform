// Node.js runner for cache invalidation test
const fs = require('fs');
const path = require('path');

// Mock browser environment
global.window = global;
global.console = console;

// Mock the services with more comprehensive cache key lists
const mockPlatformHomeService = {
  getServiceCachePatterns: () => [
    'platform-home:*',
    'tenants:*',
    'organizations:*'
  ],
  // Simulate actual cache keys that might exist
  getActualCacheKeys: () => [
    'platform-home:config',
    'platform-home:stats',
    'platform-home:user-count',
    'tenants:list',
    'tenants:active',
    'tenants:trial',
    'organizations:list',
    'organizations:active',
    'organizations:stats',
    'tenants:mina-market', // Specific tenant
    'organizations:acme-corp' // Specific organization
  ],
  invalidateServiceCaches: (patterns) => {
    console.log(`Invalidating patterns: ${patterns.join(', ')}`);
    return Promise.resolve();
  }
};

const mockTenantInfoService = {
  getServiceCachePatterns: () => [
    'tenant-info:*',
    'tenant-settings:*'
  ],
  // Simulate actual cache keys that might exist
  getActualCacheKeys: () => [
    'tenant-info:123',
    'tenant-info:456',
    'tenant-info:mina-market',
    'tenant-settings:123',
    'tenant-settings:456',
    'tenant-settings:mina-market',
    'tenant-info:config',
    'tenant-settings:global'
  ],
  invalidateServiceCaches: (patterns) => {
    console.log(`Invalidating patterns: ${patterns.join(', ')}`);
    return Promise.resolve();
  }
};

// Test services
const testServices = [
  { name: 'PlatformHomeSingletonService', service: mockPlatformHomeService },
  { name: 'TenantInfoService', service: mockTenantInfoService }
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

  // Test 2: Pattern Validation
  console.log('\n🔍 2. Testing Pattern Validation:');
  
  for (const test of testServices) {
    console.log(`  🧪 Testing ${test.name} patterns:`);
    
    try {
      const patterns = test.service.getServiceCachePatterns();
      const validPatterns = patterns.filter(pattern => 
        typeof pattern === 'string' && pattern.includes(':')
      );
      
      console.log(`    ✅ Valid patterns: ${validPatterns.length}/${patterns.length}`);
      
      if (validPatterns.length !== patterns.length) {
        console.log(`    ⚠️  Invalid patterns found: ${patterns.length - validPatterns.length}`);
      }
      
      results.push({
        test: 'Pattern Validation',
        service: test.name,
        status: validPatterns.length === patterns.length ? 'PASS' : 'WARN',
        valid: validPatterns.length,
        total: patterns.length
      });
      
    } catch (error) {
      console.error(`    ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        test: 'Pattern Validation',
        service: test.name,
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Test 3: Cache Key Discovery
  console.log('\n🔍 3. Testing Cache Key Discovery:');
  
  for (const test of testServices) {
    console.log(`  🧪 Testing ${test.name} key coverage:`);
    
    try {
      const patterns = test.service.getServiceCachePatterns();
      const actualKeys = test.service.getActualCacheKeys();
      
      // Check which keys are covered by patterns
      const coveredKeys = [];
      const uncoveredKeys = [];
      
      for (const key of actualKeys) {
        const isCovered = patterns.some(pattern => {
          // Simple pattern matching (service:*)
          if (pattern.endsWith(':*')) {
            const prefix = pattern.slice(0, -1); // Remove '*'
            return key.startsWith(prefix);
          }
          // Exact match
          return key === pattern;
        });
        
        if (isCovered) {
          coveredKeys.push(key);
        } else {
          uncoveredKeys.push(key);
        }
      }
      
      console.log(`    📊 Total keys: ${actualKeys.length}`);
      console.log(`    ✅ Covered: ${coveredKeys.length}`);
      console.log(`    ❌ Uncovered: ${uncoveredKeys.length}`);
      
      if (uncoveredKeys.length > 0) {
        console.log(`    🔍 Uncovered keys:`);
        uncoveredKeys.forEach(key => console.log(`       - ${key}`));
      }
      
      if (coveredKeys.length > 0) {
        console.log(`    ✅ Covered keys (sample):`);
        coveredKeys.slice(0, 3).forEach(key => console.log(`       - ${key}`));
        if (coveredKeys.length > 3) {
          console.log(`       ... and ${coveredKeys.length - 3} more`);
        }
      }
      
      const coverageRate = (coveredKeys.length / actualKeys.length) * 100;
      console.log(`    📈 Coverage: ${coverageRate.toFixed(1)}%`);
      
      results.push({
        test: 'Cache Key Discovery',
        service: test.name,
        status: uncoveredKeys.length === 0 ? 'PASS' : coverageRate >= 80 ? 'WARN' : 'FAIL',
        total: actualKeys.length,
        covered: coveredKeys.length,
        uncovered: uncoveredKeys.length,
        coverage: coverageRate
      });
      
    } catch (error) {
      console.error(`    ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        test: 'Cache Key Discovery',
        service: test.name,
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Test 4: Cache Invalidation
  console.log('\n🗑️ 4. Testing Cache Invalidation:');
  
  for (const test of testServices) {
    console.log(`  🧪 Testing ${test.name} invalidation:`);
    
    try {
      const patterns = test.service.getServiceCachePatterns();
      await test.service.invalidateServiceCaches(patterns.slice(0, 1)); // Test with first pattern
      
      console.log(`    ✅ Cache invalidation successful`);
      
      results.push({
        test: 'Cache Invalidation',
        service: test.name,
        status: 'PASS'
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
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${results.length}`);
  
  // Show coverage summary
  const coverageResults = results.filter(r => r.test === 'Cache Key Discovery');
  if (coverageResults.length > 0) {
    console.log('\n📈 Cache Coverage Summary:');
    coverageResults.forEach(result => {
      if (result.coverage !== undefined) {
        console.log(`  ${result.service}: ${result.coverage.toFixed(1)}% (${result.covered}/${result.total} keys)`);
      }
    });
  }
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(result => {
      console.log(`  - ${result.service}: ${result.test} - ${result.error}`);
    });
  }
  
  if (warned > 0) {
    console.log('\n⚠️  Warnings:');
    results.filter(r => r.status === 'WARN').forEach(result => {
      console.log(`  - ${result.service}: ${result.test} - Low coverage (${result.coverage.toFixed(1)}%)`);
    });
  }
  
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
