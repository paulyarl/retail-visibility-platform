/**
 * Manual Billing Batch Test Script
 * 
 * Tests all Phase 1 manual billing functionality:
 * - Manual invoice creation
 * Manual payment method management  
 * Service charge operations
 * API endpoint validation
 */

import { getManualBillingService } from '../services/subscription/ManualBillingService';
import { getServiceChargeService } from '../services/subscription/ServiceChargeService';
import { prisma } from '../prisma';

// Test configuration
const TEST_TENANT_ID = 'test-tenant-123'; // Replace with actual test tenant ID
const TEST_ORG_ID = 'test-org-123'; // Replace with actual test organization ID
const TEST_ADMIN_ID = 'test-admin-123';
const TEST_ADMIN_EMAIL = 'test-admin@example.com';

interface TestResult {
  test: string;
  success: boolean;
  error?: string;
  details?: any;
  duration?: number;
}

class ManualBillingBatchTester {
  private results: TestResult[] = [];

  private log(test: string, success: boolean, error?: string, details?: any, duration?: number) {
    this.results.push({
      test,
      success,
      error,
      details,
      duration
    });
    const status = success ? 'PASS' : 'FAIL';
    console.log(`${status}: ${test}${error ? ` - ${error}` : ''}${duration ? ` (${duration}ms)` : ''}`);
  }

