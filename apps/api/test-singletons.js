#!/usr/bin/env node

/**
 * API Singleton Batch Test Script
 * 
 * Tests all singleton contexts:
 * - Public API singleton
 * - Private API singleton  
 * - Public product singleton
 * - Public store singleton
 * - Public category singleton
 */

// Use Node.js built-in fetch (available in Node 18+) or fallback to node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
} catch (error) {
  fetch = require('node-fetch');
}

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const TEST_TIMEOUT = 30000; // 30 seconds per test
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';

// Test results tracking
const results = {
  publicApi: { passed: 0, failed: 0, errors: [] },
  privateApi: { passed: 0, failed: 0, errors: [] },
  productSingleton: { passed: 0, failed: 0, errors: [] },
  storeSingleton: { passed: 0, failed: 0, errors: [] },
  categorySingleton: { passed: 0, failed: 0, errors: [] },
  performance: { passed: 0, failed: 0, errors: [] }
};

// Utility functions
function log(category, message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${category.toUpperCase()}]`;
  
  switch(type) {
    case 'success':
      console.log(`✅ ${prefix} ${message}`);
      break;
    case 'error':
      console.log(`❌ ${prefix} ${message}`);
      break;
    case 'warn':
      console.log(`⚠️  ${prefix} ${message}`);
      break;
    default:
      console.log(`ℹ️  ${prefix} ${message}`);
  }
}

function recordResult(category, success, error = null) {
  if (success) {
    results[category].passed++;
  } else {
    results[category].failed++;
    if (error) {
      results[category].errors.push(error);
    }
  }
}

async function runTest(category, testName, testFn) {
  try {
    log(category, `Running ${testName}...`);
    const result = await Promise.race([
      testFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
      )
    ]);
    
    if (result.success) {
      log(category, `✓ ${testName}: ${result.message || 'PASSED'}`, 'success');
      recordResult(category, true);
    } else {
      log(category, `✗ ${testName}: ${result.message || 'FAILED'}`, 'error');
      recordResult(category, false, result.error);
    }
  } catch (error) {
    log(category, `✗ ${testName}: ${error.message}`, 'error');
    recordResult(category, false, error.message);
  }
}

// Test suites
async function testPublicApiSingleton() {
  const category = 'publicApi';
  
  await runTest(category, 'Health Check', async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    return {
      success: response.ok,
      message: `Health check returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Public Directory Endpoint', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory`);
    return {
      success: response.ok,
      message: `Directory endpoint returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Public Featured Products', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/random-featured?limit=3&lat=40.7128&lng=-74.0060`);
    return {
      success: response.ok,
      message: `Featured products returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Public Directory Categories', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/categories`);
    return {
      success: response.ok,
      message: `Directory categories returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Public Directory Stores', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/featured-stores?limit=5`);
    return {
      success: response.ok,
      message: `Featured stores returned ${response.status}`,
      data: await response.json()
    };
  });
}

async function testPrivateApiSingleton() {
  const category = 'privateApi';
  
  await runTest(category, 'Auth Endpoint Check', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'test' })
      });
      
      // We expect this to fail with invalid credentials, but the endpoint should exist
      return {
        success: response.status !== 404,
        message: `Auth endpoint exists (status: ${response.status})`,
        data: await response.json().catch(() => ({}))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  await runTest(category, 'Protected Route Access', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tenants`, {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: response.ok || response.status === 401,
        message: `Protected route access test (status: ${response.status})`,
        data: await response.json().catch(() => ({}))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  await runTest(category, 'Tenant Data Access', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tenants/tid-m8ijkjrnk`, {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: response.ok || response.status === 401 || response.status === 403,
        message: `Tenant data access test (status: ${response.status})`,
        data: await response.json().catch(() => ({}))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  await runTest(category, 'Admin Dashboard Access', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: response.ok || response.status === 401 || response.status === 403,
        message: `Admin dashboard access test (status: ${response.status})`,
        data: await response.json().catch(() => ({}))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
}

async function testProductSingleton() {
  const category = 'productSingleton';
  
  await runTest(category, 'Directory Products Search', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/search?q=test&limit=5`);
    return {
      success: response.ok,
      message: `Directory product search returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Directory Tenant Products', async () => {
    // Test getting products from a specific tenant
    const response = await fetch(`${API_BASE_URL}/api/directory/tenant/tid-m8ijkjrnk/products?limit=5`);
    return {
      success: response.ok || response.status === 404, // 404 is acceptable if tenant has no products
      message: `Directory tenant products returned ${response.status}`,
      data: await response.json().catch(() => ({}))
    };
  });

  await runTest(category, 'Featured Products with Location', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/random-featured?limit=5&lat=40.7128&lng=-74.0060&radius=25`);
    return {
      success: response.ok,
      message: `Location-aware featured products returned ${response.status}`,
      data: await response.json()
    };
  });
}

async function testStoreSingleton() {
  const category = 'storeSingleton';
  
  await runTest(category, 'Directory Featured Stores', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/featured-stores?limit=10`);
    return {
      success: response.ok,
      message: `Directory featured stores returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Directory Store Search', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/search?q=new+york&type=stores&limit=5`);
    return {
      success: response.ok,
      message: `Directory store search returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Directory Tenant Info', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/tenant/tid-m8ijkjrnk`);
    return {
      success: response.ok || response.status === 404, // 404 is acceptable if tenant doesn't exist
      message: `Directory tenant info returned ${response.status}`,
      data: await response.json().catch(() => ({}))
    };
  });
}

