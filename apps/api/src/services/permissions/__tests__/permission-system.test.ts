/**
 * Permission System Batch Test Script
 * 
 * Comprehensive tests for all permission contexts:
 * - TenantPermissionContext (tier-based)
 * - AdminPermissionContext (role-based)
 * - PublicPermissionContext (read-only)
 * - TenantFeatureService (feature management)
 * - TenantLimitsService (limit checking)
 * - PermissionServiceFactory (unified access)
 * 
 * Run with: npx ts-node src/services/permissions/__tests__/permission-system.test.ts
 */

import {
  tenantPermissionContext,
  adminPermissionContext,
  publicPermissionContext,
  tenantFeatureService,
  tenantLimitsService,
  permissionServiceFactory
} from '../index';

// Test configuration
const TEST_CONFIG = {
  // Test tenant IDs for different tiers
  tenants: {
    starter: 'test-tenant-starter',
    professional: 'test-tenant-professional',
    enterprise: 'test-tenant-enterprise'
  },
  // Test user IDs for different roles
  users: {
    platformAdmin: 'test-user-platform-admin',
    tenantAdmin: 'test-user-tenant-admin',
    platformSupport: 'test-user-platform-support',
    platformViewer: 'test-user-platform-viewer',
    regularUser: 'test-user-regular'
  },
  // Test client IDs for public access
  clients: {
    anonymous: 'test-client-anonymous',
    rateLimited: 'test-client-rate-limited'
  }
};

// Test results tracking
interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const testResults: TestResult[] = [];

// Test utilities
function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    error: '\x1b[31m',   // red
    warning: '\x1b[33m', // yellow
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(suite: string, test: string, testFn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    testResults.push({
      suite,
      test,
      passed: true,
      duration: Date.now() - startTime
    });
    log(`  ✓ ${test} (${Date.now() - startTime}ms)`, 'success');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({
      suite,
      test,
      passed: false,
      duration: Date.now() - startTime,
      error: errorMessage
    });
    log(`  ✗ ${test} (${Date.now() - startTime}ms)`, 'error');
    log(`    Error: ${errorMessage}`, 'error');
  }
}

// ==========================================
// Test Suites
// ==========================================

/**
 * Test Suite 1: Tenant Permission Context
 */
async function testTenantPermissionContext(): Promise<void> {
  log('\n📋 Testing TenantPermissionContext', 'info');

  // Test 1: Feature checking by tier
  await runTest('TenantPermissionContext', 'Starter tier - basicAnalytics should be true', async () => {
    const result = await tenantPermissionContext.hasFeature(
      TEST_CONFIG.tenants.starter,
      'basicAnalytics'
    );
    assert(result === true, 'Starter tier should have basicAnalytics');
  });

  await runTest('TenantPermissionContext', 'Starter tier - advancedAnalytics should be false', async () => {
    const result = await tenantPermissionContext.hasFeature(
      TEST_CONFIG.tenants.starter,
      'advancedAnalytics'
    );
    assert(result === false, 'Starter tier should not have advancedAnalytics');
  });

  await runTest('TenantPermissionContext', 'Professional tier - advancedAnalytics should be true', async () => {
    const result = await tenantPermissionContext.hasFeature(
      TEST_CONFIG.tenants.professional,
      'advancedAnalytics'
    );
    assert(result === true, 'Professional tier should have advancedAnalytics');
  });

  await runTest('TenantPermissionContext', 'Enterprise tier - whiteLabel should be true', async () => {
    const result = await tenantPermissionContext.hasFeature(
      TEST_CONFIG.tenants.enterprise,
      'whiteLabel'
    );
    assert(result === true, 'Enterprise tier should have whiteLabel');
  });

  // Test 2: Limit checking by tier
  await runTest('TenantPermissionContext', 'Starter tier - products limit should be 100', async () => {
    const result = await tenantPermissionContext.getLimit(
      TEST_CONFIG.tenants.starter,
      'products'
    );
    assert(result === 100, `Starter tier products limit should be 100, got ${result}`);
  });

  await runTest('TenantPermissionContext', 'Professional tier - products limit should be 1000', async () => {
    const result = await tenantPermissionContext.getLimit(
      TEST_CONFIG.tenants.professional,
      'products'
    );
    assert(result === 1000, `Professional tier products limit should be 1000, got ${result}`);
  });

  await runTest('TenantPermissionContext', 'Enterprise tier - products limit should be unlimited (-1)', async () => {
    const result = await tenantPermissionContext.getLimit(
      TEST_CONFIG.tenants.enterprise,
      'products'
    );
    assert(result === -1, `Enterprise tier products limit should be -1 (unlimited), got ${result}`);
  });

  // Test 3: Access checking
  await runTest('TenantPermissionContext', 'Read access should be allowed for all tiers', async () => {
    const result = await tenantPermissionContext.canAccess(
      TEST_CONFIG.tenants.starter,
      'products',
      'read'
    );
    assert(result === true, 'Read access should be allowed');
  });

  // Test 4: Convenience methods
  await runTest('TenantPermissionContext', 'canUseAdvancedAnalytics for professional tier', async () => {
    const result = await tenantPermissionContext.canUseAdvancedAnalytics(
      TEST_CONFIG.tenants.professional
    );
    assert(result === true, 'Professional tier should be able to use advanced analytics');
  });

  await runTest('TenantPermissionContext', 'canAccessAPI for starter tier', async () => {
    const result = await tenantPermissionContext.canAccessAPI(
      TEST_CONFIG.tenants.starter
    );
    assert(result === false, 'Starter tier should not have API access');
  });

  // Test 5: Cache invalidation
  await runTest('TenantPermissionContext', 'Cache invalidation should work', async () => {
    await tenantPermissionContext.invalidateTenantCache(TEST_CONFIG.tenants.starter);
    // No assertion needed - just verify no errors
    assert(true, 'Cache invalidation completed without errors');
  });
}

