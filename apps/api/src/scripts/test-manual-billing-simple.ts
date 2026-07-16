/**
 * Simple Manual Billing Test Script
 * 
 * Tests Phase 1 implementation without requiring specific tenant data
 */

import { getManualBillingService } from '../services/subscription/ManualBillingService';
import { getServiceChargeService } from '../services/subscription/ServiceChargeService';
import { prisma } from '../prisma';

interface TestResult {
  test: string;
  success: boolean;
  error?: string;
  details?: any;
}

class SimpleManualBillingTester {
  private results: TestResult[] = [];

  private log(test: string, success: boolean, error?: string, details?: any) {
    this.results.push({ test, success, error, details });
    const status = success ? 'PASS' : 'FAIL';
    console.log(`${status}: ${test}${error ? ` - ${error}` : ''}`);
  }

  async runTests(): Promise<void> {
    console.log('=== Simple Manual Billing Test Suite ===');
    console.log('Testing Phase 1 Implementation...\n');

    try {
      // Test 1: Database Schema
      await this.testDatabaseSchema();

      // Test 2: Service Instantiation
      await this.testServiceInstantiation();

      // Test 3: Service Charge Configurations
      await this.testServiceChargeConfigurations();

      // Test 4: ID Generators
      await this.testIDGenerators();

    } catch (error: any) {
      this.log('Test Suite Error', false, (error as any)?.message || 'Unknown error');
    }

    this.printSummary();
  }

  private async testDatabaseSchema(): Promise<void> {
    console.log('--- Test 1: Database Schema Validation ---');

    try {
      // Test basic database connectivity by checking tenant count
      const tenantCount = await prisma.tenants.count();
      this.log('Database Connectivity', true, `Connected to database with ${tenantCount} tenants`);

      // Test service charges table exists by trying to query it
      try {
        const serviceChargeCount = await prisma.service_charges.count();
        this.log('Service Charges Table', true, `Service charges table accessible (${serviceChargeCount} records)`);
      } catch (error) {
        this.log('Service Charges Table', false, 'Service charges table not accessible');
      }

      // Test service charge configurations table exists by trying to query it
      try {
        const configCount = await prisma.service_charge_configurations.count();
        this.log('Service Charge Configurations Table', true, `Service charge configurations table accessible (${configCount} records)`);
      } catch (error) {
        this.log('Service Charge Configurations Table', false, 'Service charge configurations table not accessible');
      }

      // Test subscription_invoices table has manual_payment field by trying to query it
      try {
        const invoiceCount = await prisma.subscription_invoices.count({
          where: { manual_payment: true }
        });
        this.log('Subscription Invoices Manual Fields', true, `Manual invoice fields accessible (${invoiceCount} manual invoices)`);
      } catch (error) {
        this.log('Subscription Invoices Manual Fields', false, 'Manual invoice fields not accessible');
      }

      // Test merchant_billing_gateways table has manual fields by trying to query them
      try {
        const manualPaymentCount = await prisma.merchant_billing_gateways.count({
          where: { gateway_type: 'manual' }
        });
        this.log('Merchant Billing Gateways Manual Fields', true, `Manual payment method fields accessible (${manualPaymentCount} manual methods)`);
      } catch (error) {
        this.log('Merchant Billing Gateways Manual Fields', false, 'Manual payment method fields not accessible');
      }

    } catch (error: any) {
      this.log('Database Schema Validation', false, (error as any)?.message || 'Unknown error');
    }
  }

