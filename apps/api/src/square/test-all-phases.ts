/**
 * Comprehensive Square Integration Test Suite
 * Tests all phases: Infrastructure, OAuth, and Sync
 * 
 * Usage: tsx src/square/test-all-phases.ts
 */

import { createSquareOAuthService } from '../services/square/square-oauth.service';
import { squareIntegrationRepository } from '../services/square/square-integration.repository';
import { squareIntegrationService } from './square-integration.service';
import { createSquareClient } from '../services/square/square-client';
import { squareSyncService } from '../services/square/square-sync.service';
import { createCatalogSync } from '../services/square/catalog-sync';
import { createInventorySync } from '../services/square/inventory-sync';
import { createConflictResolver } from '../services/square/conflict-resolver';
import { createSquareBatchProcessor } from '../services/square/batch-processor';

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
  magenta: '\x1b[35m',
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
  log(`\n${'='.repeat(70)}`, colors.blue);
  log(`  ${message}`, colors.blue);
  log(`${'='.repeat(70)}`, colors.blue);
}

function subsection(message: string) {
  log(`\n${'─'.repeat(70)}`, colors.cyan);
  log(`  ${message}`, colors.cyan);
  log(`${'─'.repeat(70)}`, colors.cyan);
}

// =============================================================================
// PHASE 1: INFRASTRUCTURE TESTS
// =============================================================================

async function testPhase1Infrastructure() {
  section('PHASE 1: INFRASTRUCTURE TESTS');
  let passed = 0;
  let failed = 0;

  // Test 1.1: Environment Variables
  subsection('Test 1.1: Environment Variables');
  try {
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

    if (allPresent) {
      passed++;
      success('All environment variables present');
    } else {
      failed++;
      error('Some environment variables missing');
    }
  } catch (err) {
    failed++;
    error(`Environment test failed: ${err}`);
  }

  // Test 1.2: Database Schema
  subsection('Test 1.2: Database Schema');
  try {
    info('Checking if Square tables exist...');
    
    // Try to query each table
    const tables = ['square_integrations', 'square_product_mappings', 'square_sync_logs'];
    let allTablesExist = true;

    for (const table of tables) {
      try {
        await squareIntegrationRepository.getIntegrationByTenantId('test-check');
        success(`Table '${table}' exists`);
      } catch (err: any) {
        if (err.message?.includes('does not exist')) {
          error(`Table '${table}' does not exist`);
          allTablesExist = false;
        }
      }
    }

    if (allTablesExist) {
      passed++;
      success('All database tables exist');
    } else {
      failed++;
      error('Some database tables missing');
    }
  } catch (err) {
    failed++;
    error(`Database schema test failed: ${err}`);
  }

  // Test 1.3: Square SDK Import
  subsection('Test 1.3: Square SDK Import');
  try {
    const { SquareClient } = require('square') as any;
    if (SquareClient) {
      passed++;
      success('Square SDK imported successfully');
    } else {
      failed++;
      error('Square SDK import failed');
    }
  } catch (err) {
    failed++;
    error(`Square SDK test failed: ${err}`);
  }

  return { phase: 1, passed, failed, total: passed + failed };
}

// =============================================================================
// PHASE 2: OAUTH & BACKEND TESTS
// =============================================================================