/**
 * Test Suite 2: Admin Permission Context
 */
async function testAdminPermissionContext(): Promise<void> {
  log('\n📋 Testing AdminPermissionContext', 'info');

  // Test 1: Feature checking by role
  await runTest('AdminPermissionContext', 'Platform admin - manageAllTenants should be true', async () => {
    const result = await adminPermissionContext.hasFeature(
      TEST_CONFIG.users.platformAdmin,
      'manageAllTenants'
    );
    assert(result === true, 'Platform admin should manage all tenants');
  });

  await runTest('AdminPermissionContext', 'Platform support - manageTickets should be true', async () => {
    const result = await adminPermissionContext.hasFeature(
      TEST_CONFIG.users.platformSupport,
      'manageTickets'
    );
    assert(result === true, 'Platform support should manage tickets');
  });

  await runTest('AdminPermissionContext', 'Platform viewer - systemConfig should be false', async () => {
    const result = await adminPermissionContext.hasFeature(
      TEST_CONFIG.users.platformViewer,
      'systemConfig'
    );
    assert(result === false, 'Platform viewer should not have system config');
  });

  // Test 2: Admin-specific methods
  await runTest('AdminPermissionContext', 'isPlatformAdmin check', async () => {
    const result = await adminPermissionContext.isPlatformAdmin(
      TEST_CONFIG.users.platformAdmin
    );
    assert(result === true, 'Should identify platform admin');
  });

  await runTest('AdminPermissionContext', 'canManageOverrides for platform admin', async () => {
    const result = await adminPermissionContext.canManageOverrides(
      TEST_CONFIG.users.platformAdmin
    );
    assert(result === true, 'Platform admin should manage overrides');
  });

  await runTest('AdminPermissionContext', 'canViewAuditLogs for platform support', async () => {
    const result = await adminPermissionContext.canViewAuditLogs(
      TEST_CONFIG.users.platformSupport
    );
    assert(result === true, 'Platform support should view audit logs');
  });

  // Test 3: Access checking
  await runTest('AdminPermissionContext', 'Admin can read analytics', async () => {
    const result = await adminPermissionContext.canAccess(
      TEST_CONFIG.users.platformAdmin,
      'analytics',
      'read'
    );
    assert(result === true, 'Admin should read analytics');
  });

  await runTest('AdminPermissionContext', 'Platform viewer cannot update config', async () => {
    const result = await adminPermissionContext.canAccess(
      TEST_CONFIG.users.platformViewer,
      'config',
      'update'
    );
    assert(result === false, 'Platform viewer should not update config');
  });
}

/**
 * Test Suite 3: Public Permission Context
 */
