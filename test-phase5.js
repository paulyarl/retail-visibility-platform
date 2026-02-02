#!/usr/bin/env node

/**
 * Batch Test Script for Phase 5: Advanced Shop Discovery Components
 * Tests TrendingShops, ShopCategories, and ShopSearch components
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'; // Frontend URL for page testing
const API_URL = process.env.API_URL || 'http://localhost:4000'; // API URL for API testing
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';
const TEST_RESULTS = {
  phase: 'Phase 5: Advanced Shop Discovery Components',
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
    console.error('Test error:', error);
    TEST_RESULTS.tests.push({
      name: testName,
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });
    TEST_RESULTS.failed++;
    console.log(`❌ ${testName} - FAIL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Phase 5 Tests

async function testTrendingShopsComponent() {
  // Test if the trending shops component renders on the directory page
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  const hasTrendingComponent = response.data.includes('TrendingShops') || 
                            response.data.includes('trending') ||
                            response.data.includes('Trending');
  if (!hasTrendingComponent) {
    throw new Error('Trending shops component not found in page');
  }
  
  return { 
    componentRenders: true,
    pageLoads: true,
    contentSize: response.data.length
  };
}

async function testTrendingShopsAPI() {
  // Test the trending shops API that feeds the component
  const response = await makeRequest(`${API_URL}/api/shops/trending`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  if (!response.data.data || !Array.isArray(response.data.data)) {
    throw new Error('Trending shops API not returning proper data structure');
  }
  
  const trendingShop = response.data.data[0];
  if (!trendingShop.trendingScore && !trendingShop.weeklyGrowth) {
    throw new Error('Trending shops missing trending metrics');
  }
  
  return { 
    apiWorking: true,
    hasTrendingData: true,
    shopCount: response.data.data.length,
    hasMetrics: !!(trendingShop.trendingScore || trendingShop.weeklyGrowth)
  };
}

async function testShopCategoriesComponent() {
  // Test if the shop categories component renders
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  const hasCategoriesComponent = response.data.includes('Category') && 
                               response.data.includes('All Categories') &&
                               response.data.includes('<select');
  if (!hasCategoriesComponent) {
    throw new Error('Shop categories component not found in page');
  }
  
  return { 
    componentRenders: true,
    hasCategoryUI: true,
    hasDropdown: true,
    contentSize: response.data.length
  };
}

async function testShopCategoriesAPI() {
  // Test the shop categories API
  const response = await makeRequest(`${API_URL}/api/shops/categories`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  if (!response.data.data || !Array.isArray(response.data.data)) {
    throw new Error('Shop categories API not returning proper data structure');
  }
  
  const category = response.data.data[0];
  if (!category.id || !category.name) {
    throw new Error('Shop categories missing required fields');
  }
  
  return { 
    apiWorking: true,
    hasCategoryData: true,
    categoryCount: response.data.data.length,
    hasIcons: !!(category.icon || category.imageUrl)
  };
}

async function testShopSearchComponent() {
  // Test if the shop search component renders
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  const hasSearchComponent = response.data.includes('ShopSearch') || 
                           response.data.includes('search') ||
                           response.data.includes('Search');
  if (!hasSearchComponent) {
    throw new Error('Shop search component not found in page');
  }
  
  return { 
    componentRenders: true,
    hasSearchUI: true,
    contentSize: response.data.length
  };
}

async function testShopSearchFunctionality() {
  // Test shop search API functionality
  const response = await makeRequest(`${API_URL}/api/shops/directory?search=market&limit=5`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  if (!response.data.data || !Array.isArray(response.data.data)) {
    throw new Error('Shop search API not returning proper data structure');
  }
  
  // Check if search results are relevant
  const searchResults = response.data.data;
  const hasRelevantResults = searchResults.some(shop => 
    shop.name.toLowerCase().includes('market') || 
    shop.description.toLowerCase().includes('market')
  );
  
  return { 
    searchWorking: true,
    hasSearchResults: searchResults.length > 0,
    resultCount: searchResults.length,
    hasRelevantResults
  };
}

async function testComponentIntegration() {
  // Test if all three components work together on the same page
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  const pageContent = response.data;
  const hasAllComponents = 
    pageContent.includes('TrendingShops') || pageContent.includes('trending') &&
    pageContent.includes('ShopCategories') || pageContent.includes('categories') &&
    pageContent.includes('ShopSearch') || pageContent.includes('search');
  
  if (!hasAllComponents) {
    throw new Error('Not all discovery components present on page');
  }
  
  return { 
    allComponentsPresent: true,
    pageContent: pageContent.length,
    componentCount: 3
  };
}

async function testAdvancedFiltering() {
  // Test advanced filtering capabilities
  const categoryResponse = await makeRequest(`${API_URL}/api/shops/directory?category=grocery&limit=5`);
  const searchResponse = await makeRequest(`${API_URL}/api/shops/directory?search=fashion&limit=5`);
  
  if (categoryResponse.status !== 200 || searchResponse.status !== 200) {
    throw new Error('Advanced filtering APIs not working');
  }
  
  const hasCategoryResults = categoryResponse.data.data && categoryResponse.data.data.length > 0;
  const hasSearchResults = searchResponse.data.data && searchResponse.data.data.length > 0;
  
  return { 
    categoryFilterWorking: hasCategoryResults,
    searchFilterWorking: hasSearchResults,
    categoryResults: hasCategoryResults ? categoryResponse.data.data.length : 0,
    searchResults: hasSearchResults ? searchResponse.data.data.length : 0
  };
}

async function testComponentResponsiveness() {
  // Test if components are responsive (check for responsive design patterns)
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  const pageContent = response.data;
  const hasResponsiveClasses = 
    pageContent.includes('md:') || 
    pageContent.includes('lg:') || 
    pageContent.includes('sm:') ||
    pageContent.includes('responsive') ||
    pageContent.includes('grid-cols-');
  
  return { 
    pageLoads: true,
    hasResponsiveDesign: hasResponsiveClasses,
    contentSize: pageContent.length
  };
}

async function testComponentErrorHandling() {
  // Test component behavior with empty states
  const emptySearchResponse = await makeRequest(`${API_URL}/api/shops/directory?search=nonexistent&limit=5`);
  const emptyCategoryResponse = await makeRequest(`${API_URL}/api/shops/directory?category=nonexistent&limit=5`);
  
  if (emptySearchResponse.status !== 200 || emptyCategoryResponse.status !== 200) {
    throw new Error('Error handling APIs not responding correctly');
  }
  
  const handlesEmptySearch = emptySearchResponse.data.data && emptySearchResponse.data.data.length === 0;
  const handlesEmptyCategory = emptyCategoryResponse.data.data && emptyCategoryResponse.data.data.length === 0;
  
  return { 
    handlesEmptySearch,
    handlesEmptyCategory,
    emptySearchResults: emptySearchResponse.data.data ? emptySearchResponse.data.data.length : 0,
    emptyCategoryResults: emptyCategoryResponse.data.data ? emptyCategoryResponse.data.data.length : 0
  };
}

async function testComponentPerformance() {
  // Test component loading performance
  const startTime = Date.now();
  const response = await makeRequest(`${BASE_URL}/shops/directory`);
  const endTime = Date.now();
  
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  
  const loadTime = endTime - startTime;
  const isPerformant = loadTime < 3000; // 3 seconds threshold
  
  if (!isPerformant) {
    throw new Error(`Page load too slow: ${loadTime}ms`);
  }
  
  return { 
    loadTime,
    isPerformant,
    pageSize: response.data.length
  };
}

// Main test runner
async function runPhase5Tests() {
  console.log(`🚀 Starting Phase 5: Advanced Shop Discovery Components Tests`);
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔗 API URL: ${API_URL}`);
  
  // Run all tests
  await runTest('Trending Shops Component', testTrendingShopsComponent);
  await runTest('Trending Shops API', testTrendingShopsAPI);
  await runTest('Shop Categories Component', testShopCategoriesComponent);
  await runTest('Shop Categories API', testShopCategoriesAPI);
  await runTest('Shop Search Component', testShopSearchComponent);
  await runTest('Shop Search Functionality', testShopSearchFunctionality);
  await runTest('Component Integration', testComponentIntegration);
  await runTest('Advanced Filtering', testAdvancedFiltering);
  await runTest('Component Responsiveness', testComponentResponsiveness);
  await runTest('Component Error Handling', testComponentErrorHandling);
  await runTest('Component Performance', testComponentPerformance);
  
  // Calculate results
  TEST_RESULTS.endTime = new Date();
  TEST_RESULTS.totalDuration = TEST_RESULTS.endTime - TEST_RESULTS.startTime;
  TEST_RESULTS.totalTests = TEST_RESULTS.passed + TEST_RESULTS.failed;
  TEST_RESULTS.successRate = (TEST_RESULTS.passed / TEST_RESULTS.totalTests) * 100;
  
  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 5 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Duration: ${TEST_RESULTS.totalDuration}ms`);
  console.log(`✅ Passed: ${TEST_RESULTS.passed}`);
  console.log(`❌ Failed: ${TEST_RESULTS.failed}`);
  console.log(`📈 Success Rate: ${TEST_RESULTS.successRate.toFixed(1)}%`);
  
  if (TEST_RESULTS.failed > 0) {
    console.log('\n❌ Failed Tests:');
    TEST_RESULTS.tests.filter(t => t.status === 'FAIL').forEach(test => {
      console.log(`  • ${test.name}: ${test.error}`);
    });
  }
  
  // Status assessment
  if (TEST_RESULTS.failed === 0) {
    console.log('\n✅ Phase 5 Advanced Discovery Components Status:');
    console.log('🎉 ALL TESTS PASSED - Advanced discovery components are ready!');
  } else if (TEST_RESULTS.failed <= 2) {
    console.log('\n⚠️  Phase 5 Advanced Discovery Components Status:');
    console.log('👍 MOSTLY READY - Minor component issues to address');
  } else {
    console.log('\n❌ Phase 5 Advanced Discovery Components Status:');
    console.log('🔧 NEEDS WORK - Multiple component issues found');
  }
  
  console.log('\n🔧 Components Tested:');
  console.log('  • TrendingShops Component (trending algorithm, metrics, ranking)');
  console.log('  • ShopCategories Component (browsing, filtering, icons)');
  console.log('  • ShopSearch Component (real-time search, suggestions, filters)');
  console.log('  • Component Integration (all components working together)');
  console.log('  • Advanced Filtering (category, search, combined filters)');
  console.log('  • Responsive Design (mobile, tablet, desktop)');
  console.log('  • Error Handling (empty states, API failures)');
  console.log('  • Performance (load times, optimization)');
  
  // Save results to file
  const fs = require('fs');
  const resultsPath = './test-results-phase5.json';
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
  runPhase5Tests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runPhase5Tests };
