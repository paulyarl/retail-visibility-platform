/**
 * Location (Tenant) Lifecycle Test Suite - Standalone Version
 * 
 * Tests the complete lifecycle of tenant/location management including:
 * - Tenant creation
 * - Status transitions (active/inactive/archived)
 * - Tenant updates
 * - Access control
 * - Soft delete (archive)
 * 
 * Run with: doppler run -- npx tsx src/tests/location-lifecycle-standalone.test.ts
 */

import { prisma } from '../prisma';

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const TEST_USER_EMAIL = 'admin@rvp.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Admin123!';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];
let authToken: string | null = null;
let testTenantId: string | null = null;

// Helper to log test results
function logTest(test: string, passed: boolean, error?: string, duration?: number) {
  results.push({ test, passed, error, duration });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const time = duration ? ` (${duration}ms)` : '';
  console.log(`${status}: ${test}${time}`);
  if (error) console.error(`  Error: ${error}`);
}

// Helper to authenticate
async function authenticate(): Promise<string | null> {
  try {
    console.log('🔐 Authenticating...');
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Authentication failed:', data);
      return null;
    }
    
    console.log('✅ Authentication successful\n');
    return data.token || data.accessToken || null;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return null;
  }
}

// Helper to make API requests
async function apiRequest(method: string, path: string, body?: any, requireAuth = true): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (requireAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  // Handle 204 No Content
  if (response.status === 204) {
    return { success: true };
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API Error (${response.status}): ${JSON.stringify(data)}`);
  }
  
  return data;
}

// Test 1: Create Tenant
async function testCreateTenant(): Promise<string | null> {
  const start = Date.now();
  try {
    const testTenant = {
      name: `Test Location ${Date.now()}`,
      slug: `test-loc-${Date.now()}`,
      description: 'Test location for lifecycle validation',
      subscriptionTier: 'STARTER',
    };
    
    const created = await apiRequest('POST', '/api/tenants', testTenant);
    
    if (!created.id) throw new Error('No ID returned');
    if (created.name !== testTenant.name) throw new Error('Name mismatch');
    
    logTest('Create Tenant (POST /api/tenants)', true, undefined, Date.now() - start);
    return created.id;
  } catch (error) {
    logTest('Create Tenant (POST /api/tenants)', false, (error as Error).message, Date.now() - start);
    return null;
  }
}

// Test 2: Read Tenant
async function testReadTenant(tenantId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const tenant = await apiRequest('GET', `/api/tenants/${tenantId}`);
    
    if (!tenant.id) throw new Error('No ID in response');
    if (tenant.id !== tenantId) throw new Error('ID mismatch');
    
    logTest('Read Tenant (GET /api/tenants/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Read Tenant (GET /api/tenants/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 3: Update Tenant Name
async function testUpdateTenant(tenantId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const updated = await apiRequest('PUT', `/api/tenants/${tenantId}`, {
      name: 'Updated Test Location',
      description: 'Updated description for testing',
    });
    
    if (updated.name !== 'Updated Test Location') {
      throw new Error('Name not updated');
    }
    
    logTest('Update Tenant (PUT /api/tenants/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Update Tenant (PUT /api/tenants/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 4: Change Status to Inactive
async function testSetInactive(tenantId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const updated = await apiRequest('PATCH', `/api/tenants/${tenantId}/status`, {
      status: 'inactive',
      reason: 'Testing status transition',
    });
    
    if (updated.locationStatus !== 'inactive' && updated.location_status !== 'inactive') {
      throw new Error(`Expected inactive status, got ${updated.locationStatus || updated.location_status}`);
    }
    
    logTest('Set Status to Inactive (PATCH /api/tenants/:id/status)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Set Status to Inactive (PATCH /api/tenants/:id/status)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 5: Change Status Back to Active
async function testSetActive(tenantId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const updated = await apiRequest('PATCH', `/api/tenants/${tenantId}/status`, {
      status: 'active',
      reason: 'Reactivating for testing',
    });
    
    if (updated.locationStatus !== 'active' && updated.location_status !== 'active') {
      throw new Error(`Expected active status, got ${updated.locationStatus || updated.location_status}`);
    }
    
    logTest('Set Status to Active (PATCH /api/tenants/:id/status)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Set Status to Active (PATCH /api/tenants/:id/status)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 6: Archive Tenant (Soft Delete)
async function testArchiveTenant(tenantId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const updated = await apiRequest('PATCH', `/api/tenants/${tenantId}/status`, {
      status: 'archived',
      reason: 'Archiving for testing',
    });
    
    if (updated.locationStatus !== 'archived' && updated.location_status !== 'archived') {
      throw new Error(`Expected archived status, got ${updated.locationStatus || updated.location_status}`);
    }
    
    logTest('Archive Tenant (PATCH /api/tenants/:id/status)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Archive Tenant (PATCH /api/tenants/:id/status)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 7: Verify Archived in Database
async function testVerifyArchived(tenantId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant) throw new Error('Tenant not found in database');
    if (tenant.location_status !== 'archived') {
      throw new Error(`Expected archived in DB, got ${tenant.location_status}`);
    }
    
    logTest('Verify Archived in Database', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Verify Archived in Database', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 8: List Tenants (Exclude Archived by Default)
async function testListTenants(): Promise<boolean> {
  const start = Date.now();
  try {
    const tenants = await apiRequest('GET', '/api/tenants');
    
    if (!Array.isArray(tenants)) {
      throw new Error('Response is not an array');
    }
    
    // Verify no archived tenants in default list
    const archivedCount = tenants.filter((t: any) => 
      t.locationStatus === 'archived' || t.location_status === 'archived'
    ).length;
    
    if (archivedCount > 0) {
      throw new Error(`Found ${archivedCount} archived tenants in default list`);
    }
    
    logTest('List Tenants (GET /api/tenants)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('List Tenants (GET /api/tenants)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 9: List Tenants Including Archived
async function testListTenantsWithArchived(): Promise<boolean> {
  const start = Date.now();
  try {
    const tenants = await apiRequest('GET', '/api/tenants?includeArchived=true');
    
    if (!Array.isArray(tenants)) {
      throw new Error('Response is not an array');
    }
    
    logTest('List Tenants with Archived (GET /api/tenants?includeArchived=true)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('List Tenants with Archived (GET /api/tenants?includeArchived=true)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 10: Cleanup - Delete Test Tenant
async function testCleanup(tenantId: string): Promise<boolean> {
  const start = Date.now();
  try {
    // Permanently delete the test tenant from database
    await prisma.tenants.delete({
      where: { id: tenantId },
    });
    
    // Verify deletion
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });
    
    if (tenant) throw new Error('Tenant still exists after deletion');
    
    logTest('Cleanup - Delete Test Tenant', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Cleanup - Delete Test Tenant', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n🧪 Location (Tenant) Lifecycle Test Suite\n');
  console.log(`Testing against: ${API_BASE_URL}\n`);
  
  const startTime = Date.now();
  
  // Authenticate
  authToken = await authenticate();
  if (!authToken) {
    console.error('\n❌ Failed to authenticate. Tests cannot proceed.');
    process.exit(1);
  }
  
  // Run tests
  testTenantId = await testCreateTenant();
  
  if (testTenantId) {
    await testReadTenant(testTenantId);
    await testUpdateTenant(testTenantId);
    await testSetInactive(testTenantId);
    await testSetActive(testTenantId);
    await testArchiveTenant(testTenantId);
    await testVerifyArchived(testTenantId);
    await testListTenants();
    await testListTenantsWithArchived();
    await testCleanup(testTenantId);
  }
  
  // Summary
  const totalTime = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}`);
      if (r.error) console.log(`    ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
