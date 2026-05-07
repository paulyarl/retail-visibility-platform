/**
 * Subscription Billing Batch Test
 * 
 * Comprehensive test suite for subscription billing automation
 * Run with: npx ts-node src/tests/subscription-billing-batch-test.ts
 */

import { prisma } from '../prisma';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { getSubscriptionStatusService } from '../services/subscription/SubscriptionStatusService';
import { getBillingNotificationService } from '../services/subscription/BillingNotificationService';

// Test configuration
const TEST_TENANT_ID = 'test-billing-tenant-' + Date.now();
const TEST_USER_EMAIL = 'billing-test@example.com';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Helper to run a test
async function runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now();
  try {
    await testFn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (error: any) {
    return { name, passed: false, duration: Date.now() - start, error: error.message };
  }
}

// Setup test tenant
async function setupTestTenant(): Promise<void> {
  const testSlug = 'billing-test-' + Date.now();
  
  // Check if tenant exists
  const existing = await prisma.tenants.findUnique({ where: { id: TEST_TENANT_ID } });
  
  if (existing) {
    // Update existing tenant
    await prisma.tenants.update({
      where: { id: TEST_TENANT_ID },
      data: {
        subscription_tier: 'starter',
        subscription_status: 'active',
        location_status: 'active',
      },
    });
  } else {
    // Create new tenant
    await prisma.tenants.create({
      data: {
        id: TEST_TENANT_ID,
        name: 'Billing Test Tenant',
        slug: testSlug,
        subscription_tier: 'starter',
        subscription_status: 'active',
        location_status: 'active',
      },
    });
  }

  // Check if user exists
  const existingUser = await prisma.users.findUnique({ where: { id: 'test-billing-user' } });
  
  if (existingUser) {
    await prisma.users.update({
      where: { id: 'test-billing-user' },
      data: { email: TEST_USER_EMAIL },
    });
  } else {
    await prisma.users.create({
      data: {
        id: 'test-billing-user',
        email: TEST_USER_EMAIL,
        password_hash: 'test-hash',
        first_name: 'Billing',
        last_name: 'Test User',
        role: 'OWNER',
        updated_at: new Date(),
      },
    });
  }

  // Create user_tenant relationship
  const existingUserTenant = await prisma.user_tenants.findFirst({
    where: { user_id: 'test-billing-user', tenant_id: TEST_TENANT_ID },
  });
  
  if (!existingUserTenant) {
    await prisma.user_tenants.create({
      data: {
        id: 'ut-test-billing-' + Date.now(),
        user_id: 'test-billing-user',
        tenant_id: TEST_TENANT_ID,
        role: 'OWNER',
        updated_at: new Date(),
      },
    });
  }

  console.log(`  Setup: Created test tenant ${TEST_TENANT_ID}`);
}

// Cleanup test tenant
async function cleanupTestTenant(): Promise<void> {
  // Use Prisma client methods for cleanup
  try {
    await prisma.merchant_billing_gateways.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  } catch (e) {}
  try {
    await prisma.$executeRaw`DELETE FROM subscription_invoices WHERE tenant_id = ${TEST_TENANT_ID}`;
  } catch (e) {} // Table not in Prisma schema
  try {
    await prisma.location_status_logs.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  } catch (e) {}
  try {
    await prisma.user_tenants.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  } catch (e) {}
  try {
    await prisma.users.delete({ where: { id: 'test-billing-user' } }).catch(() => {});
  } catch (e) {}
  try {
    await prisma.tenants.delete({ where: { id: TEST_TENANT_ID } }).catch(() => {});
  } catch (e) {}
  
  console.log(`  Cleanup: Removed test tenant ${TEST_TENANT_ID}`);
}

// ==================== TESTS ====================

async function testTierPricing(): Promise<void> {
  const billingService = getSubscriptionBillingService();
  
  // Get all tiers
  const tiers = await billingService.getTierPricing();
  if (!tiers || tiers.length === 0) {
    throw new Error('No tier pricing found');
  }
  
  console.log(`    Found ${tiers.length} tier pricing entries`);
  
  // Get specific tier
  const starterTier = await billingService.getTierPricingByTier('starter');
  if (!starterTier) {
    throw new Error('Starter tier not found');
  }
  
  console.log(`    Starter tier: $${starterTier.monthlyPriceCents / 100}/month, ${starterTier.maxSkus} SKUs, ${starterTier.maxLocations} locations`);
}