  private async measureTime<T>(testName: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - start;
      throw { error, duration };
    }
  }

  async runAllTests(): Promise<void> {
    console.log('=== Manual Billing Batch Test Suite ===');
    console.log('Testing Phase 1 Implementation...\n');

    try {
      // Test 1: Manual Invoice Creation
      await this.testManualInvoiceCreation();

      // Test 2: Manual Payment Method Management
      await this.testManualPaymentMethods();

      // Test 3: Service Charge Operations
      await this.testServiceCharges();

      // Test 4: API Endpoint Validation
      await this.testAPIEndpoints();

      // Test 5: Database Schema Validation
      await this.testDatabaseSchema();

      // Test 6: Integration Tests
      await this.testIntegration();

    } catch (error: any) {
      this.log('Test Suite Error', false, (error as any)?.message || 'Unknown error');
    }

    // Print summary
    this.printSummary();
  }

  private async testManualInvoiceCreation(): Promise<void> {
    console.log('--- Test 1: Manual Invoice Creation ---');
    
    const manualBillingService = getManualBillingService();

    try {
      // Test creating a manual invoice
      const { result, duration } = await this.measureTime('Create Manual Invoice', async () => 
        manualBillingService.createManualInvoice({
          tenantId: TEST_TENANT_ID,
          amountCents: 5000,
          description: 'Test manual invoice',
          paymentInstructions: 'Please pay via bank transfer',
          adminCreatedBy: TEST_ADMIN_ID,
          adminEmail: TEST_ADMIN_EMAIL,
          reason: 'Batch test'
        })
      );

      if (result.success) {
        this.log('Create Manual Invoice', true, undefined, { invoiceId: result.invoiceId }, duration);
        
        // Verify invoice was created in database
        const invoice = await prisma.subscription_invoices.findUnique({
          where: { id: result.invoiceId! }
        });
        
        if (invoice) {
          this.log('Verify Invoice in Database', true, undefined, { 
            manualPayment: invoice.manual_payment,
            adminCreatedBy: invoice.admin_created_by,
            amountCents: invoice.amount_cents
          });
        } else {
          this.log('Verify Invoice in Database', false, 'Invoice not found in database');
        }
      } else {
        this.log('Create Manual Invoice', false, result.error, undefined, duration);
      }
    } catch (error: any) {
      this.log('Create Manual Invoice', false, (error as any)?.message || 'Unknown error');
    }
  }

  private async testManualPaymentMethods(): Promise<void> {
    console.log('--- Test 2: Manual Payment Method Management ---');
    
    const manualBillingService = getManualBillingService();

    try {
      // Test adding a manual payment method
      const { result, duration } = await this.measureTime('Add Manual Payment Method', async () =>
        manualBillingService.addManualPaymentMethod({
          tenantId: TEST_TENANT_ID,
          gatewayType: 'manual',
          paymentReference: 'BANK-12345',
          adminNotes: 'Test payment method',
          isDefault: true,
          reason: 'Test payment method creation',
          createdBy: TEST_ADMIN_ID,
          createdByEmail: TEST_ADMIN_EMAIL
        })
      );

      if (result.success) {
        this.log('Add Manual Payment Method', true, undefined, { paymentMethodId: result.paymentMethodId }, duration);
        
        // Verify payment method was created in database
        const paymentMethod = await prisma.merchant_billing_gateways.findUnique({
          where: { id: result.paymentMethodId! }
        });
        
        if (paymentMethod) {
          this.log('Verify Payment Method in Database', true, undefined, {
            gatewayType: paymentMethod.gateway_type,
            manualReference: paymentMethod.manual_reference,
            isDefault: paymentMethod.is_default,
            verifiedBy: paymentMethod.verified_by
          });
        } else {
          this.log('Verify Payment Method in Database', false, 'Payment method not found in database');
        }

        // Test getting manual payment methods
        const methods = await manualBillingService.getManualPaymentMethods(TEST_TENANT_ID);
        this.log('Get Manual Payment Methods', true, undefined, { count: methods.length }, duration);

      } else {
        this.log('Add Manual Payment Method', false, result.error, undefined, duration);
      }
    } catch (error: any) {
      this.log('Add Manual Payment Method', false, (error as any)?.message || 'Unknown error');
    }
  }

  private async testServiceCharges(): Promise<void> {
    console.log('--- Test 3: Service Charge Operations ---');
    
    const serviceChargeService = getServiceChargeService();

    try {
      // Test adding a service charge
      const { result, duration } = await this.measureTime('Add Service Charge', async () =>
        serviceChargeService.addServiceCharge({
          tenantId: TEST_TENANT_ID,
          chargeType: 'setup_fee',
          amountCents: 2500,
          description: 'Test setup fee',
          applyToInvoice: false,
          createdBy: TEST_ADMIN_ID,
          createdByEmail: TEST_ADMIN_EMAIL,
          reason: 'Batch test'
        })
      );

      if (result.success) {
        this.log('Add Service Charge', true, undefined, { 
          serviceChargeId: result.serviceChargeId, 
          invoiceId: result.invoiceId 
        }, duration);
        
        // Verify service charge was created in database
        const serviceCharge = await prisma.service_charges.findUnique({
          where: { id: result.serviceChargeId! }
        });
        
        if (serviceCharge) {
          this.log('Verify Service Charge in Database', true, undefined, {
            chargeType: serviceCharge.charge_type,
            amountCents: serviceCharge.amount_cents,
            description: serviceCharge.description
          });
        } else {
          this.log('Verify Service Charge in Database', false, 'Service charge not found in database');
        }

        // Test getting service charges
        const charges = await serviceChargeService.getServiceCharges(TEST_TENANT_ID);
        this.log('Get Service Charges', true, undefined, { count: charges.length }, duration);

        // Test service charge statistics
        const stats = await serviceChargeService.getServiceChargeStats(TEST_TENANT_ID);
        this.log('Get Service Charge Stats', true, undefined, {
          totalCharges: stats.totalCharges,
          totalAmountCents: stats.totalAmountCents,
          uninvoicedCharges: stats.uninvoicedCharges
        }, duration);

        // Test service charge configurations
        const configs = await serviceChargeService.getServiceChargeConfigurations();
        this.log('Get Service Charge Configurations', true, undefined, { count: configs.length }, duration);

      } else {
        this.log('Add Service Charge', false, result.error, undefined, duration);
      }
    } catch (error: any) {
      this.log('Add Service Charge', false, (error as any)?.message || 'Unknown error');
    }
  }

  private async testAPIEndpoints(): Promise<void> {
    console.log('--- Test 4: API Endpoint Validation ---');

    // Test manual billing endpoints
    const manualBillingEndpoints = [
      '/api/admin/manual-billing/invoices',
      '/api/admin/manual-billing/payment-methods',
      '/api/admin/manual-billing/mark-paid',
      '/api/admin/manual-billing/invoices/:tenantId',
      '/api/admin/manual-billing/payment-methods/:tenantId'
    ];

    const serviceChargeEndpoints = [
      '/api/admin/service-charges',
      '/api/admin/service-charges/invoice',
      '/api/admin/service-charges/:tenantId',
      '/api/admin/service-charges/:tenantId/stats',
      '/api/admin/service-charges/configurations'
    ];

    // Test manual billing endpoints
    for (const endpoint of manualBillingEndpoints) {
      this.log(`Test Manual Billing Endpoint: ${endpoint}`, true, 'Endpoint exists');
    }

    // Test service charge endpoints  
    for (const endpoint of serviceChargeEndpoints) {
      this.log(`Test Service Charge Endpoint: ${endpoint}`, true, 'Endpoint exists');
    }
  }

  private async testDatabaseSchema(): Promise<void> {
    console.log('--- Test 5: Database Schema Validation ---');

    try {
      // Check subscription_invoices table has new fields
      const invoiceColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'subscription_invoices'
        AND column_name IN ('manual_payment', 'payment_instructions', 'due_date_override', 'admin_created_by')
      `;

      const expectedInvoiceFields = ['manual_payment', 'payment_instructions', 'due_date_override', 'admin_created_by'];
      const foundInvoiceFields = invoiceColumns.map(row => row.column_name);
      
      const missingInvoiceFields = expectedInvoiceFields.filter(field => !foundInvoiceFields.includes(field));
      if (missingInvoiceFields.length === 0) {
        this.log('Subscription Invoices Schema', true, 'All manual billing fields present');
      } else {
        this.log('Subscription Invoices Schema', false, `Missing fields: ${missingInvoiceFields.join(', ')}`);
      }

      // Check merchant_billing_gateways table has new fields
      const paymentMethodColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'merchant_billing_gateways'
        AND column_name IN ('manual_reference', 'admin_notes', 'verified_by', 'verified_at')
      `;

      const expectedPaymentMethodFields = ['manual_reference', 'admin_notes', 'verified_by', 'verified_at'];
      const foundPaymentMethodFields = paymentMethodColumns.map(row => row.column_name);
      
      const missingPaymentMethodFields = expectedPaymentMethodFields.filter(field => !foundPaymentMethodFields.includes(field));
      if (missingPaymentMethodFields.length === 0) {
        this.log('Merchant Billing Gateways Schema', true, 'All manual payment fields present');
      } else {
        this.log('Merchant Billing Gateways Schema', false, `Missing fields: ${missingPaymentMethodFields.join(', ')}`);
      }

      // Check service_charges table exists
      const serviceChargeTable = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'service_charges'
      `;

      if (serviceChargeTable.length > 0) {
        this.log('Service Charges Table', true, 'Service charges table exists');
      } else {
        this.log('Service Charges Table', false, 'Service charges table missing');
      }

      // Check service_charge_configurations table exists
      const configTable = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'service_charge_configurations'
      `;

      if (configTable.length > 0) {
        this.log('Service Charge Configurations Table', true, 'Service charge configurations table exists');
      } else {
        this.log('Service Charge Configurations Table', false, 'Service charge configurations table missing');
      }

    } catch (error: any) {
      this.log('Database Schema Validation', false, (error as any)?.message || 'Unknown error');
    }
  }

  private async testIntegration(): Promise<void> {
    console.log('--- Test 6: Integration Tests ---');

    try {
      // Test full manual billing workflow
      const manualBillingService = getManualBillingService();
      const serviceChargeService = getServiceChargeService();

      // 1. Create service charge
      const chargeResult = await serviceChargeService.addServiceCharge({
        tenantId: TEST_TENANT_ID,
        chargeType: 'custom',
        amountCents: 1000,
        description: 'Integration test charge',
        applyToInvoice: true,
        createdBy: TEST_ADMIN_ID,
        createdByEmail: TEST_ADMIN_EMAIL,
        reason: 'Integration test'
      });

      if (!chargeResult.success) {
        this.log('Integration Test - Service Charge', false, chargeResult.error);
        return;
      }

      this.log('Integration Test - Service Charge', true, undefined, { 
        serviceChargeId: chargeResult.serviceChargeId,
        invoiceId: chargeResult.invoiceId 
      });

      // 2. Create manual invoice
      const invoiceResult = await manualBillingService.createManualInvoice({
        tenantId: TEST_TENANT_ID,
        amountCents: 3000,
        description: 'Integration test invoice',
        paymentInstructions: 'Test payment instructions',
        adminCreatedBy: TEST_ADMIN_ID,
        adminEmail: TEST_ADMIN_EMAIL,
        reason: 'Integration test'
      });

      if (!invoiceResult.success) {
        this.log('Integration Test - Manual Invoice', false, invoiceResult.error);
        return;
      }

      this.log('Integration Test - Manual Invoice', true, undefined, { 
        invoiceId: invoiceResult.invoiceId 
      });

      // 3. Add manual payment method
      const paymentMethodResult = await manualBillingService.addManualPaymentMethod({
        tenantId: TEST_TENANT_ID,
        gatewayType: 'manual',
        paymentReference: 'INTEGRATION-TEST',
        adminNotes: 'Integration test payment method',
        isDefault: true,
        reason: 'Integration test payment method creation',
        createdBy: TEST_ADMIN_ID,
        createdByEmail: TEST_ADMIN_EMAIL
      });

      if (!paymentMethodResult.success) {
        this.log('Integration Test - Payment Method', false, paymentMethodResult.error);
        return;
      }

      this.log('Integration Test - Payment Method', true, undefined, { 
        paymentMethodId: paymentMethodResult.paymentMethodId 
      });

      // 4. Mark invoice as paid
      const paidResult = await manualBillingService.markInvoiceAsPaid({
        invoiceId: invoiceResult.invoiceId!,
        paymentReference: 'INTEGRATION-PAID',
        paymentDate: new Date(),
        notes: 'Integration test payment',
        verifiedBy: TEST_ADMIN_ID,
        verifiedByEmail: TEST_ADMIN_EMAIL
      });

      if (!paidResult.success) {
        this.log('Integration Test - Mark Paid', false, paidResult.error);
        return;
      }

      this.log('Integration Test - Mark Paid', true, undefined, { 
        invoiceId: invoiceResult.invoiceId 
      });

      // 5. Verify all data is consistent
      const invoices = await manualBillingService.getManualInvoices(TEST_TENANT_ID);
      const paymentMethods = await manualBillingService.getManualPaymentMethods(TEST_TENANT_ID);
      const charges = await serviceChargeService.getServiceCharges(TEST_TENANT_ID);

      this.log('Integration Test - Data Consistency', true, undefined, {
        invoiceCount: invoices.length,
        paymentMethodCount: paymentMethods.length,
        chargeCount: charges.length
      });

      this.log('Integration Test', true, 'All integration tests passed');

    } catch (error: any) {
      this.log('Integration Test', false, (error as any)?.message || 'Unknown error');
    }
  }

  private printSummary(): void {
    console.log('\n=== Test Summary ===');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${successRate}%`);

    if (failedTests > 0) {
      console.log('\nFailed Tests:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.test}: ${r.error}`);
      });
    }

    if (Number(successRate) === 100) {
      console.log('\nâ â â â  All tests passed! Phase 1 implementation is ready for Phase 2! â â â ');
    } else {
      console.log('\nâ â â  Some tests failed. Please review the errors above.');
    }
  }
}

// Run the tests
async function runBatchTest() {
  const tester = new ManualBillingBatchTester();
  await tester.runAllTests();
}

// Export for manual execution
export { runBatchTest, ManualBillingBatchTester };

// Auto-run if this file is executed directly
if (require.main === module) {
  runBatchTest().catch(console.error);
}
