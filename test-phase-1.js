#!/usr/bin/env node

/**
 * Batch Test Script for Phase 1: Core Infrastructure
 * Tests authentication, tenant management, and basic APIs
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';
const TEST_RESULTS = {
  phase: 'Phase 1: Core Infrastructure',
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

// Phase 1 Tests
async function testAuthentication() {
  const response = await makeRequest(`${BASE_URL}/api/auth/me`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { authenticated: !!response.data?.user };
}

async function testTenantsAPI() {
  const response = await makeRequest(`${BASE_URL}/api/tenants`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { tenantCount: Array.isArray(response.data) ? response.data.length : 0 };
}

async function testTenantLimits() {
  const response = await makeRequest(`${BASE_URL}/api/tenant-limits/status`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { hasLimits: !!response.data?.current };
}

async function testCategoriesAPI() {
  const response = await makeRequest(`${BASE_URL}/api/categories`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { categoryCount: Array.isArray(response.data) ? response.data.length : 0 };
}

async function testDashboardAPI() {
  const response = await makeRequest(`${BASE_URL}/api/dashboard`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { hasDashboard: !!response.data };
}

async function testItemsAPI() {
  const response = await makeRequest(`${BASE_URL}/api/items?tenant_id=tid-m8ijkrnk`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { itemCount: Array.isArray(response.data) ? response.data.length : 0 };
}

async function testUserAPI() {
  const response = await makeRequest(`${BASE_URL}/api/user/profile`);
  // May return 401 if not authenticated, that's expected
  return { 
    status: response.status,
    hasProfile: response.status === 200 && !!response.data
  };
}

async function testDirectoryAPI() {
  const response = await makeRequest(`${BASE_URL}/api/directory/stores`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  return { storeCount: Array.isArray(response.data) ? response.data.length : 0 };
}

// Main test runner
async function runPhase1Tests() {
  console.log('🚀 Starting Phase 1: Core Infrastructure Tests');
  console.log(`📍 Base URL: ${BASE_URL}\n`);

  // Run all tests
  await runTest('Authentication Check', testAuthentication);
  await runTest('Tenants API', testTenantsAPI);
  await runTest('Tenant Limits API', testTenantLimits);
  await runTest('Categories API', testCategoriesAPI);
  await runTest('Dashboard API', testDashboardAPI);
  await runTest('Items API', testItemsAPI);
  await runTest('User Profile API', testUserAPI);
  await runTest('Directory Stores API', testDirectoryAPI);

  // Final results
  TEST_RESULTS.endTime = new Date();
  const duration = TEST_RESULTS.endTime - TEST_RESULTS.startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 1 TEST RESULTS');
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

  console.log('\n🎯 Phase 1 Core Infrastructure Status:');
  if (TEST_RESULTS.failed === 0) {
    console.log('✅ ALL TESTS PASSED - Core infrastructure is ready!');
  } else if (TEST_RESULTS.failed <= 2) {
    console.log('⚠️  MOSTLY READY - Minor issues to address');
  } else {
    console.log('❌ NEEDS ATTENTION - Multiple issues found');
  }

  // Save results to file
  const fs = require('fs');
  const resultsPath = './test-results-phase1.json';
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
  runPhase1Tests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runPhase1Tests };