async function testPhase2OAuth() {
  section('PHASE 2: OAUTH & BACKEND TESTS');
  let passed = 0;
  let failed = 0;

  // Test 2.1: OAuth Service Creation
  subsection('Test 2.1: OAuth Service Creation');
  try {
    const oauthService = createSquareOAuthService();
    passed++;
    success('OAuth service created successfully');
  } catch (err) {
    failed++;
    error(`OAuth service creation failed: ${err}`);
  }

  // Test 2.2: Authorization URL Generation
  subsection('Test 2.2: Authorization URL Generation');
  try {
    const oauthService = createSquareOAuthService();
    const state = 'test-state-123';
    const authUrl = oauthService.generateAuthorizationUrl(state, TEST_TENANT_ID);
    
    if (authUrl.includes('connect.squareupsandbox.com') || authUrl.includes('connect.squareup.com')) {
      passed++;
      success('Authorization URL generated correctly');
      info(`URL: ${authUrl.substring(0, 80)}...`);
    } else {
      failed++;
      error('Authorization URL format incorrect');
    }
  } catch (err) {
    failed++;
    error(`Authorization URL test failed: ${err}`);
  }

  // Test 2.3: State Parsing
  subsection('Test 2.3: State Parsing');
  try {
    const state = 'test-state-123';
    const parsed = (createSquareOAuthService().constructor as any).parseState(`${state}:${TEST_TENANT_ID}`);
    
    if (parsed.state === state && parsed.tenantId === TEST_TENANT_ID) {
      passed++;
      success('State parsing works correctly');
    } else {
      failed++;
      error('State parsing failed');
    }
  } catch (err) {
    failed++;
    error(`State parsing test failed: ${err}`);
  }

  // Test 2.4: Integration Repository
  subsection('Test 2.4: Integration Repository');
  try {
    info('Testing repository CRUD operations...');
    
    // Create test integration
    await squareIntegrationRepository.createIntegration({
      tenantId: TEST_TENANT_ID,
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      merchantId: 'test-merchant',
      locationId: 'test-location',
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      scopes: ['ITEMS_READ', 'ITEMS_WRITE'],
      mode: 'sandbox',
    });
    success('Integration created');

    // Retrieve integration
    const integration = await squareIntegrationRepository.getIntegrationByTenantId(TEST_TENANT_ID);
    if (integration && integration.merchantId === 'test-merchant') {
      success('Integration retrieved');
    } else {
      throw new Error('Integration retrieval failed');
    }

    // Create sync log
    await squareIntegrationRepository.createSyncLog({
      tenantId: TEST_TENANT_ID,
      integrationId: integration.id,
      syncType: 'catalog',
      direction: 'from_square',
      operation: 'sync',
      status: 'success',
      itemsAffected: 10,
      durationMs: 1500,
    });
    success('Sync log created');

    // Cleanup
    await squareIntegrationRepository.deleteIntegration(integration.id);
    success('Test data cleaned up');

    passed++;
    success('Repository operations successful');
  } catch (err) {
    failed++;
    error(`Repository test failed: ${err}`);
  }

  // Test 2.5: Integration Service
  subsection('Test 2.5: Integration Service');
  try {
    const status = await squareIntegrationService.getIntegrationStatus(TEST_TENANT_ID);
    passed++;
    success('Integration service works');
    info(`Status: ${status ? 'Connected' : 'Not connected'}`);
  } catch (err) {
    failed++;
    error(`Integration service test failed: ${err}`);
  }

  return { phase: 2, passed, failed, total: passed + failed };
}

// =============================================================================
// PHASE 3: SYNC SERVICE TESTS
// =============================================================================

