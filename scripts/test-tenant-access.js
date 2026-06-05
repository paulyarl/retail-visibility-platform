#!/usr/bin/env node

/**
 * Tenant Access Test Runner
 * 
 * Automated testing script for Phase 2 architecture validation
 * Usage: node test-tenant-access.js --user=admin --tenant=tenant-123 --scenario=platform-admin
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Test configuration
const CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
  retries: 3
};

// Debug configuration
console.log('🔍 DEBUG: Environment variables:');
console.log('  TEST_BASE_URL:', process.env.TEST_BASE_URL);
console.log('  API_BASE_URL:', process.env.API_BASE_URL);
console.log('🔍 DEBUG: Final CONFIG:');
console.log('  baseUrl:', CONFIG.baseUrl);
console.log('  apiUrl:', CONFIG.apiUrl);

// Test scenarios
const TEST_SCENARIOS = {
  'platform-admin': {
    name: 'Platform Admin',
    expectedAccess: {
      platformAccess: true,
      tenantAccess: true,
      tierBypass: true,
      roleBypass: true,
      canView: true,
      canEdit: true,
      canManage: true,
      canAdmin: true
    }
  },
  'platform-support': {
    name: 'Platform Support',
    expectedAccess: {
      platformAccess: true,
      tenantAccess: true,
      tierBypass: true,
      roleBypass: true,
      canView: true,
      canEdit: true,
      canManage: true,
      canAdmin: true
    }
  },
  'platform-viewer': {
    name: 'Platform Viewer',
    expectedAccess: {
      platformAccess: true,
      tenantAccess: true,
      tierBypass: false,
      roleBypass: false,
      canView: true,
      canEdit: false,
      canManage: false,
      canAdmin: false
    }
  },
  'tenant-owner': {
    name: 'Tenant Owner',
    expectedAccess: {
      platformAccess: false,
      tenantAccess: true,
      tierBypass: false,
      roleBypass: false,
      canView: true,
      canEdit: true,
      canManage: true,
      canAdmin: true
    }
  },
  'tenant-admin': {
    name: 'Tenant Admin',
    expectedAccess: {
      platformAccess: false,
      tenantAccess: true,
      tierBypass: false,
      roleBypass: true, // Tenant admins have support-level access
      canView: true,
      canEdit: true,
      canManage: true,
      canAdmin: false // Cannot manage tenant settings/ownership (below Tenant Owner)
    }
  },
  'tenant-manager': {
    name: 'Tenant Manager',
    expectedAccess: {
      platformAccess: false,
      tenantAccess: true,
      tierBypass: false,
      roleBypass: false,
      canView: true,
      canEdit: true,
      canManage: true,
      canAdmin: false
    }
  },
  'tenant-member': {
    name: 'Tenant Member',
    expectedAccess: {
      platformAccess: false,
      tenantAccess: true,
      tierBypass: false,
      roleBypass: false,
      canView: true,
      canEdit: true,
      canManage: false,
      canAdmin: false
    }
  },
  'tenant-viewer': {
    name: 'Tenant Viewer',
    expectedAccess: {
      platformAccess: false,
      tenantAccess: true,
      tierBypass: false,
      roleBypass: false,
      canView: true,
      canEdit: false,
      canManage: false,
      canAdmin: false
    }
  }
};

// Parse command line arguments
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
}

// Make HTTP request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TenantAccessTestRunner/1.0',
        ...options.headers
      },
      timeout: CONFIG.timeout
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          };
          resolve(result);
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test authentication
async function testAuth(userCredentials) {
  console.log('🔐 Testing authentication...');
  
  try {
    // Simulate login (adjust based on your auth system)
    const loginUrl = `${CONFIG.apiUrl}/auth/login`;
    console.log('🔍 DEBUG: Login URL:', loginUrl);
    console.log('🔍 DEBUG: User credentials:', JSON.stringify(userCredentials, null, 2));
    console.log('🔍 DEBUG: CONFIG.apiUrl:', CONFIG.apiUrl);
    
    const response = await makeRequest(loginUrl, {
      method: 'POST',
      body: userCredentials
    });

    console.log('🔍 DEBUG: Response status:', response.status);
    console.log('🔍 DEBUG: Response data:', JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('✅ Authentication successful');
      const token = response.data.accessToken || response.data.token || response.headers['set-cookie'];
      console.log('🔍 DEBUG: Extracted token:', token ? 'Found' : 'Not found');
      return token;
    } else {
      console.log('❌ Authentication failed:', response.status);
      console.log('🔍 DEBUG: Response body:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Authentication error:', error.message);
    console.log('🔍 DEBUG: Full error:', error);
    return null;
  }
}

// Test user profile
async function testUserProfile(authToken) {
  console.log('👤 Testing user profile...');
  
  try {
    const profileUrl = `${CONFIG.apiUrl}/auth/me`;
    const headers = {
      'Authorization': `Bearer ${authToken}`
    };
    
    // Only add Cookie header if authToken looks like a cookie (contains =)
    if (typeof authToken === 'string' && authToken.includes('=')) {
      headers['Cookie'] = authToken;
    }
    
    const response = await makeRequest(profileUrl, {
      headers: headers
    });

    if (response.status === 200) {
      const user = response.data.user || response.data;
      console.log('✅ User profile retrieved');
      console.log(`   Platform Role: ${user.role || 'None'}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      return user;
    } else {
      console.log('❌ User profile failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ User profile error:', error.message);
    return null;
  }
}

// Test tenant access
async function testTenantAccess(tenantId, authToken) {
  console.log(`🏢 Testing tenant access for: ${tenantId}`);
  
  const results = {
    tierData: null,
    userRole: null,
    usageData: null,
    errors: []
  };

  try {
    // Test tier data
    const tierUrl = `${CONFIG.apiUrl}/api/tenants/${tenantId}/tier`;
    const tierHeaders = {
      'Authorization': `Bearer ${authToken}`
    };
    if (typeof authToken === 'string' && authToken.includes('=')) {
      tierHeaders['Cookie'] = authToken;
    }
    
    const tierResponse = await makeRequest(tierUrl, {
      headers: tierHeaders
    });

    if (tierResponse.status === 200) {
      results.tierData = tierResponse.data;
      console.log('✅ Tier data retrieved');
      console.log(`   Effective Tier: ${tierResponse.data.tenantTier?.name || 'Unknown'}`);
    } else {
      results.errors.push(`Tier data failed: ${tierResponse.status}`);
      console.log('❌ Tier data failed:', tierResponse.status);
    }

    // Test user role on tenant
    const user = await testUserProfile(authToken);
    if (user) {
      const roleUrl = `${CONFIG.apiUrl}/api/users/${user.id}/tenants/${tenantId}`;
      const roleHeaders = {
        'Authorization': `Bearer ${authToken}`
      };
      if (typeof authToken === 'string' && authToken.includes('=')) {
        roleHeaders['Cookie'] = authToken;
      }
      
      const roleResponse = await makeRequest(roleUrl, {
        headers: roleHeaders
      });

      if (roleResponse.status === 200) {
        results.userRole = roleResponse.data;
        console.log('✅ User role retrieved');
        console.log(`   Tenant Role: ${roleResponse.data.role || 'None'}`);
      } else {
        results.errors.push(`User role failed: ${roleResponse.status}`);
        console.log('❌ User role failed:', roleResponse.status);
      }
    }

    // Test usage data
    const usageUrl = `${CONFIG.apiUrl}/api/tenants/${tenantId}/usage`;
    const usageHeaders = {
      'Authorization': `Bearer ${authToken}`
    };
    if (typeof authToken === 'string' && authToken.includes('=')) {
      usageHeaders['Cookie'] = authToken;
    }
    
    const usageResponse = await makeRequest(usageUrl, {
      headers: usageHeaders
    });

    if (usageResponse.status === 200) {
      results.usageData = usageResponse.data;
      console.log('✅ Usage data retrieved');
    } else {
      results.errors.push(`Usage data failed: ${usageResponse.status}`);
      console.log('❌ Usage data failed:', usageResponse.status);
    }

  } catch (error) {
    results.errors.push(`Request error: ${error.message}`);
    console.log('❌ Request error:', error.message);
  }

  return results;
}

// Validate access against scenario
function validateAccess(results, scenario, user) {
  console.log(`🧪 Validating access for scenario: ${scenario.name}`);
  
  const validation = {
    passed: 0,
    failed: 0,
    details: []
  };

  // Determine actual access based on results
  const actualAccess = {
    platformAccess: ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER'].includes(user?.role),
    tenantAccess: results.userRole !== null || ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER'].includes(user?.role),
    tierBypass: ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'].includes(user?.role),
    roleBypass: ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'].includes(user?.role),
    canView: true, // Most roles can view
    canEdit: !['VIEWER', 'PLATFORM_VIEWER'].includes(user?.role) && !['VIEWER'].includes(results.userRole?.role),
    canManage: ['OWNER', 'ADMIN', 'MANAGER', 'PLATFORM_ADMIN', 'PLATFORM_SUPPORT'].includes(user?.role) || 
               ['OWNER', 'ADMIN', 'MANAGER'].includes(results.userRole?.role),
    canAdmin: ['OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_SUPPORT'].includes(user?.role) || 
              ['OWNER', 'ADMIN'].includes(results.userRole?.role)
  };

  // Compare expected vs actual
  Object.keys(scenario.expectedAccess).forEach(key => {
    const expected = scenario.expectedAccess[key];
    const actual = actualAccess[key];
    
    if (expected === actual) {
      validation.passed++;
      validation.details.push(`✅ ${key}: Expected ${expected}, Got ${actual}`);
    } else {
      validation.failed++;
      validation.details.push(`❌ ${key}: Expected ${expected}, Got ${actual}`);
    }
  });

  return validation;
}

// Generate test report
function generateReport(testResults) {
  console.log('\n📊 TEST REPORT');
  console.log('='.repeat(50));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  testResults.forEach(result => {
    console.log(`\n🧪 ${result.scenario}: ${result.validation.failed === 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Passed: ${result.validation.passed}`);
    console.log(`   Failed: ${result.validation.failed}`);
    
    if (result.validation.failed > 0) {
      console.log('   Issues:');
      result.validation.details.forEach(detail => {
        if (detail.startsWith('❌')) {
          console.log(`     ${detail}`);
        }
      });
    }
    
    totalPassed += result.validation.passed;
    totalFailed += result.validation.failed;
  });
  
  console.log('\n📈 SUMMARY');
  console.log(`Total Checks: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - Ready for deployment!');
    process.exit(0);
  } else {
    console.log('\n🚨 TESTS FAILED - Do not deploy!');
    process.exit(1);
  }
}

// Main test runner
async function runTests() {
  const args = parseArgs();
  
  console.log('🚀 Tenant Access Test Runner');
  console.log('='.repeat(30));
  
  // Validate required arguments
  if (!args.user || !args.tenant) {
    console.log('❌ Missing required arguments');
    console.log('Usage: node test-tenant-access.js --user=admin --tenant=tenant-123 [--scenario=platform-admin] [--password=secret]');
    console.log('\nAvailable scenarios:', Object.keys(TEST_SCENARIOS).join(', '));
    process.exit(1);
  }

  const userCredentials = {
    email: args.user,
    username: args.user,
    password: args.password || 'password'
  };

  const tenantId = args.tenant;
  const scenarioKeys = args.scenario ? [args.scenario] : Object.keys(TEST_SCENARIOS);

  console.log(`👤 User: ${args.user}`);
  console.log(`🏢 Tenant: ${tenantId}`);
  console.log(`🧪 Scenarios: ${scenarioKeys.join(', ')}`);
  console.log('');

  // Test authentication
  const authToken = await testAuth(userCredentials);
  if (!authToken) {
    console.log('🚨 Authentication failed - cannot continue');
    process.exit(1);
  }

  // Get user profile
  const user = await testUserProfile(authToken);
  if (!user) {
    console.log('🚨 User profile failed - cannot continue');
    process.exit(1);
  }

  // Test tenant access
  const accessResults = await testTenantAccess(tenantId, authToken);
  
  // Run scenario validations
  const testResults = [];
  
  for (const scenarioKey of scenarioKeys) {
    const scenario = TEST_SCENARIOS[scenarioKey];
    if (!scenario) {
      console.log(`❌ Unknown scenario: ${scenarioKey}`);
      continue;
    }

    const validation = validateAccess(accessResults, scenario, user);
    testResults.push({
      scenario: scenario.name,
      validation,
      scenarioKey
    });
  }

  // Generate report
  generateReport(testResults);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.log('🚨 Unhandled error:', error.message);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.log('🚨 Test runner error:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, TEST_SCENARIOS };