async function testPublicPermissionContext(): Promise<void> {
  log('\n📋 Testing PublicPermissionContext', 'info');

  // Test 1: Public features
  await runTest('PublicPermissionContext', 'browseProducts should be accessible', async () => {
    const result = await publicPermissionContext.hasFeature(
      TEST_CONFIG.clients.anonymous,
      'browseProducts'
    );
    assert(result === true, 'browseProducts should be publicly accessible');
  });

  await runTest('PublicPermissionContext', 'viewStorefronts should be accessible', async () => {
    const result = await publicPermissionContext.hasFeature(
      TEST_CONFIG.clients.anonymous,
      'viewStorefronts'
    );
    assert(result === true, 'viewStorefronts should be publicly accessible');
  });

  await runTest('PublicPermissionContext', 'Non-public feature should be denied', async () => {
    const result = await publicPermissionContext.hasFeature(
      TEST_CONFIG.clients.anonymous,
      'customBranding'
    );
    assert(result === false, 'customBranding should not be publicly accessible');
  });

  // Test 2: Public access (read-only)
  await runTest('PublicPermissionContext', 'Read access to products should be allowed', async () => {
    const result = await publicPermissionContext.canAccess(
      TEST_CONFIG.clients.anonymous,
      'products',
      'read'
    );
    assert(result === true, 'Read access to products should be allowed');
  });

  await runTest('PublicPermissionContext', 'Write access should be denied', async () => {
    const result = await publicPermissionContext.canAccess(
      TEST_CONFIG.clients.anonymous,
      'products',
      'write'
    );
    assert(result === false, 'Write access should be denied for public');
  });

  // Test 3: Rate limits
  await runTest('PublicPermissionContext', 'Rate limit - requests per minute', async () => {
    const result = await publicPermissionContext.getLimit(
      TEST_CONFIG.clients.anonymous,
      'requestsPerMinute'
    );
    assert(result === 60, `Requests per minute should be 60, got ${result}`);
  });

  await runTest('PublicPermissionContext', 'Rate limit - requests per hour', async () => {
    const result = await publicPermissionContext.getLimit(
      TEST_CONFIG.clients.anonymous,
      'requestsPerHour'
    );
    assert(result === 1000, `Requests per hour should be 1000, got ${result}`);
  });

  // Test 4: Convenience methods
  await runTest('PublicPermissionContext', 'canBrowseProducts', async () => {
    const result = await publicPermissionContext.canBrowseProducts(
      TEST_CONFIG.clients.anonymous
    );
    assert(result === true, 'Should be able to browse products');
  });

  await runTest('PublicPermissionContext', 'canViewCategories', async () => {
    const result = await publicPermissionContext.canViewCategories(
      TEST_CONFIG.clients.anonymous
    );
    assert(result === true, 'Should be able to view categories');
  });

  // Test 5: Client identifier generation
  await runTest('PublicPermissionContext', 'Client identifier generation', async () => {
    const clientId = publicPermissionContext.getClientIdentifier({
      ip: '192.168.1.1',
      userAgent: 'TestAgent/1.0'
    });
    assert(clientId.startsWith('ip:'), 'Client ID should start with ip:');
  });
}

/**
 * Test Suite 4: Tenant Feature Service
 */
async function testTenantFeatureService(): Promise<void> {
  log('\n📋 Testing TenantFeatureService', 'info');

  // Test 1: Feature definitions
  await runTest('TenantFeatureService', 'Get feature definition', async () => {
    const definition = tenantFeatureService.getFeatureDefinition('advancedAnalytics');
    assert(definition !== undefined, 'Should get feature definition');
    assert(definition?.name === 'Advanced Analytics', 'Feature name should match');
  });

  await runTest('TenantFeatureService', 'Get all feature definitions', async () => {
    const definitions = tenantFeatureService.getAllFeatureDefinitions();
    assert(definitions.length > 0, 'Should have feature definitions');
    assert(definitions.some(d => d.id === 'apiAccess'), 'Should include apiAccess feature');
  });

  await runTest('TenantFeatureService', 'Get features by category', async () => {
    const analyticsFeatures = tenantFeatureService.getFeaturesByCategory('analytics');
    assert(analyticsFeatures.length >= 2, 'Should have at least 2 analytics features');
  });

  await runTest('TenantFeatureService', 'Get features for tier', async () => {
    const starterFeatures = tenantFeatureService.getFeaturesForTier('starter');
    assert(starterFeatures.length > 0, 'Starter tier should have features');
    assert(!starterFeatures.some(f => f.id === 'whiteLabel'), 'Starter should not have whiteLabel');
  });

  // Test 2: Feature delegation
  await runTest('TenantFeatureService', 'isFeatureEnabled delegates to context', async () => {
    const result = await tenantFeatureService.isFeatureEnabled(
      TEST_CONFIG.tenants.professional,
      'advancedAnalytics'
    );
    assert(result === true, 'Professional tier should have advancedAnalytics');
  });

  await runTest('TenantFeatureService', 'getAllFeatures returns all features', async () => {
    const features = await tenantFeatureService.getAllFeatures(TEST_CONFIG.tenants.starter);
    assert(Object.keys(features).length > 0, 'Should return features object');
    assert(features.basicAnalytics === true, 'Should have basicAnalytics');
  });
}