async function testPaymentMethodCRUD(): Promise<void> {
  const billingService = getSubscriptionBillingService();
  
  // Use 'stripe' gateway to match the allowed types
  const method = await billingService.addPaymentMethod(TEST_TENANT_ID, 'stripe', 'pm_test_' + Date.now(), {
    cardLast4: '4242',
    cardBrand: 'visa',
    expiryMonth: 12,
    expiryYear: 2025,
  });
  
  if (!method.id || !method.id.startsWith('mbg-')) {
    throw new Error('Payment method ID not properly formatted');
  }
  
  console.log(`    Created payment method: ${method.id}`);
  
  // Get payment methods
  const methods = await billingService.getPaymentMethods(TEST_TENANT_ID);
  if (methods.length === 0) {
    throw new Error('No payment methods found after adding');
  }
  
  console.log(`    Found ${methods.length} payment method(s)`);
  
  // Set as default
  await billingService.setDefaultPaymentMethod(TEST_TENANT_ID, method.id);
  
  const defaultMethod = await billingService.getDefaultPaymentMethod(TEST_TENANT_ID);
  if (!defaultMethod || defaultMethod.id !== method.id) {
    throw new Error('Default payment method not set correctly');
  }
  
  console.log(`    Set default payment method: ${method.id}`);
  
  // Remove payment method
  await billingService.removePaymentMethod(TEST_TENANT_ID, method.id);
  
  const afterRemove = await billingService.getPaymentMethods(TEST_TENANT_ID);
  if (afterRemove.length > 0) {
    throw new Error('Payment method not removed');
  }
  
  console.log(`    Removed payment method successfully`);
}

async function testSubscriptionPreview(): Promise<void> {
  const billingService = getSubscriptionBillingService();
  
  // Preview upgrade to professional
  const preview = await billingService.previewSubscriptionChange(
    TEST_TENANT_ID,
    'professional',
    'monthly'
  );
  
  if (!preview.currentTier || !preview.newTier) {
    throw new Error('Preview missing tier information');
  }
  
  if (preview.currentTier !== 'starter') {
    throw new Error(`Expected current tier 'starter', got '${preview.currentTier}'`);
  }
  
  if (preview.newTier !== 'professional') {
    throw new Error(`Expected new tier 'professional', got '${preview.newTier}'`);
  }
  
  console.log(`    Preview: ${preview.currentTier} -> ${preview.newTier}`);
  console.log(`    Price change: $${preview.currentPrice / 100} -> $${preview.newPrice / 100}`);
  console.log(`    Prorated amount: $${preview.proratedAmount / 100}`);
}

async function testStatusTransitions(): Promise<void> {
  const statusService = getSubscriptionStatusService();
  
  // Test payment success
  const successResult = await statusService.handlePaymentSuccess(TEST_TENANT_ID, 'professional', 'inv-test-' + Date.now());
  
  if (successResult.newStatus !== 'active') {
    throw new Error(`Expected status 'active', got '${successResult.newStatus}'`);
  }
  
  if (successResult.newTier !== 'professional') {
    throw new Error(`Expected tier 'professional', got '${successResult.newTier}'`);
  }
  
  console.log(`    Payment success: ${successResult.previousStatus} -> ${successResult.newStatus}`);
  console.log(`    Tier changed: ${successResult.previousTier} -> ${successResult.newTier}`);
  
  // Test payment failure
  const failureResult = await statusService.handlePaymentFailure(TEST_TENANT_ID, 'Card declined');
  
  if (failureResult.newStatus !== 'past_due') {
    throw new Error(`Expected status 'past_due', got '${failureResult.newStatus}'`);
  }
  
  console.log(`    Payment failure: ${failureResult.previousStatus} -> ${failureResult.newStatus}`);
  
  // Check grace period
  const isInGrace = await statusService.isInGracePeriod(TEST_TENANT_ID);
  
  if (!isInGrace) {
    throw new Error('Expected tenant to be in grace period');
  }
  
  const daysRemaining = await statusService.getGracePeriodDaysRemaining(TEST_TENANT_ID);
  console.log(`    Grace period: ${daysRemaining} days remaining`);
  
  // Test reactivation
  const reactivateResult = await statusService.reactivate(TEST_TENANT_ID, 'professional');
  
  if (reactivateResult.newStatus !== 'active') {
    throw new Error(`Expected status 'active' after reactivation, got '${reactivateResult.newStatus}'`);
  }
  
  console.log(`    Reactivation: ${reactivateResult.previousStatus} -> ${reactivateResult.newStatus}`);
}

async function testGracePeriodExpiry(): Promise<void> {
  const statusService = getSubscriptionStatusService();
  
  // Set tenant to past_due with old timestamp (simulate 31 days past)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 31);
  
  await prisma.tenants.update({
    where: { id: TEST_TENANT_ID },
    data: {
      subscription_status: 'past_due',
      status_changed_at: oldDate,
    },
  });
  
  // Handle grace period expiry
  const result = await statusService.handleGracePeriodExpiry(TEST_TENANT_ID);
  
  if (result.newStatus !== 'canceled') {
    throw new Error(`Expected status 'canceled', got '${result.newStatus}'`);
  }
  
  if (result.newTier !== 'google_only') {
    throw new Error(`Expected tier 'google_only', got '${result.newTier}'`);
  }
  
  console.log(`    Grace period expiry: ${result.previousStatus} -> ${result.newStatus}`);
  console.log(`    Tier demoted: ${result.previousTier} -> ${result.newTier}`);
}

