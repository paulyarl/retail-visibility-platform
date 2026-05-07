/**
 * Platform Revenue Collection - Batch Test Script
 * 
 * Run this script after configuring Stripe Connect and PayPal Commerce Platform
 * to verify the implementation is working correctly.
 * 
 * Usage:
 *   npx ts-node scripts/test-platform-revenue.ts
 * 
 * Or compile and run:
 *   npx tsc scripts/test-platform-revenue.ts --outDir dist/scripts
 *   node dist/scripts/test-platform-revenue.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// CONFIGURATION - Update these values
// ==========================================

const TEST_CONFIG = {
  // Test tenant ID (create a test tenant or use existing)
  testTenantId: 'tid-fjwr30ib',
  
  // Test amounts in cents
  testAmountCents: 10000, // $100.00
  
  // Platform fee percentage (should match your config)
  expectedFeePercent: 2.0,
  
  // Test period for invoice generation
  testPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  testPeriodEnd: new Date(),
};

// ==========================================
// TEST SUITE
// ==========================================

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${result.name}: ${result.message}`);
}

async function test(name: string, fn: () => Promise<boolean | string>) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    if (result === true) {
      logResult({ name, passed: true, message: 'OK', duration });
    } else {
      logResult({ name, passed: false, message: result as string, duration });
    }
  } catch (error: any) {
    logResult({ name, passed: false, message: error.message, duration: Date.now() - start });
  }
}

// ==========================================
// DATABASE TESTS
// ==========================================

async function testDatabaseTables(): Promise<void> {
  console.log('\n--- Database Tests ---\n');

  await test('platform_payment_config table exists', async () => {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    return config !== null ? true : 'platform_payment_config record not found. Run the SQL setup script.';
  });

  await test('merchant_stripe_connections table exists', async () => {
    const count = await prisma.merchant_stripe_connections.count();
    return true; // Table exists if no error
  });

  await test('merchant_paypal_connections table exists', async () => {
    const count = await prisma.merchant_paypal_connections.count();
    return true; // Table exists if no error
  });

  await test('platform_revenue_transactions table exists', async () => {
    const count = await prisma.platform_revenue_transactions.count();
    return true; // Table exists if no error
  });

  await test('platform_fee_invoices table exists', async () => {
    const count = await prisma.platform_fee_invoices.count();
    return true; // Table exists if no error
  });

  await test('platform_fee_invoice_items table exists', async () => {
    const count = await prisma.platform_fee_invoice_items.count();
    return true; // Table exists if no error
  });
}

// ==========================================
// STRIPE CONFIG TESTS
// ==========================================

async function testStripeConfiguration(): Promise<void> {
  console.log('\n--- Stripe Connect Tests ---\n');

  await test('Stripe platform account ID configured', async () => {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    if (!config?.stripe_platform_account_id) {
      return 'stripe_platform_account_id not set. Configure in platform_payment_config table.';
    }
    return config.stripe_platform_account_id.startsWith('acct_') ? true : 'Invalid Stripe account ID format';
  });

  await test('Stripe Connect client ID configured', async () => {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    if (!config?.stripe_connect_client_id) {
      return 'stripe_connect_client_id not set. Get from Stripe Dashboard > Connect.';
    }
    return config.stripe_connect_client_id.startsWith('ca_') ? true : 'Invalid Connect client ID format';
  });

  await test('Stripe secret key configured', async () => {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    if (!config?.stripe_platform_secret_key_encrypted) {
      return 'stripe_platform_secret_key_encrypted not set. Add your Stripe secret key.';
    }
    const key = config.stripe_platform_secret_key_encrypted;
    return key.startsWith('sk_') || key.startsWith('rk_') ? true : 'Invalid secret key format';
  });

  await test('Stripe webhook secret configured', async () => {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    if (!config?.stripe_webhook_secret_encrypted) {
      return 'stripe_webhook_secret_encrypted not set. Get from Stripe Dashboard > Webhooks.';
    }
    return config.stripe_webhook_secret_encrypted.startsWith('whsec_') ? true : 'Invalid webhook secret format';
  });

  await test('Default platform fee percentage set', async () => {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    if (config?.default_platform_fee_percent === null || config?.default_platform_fee_percent === undefined) {
      return 'default_platform_fee_percent not set. Recommended: 2.0';
    }
    const fee = Number(config.default_platform_fee_percent);
    return fee >= 0 && fee <= 100 ? true : `Invalid fee percentage: ${fee}`;
  });

  await test('Revenue collection enabled', async () => {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    return config?.is_active === true ? true : 'is_active is false. Enable revenue collection.';
  });
}

// ==========================================
// STRIPE CONNECT TESTS
// ==========================================

async function testStripeConnectIntegration(): Promise<void> {
  console.log('\n--- Stripe Connect Integration Tests ---\n');

  await test('Stripe API reachable', async () => {
    try {
      const Stripe = require('stripe');
      const config = await prisma.platform_payment_config.findUnique({
        where: { id: 'platform_main' },
      });
      if (!config?.stripe_platform_secret_key_encrypted) {
        return 'Stripe not configured';
      }
      const stripe = new Stripe(config.stripe_platform_secret_key_encrypted, {
        apiVersion: '2025-02-24.acacia',
      });
      await stripe.balance.retrieve();
      return true;
    } catch (error: any) {
      return `Stripe API error: ${error.message}`;
    }
  });

  await test('Platform account has Connect enabled', async () => {
    try {
      const Stripe = require('stripe');
      const config = await prisma.platform_payment_config.findUnique({
        where: { id: 'platform_main' },
      });
      if (!config?.stripe_platform_secret_key_encrypted) {
        return 'Stripe not configured';
      }
      const stripe = new Stripe(config.stripe_platform_secret_key_encrypted, {
        apiVersion: '2025-02-24.acacia',
      });
      const account = await stripe.accounts.retrieve(config.stripe_platform_account_id!);
      return account.capabilities?.transfers === 'active' ? true : 'Transfers capability not active';
    } catch (error: any) {
      return `Account check error: ${error.message}`;
    }
  });

  await test('Can create test payment intent', async () => {
    try {
      const Stripe = require('stripe');
      const config = await prisma.platform_payment_config.findUnique({
        where: { id: 'platform_main' },
      });
      if (!config?.stripe_platform_secret_key_encrypted) {
        return 'Stripe not configured';
      }
      const stripe = new Stripe(config.stripe_platform_secret_key_encrypted, {
        apiVersion: '2025-02-24.acacia',
      });
      const intent = await stripe.paymentIntents.create({
        amount: 100,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      return intent.id.startsWith('pi_') ? true : 'Invalid payment intent ID';
    } catch (error: any) {
      return `Payment intent error: ${error.message}`;
    }
  });
}

// ==========================================
// MERCHANT CONNECTION TESTS
// ==========================================

async function testMerchantConnections(): Promise<void> {
  console.log('\n--- Merchant Connection Tests ---\n');

  await test('Merchant Stripe connections queryable', async () => {
    const connections = await prisma.merchant_stripe_connections.findMany({
      take: 5,
    });
    return true;
  });

  await test('Merchant PayPal connections queryable', async () => {
    const connections = await prisma.merchant_paypal_connections.findMany({
      take: 5,
    });
    return true;
  });

  await test('Can create test merchant connection', async () => {
    const testId = `test_msc_${Date.now()}`;
    try {
      await prisma.merchant_stripe_connections.create({
        data: {
          id: testId,
          tenant_id: TEST_CONFIG.testTenantId,
          onboarding_status: 'pending',
        },
      });
      await prisma.merchant_stripe_connections.delete({
        where: { id: testId },
      });
      return true;
    } catch (error: any) {
      return `Create/delete error: ${error.message}`;
    }
  });
}

// ==========================================
// REVENUE TRANSACTION TESTS
// ==========================================

async function testRevenueTransactions(): Promise<void> {
  console.log('\n--- Revenue Transaction Tests ---\n');

  await test('Can query revenue transactions', async () => {
    const transactions = await prisma.platform_revenue_transactions.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
    });
    return true;
  });

  await test('Can create test revenue transaction', async () => {
    const testId = `test_rev_${Date.now()}`;
    try {
      await prisma.platform_revenue_transactions.create({
        data: {
          id: testId,
          tenant_id: TEST_CONFIG.testTenantId,
          transaction_type: 'transaction_fee',
          gross_amount_cents: 10000,
          platform_fee_cents: 200,
          gateway_fee_cents: 290,
          net_amount_cents: 9510,
          status: 'completed',
          processed_at: new Date(),
        },
      });
      await prisma.platform_revenue_transactions.delete({
        where: { id: testId },
      });
      return true;
    } catch (error: any) {
      return `Create/delete error: ${error.message}`;
    }
  });
}

// ==========================================
// INVOICE TESTS
// ==========================================

async function testInvoiceSystem(): Promise<void> {
  console.log('\n--- Invoice System Tests ---\n');

  await test('Can query platform fee invoices', async () => {
    const invoices = await prisma.platform_fee_invoices.findMany({
      take: 5,
      include: {
        platform_fee_invoice_items: true,
      },
    });
    return true;
  });

  await test('Can create test invoice', async () => {
    const testId = `test_inv_${Date.now()}`;
    try {
      await prisma.platform_fee_invoices.create({
        data: {
          id: testId,
          tenant_id: TEST_CONFIG.testTenantId,
          period_start: TEST_CONFIG.testPeriodStart,
          period_end: TEST_CONFIG.testPeriodEnd,
          total_fees_cents: 1000,
          status: 'pending',
        },
      });
      await prisma.platform_fee_invoices.delete({
        where: { id: testId },
      });
      return true;
    } catch (error: any) {
      return `Create/delete error: ${error.message}`;
    }
  });

  await test('Can create test invoice item', async () => {
    const testInvoiceId = `test_inv_item_${Date.now()}`;
    const testItemId = `test_item_${Date.now()}`;
    try {
      // Create invoice first
      await prisma.platform_fee_invoices.create({
        data: {
          id: testInvoiceId,
          tenant_id: TEST_CONFIG.testTenantId,
          period_start: TEST_CONFIG.testPeriodStart,
          period_end: TEST_CONFIG.testPeriodEnd,
          total_fees_cents: 100,
          status: 'pending',
        },
      });
      // Create item
      await prisma.platform_fee_invoice_items.create({
        data: {
          id: testItemId,
          invoice_id: testInvoiceId,
          gateway: 'paypal',
          transaction_date: new Date(),
          gross_amount_cents: 10000,
          platform_fee_cents: 200,
          description: 'Test item',
        },
      });
      // Cleanup
      await prisma.platform_fee_invoice_items.delete({
        where: { id: testItemId },
      });
      await prisma.platform_fee_invoices.delete({
        where: { id: testInvoiceId },
      });
      return true;
    } catch (error: any) {
      return `Create/delete error: ${error.message}`;
    }
  });
}

// ==========================================
// API ENDPOINT TESTS
// ==========================================

async function testApiEndpoints(): Promise<void> {
  console.log('\n--- API Endpoint Tests ---\n');

  const baseUrl = process.env.API_URL || 'http://localhost:3001';

  await test('API server is running', async () => {
    try {
      const response = await fetch(`${baseUrl}/health`);
      return response.ok ? true : `Health check failed: ${response.status}`;
    } catch (error: any) {
      return `Cannot connect to API: ${error.message}. Start the server with 'pnpm dev'`;
    }
  });

  // Note: These tests require authentication
  // In a real test, you'd use a test JWT or API key
  
  await test('Platform revenue config endpoint accessible', async () => {
    // This would require auth in real scenario
    return 'Requires authentication - test manually with curl or Postman';
  });

  await test('Stripe webhook endpoint accessible', async () => {
    try {
      const response = await fetch(`${baseUrl}/api/webhooks/stripe-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      // Should get 400 for invalid signature, not 404
      return response.status === 400 ? true : `Unexpected status: ${response.status}`;
    } catch (error: any) {
      return `Endpoint error: ${error.message}`;
    }
  });
}

// ==========================================
// SUMMARY
// ==========================================

function printSummary(): void {
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
  }

  console.log('\n========================================\n');

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  console.log('========================================');
  console.log('Platform Revenue Collection Test Suite');
  console.log('========================================');
  console.log(`\nStarted at: ${new Date().toISOString()}`);
  console.log(`Test Tenant ID: ${TEST_CONFIG.testTenantId}`);

  try {
    await testDatabaseTables();
    await testStripeConfiguration();
    await testStripeConnectIntegration();
    await testMerchantConnections();
    await testRevenueTransactions();
    await testInvoiceSystem();
    await testApiEndpoints();
  } catch (error: any) {
    console.error('\nTest suite error:', error);
  } finally {
    await prisma.$disconnect();
    printSummary();
  }
}

main();
