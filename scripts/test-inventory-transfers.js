/**
 * Cross-Location Inventory System Test Script
 * 
 * Tests the complete inventory transfer workflow:
 * - Transfer initiation and approval
 * - Real-time inventory synchronization
 * - Location inventory pool management
 * - Low stock alerts and analytics
 */

const axios = require('axios');

// Configuration
const ADMIN_API_BASE = 'http://localhost:4000/api/admin/inventory-transfers';
const TENANT_API_BASE = 'http://localhost:4000/api/tenant/inventory-transfers';
const TENANT_ID = 'tid-042hi7ju';
const AUTH0_EMAIL = 'yarlmoment@gmail.com';
const AUTH0_ID = 'google-oauth2|101197082777619041667';

// Test data - using real tenant IDs as locations
const testData = {
  sourceLocationId: 'tid-042hi7ju', // African International Market
  targetLocationId: 'tid-8622qs2t', // Ivoire African Market
  sku: 'TEST-PRODUCT-001',
  quantity: 25,
  notes: 'Test transfer for cross-location inventory system'
};

// Create API clients with authentication
const adminApi = axios.create({
  baseURL: ADMIN_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-auth0-email': AUTH0_EMAIL,
    'x-auth0-id': AUTH0_ID
  }
});

const tenantApi = axios.create({
  baseURL: TENANT_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-auth0-email': AUTH0_EMAIL,
    'x-auth0-id': AUTH0_ID
  }
});

// Utility functions
const log = (message) => console.log(`\n🔹 ${message}`);
const logSuccess = (message) => console.log(`✅ ${message}`);
const logError = (message, error) => {
  console.log(`❌ ${message}`);
  if (error.response) {
    console.log('   Response:', error.response.data);
  } else {
    console.log('   Error:', error.message);
  }
};

// Test functions

