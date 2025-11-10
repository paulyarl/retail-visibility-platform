/**
 * Square Integration Test Script
 * Tests all Phase 2 functionality
 * 
 * Usage: tsx src/square/test-square-integration.ts
 */

import { createSquareOAuthService } from '../services/square/square-oauth.service';
import { squareIntegrationRepository } from '../services/square/square-integration.repository';
import { squareIntegrationService } from './square-integration.service';
import { createSquareClient } from '../services/square/square-client';

// Test configuration
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const TEST_AUTH_CODE = process.env.TEST_AUTH_CODE; // Optional: from OAuth flow

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function section(message: string) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`  ${message}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

async function testEnvironmentVariables() {
  section('Test 1: Environment Variables');
  
  const required = [
    'SQUARE_APPLICATION_ID',
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_CLIENT_SECRET',
    'SQUARE_ENVIRONMENT',
    'SQUARE_OAUTH_REDIRECT_URI',
  ];

  let allPresent = true;
  for (const envVar of required) {
    if (process.env[envVar]) {
      success(`${envVar} is set`);
    } else {
      error(`${envVar} is missing`);
      allPresent = false;
    }
  }

  return allPresent;
}

async function testOAuthService() {
  section('Test 2: OAuth Service');

  try {
    const oauthService = createSquareOAuthService();
    success('OAuth service created successfully');

    // Test authorization URL generation
    const state = 'test-state-123';
    const authUrl = oauthService.generateAuthorizationUrl(state, TEST_TENANT_ID);
    
    if (authUrl.includes('connect.squareupsandbox.com') || authUrl.includes('connect.squareup.com')) {
      success('Authorization URL generated correctly');
      info(`URL: ${authUrl.substring(0, 80)}...`);
    } else {
      error('Authorization URL format incorrect');
      return false;
    }

    // Test state parsing
    const parsed = (oauthService.constructor as any).parseState(`${state}:${TEST_TENANT_ID}`);
    if (parsed.state === state && parsed.tenantId === TEST_TENANT_ID) {
      success('State parsing works correctly');
    } else {
      error('State parsing failed');
      return false;
    }

    return true;
  } catch (err) {
    error(`OAuth service test failed: ${err}`);
    return false;
  }
}

async function testSquareClient() {
  section('Test 3: Square Client');

  try {
    const client = createSquareClient({
      access_token: process.env.SQUARE_ACCESS_TOKEN!,
      mode: (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    });
    success('Square client created successfully');

    // Test connection
    const isConnected = await client.testConnection();
    if (isConnected) {
      success('Square API connection successful');
    } else {
      error('Square API connection failed');
      return false;
    }

    // Test listing locations
    const locations = await client.listLocations();
    if (locations && locations.length > 0) {
      success(`Found ${locations.length} location(s)`);
      info(`First location: ${locations[0].name} (${locations[0].id})`);
    } else {
      error('No locations found');
      return false;
    }

    return true;
  } catch (err) {
    error(`Square client test failed: ${err}`);
    return false;
  }
}

async function testDatabaseOperations() {
  section('Test 4: Database Operations');

  try {
    // Test creating integration
    info('Creating test integration...');
    await squareIntegrationRepository.createIntegration({
      tenantId: TEST_TENANT_ID,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      merchantId: 'test-merchant-id',
      locationId: 'test-location-id',
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      scopes: ['ITEMS_READ', 'ITEMS_WRITE', 'INVENTORY_READ', 'INVENTORY_WRITE'],
      mode: 'sandbox',
    });
    success('Integration created successfully');

    // Test retrieving integration
    info('Retrieving integration...');
    const integration = await squareIntegrationRepository.getIntegrationByTenantId(TEST_TENANT_ID);
    if (integration && integration.merchantId === 'test-merchant-id') {
      success('Integration retrieved successfully');
    } else {
      error('Integration retrieval failed');
      return false;
    }

    // Test updating integration
    info('Updating integration...');
    await squareIntegrationRepository.updateIntegration(integration.id, {
      lastSyncAt: new Date(),
    });
    success('Integration updated successfully');

    // Test creating product mapping
    info('Creating product mapping...');
    await squareIntegrationRepository.createProductMapping({
      tenantId: TEST_TENANT_ID,
      integrationId: integration.id,
      inventoryItemId: 'test-inventory-item-id',
      squareCatalogObjectId: 'test-catalog-object-id',
      squareItemVariationId: 'test-variation-id',
    });
    success('Product mapping created successfully');

    // Test creating sync log
    info('Creating sync log...');
    await squareIntegrationRepository.createSyncLog({
      tenantId: TEST_TENANT_ID,
      integrationId: integration.id,
      syncType: 'catalog',
      direction: 'to_square',
      operation: 'create',
      status: 'success',
      itemsAffected: 1,
      durationMs: 150,
    });
    success('Sync log created successfully');

    // Test retrieving sync logs
    info('Retrieving sync logs...');
    const logs = await squareIntegrationRepository.getSyncLogsByTenantId(TEST_TENANT_ID, 10);
    if (logs && logs.length > 0) {
      success(`Retrieved ${logs.length} sync log(s)`);
    } else {
      error('Sync log retrieval failed');
      return false;
    }

    // Cleanup
    info('Cleaning up test data...');
    await squareIntegrationRepository.deleteIntegration(integration.id);
    success('Test data cleaned up');

    return true;
  } catch (err) {
    error(`Database operations test failed: ${err}`);
    return false;
  }
}

async function testIntegrationService() {
  section('Test 5: Integration Service');

  try {
    // Test getting integration status (should be null for test tenant)
    info('Testing integration status...');
    const status = await squareIntegrationService.getIntegrationStatus(TEST_TENANT_ID);
    if (status === null) {
      success('Integration status check works (no integration found as expected)');
    } else {
      info('Found existing integration for test tenant');
    }

    // Test connection test
    if (status) {
      info('Testing connection...');
      const isConnected = await squareIntegrationService.testConnection(TEST_TENANT_ID);
      if (isConnected) {
        success('Connection test passed');
      } else {
        error('Connection test failed');
        return false;
      }
    }

    return true;
  } catch (err) {
    error(`Integration service test failed: ${err}`);
    return false;
  }
}

async function testOAuthFlow() {
  section('Test 6: OAuth Flow (Optional)');

  if (!TEST_AUTH_CODE) {
    info('Skipping OAuth flow test (no TEST_AUTH_CODE provided)');
    info('To test OAuth flow:');
    info('1. Visit the authorization URL from Test 2');
    info('2. Authorize in Square sandbox');
    info('3. Copy the "code" parameter from the redirect URL');
    info('4. Set TEST_AUTH_CODE environment variable');
    info('5. Run this script again');
    return true;
  }

  try {
    info('Testing OAuth token exchange...');
    const integration = await squareIntegrationService.connectTenant(
      TEST_TENANT_ID,
      TEST_AUTH_CODE
    );

    if (integration && integration.merchantId) {
      success('OAuth flow completed successfully');
      success(`Merchant ID: ${integration.merchantId}`);
      
      // Cleanup
      info('Cleaning up OAuth test data...');
      await squareIntegrationService.disconnectTenant(TEST_TENANT_ID);
      success('OAuth test data cleaned up');
      
      return true;
    } else {
      error('OAuth flow failed');
      return false;
    }
  } catch (err) {
    error(`OAuth flow test failed: ${err}`);
    return false;
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(60), colors.blue);
  log('  SQUARE INTEGRATION TEST SUITE', colors.blue);
  log('='.repeat(60) + '\n', colors.blue);

  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Run tests
  const tests = [
    { name: 'Environment Variables', fn: testEnvironmentVariables },
    { name: 'OAuth Service', fn: testOAuthService },
    { name: 'Square Client', fn: testSquareClient },
    { name: 'Database Operations', fn: testDatabaseOperations },
    { name: 'Integration Service', fn: testIntegrationService },
    { name: 'OAuth Flow', fn: testOAuthFlow },
  ];

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (err) {
      error(`Test "${test.name}" threw an error: ${err}`);
      results.failed++;
    }
  }

  // Summary
  section('Test Summary');
  log(`Total Tests: ${tests.length}`, colors.cyan);
  log(`Passed: ${results.passed}`, colors.green);
  log(`Failed: ${results.failed}`, colors.red);
  log(`Success Rate: ${((results.passed / tests.length) * 100).toFixed(1)}%`, colors.cyan);

  if (results.failed === 0) {
    log('\n🎉 All tests passed! Square integration is ready!', colors.green);
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.', colors.yellow);
  }

  process.exit(results.failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch((err) => {
  error(`Test suite failed: ${err}`);
  process.exit(1);
});