/**
 * Test Suite 5: Tenant Limits Service
 */
async function testTenantLimitsService(): Promise<void> {
  log('\n📋 Testing TenantLimitsService', 'info');

  // Test 1: Limit definitions
  await runTest('TenantLimitsService', 'Get limit definition', async () => {
    const definition = tenantLimitsService.getLimitDefinition('products');
    assert(definition !== undefined, 'Should get limit definition');
    assert(definition?.name === 'Products', 'Limit name should match');
  });

  await runTest('TenantLimitsService', 'Get all limit definitions', async () => {
    const definitions = tenantLimitsService.getAllLimitDefinitions();
    assert(definitions.length > 0, 'Should have limit definitions');
    assert(definitions.some(d => d.id === 'users'), 'Should include users limit');
  });

  // Test 2: Limit checking
  await runTest('TenantLimitsService', 'getLimit delegates to context', async () => {
    const limit = await tenantLimitsService.getLimit(
      TEST_CONFIG.tenants.professional,
      'locations'
    );
    assert(limit === 5, `Professional tier locations limit should be 5, got ${limit}`);
  });

  await runTest('TenantLimitsService', 'wouldExceedLimit for unlimited tier', async () => {
    const wouldExceed = await tenantLimitsService.wouldExceedLimit(
      TEST_CONFIG.tenants.enterprise,
      'products',
      10000
    );
    assert(wouldExceed === false, 'Enterprise tier should not exceed products limit (unlimited)');
  });

  // Test 3: Convenience methods
  await runTest('TenantLimitsService', 'canAddProduct for starter tier', async () => {
    // This will check current usage, which may be 0 for test tenant
    const canAdd = await tenantLimitsService.canAddProduct(TEST_CONFIG.tenants.starter);
    // Result depends on current usage, just verify no errors
    assert(typeof canAdd === 'boolean', 'Should return boolean');
  });

  await runTest('TenantLimitsService', 'canAddLocation for enterprise tier', async () => {
    const canAdd = await tenantLimitsService.canAddLocation(TEST_CONFIG.tenants.enterprise);
    assert(canAdd === true, 'Enterprise tier should always be able to add locations');
  });

  // Test 4: Limit status
  await runTest('TenantLimitsService', 'getLimitStatus returns complete status', async () => {
    const status = await tenantLimitsService.getLimitStatus(
      TEST_CONFIG.tenants.professional,
      'products'
    );
    assert(status.limitType === 'products', 'Limit type should match');
    assert(status.limit === 1000, 'Limit should be 1000');
    assert(typeof status.current === 'number', 'Current should be a number');
    assert(typeof status.remaining === 'number', 'Remaining should be a number');
    assert(typeof status.percentage === 'number', 'Percentage should be a number');
    assert(typeof status.exceeded === 'boolean', 'Exceeded should be a boolean');
    assert(status.unlimited === false, 'Professional tier is not unlimited');
  });
}

/**
 * Test Suite 6: Permission Service Factory
 */