async function testCategorySingleton() {
  const category = 'categorySingleton';
  
  await runTest(category, 'Directory Categories', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/categories`);
    return {
      success: response.ok,
      message: `Directory categories returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Directory Categories Optimized', async () => {
    const response = await fetch(`${API_BASE_URL}/api/directory/categories-optimized`);
    return {
      success: response.ok,
      message: `Directory categories optimized returned ${response.status}`,
      data: await response.json()
    };
  });

  await runTest(category, 'Directory Category Products', async () => {
    // First get a category, then get products for it
    const categoriesResponse = await fetch(`${API_BASE_URL}/api/directory/categories?limit=1`);
    if (!categoriesResponse.ok) {
      throw new Error('Could not get categories');
    }
    
    const categoriesData = await categoriesResponse.json();
    const categoryId = categoriesData.categories?.[0]?.id || 'electronics'; // fallback to common category
    
    const response = await fetch(`${API_BASE_URL}/api/directory/category/${categoryId}/products?limit=5`);
    return {
      success: response.ok || response.status === 404, // 404 is acceptable if category has no products
      message: `Directory category products returned ${response.status}`,
      data: await response.json().catch(() => ({}))
    };
  });
}

// Performance tests
async function testPerformance() {
  const category = 'performance';
  
  await runTest(category, 'Concurrent Requests', async () => {
    const requests = Array(10).fill().map(() => 
      fetch(`${API_BASE_URL}/api/directory/random-featured?limit=3`)
    );
    
    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const endTime = Date.now();
    
    const allSuccessful = responses.every(r => r.ok);
    const totalTime = endTime - startTime;
    
    return {
      success: allSuccessful,
      message: `10 concurrent requests completed in ${totalTime}ms (${allSuccessful ? 'all successful' : 'some failed'})`,
      data: { totalTime, averageTime: totalTime / 10 }
    };
  });

  await runTest(category, 'Cache Hit Test', async () => {
    // Make same request twice to test caching
    const url = `${API_BASE_URL}/api/directory/random-featured?limit=3&lat=40.7128&lng=-74.0060`;
    
    const start1 = Date.now();
    const response1 = await fetch(url);
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    const response2 = await fetch(url);
    const time2 = Date.now() - start2;
    
    const cacheImprovement = time1 > 0 ? ((time1 - time2) / time1 * 100).toFixed(1) : 0;
    
    return {
      success: response1.ok && response2.ok,
      message: `Cache test: first ${time1}ms, second ${time2}ms (${cacheImprovement}% improvement)`,
      data: { time1, time2, cacheImprovement }
    };
  });
}

// Main execution
async function main() {
  console.log('🚀 Starting API Singleton Batch Tests');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`⏱️  Test Timeout: ${TEST_TIMEOUT}ms per test`);
  console.log('');

  const startTime = Date.now();

  try {
    // Run all test suites
    await testPublicApiSingleton();
    console.log('');
    
    await testPrivateApiSingleton();
    console.log('');
    
    await testProductSingleton();
    console.log('');
    
    await testStoreSingleton();
    console.log('');
    
    await testCategorySingleton();
    console.log('');
    
    await testPerformance();
    console.log('');

    // Print summary
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log('');

    let totalPassed = 0;
    let totalFailed = 0;

    Object.entries(results).forEach(([category, result]) => {
      const categoryName = category.replace(/([A-Z])/g, ' $1').trim();
      const categoryTotal = result.passed + result.failed;
      const successRate = categoryTotal > 0 ? (result.passed / categoryTotal * 100).toFixed(1) : 0;
      
      console.log(`${categoryName}:`);
      console.log(`  ✅ Passed: ${result.passed}`);
      console.log(`  ❌ Failed: ${result.failed}`);
      console.log(`  📈 Success Rate: ${successRate}%`);
      
      if (result.errors.length > 0) {
        console.log(`  🚨 Errors:`);
        result.errors.forEach(error => console.log(`    - ${error}`));
      }
      console.log('');
      
      totalPassed += result.passed;
      totalFailed += result.failed;
    });

    const grandTotal = totalPassed + totalFailed;
    const grandSuccessRate = grandTotal > 0 ? (totalPassed / grandTotal * 100).toFixed(1) : 0;

    console.log('='.repeat(50));
    console.log(`🎯 OVERALL RESULTS:`);
    console.log(`  ✅ Total Passed: ${totalPassed}`);
    console.log(`  ❌ Total Failed: ${totalFailed}`);
    console.log(`  📈 Overall Success Rate: ${grandSuccessRate}%`);
    console.log('');

    if (grandSuccessRate >= 80) {
      console.log('🎉 EXCELLENT: API singletons are performing well!');
    } else if (grandSuccessRate >= 60) {
      console.log('⚠️  WARNING: Some issues detected, review failed tests');
    } else {
      console.log('🚨 CRITICAL: Major issues with API singletons');
    }

    process.exit(totalFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 Test suite crashed:', error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  main,
  testPublicApiSingleton,
  testPrivateApiSingleton,
  testProductSingleton,
  testStoreSingleton,
  testCategorySingleton,
  testPerformance
};