async function testNotifications(): Promise<void> {
  const notificationService = getBillingNotificationService();
  
  // Test payment success notification
  const successSent = await notificationService.sendNotification({
    tenantId: TEST_TENANT_ID,
    type: 'payment_success',
    tier: 'professional',
    amount: 2900,
  });
  
  if (!successSent) {
    throw new Error('Payment success notification failed');
  }
  
  console.log(`    Sent payment_success notification`);
  
  // Test payment failed notification
  const failedSent = await notificationService.sendNotification({
    tenantId: TEST_TENANT_ID,
    type: 'payment_failed',
    reason: 'Card declined - insufficient funds',
  });
  
  if (!failedSent) {
    throw new Error('Payment failed notification failed');
  }
  
  console.log(`    Sent payment_failed notification`);
  
  // Test grace period warning
  const warningSent = await notificationService.sendNotification({
    tenantId: TEST_TENANT_ID,
    type: 'grace_period_warning',
    gracePeriodDaysRemaining: 7,
  });
  
  if (!warningSent) {
    throw new Error('Grace period warning notification failed');
  }
  
  console.log(`    Sent grace_period_warning notification (7 days)`);
  
  // Test tier change notification
  const tierSent = await notificationService.sendNotification({
    tenantId: TEST_TENANT_ID,
    type: 'tier_changed',
    tier: 'professional',
    amount: 2900,
    billingCycle: 'monthly',
  });
  
  if (!tierSent) {
    throw new Error('Tier change notification failed');
  }
  
  console.log(`    Sent tier_changed notification`);
}

async function testStatusLogs(): Promise<void> {
  // Check that status transitions were logged
  const logs = await prisma.location_status_logs.findMany({
    where: { tenant_id: TEST_TENANT_ID },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: {
      id: true,
      old_status: true,
      new_status: true,
      changed_by: true,
      created_at: true,
    },
  });
  
  if (logs.length === 0) {
    throw new Error('No status logs found');
  }
  
  console.log(`    Found ${logs.length} status log entries`);
  
  for (const log of logs.slice(0, 3)) {
    console.log(`    - ${log.old_status} -> ${log.new_status} (${log.changed_by})`);
  }
}

async function testIDGeneration(): Promise<void> {
  const billingService = getSubscriptionBillingService();
  
  // Use 'stripe' gateway to match the allowed types
  const method = await billingService.addPaymentMethod(TEST_TENANT_ID, 'stripe', 'pm_test_' + Date.now(), {
    cardLast4: '1234',
    cardBrand: 'mastercard',
    expiryMonth: 6,
    expiryYear: 2026,
  });
  
  if (!method.id.startsWith('mbg-')) {
    throw new Error(`Payment method ID should start with 'mbg-', got '${method.id}'`);
  }
  
  console.log(`    Payment method ID format: ${method.id} (correct)`);
  
  // Clean up
  await billingService.removePaymentMethod(TEST_TENANT_ID, method.id);
}

// ==================== MAIN ====================

async function runAllTests(): Promise<void> {
  console.log('\n========================================');
  console.log('Subscription Billing Batch Test');
  console.log('========================================\n');
  
  try {
    // Setup
    console.log('Setting up test environment...\n');
    await setupTestTenant();
    
    // Run tests
    console.log('\nRunning tests...\n');
    
    results.push(await runTest('Tier Pricing', testTierPricing));
    results.push(await runTest('Payment Method CRUD', testPaymentMethodCRUD));
    results.push(await runTest('Subscription Preview', testSubscriptionPreview));
    results.push(await runTest('Status Transitions', testStatusTransitions));
    results.push(await runTest('Grace Period Expiry', testGracePeriodExpiry));
    results.push(await runTest('Notifications', testNotifications));
    results.push(await runTest('Status Logs', testStatusLogs));
    results.push(await runTest('ID Generation', testIDGeneration));
    
  } finally {
    // Cleanup
    console.log('\nCleaning up...\n');
    await cleanupTestTenant();
  }
  
  // Print results
  console.log('\n========================================');
  console.log('Test Results');
  console.log('========================================\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.passed ? '[32mPASS[0m' : '[31mFAIL[0m';
    console.log(`  ${status} - ${result.name} (${result.duration}ms)`);
    
    if (result.error) {
      console.log(`        Error: ${result.error}`);
    }
    
    if (result.passed) passed++;
    else failed++;
  }
  
  console.log('\n----------------------------------------');
  console.log(`Total: ${results.length} tests`);
  console.log(`[32mPassed: ${passed}[0m`);
  console.log(`[31mFailed: ${failed}[0m`);
  console.log('----------------------------------------\n');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