async function testPermissionServiceFactory(): Promise<void> {
  log('\n📋 Testing PermissionServiceFactory', 'info');

  // Test 1: Service accessors
  await runTest('PermissionServiceFactory', 'getTenantService returns tenant context', async () => {
    const service = permissionServiceFactory.getTenantService();
    assert(service !== undefined, 'Should return tenant service');
  });

  await runTest('PermissionServiceFactory', 'getAdminService returns admin context', async () => {
    const service = permissionServiceFactory.getAdminService();
    assert(service !== undefined, 'Should return admin service');
  });

  await runTest('PermissionServiceFactory', 'getPublicService returns public context', async () => {
    const service = permissionServiceFactory.getPublicService();
    assert(service !== undefined, 'Should return public service');
  });

  // Test 2: Zero-import convenience methods
  await runTest('PermissionServiceFactory', 'hasFeature convenience method', async () => {
    const result = await permissionServiceFactory.hasFeature(
      TEST_CONFIG.tenants.professional,
      'apiAccess'
    );
    assert(result === true, 'Professional tier should have API access');
  });

  await runTest('PermissionServiceFactory', 'getLimit convenience method', async () => {
    const limit = await permissionServiceFactory.getLimit(
      TEST_CONFIG.tenants.starter,
      'users'
    );
    assert(limit === 1, `Starter tier users limit should be 1, got ${limit}`);
  });

  await runTest('PermissionServiceFactory', 'canAccess convenience method', async () => {
    const canAccess = await permissionServiceFactory.canAccess(
      TEST_CONFIG.tenants.professional,
      'analytics',
      'read'
    );
    assert(canAccess === true, 'Should be able to read analytics');
  });

  await runTest('PermissionServiceFactory', 'isPlatformAdmin convenience method', async () => {
    const isAdmin = await permissionServiceFactory.isPlatformAdmin(
      TEST_CONFIG.users.platformAdmin
    );
    assert(isAdmin === true, 'Should identify platform admin');
  });

  // Test 3: Convenience methods for limits
  await runTest('PermissionServiceFactory', 'canAddProduct convenience method', async () => {
    const canAdd = await permissionServiceFactory.canAddProduct(TEST_CONFIG.tenants.enterprise);
    assert(canAdd === true, 'Enterprise should be able to add products');
  });

  await runTest('PermissionServiceFactory', 'canAddLocation convenience method', async () => {
    const canAdd = await permissionServiceFactory.canAddLocation(TEST_CONFIG.tenants.enterprise);
    assert(canAdd === true, 'Enterprise should be able to add locations');
  });

  // Test 4: Metrics
  await runTest('PermissionServiceFactory', 'getMetrics returns all service metrics', async () => {
    const metrics = permissionServiceFactory.getMetrics();
    assert(metrics.tenant !== undefined, 'Should have tenant metrics');
    assert(metrics.admin !== undefined, 'Should have admin metrics');
    assert(metrics.public !== undefined, 'Should have public metrics');
  });

  // Test 5: Context-aware service selection
  await runTest('PermissionServiceFactory', 'getServiceForContext returns correct service', async () => {
    const tenantService = permissionServiceFactory.getServiceForContext('tenant');
    const adminService = permissionServiceFactory.getServiceForContext('admin');
    const publicService = permissionServiceFactory.getServiceForContext('public');
    
    assert(tenantService !== undefined, 'Should return tenant service for tenant context');
    assert(adminService !== undefined, 'Should return admin service for admin context');
    assert(publicService !== undefined, 'Should return public service for public context');
  });
}

/**
 * Test Suite 7: Integration Tests
 */
async function testIntegration(): Promise<void> {
  log('\n📋 Testing Integration Scenarios', 'info');

  // Test 1: Full permission flow for tenant
  await runTest('Integration', 'Full tenant permission flow', async () => {
    // Get all permissions for a tenant
    const permissions = await permissionServiceFactory.getTenantPermissions(
      TEST_CONFIG.tenants.professional
    );
    
    assert(permissions.features !== undefined, 'Should have features');
    assert(permissions.limits !== undefined, 'Should have limits');
    assert(permissions.features.advancedAnalytics === true, 'Should have advancedAnalytics');
    assert(permissions.limits.products === 1000, 'Should have products limit of 1000');
  });

  // Test 2: Admin permission flow
  await runTest('Integration', 'Full admin permission flow', async () => {
    const permissions = await permissionServiceFactory.getAdminPermissions(
      TEST_CONFIG.users.platformAdmin
    );
    
    assert(permissions.roles !== undefined, 'Should have roles');
    assert(permissions.features !== undefined, 'Should have features');
    assert(permissions.roles.includes('PLATFORM_ADMIN'), 'Should have PLATFORM_ADMIN role');
  });

  // Test 3: Public permission flow
  await runTest('Integration', 'Full public permission flow', async () => {
    const permissions = await permissionServiceFactory.getPublicPermissions(
      TEST_CONFIG.clients.anonymous
    );
    
    assert(permissions.features !== undefined, 'Should have features');
    assert(permissions.rateLimits !== undefined, 'Should have rate limits');
    assert(permissions.features.browseProducts === true, 'Should be able to browse products');
  });

  // Test 4: Cache invalidation flow
  await runTest('Integration', 'Cache invalidation flow', async () => {
    // First, cache a permission
    await permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.starter, 'basicAnalytics');
    
    // Invalidate cache
    await permissionServiceFactory.invalidateTenantCache(TEST_CONFIG.tenants.starter);
    
    // Check again (should fetch fresh)
    const result = await permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.starter, 'basicAnalytics');
    assert(result === true, 'Should still have feature after cache invalidation');
  });

  // Test 5: Cross-context permission check
  await runTest('Integration', 'Cross-context permission check', async () => {
    // Tenant context
    const tenantCanAccess = await permissionServiceFactory.canAccess(
      TEST_CONFIG.tenants.professional,
      'analytics',
      'read'
    );
    
    // Admin context
    const adminCanAccess = await permissionServiceFactory.canAdminAccess(
      TEST_CONFIG.users.platformAdmin,
      'analytics',
      'read'
    );
    
    // Public context
    const publicCanAccess = await permissionServiceFactory.canPublicAccess(
      TEST_CONFIG.clients.anonymous,
      'products',
      'read'
    );
    
    assert(tenantCanAccess === true, 'Tenant should access analytics');
    assert(adminCanAccess === true, 'Admin should access analytics');
    assert(publicCanAccess === true, 'Public should access products');
  });
}