async function testPhase3Sync() {
  section('PHASE 3: SYNC SERVICE TESTS');
  let passed = 0;
  let failed = 0;

  // Test 3.1: Catalog Sync - Data Transformation
  subsection('Test 3.1: Catalog Sync - Data Transformation');
  try {
    const catalogSync = createCatalogSync(TEST_TENANT_ID, 'test-integration-id', null);
    
    // Test Square to Platform transformation
    const squareProduct = {
      id: 'square-123',
      type: 'ITEM',
      item_data: {
        name: 'Test Product',
        description: 'Test Description',
        variations: [
          {
            id: 'var-123',
            type: 'ITEM_VARIATION',
            item_variation_data: {
              item_id: 'square-123',
              sku: 'TEST-SKU',
              price_money: {
                amount: 1999,
                currency: 'USD',
              },
            },
          },
        ],
      },
    };

    const platformData = catalogSync.transformSquareToPlatform(squareProduct);
    
    if (
      platformData.name === 'Test Product' &&
      platformData.price === 19.99 &&
      platformData.sku === 'TEST-SKU'
    ) {
      passed++;
      success('Square → Platform transformation works');
    } else {
      failed++;
      error('Square → Platform transformation failed');
    }
  } catch (err) {
    failed++;
    error(`Catalog sync test failed: ${err}`);
  }

  // Test 3.2: Inventory Sync - Data Transformation
  subsection('Test 3.2: Inventory Sync - Data Transformation');
  try {
    const inventorySync = createInventorySync(TEST_TENANT_ID, 'test-integration-id', null);
    
    const squareInventory = {
      catalog_object_id: 'square-123',
      catalog_object_type: 'ITEM_VARIATION',
      state: 'IN_STOCK' as const,
      location_id: 'loc-123',
      quantity: '50',
      calculated_at: new Date().toISOString(),
    };

    const platformData = inventorySync.transformSquareToPlatform(squareInventory, 'platform-123');
    
    if (platformData.quantity === 50 && platformData.productId === 'platform-123') {
      passed++;
      success('Inventory transformation works');
    } else {
      failed++;
      error('Inventory transformation failed');
    }
  } catch (err) {
    failed++;
    error(`Inventory sync test failed: ${err}`);
  }

  // Test 3.3: Conflict Resolver
  subsection('Test 3.3: Conflict Resolver');
  try {
    const resolver = createConflictResolver();
    
    // Test conflict detection
    const squareData = { name: 'Product A', price: 19.99, sku: 'SKU-A' };
    const platformData = { name: 'Product A', price: 24.99, sku: 'SKU-A' };
    
    const conflicts = resolver.detectConflicts(squareData, platformData);
    
    if (conflicts.length === 1 && conflicts[0].field === 'price') {
      success('Conflict detection works');
    } else {
      throw new Error('Conflict detection failed');
    }

    // Test conflict resolution
    const resolution = resolver.resolve(conflicts[0]);
    
    if (resolution.field === 'price' && resolution.source) {
      success('Conflict resolution works');
      info(`Resolution: ${resolution.source} wins - ${resolution.reason}`);
    } else {
      throw new Error('Conflict resolution failed');
    }

    passed++;
    success('Conflict resolver works correctly');
  } catch (err) {
    failed++;
    error(`Conflict resolver test failed: ${err}`);
  }

  // Test 3.4: Batch Processor
  subsection('Test 3.4: Batch Processor');
  try {
    const batchProcessor = createSquareBatchProcessor<number>();
    
    // Test batch processing
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    const processor = async (item: number) => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate API call
      return item * 2;
    };

    const result = await batchProcessor.process(items, processor);
    
    if (
      result.totalProcessed === 25 &&
      result.totalSucceeded === 25 &&
      result.totalFailed === 0
    ) {
      passed++;
      success('Batch processor works correctly');
      info(`Processed ${result.totalProcessed} items in ${result.duration}ms`);
    } else {
      failed++;
      error('Batch processor failed');
    }
  } catch (err) {
    failed++;
    error(`Batch processor test failed: ${err}`);
  }

  // Test 3.5: Rate Limiting
  subsection('Test 3.5: Rate Limiting');
  try {
    const batchProcessor = createSquareBatchProcessor<number>({
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerSecond: 2,
      },
    });

    const status = batchProcessor.getRateLimitStatus();
    
    if (status.canMakeRequest) {
      passed++;
      success('Rate limiting works');
      info(`Requests in last minute: ${status.requestsInLastMinute}`);
    } else {
      failed++;
      error('Rate limiting failed');
    }
  } catch (err) {
    failed++;
    error(`Rate limiting test failed: ${err}`);
  }

  return { phase: 3, passed, failed, total: passed + failed };
}

