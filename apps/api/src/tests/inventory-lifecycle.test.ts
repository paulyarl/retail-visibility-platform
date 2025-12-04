/**
 * Inventory Item Lifecycle Test Suite
 * 
 * Tests the complete lifecycle of inventory items through all CRUD operations
 * and status transitions. Critical for validating API functionality after
 * schema migrations and case transformation updates.
 * 
 * Run with: doppler run -- npx tsx src/tests/inventory-lifecycle.test.ts
 */

import { prisma } from '../prisma';

// Test configuration
const TEST_TENANT_ID = 't-alh0vrz9'; // Replace with your test tenant ID
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const TEST_USER_EMAIL = 'admin@rvp.com'; // Replace with your test user
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Admin123!'; // Set in Doppler

interface TestItem {
  id?: string;
  sku: string;
  name: string;
  brand: string;
  manufacturer?: string;
  price: number;
  stock: number;
  description: string;
  itemStatus?: 'active' | 'inactive' | 'archived';
  tenantId: string;
  tenantCategoryId?: string;
}

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];
let authToken: string | null = null;

// Helper to log test results
function logTest(test: string, passed: boolean, error?: string, duration?: number) {
  results.push({ test, passed, error, duration });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const time = duration ? ` (${duration}ms)` : '';
  console.log(`${status}: ${test}${time}`);
  if (error) console.error(`  Error: ${error}`);
}

// Helper to authenticate and get token
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
    
    console.log('✅ Authentication successful');
    return data.token || data.accessToken || null;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return null;
  }
}