async function testInitiateTransfer() {
  log('🚚 Test 1: Initiating Inventory Transfer');
  
  try {
    const response = await adminApi.post('/transfers/initiate', {
      sourceLocationId: testData.sourceLocationId,
      targetLocationId: testData.targetLocationId,
      sku: testData.sku,
      quantity: testData.quantity,
      notes: testData.notes
    }, {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    logSuccess('Transfer initiated successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to initiate transfer', error);
    return null;
  }
}

async function testGetTransfers() {
  log('📋 Test 2: Getting Inventory Transfers');
  
  try {
    const response = await tenantApi.get('/transfers', {
      params: {
        limit: 10,
        offset: 0
      },
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    logSuccess('Transfers retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get transfers', error);
    return null;
  }
}

async function testApproveTransfer() {
  log('✅ Test 3: Approving Transfer');
  
  try {
    // First initiate a transfer to approve
    const initiateResponse = await testInitiateTransfer();
    if (!initiateResponse || !initiateResponse.data) {
      logError('No transfer available to approve');
      return null;
    }
    
    const transferId = initiateResponse.data.id;
    
    const response = await adminApi.post(`/transfers/${transferId}/approve`, {
      notes: 'Admin approval for test transfer'
    });
    
    logSuccess('Transfer approved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to approve transfer', error);
    return null;
  }
}

async function testShipTransfer() {
  log('🚢 Test 4: Shipping Transfer');
  
  try {
    // First approve a transfer to ship
    const approveResponse = await testApproveTransfer();
    if (!approveResponse || !approveResponse.data) {
      logError('No approved transfer available to ship');
      return null;
    }
    
    const transferId = approveResponse.data.id;
    
    const response = await adminApi.post(`/transfers/${transferId}/ship`, {
      trackingNumber: 'TRK123456789',
      estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      notes: 'Shipped via standard delivery'
    });
    
    logSuccess('Transfer shipped successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to ship transfer', error);
    return null;
  }
}

async function testReceiveTransfer() {
  log('📦 Test 5: Receiving Transfer');
  
  try {
    // First ship a transfer to receive
    const shipResponse = await testShipTransfer();
    if (!shipResponse || !shipResponse.data) {
      logError('No shipped transfer available to receive');
      return null;
    }
    
    const transferId = shipResponse.data.id;
    
    const response = await adminApi.post(`/transfers/${transferId}/receive`, {
      actualQuantity: testData.quantity,
      notes: 'Received in good condition'
    });
    
    logSuccess('Transfer received successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to receive transfer', error);
    return null;
  }
}

async function testGetLocationInventory() {
  log('🏪 Test 6: Getting Location Inventory Pools');
  
  try {
    const response = await tenantApi.get(`/locations/${testData.sourceLocationId}/inventory`, {
      params: {
        limit: 50,
        offset: 0
      },
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    logSuccess('Location inventory retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get location inventory', error);
    return null;
  }
}

async function testGetSpecificInventoryPool() {
  log('🎯 Test 7: Getting Specific Inventory Pool');
  
  try {
    const response = await tenantApi.get(`/locations/${testData.sourceLocationId}/inventory/${testData.sku}`, {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    logSuccess('Specific inventory pool retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get specific inventory pool', error);
    return null;
  }
}

async function testGetLowStockAlerts() {
  log('⚠️ Test 8: Getting Low Stock Alerts');
  
  try {
    const response = await tenantApi.get('/alerts/low-stock', {
      params: {
        limit: 20,
        offset: 0
      },
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    logSuccess('Low stock alerts retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get low stock alerts', error);
    return null;
  }
}

async function testGetInventoryAnalytics() {
  log('📊 Test 9: Getting Inventory Analytics');
  
  try {
    const response = await tenantApi.get('/analytics/inventory', {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    logSuccess('Inventory analytics retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get inventory analytics', error);
    return null;
  }
}

async function testBulkInventoryUpdate() {
  log('🔄 Test 10: Bulk Inventory Update');
  
  try {
    const response = await adminApi.post('/inventory/bulk-update', {
      tenantId: TENANT_ID,
      updates: [
        {
          locationId: testData.sourceLocationId,
          sku: testData.sku,
          totalQuantity: 100,
          availableQuantity: 75,
          reservedQuantity: 10,
          inTransitQuantity: 15,
          lowStockThreshold: 5,
          reorderPoint: 10,
          reorderQuantity: 50
        },
        {
          locationId: testData.targetLocationId,
          sku: testData.sku,
          totalQuantity: 50,
          availableQuantity: 45,
          reservedQuantity: 5,
          inTransitQuantity: 0,
          lowStockThreshold: 5,
          reorderPoint: 10,
          reorderQuantity: 25
        }
      ]
    });
    
    logSuccess('Bulk inventory update successful');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to perform bulk inventory update', error);
    return null;
  }
}

async function testCancelTransfer() {
  log('❌ Test 11: Cancelling Transfer');
  
  try {
    // First initiate a transfer to cancel
    const initiateResponse = await testInitiateTransfer();
    if (!initiateResponse || !initiateResponse.data) {
      logError('No transfer available to cancel');
      return null;
    }
    
    const transferId = initiateResponse.data.id;
    
    const response = await adminApi.post(`/transfers/${transferId}/cancel`, {
      notes: 'Cancelled due to inventory shortage'
    });
    
    logSuccess('Transfer cancelled successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to cancel transfer', error);
    return null;
  }
}

// Check if API server is running
async function checkApiServer() {
  try {
    // Use the fulfillment stats endpoint as a health check
    await axios.get(`http://localhost:4000/api/fulfillment/stats/${TENANT_ID}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth0-email': AUTH0_EMAIL,
        'x-auth0-id': AUTH0_ID
      },
      validateStatus: (status) => status < 500 // Accept 4xx as server is running
    });
    return true;
  } catch (error) {
    // If we get a response, the server is running even if it's an error
    if (error.response) {
      return true;
    }
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Cross-Location Inventory System Tests');
  console.log('='.repeat(60));

  // Check if API server is running
  const serverRunning = await checkApiServer();
  if (!serverRunning) {
    console.log('❌ API server is not running. Please start the server first.');
    console.log('   Run: pnpm dev:api');
    return;
  }

  console.log('✅ API server is running');

  const tests = [
    testInitiateTransfer,
    testGetTransfers,
    testApproveTransfer,
    testShipTransfer,
    testReceiveTransfer,
    testGetLocationInventory,
    testGetSpecificInventoryPool,
    testGetLowStockAlerts,
    testGetInventoryAnalytics,
    testBulkInventoryUpdate,
    testCancelTransfer
  ];

  let successCount = 0;
  const totalCount = tests.length;

  for (let i = 0; i < tests.length; i++) {
    try {
      const result = await tests[i]();
      if (result) {
        successCount++;
      }
    } catch (error) {
      console.log(`❌ Test ${i + 1} failed with exception:`, error.message);
    }
  }

  console.log('\n✅ Cross-Location Inventory System Tests Complete!');
  console.log('='.repeat(60));
  console.log(`📊 Test Results: ${successCount}/${totalCount} passed`);
  
  if (successCount === totalCount) {
    console.log('🎉 All tests passed! Cross-Location Inventory System is working correctly.');
  } else {
    console.log('⚠️  Some tests failed - check API server and authentication');
  }

  console.log('\n🔧 Setup Requirements:');
  console.log('1. Start API server: pnpm dev:api');
  console.log('2. Ensure platform admin authentication is working');
  console.log('3. Verify database schema includes cross-location inventory tables');
  console.log('4. Check that InventoryTransferService is properly integrated');
}

// Run tests
runTests().catch(console.error);