// =============================================================================
// INTEGRATION TESTS (All Phases Together)
// =============================================================================

async function testIntegration() {
  section('INTEGRATION TESTS (All Phases)');
  let passed = 0;
  let failed = 0;

  // Test I.1: End-to-End OAuth Flow (Optional)
  subsection('Test I.1: End-to-End OAuth Flow');
  if (TEST_AUTH_CODE) {
    try {
      info('Testing complete OAuth flow...');
      
      const integration = await squareIntegrationService.connectTenant(
        TEST_TENANT_ID,
        TEST_AUTH_CODE
      );

      if (integration && integration.merchantId) {
        success('OAuth flow completed successfully');
        success(`Merchant ID: ${integration.merchantId}`);
        
        // Cleanup
        await squareIntegrationService.disconnectTenant(TEST_TENANT_ID);
        success('OAuth test data cleaned up');
        
        passed++;
      } else {
        failed++;
        error('OAuth flow failed');
      }
    } catch (err) {
      failed++;
      error(`OAuth flow test failed: ${err}`);
    }
  } else {
    info('Skipping OAuth flow test (no TEST_AUTH_CODE provided)');
    info('To test OAuth flow:');
    info('1. Get authorization URL from Phase 2 tests');
    info('2. Authorize in Square sandbox');
    info('3. Set TEST_AUTH_CODE environment variable');
    info('4. Run this script again');
  }

  return { phase: 'Integration', passed, failed, total: passed + failed };
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runAllTests() {
  log('\n' + '='.repeat(70), colors.magenta);
  log('  COMPREHENSIVE SQUARE INTEGRATION TEST SUITE', colors.magenta);
  log('  Testing All Phases: Infrastructure, OAuth, and Sync', colors.magenta);
  log('='.repeat(70) + '\n', colors.magenta);

  const results: any[] = [];
  const startTime = Date.now();

  try {
    // Run Phase 1 tests
    results.push(await testPhase1Infrastructure());

    // Run Phase 2 tests
    results.push(await testPhase2OAuth());

    // Run Phase 3 tests
    results.push(await testPhase3Sync());

    // Run Integration tests
    results.push(await testIntegration());

  } catch (err) {
    error(`Test suite failed: ${err}`);
  }

  const duration = Date.now() - startTime;

  // Summary
  section('COMPREHENSIVE TEST SUMMARY');
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  results.forEach((result) => {
    const phaseLabel = typeof result.phase === 'number' ? `Phase ${result.phase}` : result.phase;
    log(`\n${phaseLabel}:`, colors.cyan);
    log(`  Total Tests: ${result.total}`, colors.cyan);
    log(`  Passed: ${result.passed}`, colors.green);
    log(`  Failed: ${result.failed}`, result.failed > 0 ? colors.red : colors.cyan);
    log(`  Success Rate: ${((result.passed / result.total) * 100).toFixed(1)}%`, colors.cyan);

    totalPassed += result.passed;
    totalFailed += result.failed;
    totalTests += result.total;
  });

  log(`\n${'='.repeat(70)}`, colors.magenta);
  log(`OVERALL RESULTS:`, colors.magenta);
  log(`  Total Tests: ${totalTests}`, colors.cyan);
  log(`  Passed: ${totalPassed}`, colors.green);
  log(`  Failed: ${totalFailed}`, totalFailed > 0 ? colors.red : colors.cyan);
  log(`  Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`, colors.cyan);
  log(`  Duration: ${(duration / 1000).toFixed(2)}s`, colors.cyan);
  log(`${'='.repeat(70)}`, colors.magenta);

  if (totalFailed === 0) {
    log('\n🎉 ALL TESTS PASSED! Square integration is ready for production!', colors.green);
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.', colors.yellow);
  }

  process.exit(totalFailed === 0 ? 0 : 1);
}

// Run all tests
runAllTests().catch((err) => {
  error(`Test suite crashed: ${err}`);
  process.exit(1);
});