/**
 * Test Suite 8: Performance Tests
 */
async function testPerformance(): Promise<void> {
  log('\n📋 Testing Performance', 'info');

  // Test 1: Cached permission check speed
  await runTest('Performance', 'Cached permission check should be fast', async () => {
    // First call to cache
    await permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.professional, 'apiAccess');
    
    // Second call should be cached
    const startTime = Date.now();
    await permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.professional, 'apiAccess');
    const duration = Date.now() - startTime;
    
    assert(duration < 10, `Cached check should be < 10ms, got ${duration}ms`);
  });

  // Test 2: Batch permission checks
  await runTest('Performance', 'Batch permission checks', async () => {
    const startTime = Date.now();
    
    const promises = [
      permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.professional, 'basicAnalytics'),
      permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.professional, 'advancedAnalytics'),
      permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.professional, 'apiAccess'),
      permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.professional, 'bulkOperations'),
      permissionServiceFactory.hasFeature(TEST_CONFIG.tenants.professional, 'customBranding')
    ];
    
    await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    assert(duration < 100, `Batch checks should complete in < 100ms, got ${duration}ms`);
  });

  // Test 3: Limit status check performance
  await runTest('Performance', 'Limit status check performance', async () => {
    const startTime = Date.now();
    await tenantLimitsService.getLimitStatus(TEST_CONFIG.tenants.professional, 'products');
    const duration = Date.now() - startTime;
    
    assert(duration < 50, `Limit status check should be < 50ms, got ${duration}ms`);
  });
}

// ==========================================
// Main Test Runner
// ==========================================

async function runAllTests(): Promise<void> {
  log('\n========================================', 'info');
  log('  Permission System Batch Test Runner', 'info');
  log('========================================\n', 'info');

  const startTime = Date.now();

  try {
    // Run all test suites
    await testTenantPermissionContext();
    await testAdminPermissionContext();
    await testPublicPermissionContext();
    await testTenantFeatureService();
    await testTenantLimitsService();
    await testPermissionServiceFactory();
    await testIntegration();
    await testPerformance();
  } catch (error) {
    log('\nFatal error during test execution:', 'error');
    console.error(error);
  }

  // Print summary
  const totalDuration = Date.now() - startTime;
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const total = testResults.length;

  log('\n========================================', 'info');
  log('  Test Summary', 'info');
  log('========================================', 'info');
  log(`  Total Tests: ${total}`, 'info');
  log(`  Passed: ${passed}`, 'success');
  log(`  Failed: ${failed}`, failed > 0 ? 'error' : 'info');
  log(`  Duration: ${totalDuration}ms`, 'info');
  log('========================================\n', 'info');

  // Print failed tests details
  if (failed > 0) {
    log('Failed Tests:', 'error');
    testResults
      .filter(r => !r.passed)
      .forEach(r => {
        log(`  - ${r.suite}: ${r.test}`, 'error');
        log(`    ${r.error}`, 'error');
      });
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
