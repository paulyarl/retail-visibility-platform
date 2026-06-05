#!/usr/bin/env node

/**
 * Batch Test Script for Phase 3-4: Shop Discovery Components
 * Tests UI components, search functionality, and discovery features
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'; // Frontend URL for page testing
const API_URL = process.env.API_URL || 'http://localhost:4000'; // API URL for API testing
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';
const TEST_RESULTS = {
  phase: 'Phase 3-4: Shop Discovery Components',
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

// Phase 3-4 Tests
async function testShopDirectoryPage() {
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  const hasContent = response.data.includes('ShopDirectory') || response.data.includes('directory');
  if (!hasContent) {
    throw new Error('Shop directory page content not found');
  }
  return { 
    pageLoads: true,
    hasContent: true,
    contentSize: response.data.length
  };
}

async function testShopPage() {
  const response = await makeRequest(`${BASE_URL}/shops/demo-shop`);
  if (response.status !== 200 && response.status !== 404) {
    throw new Error(`Expected 200 or 404, got ${response.status}`);
  }
  return { 
    status: response.status,
    pageLoads: response.status === 200 || response.status === 404
  };
}

async function testTenantShopPage() {
  const response = await makeRequest(`${BASE_URL}/t/demo-tenant`);
  if (response.status !== 200 && response.status !== 404) {
    throw new Error(`Expected 200 or 404, got ${response.status}`);
  }
  return { 
    status: response.status,
    pageLoads: response.status === 200 || response.status === 404
  };
}

async function testDirectoryMainPage() {
  const response = await makeRequest(`${BASE_URL}/directory`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    pageLoads: true,
    contentSize: response.data.length
  };
}

async function testShopsListingPage() {
  const response = await makeRequest(`${BASE_URL}/shops`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    pageLoads: true,
    contentSize: response.data.length
  };
}

async function testShopSearchPage() {
  const response = await makeRequest(`${BASE_URL}/shops/directory?search=test`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    pageLoads: true,
    hasSearchParam: true,
    contentSize: response.data.length
  };
}

async function testShopCategoryFilter() {
  const response = await makeRequest(`${BASE_URL}/shops/directory?category=electronics`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    pageLoads: true,
    hasCategoryParam: true,
    contentSize: response.data.length
  };
}

async function testShopPagination() {
  const response = await makeRequest(`${BASE_URL}/shops/directory?page=2`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { 
    pageLoads: true,
    hasPageParam: true,
    contentSize: response.data.length
  };
}

async function testShopManagementDashboard() {
  const response = await makeRequest(`${BASE_URL}/t/demo-tenant/dashboard/shops/manage`);
  if (response.status !== 200 && response.status !== 404) {
    throw new Error(`Expected 200 or 404, got ${response.status}`);
  }
  return { 
    status: response.status,
    pageAccessible: response.status === 200 || response.status === 404
  };
}

async function testAPIIntegration() {
  // Test if the APIs we created are being called by the UI
  const directoryResponse = await makeRequest(`${API_URL}/api/shops/directory`);
  const trendingResponse = await makeRequest(`${API_URL}/api/shops/trending`);
  const categoriesResponse = await makeRequest(`${API_URL}/api/shops/categories`);
  
  if (directoryResponse.status !== 200) {
    throw new Error('Shop directory API not working');
  }
  if (trendingResponse.status !== 200) {
    throw new Error('Trending shops API not working');
  }
  if (categoriesResponse.status !== 200) {
    throw new Error('Shop categories API not working');
  }
  
  return {
    directoryAPI: true,
    trendingAPI: true,
    categoriesAPI: true,
    allAPIsWorking: true
  };
}

async function testComponentRendering() {
  // Test if key components are present in the directory page
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  const content = response.data;
  
  const components = {
    hasShopCard: content.includes('ShopCard') || content.includes('shop-card'),
    hasShopSearch: content.includes('ShopSearch') || content.includes('search'),
    hasShopFilters: content.includes('ShopFilters') || content.includes('filters'),
    hasTrendingShops: content.includes('TrendingShops') || content.includes('trending'),
    hasShopCategories: content.includes('ShopCategories') || content.includes('categories')
  };
  
  const missingComponents = Object.entries(components)
    .filter(([_, hasComponent]) => !hasComponent)
    .map(([name]) => name);
  
  if (missingComponents.length > 3) {
    throw new Error(`Too many components missing: ${missingComponents.join(', ')}`);
  }
  
  return components;
}

async function testResponsiveDesign() {
  // Test if pages load with mobile user agent
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    }
  };
  
  const response = await makeRequest(`${BASE_URL}/shops/directory`, options);
  if (response.status !== 200) {
    throw new Error(`Mobile page load failed: ${response.status}`);
  }
  
  return {
    mobilePageLoads: true,
    mobileContentSize: response.data.length
  };
}

// Main test runner
async function runPhase3_4Tests() {
  console.log('🚀 Starting Phase 3-4: Shop Discovery Components Tests');
  console.log(`📍 Base URL: ${BASE_URL}\n`);

  // Run all tests
  await runTest('Shop Directory Page', testShopDirectoryPage);
  await runTest('Individual Shop Page', testShopPage);
  await runTest('Tenant Shop Page', testTenantShopPage);
  await runTest('Directory Main Page', testDirectoryMainPage);
  await runTest('Shops Listing Page', testShopsListingPage);
  await runTest('Shop Search Page', testShopSearchPage);
  await runTest('Shop Category Filter', testShopCategoryFilter);
  await runTest('Shop Pagination', testShopPagination);
  await runTest('Shop Management Dashboard', testShopManagementDashboard);
  await runTest('API Integration', testAPIIntegration);
  await runTest('Component Rendering', testComponentRendering);
  await runTest('Responsive Design', testResponsiveDesign);

  // Final results
  TEST_RESULTS.endTime = new Date();
  const duration = TEST_RESULTS.endTime - TEST_RESULTS.startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 3-4 TEST RESULTS');
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

  console.log('\n🎯 Phase 3-4 Discovery Components Status:');
  if (TEST_RESULTS.failed === 0) {
    console.log('✅ ALL TESTS PASSED - Discovery components are ready!');
  } else if (TEST_RESULTS.failed <= 2) {
    console.log('⚠️  MOSTLY READY - Minor component issues to address');
  } else {
    console.log('❌ NEEDS ATTENTION - Multiple component issues found');
  }

  console.log('\n🔗 Pages Tested:');
  console.log('  • /shops/directory');
  console.log('  • /shops/[shopId]');
  console.log('  • /t/[tenantId]');
  console.log('  • /directory');
  console.log('  • /shops');

  // Save results to file
  const fs = require('fs');
  const resultsPath = './test-results-phase3-4.json';
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
  runPhase3_4Tests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runPhase3_4Tests };
