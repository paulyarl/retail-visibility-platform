#!/usr/bin/env node

/**
 * Backend Services Readiness Test Script
 * Tests all backend services before building shops pages
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:4000';
const TEST_TIMEOUT = 10000; // 10 seconds per test

// Authentication
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';
const TENANT_ID = 'tid-m8ijkrnk';

// Test results tracking
const results = {
  passed: [],
  failed: [],
  skipped: []
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`  ${title}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

async function makeRequest(url, method = 'GET', data = null, useAuth = false) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const options = {
      method,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Backend-Readiness-Test/1.0'
      }
    };

    // Add auth header if required
    if (useAuth && AUTH_TOKEN) {
      options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testEndpoint(name, url, expectedStatus = 200, method = 'GET', useAuth = false) {
  try {
    log(`  Testing ${name}...`, colors.yellow);
    
    const response = await makeRequest(url, method, null, useAuth);
    
    if (response.status === expectedStatus) {
      log(`    ✅ ${name} - ${response.status}`, colors.green);
      results.passed.push({ name, url, status: response.status });
      
      // Try to parse JSON response for validation
      try {
        const data = JSON.parse(response.body);
        if (data && typeof data === 'object') {
          log(`    📊 Response: ${Object.keys(data).length} fields`, colors.blue);
        }
      } catch (e) {
        log(`    📄 Response: ${response.body.length} chars`, colors.blue);
      }
      
      return true;
    } else {
      log(`    ❌ ${name} - ${response.status}`, colors.red);
      log(`    📄 Error: ${response.body.substring(0, 200)}...`, colors.red);
      results.failed.push({ name, url, status: response.status, error: response.body });
      return false;
    }
  } catch (error) {
    log(`    ❌ ${name} - ${error.message}`, colors.red);
    results.failed.push({ name, url, error: error.message });
    return false;
  }
}

async function testShopsFeaturedService() {
  logSection('SHOPS FEATURED SERVICE TESTS');
  
  const tests = [
    {
      name: 'Random Products',
      url: `${API_BASE_URL}/api/shops/featured/random`,
      expectedStatus: 200
    },
    {
      name: 'Trending Products',
      url: `${API_BASE_URL}/api/shops/featured/trending`,
      expectedStatus: 200
    },
    {
      name: 'New Products',
      url: `${API_BASE_URL}/api/shops/featured/new`,
      expectedStatus: 200
    },
    {
      name: 'Sale Products',
      url: `${API_BASE_URL}/api/shops/featured/sale`,
      expectedStatus: 200
    },
    {
      name: 'Seasonal Products',
      url: `${API_BASE_URL}/api/shops/featured/seasonal`,
      expectedStatus: 200
    },
    {
      name: 'Staff Pick Products',
      url: `${API_BASE_URL}/api/shops/featured/staff-pick`,
      expectedStatus: 200
    },
    {
      name: 'Store Selection Products',
      url: `${API_BASE_URL}/api/shops/featured/store-selection`,
      expectedStatus: 200
    },
    {
      name: 'Trending Shops',
      url: `${API_BASE_URL}/api/shops/trending`,
      expectedStatus: 200
    },
    {
      name: 'Shop-scoped Products',
      url: `${API_BASE_URL}/api/shops/featured/random?shopScope=shop&tenantId=test-tenant`,
      expectedStatus: 200
    }
  ];

  for (const test of tests) {
    await testEndpoint(test.name, test.url, test.expectedStatus);
  }
}

async function testCoreServices() {
  logSection('CORE SERVICES TESTS');
  
  const tests = [
    {
      name: 'Health Check',
      url: `${API_BASE_URL}/api/health`,
      expectedStatus: 200
    },
    {
      name: 'Public API Status',
      url: `${API_BASE_URL}/api/public/status`,
      expectedStatus: 200
    },
    {
      name: 'Featured Products',
      url: `${API_BASE_URL}/api/featured-products`,
      expectedStatus: 200
    },
    {
      name: 'Items API',
      url: `${API_BASE_URL}/api/items?tenantId=${TENANT_ID}&limit=5`,
      expectedStatus: 200,
      useAuth: true
    },
    {
      name: 'Tenants API',
      url: `${API_BASE_URL}/api/tenants`,
      expectedStatus: 200,
      useAuth: true
    }
  ];

  for (const test of tests) {
    await testEndpoint(test.name, test.url, test.expectedStatus, 'GET', test.useAuth || false);
  }
}

async function testCapacityServices() {
  logSection('CAPACITY & LIMITS SERVICES TESTS');
  
  const tests = [
    {
      name: 'Tenant Limits Status',
      url: `${API_BASE_URL}/api/tenant-limits/status`,
      expectedStatus: 200
    },
    {
      name: 'Tenant Limits Tiers',
      url: `${API_BASE_URL}/api/tenant-limits/tiers`,
      expectedStatus: 200
    },
    {
      name: 'Subscription Usage',
      url: `${API_BASE_URL}/api/subscription-usage`,
      expectedStatus: 200
    }
  ];

  for (const test of tests) {
    await testEndpoint(test.name, test.url, test.expectedStatus);
  }
}

async function testAuthServices() {
  logSection('AUTHENTICATION SERVICES TESTS');
  
  const tests = [
    {
      name: 'Auth Status',
      url: `${API_BASE_URL}/api/auth/status`,
      expectedStatus: 200
    },
    {
      name: 'User Profile',
      url: `${API_BASE_URL}/api/user/profile`,
      expectedStatus: 401 // Should require auth
    }
  ];

  for (const test of tests) {
    await testEndpoint(test.name, test.url, test.expectedStatus);
  }
}

async function testDirectoryServices() {
  logSection('DIRECTORY SERVICES TESTS');
  
  const tests = [
    {
      name: 'Directory Search',
      url: `${API_BASE_URL}/api/directory/search`,
      expectedStatus: 200
    },
    {
      name: 'Directory Categories',
      url: `${API_BASE_URL}/api/directory/categories`,
      expectedStatus: 200
    }
  ];

  for (const test of tests) {
    await testEndpoint(test.name, test.url, test.expectedStatus);
  }
}

async function testDatabaseConnectivity() {
  logSection('DATABASE CONNECTIVITY TESTS');
  
  const tests = [
    {
      name: 'Database Health',
      url: `${API_BASE_URL}/api/health/database`,
      expectedStatus: 200
    },
    {
      name: 'Prisma Connection',
      url: `${API_BASE_URL}/api/health/prisma`,
      expectedStatus: 200
    }
  ];

  for (const test of tests) {
    await testEndpoint(test.name, test.url, test.expectedStatus);
  }
}

function printSummary() {
  logSection('READINESS TEST SUMMARY');
  
  const total = results.passed.length + results.failed.length + results.skipped.length;
  const passRate = total > 0 ? Math.round((results.passed.length / total) * 100) : 0;
  
  log(`Total Tests: ${total}`, colors.blue);
  log(`Passed: ${results.passed.length}`, colors.green);
  log(`Failed: ${results.failed.length}`, colors.red);
  log(`Skipped: ${results.skipped.length}`, colors.yellow);
  log(`Success Rate: ${passRate}%`, colors.blue);
  
  if (results.failed.length > 0) {
    log('\nFAILED TESTS:', colors.red);
    results.failed.forEach(test => {
      log(`  ❌ ${test.name} - ${test.status || test.error}`, colors.red);
    });
  }
  
  if (results.passed.length === total && total > 0) {
    log('\n🎉 ALL TESTS PASSED! Backend is ready for shops pages development.', colors.green);
  } else if (passRate >= 80) {
    log('\n⚠️  MOST TESTS PASSED. Backend is mostly ready for shops pages development.', colors.yellow);
  } else {
    log('\n❌ MANY TESTS FAILED. Backend needs fixes before shops pages development.', colors.red);
  }
  
  log('\nRECOMMENDATIONS:', colors.blue);
  if (results.failed.length === 0) {
    log('  ✅ All backend services are ready', colors.green);
    log('  🚀 Proceed with shops pages development', colors.green);
  } else {
    log('  🔧 Fix failed endpoints before proceeding', colors.yellow);
    log('  📝 Check API routes and database connections', colors.yellow);
    log('  🧪 Run individual endpoint tests for debugging', colors.yellow);
  }
}

async function main() {
  log('🚀 BACKEND SERVICES READINESS TEST', colors.blue);
  log(`Testing API at: ${API_BASE_URL}`, colors.blue);
  log(`Timeout per test: ${TEST_TIMEOUT}ms`, colors.blue);
  
  try {
    await testCoreServices();
    await testShopsFeaturedService();
    await testCapacityServices();
    await testAuthServices();
    await testDirectoryServices();
    await testDatabaseConnectivity();
    
    printSummary();
    
    // Exit with appropriate code
    process.exit(results.failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\n❌ TEST SCRIPT ERROR: ${error.message}`, colors.red);
    process.exit(2);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`\n❌ UNCAUGHT EXCEPTION: ${error.message}`, colors.red);
  process.exit(3);
});

process.on('unhandledRejection', (reason) => {
  log(`\n❌ UNHANDLED REJECTION: ${reason}`, colors.red);
  process.exit(4);
});

// Run the tests
if (require.main === module) {
  main();
}

module.exports = { testEndpoint, testShopsFeaturedService, testCoreServices };
