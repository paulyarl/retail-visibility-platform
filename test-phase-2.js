#!/usr/bin/env node

/**
 * Batch Test Script for Phase 2: Basic Shop Management
 * Tests shop directory, shop details, categories, and discovery APIs
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';
const TEST_RESULTS = {
  phase: 'Phase 2: Basic Shop Management',
  tests: [],
  passed: 0,
  failed: 0,
  startTime: new Date(),
  endTime: null
};

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    
    // Add authentication header
    const defaultHeaders = {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    const finalOptions = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };
    
    const req = lib.request(url, finalOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          // If JSON parse fails, return raw data
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runTest(testName, testFn) {
  console.log(`\n🧪 Running: ${testName}`);
  try {
    const result = await testFn();
    TEST_RESULTS.tests.push({
      name: testName,
      status: 'PASS',
      result,
      timestamp: new Date()
    });
    TEST_RESULTS.passed++;
    console.log(`✅ ${testName} - PASS`);
  } catch (error) {
    TEST_RESULTS.tests.push({
      name: testName,
      status: 'FAIL',
      error: error.message,
      timestamp: new Date()
    });
    TEST_RESULTS.failed++;
    console.log(`❌ ${testName} - FAIL: ${error.message}`);
  }
}

// Phase 2 Tests
async function testShopDirectoryAPI() {
  const response = await makeRequest(`${BASE_URL}/api/shops/directory?page=1&limit=10`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  if (!response.data?.success) {
    throw new Error('API response indicates failure');
  }
  return { 
    shopCount: response.data.data?.length || 0,
    hasPagination: !!response.data.pagination
  };
}

async function testShopDirectoryWithFilters() {
  const response = await makeRequest(`${BASE_URL}/api/shops/directory?category=electronics&limit=5`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    filteredShops: response.data.data?.length || 0,
    category: response.data.filters?.category
  };
}

async function testShopDetailsAPI() {
  // Test with a sample shop ID
  const response = await makeRequest(`${BASE_URL}/api/shops/sample-shop`);
  if (response.status !== 404 && response.status !== 200) {
    throw new Error(`Expected 200 or 404, got ${response.status}`);
  }
  return { 
    status: response.status,
    hasShopData: response.status === 200 && !!response.data?.data
  };
}

async function testShopCategoriesAPI() {
  const response = await makeRequest(`${BASE_URL}/api/shops/categories?includeCount=true`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  if (!response.data?.success) {
    throw new Error('API response indicates failure');
  }
  return { 
    categoryCount: response.data.data?.length || 0,
    hasCounts: response.data.data?.[0]?.count !== undefined
  };
}

async function testShopCategoriesWithoutCount() {
  const response = await makeRequest(`${BASE_URL}/api/shops/categories`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    categoryCount: response.data.data?.length || 0,
    hasCounts: response.data.data?.[0]?.count === undefined
  };
}

async function testTrendingShopsAPI() {
  const response = await makeRequest(`${BASE_URL}/api/shops/trending?limit=5`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  if (!response.data?.success) {
    throw new Error('API response indicates failure');
  }
  return { 
    trendingCount: response.data.data?.length || 0,
    hasTrendingData: response.data.data?.[0]?.trending
  };
}

async function testTrendingShopsWithFilters() {
  const response = await makeRequest(`${BASE_URL}/api/shops/trending?category=electronics&limit=3`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    filteredTrending: response.data.data?.length || 0,
    filters: response.data.meta
  };
}

async function testShopDirectoryPagination() {
  const response = await makeRequest(`${BASE_URL}/api/shops/directory?page=2&limit=5`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  const pagination = response.data.pagination;
  if (!pagination) {
    throw new Error('Missing pagination data');
  }
  return { 
    currentPage: pagination.page,
    hasNext: pagination.hasNext,
    hasPrev: pagination.hasPrev
  };
}

async function testShopDirectorySearch() {
  const response = await makeRequest(`${BASE_URL}/api/shops/directory?search=tech&limit=5`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    searchResults: response.data.data?.length || 0,
    searchQuery: response.data.filters?.search
  };
}

async function testAPIResponseStructure() {
  const response = await makeRequest(`${BASE_URL}/api/shops/directory?limit=1`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  const shop = response.data.data?.[0];
  if (!shop) {
    throw new Error('No shop data in response');
  }
  
  const requiredFields = ['id', 'tenantId', 'name', 'description', 'urls'];
  const missingFields = requiredFields.filter(field => !(field in shop));
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return { 
    hasRequiredFields: true,
    shopId: shop.id,
    hasUrls: !!shop.urls
  };
}

// Main test runner
async function runPhase2Tests() {
  console.log('🚀 Starting Phase 2: Basic Shop Management Tests');
  console.log(`📍 Base URL: ${BASE_URL}\n`);

  // Run all tests
  await runTest('Shop Directory API', testShopDirectoryAPI);
  await runTest('Shop Directory with Filters', testShopDirectoryWithFilters);
  await runTest('Shop Details API', testShopDetailsAPI);
  await runTest('Shop Categories API', testShopCategoriesAPI);
  await runTest('Shop Categories without Count', testShopCategoriesWithoutCount);
  await runTest('Trending Shops API', testTrendingShopsAPI);
  await runTest('Trending Shops with Filters', testTrendingShopsWithFilters);
  await runTest('Shop Directory Pagination', testShopDirectoryPagination);
  await runTest('Shop Directory Search', testShopDirectorySearch);
  await runTest('API Response Structure', testAPIResponseStructure);

  // Final results
  TEST_RESULTS.endTime = new Date();
  const duration = TEST_RESULTS.endTime - TEST_RESULTS.startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 2 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`✅ Passed: ${TEST_RESULTS.passed}`);
  console.log(`❌ Failed: ${TEST_RESULTS.failed}`);
  console.log(`📈 Success Rate: ${((TEST_RESULTS.passed / (TEST_RESULTS.passed + TEST_RESULTS.failed)) * 100).toFixed(1)}%`);
  
  if (TEST_RESULTS.failed > 0) {
    console.log('\n❌ Failed Tests:');
    TEST_RESULTS.tests
      .filter(test => test.status === 'FAIL')
      .forEach(test => {
        console.log(`  • ${test.name}: ${test.error}`);
      });
  }

  console.log('\n🎯 Phase 2 Shop Management Status:');
  if (TEST_RESULTS.failed === 0) {
    console.log('✅ ALL TESTS PASSED - Shop management APIs are ready!');
  } else if (TEST_RESULTS.failed <= 2) {
    console.log('⚠️  MOSTLY READY - Minor API issues to address');
  } else {
    console.log('❌ NEEDS ATTENTION - Multiple API issues found');
  }

  console.log('\n🔗 Shop API Endpoints Tested:');
  console.log('  • GET /api/shops/directory');
  console.log('  • GET /api/shops/[id]');
  console.log('  • GET /api/shops/categories');
  console.log('  • GET /api/shops/trending');

  // Save results to file
  const fs = require('fs');
  const resultsPath = './test-results-phase2.json';
  fs.writeFileSync(resultsPath, JSON.stringify(TEST_RESULTS, null, 2));
  console.log(`\n💾 Results saved to: ${resultsPath}`);

  // Only exit if not being run by master test runner
  if (!process.env.MASTER_TEST_RUNNER) {
    process.exit(TEST_RESULTS.failed > 0 ? 1 : 0);
  }
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  runPhase2Tests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runPhase2Tests };