// Helper to make API requests
async function apiRequest(method: string, path: string, body?: any, requireAuth = false): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add auth token if available and required
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
  
  // Handle 204 No Content responses (successful delete/purge)
  if (response.status === 204) {
    return { success: true };
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API Error (${response.status}): ${JSON.stringify(data)}`);
  }
  
  return data;
}

// Test 1: Create Item (camelCase fields)
async function testCreateItem(): Promise<string | null> {
  const start = Date.now();
  try {
    const testItem: TestItem = {
      sku: `TEST-${Date.now()}`,
      name: 'Test Product Lifecycle',
      brand: 'Test Brand',
      manufacturer: 'Test Manufacturer Inc.',
      price: 29.99,
      stock: 100,
      description: 'Test product for lifecycle validation',
      itemStatus: 'active',
      tenantId: TEST_TENANT_ID,
    };
    
    const created = await apiRequest('POST', '/api/items', testItem);
    
    // Validate response
    if (!created.id) throw new Error('No ID returned');
    if (created.sku !== testItem.sku) throw new Error('SKU mismatch');
    if (created.name !== testItem.name) throw new Error('Name mismatch');
    if (Math.abs(created.price - testItem.price) > 0.01) throw new Error('Price mismatch');
    if (created.stock !== testItem.stock) throw new Error('Stock mismatch');
    
    logTest('Create Item (POST /api/items)', true, undefined, Date.now() - start);
    return created.id;
  } catch (error) {
    logTest('Create Item (POST /api/items)', false, (error as Error).message, Date.now() - start);
    return null;
  }
}

// Test 2: Read Item (GET by ID)
async function testReadItem(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const item = await apiRequest('GET', `/api/items/${itemId}`);
    
    if (!item.id) throw new Error('No ID in response');
    if (item.id !== itemId) throw new Error('ID mismatch');
    
    logTest('Read Item (GET /api/items/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Read Item (GET /api/items/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 3: Update Item - Change Status to Inactive
async function testUpdateStatusInactive(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const updated = await apiRequest('PUT', `/api/items/${itemId}`, {
      itemStatus: 'inactive',
    });
    
    if (updated.item_status !== 'inactive') {
      throw new Error(`Expected inactive, got ${updated.item_status}`);
    }
    
    logTest('Update Status to Inactive (PUT /api/items/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Update Status to Inactive (PUT /api/items/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 4: Update Item - Change Status to Active
async function testUpdateStatusActive(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const updated = await apiRequest('PUT', `/api/items/${itemId}`, {
      itemStatus: 'active',
    });
    
    if (updated.item_status !== 'active') {
      throw new Error(`Expected active, got ${updated.item_status}`);
    }
    
    logTest('Update Status to Active (PUT /api/items/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Update Status to Active (PUT /api/items/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 5: Update Item - Change Stock
async function testUpdateStock(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const newStock = 50;
    const updated = await apiRequest('PUT', `/api/items/${itemId}`, {
      stock: newStock,
    });
    
    if (updated.stock !== newStock) {
      throw new Error(`Expected stock ${newStock}, got ${updated.stock}`);
    }
    
    // Should auto-sync availability
    if (updated.availability !== 'in_stock') {
      throw new Error(`Expected availability in_stock, got ${updated.availability}`);
    }
    
    logTest('Update Stock (PUT /api/items/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Update Stock (PUT /api/items/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 6: Update Item - Change Price
async function testUpdatePrice(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const newPrice = 39.99;
    const updated = await apiRequest('PUT', `/api/items/${itemId}`, {
      price: newPrice,
    });
    
    if (Math.abs(updated.price - newPrice) > 0.01) {
      throw new Error(`Expected price ${newPrice}, got ${updated.price}`);
    }
    
    // Should auto-sync price_cents
    const expectedCents = Math.round(newPrice * 100);
    // Note: price_cents is hidden from response, but should be synced in DB
    
    logTest('Update Price (PUT /api/items/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Update Price (PUT /api/items/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 7: Update Item - Multiple Fields
async function testUpdateMultipleFields(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const updates = {
      name: 'Updated Test Product',
      brand: 'Updated Brand',
      price: 49.99,
      stock: 75,
      description: 'Updated description',
    };
    
    const updated = await apiRequest('PUT', `/api/items/${itemId}`, updates);
    
    if (updated.name !== updates.name) throw new Error('Name not updated');
    if (updated.brand !== updates.brand) throw new Error('Brand not updated');
    if (Math.abs(updated.price - updates.price) > 0.01) throw new Error('Price not updated');
    if (updated.stock !== updates.stock) throw new Error('Stock not updated');
    if (updated.description !== updates.description) throw new Error('Description not updated');
    
    logTest('Update Multiple Fields (PUT /api/items/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Update Multiple Fields (PUT /api/items/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 8: Soft Delete - Move to Trash
async function testSoftDelete(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    await apiRequest('DELETE', `/api/items/${itemId}`, undefined, true);
    
    // Verify item is trashed in database
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
    });
    
    if (!item) throw new Error('Item not found in database');
    if (item.item_status !== 'trashed') {
      throw new Error(`Expected trashed status, got ${item.item_status}`);
    }
    
    logTest('Soft Delete to Trash (DELETE /api/items/:id)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Soft Delete to Trash (DELETE /api/items/:id)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 9: Restore from Trash
async function testRestoreFromTrash(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    const restored = await apiRequest('PATCH', `/api/items/${itemId}/restore`, undefined, true);
    
    if (restored.item_status !== 'active') {
      throw new Error(`Expected active status, got ${restored.item_status}`);
    }
    
    logTest('Restore from Trash (PATCH /api/items/:id/restore)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Restore from Trash (PATCH /api/items/:id/restore)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 10: Permanent Delete (Purge)
async function testPermanentDelete(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    // First move to trash
    await apiRequest('DELETE', `/api/items/${itemId}`, undefined, true);
    
    // Then purge
    await apiRequest('DELETE', `/api/items/${itemId}/purge`, undefined, true);
    
    // Verify item is gone from database
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
    });
    
    if (item) throw new Error('Item still exists in database after purge');
    
    logTest('Permanent Delete/Purge (DELETE /api/items/:id/purge)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Permanent Delete/Purge (DELETE /api/items/:id/purge)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 11: List Items (with filters)
async function testListItems(): Promise<boolean> {
  const start = Date.now();
  try {
    const response = await apiRequest('GET', `/api/items?tenant_id=${TEST_TENANT_ID}`, undefined, true);
    
    // Validate paginated response structure
    if (!response.items || !Array.isArray(response.items)) {
      throw new Error('Response does not contain items array');
    }
    if (!response.pagination) {
      throw new Error('Response does not contain pagination metadata');
    }
    
    // Validate pagination structure
    const { page, limit, totalItems, totalPages, hasMore } = response.pagination;
    if (typeof page !== 'number' || typeof limit !== 'number' || typeof totalItems !== 'number') {
      throw new Error('Invalid pagination structure');
    }
    
    logTest('List Items (GET /api/items)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('List Items (GET /api/items)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Test 12: Database Field Mapping Validation
async function testDatabaseFieldMapping(itemId: string): Promise<boolean> {
  const start = Date.now();
  try {
    // Fetch directly from database
    const dbItem = await prisma.inventory_items.findUnique({
      where: { id: itemId },
    });
    
    if (!dbItem) throw new Error('Item not found in database');
    
    // Verify snake_case fields exist in database
    if (dbItem.tenant_id !== TEST_TENANT_ID) throw new Error('tenant_id field mapping failed');
    if (typeof dbItem.item_status !== 'string') throw new Error('item_status field mapping failed');
    if (typeof dbItem.price_cents !== 'number') throw new Error('price_cents field mapping failed');
    
    logTest('Database Field Mapping (snake_case)', true, undefined, Date.now() - start);
    return true;
  } catch (error) {
    logTest('Database Field Mapping (snake_case)', false, (error as Error).message, Date.now() - start);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n🧪 Inventory Item Lifecycle Test Suite\n');
  console.log(`Testing against: ${API_BASE_URL}`);
  console.log(`Test Tenant: ${TEST_TENANT_ID}\n`);
  
  const startTime = Date.now();
  
  // Authenticate first
  authToken = await authenticate();
  if (!authToken) {
    console.error('\n❌ Failed to authenticate. Some tests will fail.');
    console.error('Set TEST_USER_PASSWORD in Doppler or environment variables.\n');
  }
  
  // Run lifecycle tests
  const itemId = await testCreateItem();
  
  if (itemId) {
    await testReadItem(itemId);
    await testDatabaseFieldMapping(itemId);
    await testUpdateStatusInactive(itemId);
    await testUpdateStatusActive(itemId);
    await testUpdateStock(itemId);
    await testUpdatePrice(itemId);
    await testUpdateMultipleFields(itemId);
    await testSoftDelete(itemId);
    await testRestoreFromTrash(itemId);
    await testPermanentDelete(itemId);
  }
  
  // Test list functionality
  await testListItems();
  
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