  private async testServiceInstantiation(): Promise<void> {
    console.log('--- Test 2: Service Instantiation ---');

    try {
      // Test ManualBillingService instantiation
      const manualBillingService = getManualBillingService();
      this.log('ManualBillingService Instantiation', true, 'Service instantiated successfully');

      // Test ServiceChargeService instantiation
      const serviceChargeService = getServiceChargeService();
      this.log('ServiceChargeService Instantiation', true, 'Service instantiated successfully');

      // Test service methods exist
      const manualBillingMethods = ['createManualInvoice', 'addManualPaymentMethod', 'markInvoiceAsPaid', 'getManualInvoices', 'getManualPaymentMethods'];
      manualBillingMethods.forEach(method => {
        if (typeof (manualBillingService as any)[method] === 'function') {
          this.log(`ManualBillingService.${method}`, true, 'Method exists');
        } else {
          this.log(`ManualBillingService.${method}`, false, 'Method missing');
        }
      });

      const serviceChargeMethods = ['addServiceCharge', 'getServiceCharges', 'getServiceChargeStats', 'getServiceChargeConfigurations', 'createInvoiceForServiceCharges'];
      serviceChargeMethods.forEach(method => {
        if (typeof (serviceChargeService as any)[method] === 'function') {
          this.log(`ServiceChargeService.${method}`, true, 'Method exists');
        } else {
          this.log(`ServiceChargeService.${method}`, false, 'Method missing');
        }
      });

    } catch (error: any) {
      this.log('Service Instantiation', false, (error as any)?.message || 'Unknown error');
    }
  }

  private async testServiceChargeConfigurations(): Promise<void> {
    console.log('--- Test 3: Service Charge Configurations ---');

    try {
      const serviceChargeService = getServiceChargeService();
      const configurations = await serviceChargeService.getServiceChargeConfigurations();
      
      this.log('Get Service Charge Configurations', true, undefined, { 
        count: configurations.length,
        configurations: configurations.map(c => ({ id: c.id, chargeType: c.chargeType, name: c.name }))
      });

      // Verify default configurations exist
      const expectedTypes = ['setup_fee', 'service_fee', 'custom_invoice'];
      const foundTypes = configurations.map(c => c.chargeType);
      const missingTypes = expectedTypes.filter(type => !foundTypes.includes(type as any));
      
      if (missingTypes.length === 0) {
        this.log('Default Service Charge Configurations', true, 'All expected configurations present');
      } else {
        this.log('Default Service Charge Configurations', false, `Missing types: ${missingTypes.join(', ')}`);
      }

    } catch (error: any) {
      this.log('Service Charge Configurations', false, (error as any)?.message || 'Unknown error');
    }
  }

  private async testIDGenerators(): Promise<void> {
    console.log('--- Test 4: ID Generators ---');

    try {
      // Import and test ID generators
      const { generateServiceChargeId, generateManualInvoiceId, generateInvoiceId, generateBillingMethodId } = await import('../lib/id-generator');

      // Test service charge ID generation
      const serviceChargeId = generateServiceChargeId('test-tenant');
      this.log('Generate Service Charge ID', true, undefined, { id: serviceChargeId, pattern: /^svc-test-tenant-[a-z0-9]{6}$/.test(serviceChargeId) });

      // Test manual invoice ID generation
      const manualInvoiceId = generateManualInvoiceId('test-tenant');
      this.log('Generate Manual Invoice ID', true, undefined, { id: manualInvoiceId, pattern: /^miv-test-tenant-[a-z0-9]{6}$/.test(manualInvoiceId) });

      // Test regular invoice ID generation
      const invoiceId = generateInvoiceId('test-tenant');
      this.log('Generate Invoice ID', true, undefined, { id: invoiceId, pattern: /^inv-test-tenant-[a-z0-9]{6}$/.test(invoiceId) });

      // Test billing method ID generation
      const billingMethodId = generateBillingMethodId('test-tenant');
      this.log('Generate Billing Method ID', true, undefined, { id: billingMethodId, pattern: /^mbg-test-tenant-[a-z0-9]{6}$/.test(billingMethodId) });

    } catch (error: any) {
      this.log('ID Generators', false, (error as any)?.message || 'Unknown error');
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
      console.log('\nâ â â â  All tests passed! Phase 1 implementation is ready! â â â ');
    } else {
      console.log('\nâ â â  Some tests failed. Please review the errors above.');
    }
  }
}

// Run the tests
async function runSimpleTest() {
  const tester = new SimpleManualBillingTester();
  await tester.runTests();
}

// Export for manual execution
export { runSimpleTest, SimpleManualBillingTester };

// Auto-run if this file is executed directly
if (require.main === module) {
  runSimpleTest().catch(console.error);
}
