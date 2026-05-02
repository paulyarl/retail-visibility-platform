#!/usr/bin/env node

/**
 * Fulfillment API Test Script
 * Comprehensive testing of all fulfillment coordination endpoints
 */

const axios = require('axios');

// Configuration
const API_BASE = 'http://localhost:4000/api/fulfillment';
const ORDERS_API_BASE = 'http://localhost:4000/api/orders';
const CUSTOMER_API_BASE = 'http://localhost:4000/api/customers';
const TENANT_ID = 'tid-042hi7ju'; // Replace with actual tenant ID
const ORGANIZATION_ID = 'org-KQJ4OXF3'; // Replace with actual organization ID

// Test data storage
let testData = {
  timeSlotId: null,
  customerId: null,
  orderId: null, // Will be set after order creation
  auth0Email: 'yarlmoment@gmail.com', // Replace with actual Auth0 email
  auth0Id: 'google-oauth2|101197082777619041667' // Replace with actual Auth0 ID
};

// Axios instance with Auth0 auth
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-auth0-email': testData.auth0Email,
    'x-auth0-id': testData.auth0Id
  }
});

const customerApi = axios.create({
  baseURL: CUSTOMER_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-auth0-email': testData.auth0Email,
    'x-auth0-id': testData.auth0Id
  }
});

const ordersApi = axios.create({
  baseURL: ORDERS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-auth0-email': testData.auth0Email,
    'x-auth0-id': testData.auth0Id
  }
});

// Utility functions
const log = (message, data = null) => {
  console.log(`\n🔹 ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  console.log(`\n❌ ${message}`);
  if (error.response) {
    console.log(`Status: ${error.response.status}`);
    console.log(`Data:`, error.response.data);
  } else {
    console.log(error.message);
  }
};

const logSuccess = (message) => {
  console.log(`\n✅ ${message}`);
};

// Test functions
async function testCreateTimeSlots() {
  log('📅 Test 1: Creating Time Slots');
  
  try {
    const response = await api.post(`/time-slots/${TENANT_ID}`, {
      timeSlots: [
        {
          date: '2026-05-02T00:00:00.000Z',
          startTime: '09:00',
          endTime: '09:30',
          maxOrders: 4,
          isActive: true,
          fulfillmentMethod: 'pickup'
        },
        {
          date: '2026-05-02T00:00:00.000Z',
          startTime: '10:00',
          endTime: '10:30',
          maxOrders: 4,
          isActive: true,
          fulfillmentMethod: 'pickup'
        }
      ]
    });
    
    testData.timeSlotId = response.data.timeSlots?.[0]?.id;
    logSuccess('Time slots created successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to create time slots', error);
    return null;
  }
}

async function testGetAvailableTimeSlots() {
  log('⏰ Test 2: Getting Available Time Slots');
  
  try {
    const response = await api.get('/time-slots/available', {
      params: {
        tenantId: TENANT_ID,
        date: '2026-05-02',
        fulfillmentMethod: 'pickup'
      }
    });
    
    logSuccess('Available time slots retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get available time slots', error);
    return null;
  }
}

async function testGetLocationStats() {
  log('📊 Test 3: Getting Location Fulfillment Stats');
  
  try {
    const response = await api.get(`/stats/${TENANT_ID}`);
    
    logSuccess('Location stats retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get location stats', error);
    return null;
  }
}

async function testCreateCustomer() {
  log('👤 Test 4: Creating Test Customer');
  
  try {
    const response = await customerApi.post('/', {
      email: 'test.customer@example.com',
      firstName: 'Test',
      lastName: 'Customer',
      phone: '+1234567890'
    });
    
    testData.customerId = response.data.data?.id;
    logSuccess('Customer created successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to create customer', error);
    return null;
  }
}

async function testCreateOrder() {
  log('🛒 Test 5: Creating Test Order');
  
  try {
    const response = await ordersApi.post('/', {
      tenant_id: TENANT_ID,
      customer: {
        email: 'test.customer@example.com',
        first_name: 'Test',
        last_name: 'Customer',
        phone: '+1234567890'
      },
      items: [
        {
          variant_id: null,
          sku: 'TEST-PRODUCT-123',
          name: 'Test Product',
          description: 'Test product for fulfillment scheduling',
          quantity: 1,
          unit_price_cents: 999, // $9.99 in cents
          image_url: null
        }
      ],
      shipping_address: {
        street: '123 Test St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      },
      notes: 'Test order for fulfillment scheduling',
      source: 'api_test'
    });
    
    testData.orderId = response.data.order?.id;
    logSuccess('Order created successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to create order', error);
    return null;
  }
}

async function testScheduleFulfillment() {
  log('📦 Test 6: Scheduling Fulfillment');
  
  if (!testData.timeSlotId) {
    logError('Cannot schedule fulfillment - no time slot ID available');
    return null;
  }
  
  if (!testData.orderId) {
    logError('Cannot schedule fulfillment - no order ID available');
    return null;
  }
  
  try {
    const response = await api.post(`/schedule/${testData.orderId}`, {
      tenantId: TENANT_ID,
      timeSlotId: testData.timeSlotId,
      scheduledDate: '2026-05-02T00:00:00.000Z',
      scheduledTime: '09:00',
      fulfillmentMethod: 'pickup',
      notes: 'Test fulfillment scheduling'
    });
    
    logSuccess('Fulfillment scheduled successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to schedule fulfillment', error);
    return null;
  }
}

async function testGetLocationSchedules() {
  log('📋 Test 7: Getting Location Schedules');
  
  try {
    const response = await api.get(`/schedules/${TENANT_ID}`, {
      params: {
        limit: 10,
        offset: 0
      }
    });
    
    logSuccess('Location schedules retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get location schedules', error);
    return null;
  }
}

async function testCreateNotification() {
  log('🔔 Test 8: Creating Notification');
  
  if (!testData.customerId) {
    logError('Cannot create notification - no customer ID available');
    return null;
  }
  
  if (!testData.orderId) {
    logError('Cannot create notification - no order ID available');
    return null;
  }
  
  try {
    const response = await api.post('/notifications', {
      orderId: testData.orderId,
      customerId: testData.customerId,
      type: 'ready_for_pickup',
      channel: 'email',
      content: 'Your order is ready for pickup!',
      scheduledAt: '2026-05-02T08:00:00Z'
    });
    
    logSuccess('Notification created successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to create notification', error);
    return null;
  }
}

async function testGetTenantCustomers() {
  log('👥 Test 9: Getting Tenant Customers');
  
  try {
    const response = await customerApi.get(`/tenant/${TENANT_ID}`, {
      params: {
        limit: 10,
        offset: 0
      }
    });
    
    logSuccess('Tenant customers retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get tenant customers', error);
    return null;
  }
}

async function testUpdateScheduleStatus() {
  log('🔄 Test 10: Updating Schedule Status');
  
  if (!testData.orderId) {
    logError('Cannot update schedule status - no order ID available');
    return null;
  }
  
  try {
    const response = await api.put(`/schedule/${testData.orderId}/status`, {
      status: 'completed',
      notes: 'Order successfully picked up'
    });
    
    logSuccess('Schedule status updated successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to update schedule status', error);
    return null;
  }
}

async function testGetAllTimeSlots() {
  log('📅 Test 11: Getting All Time Slots for Tenant');
  
  try {
    const response = await api.get(`/time-slots/${TENANT_ID}`, {
      params: {
        date: '2026-05-02'
      }
    });
    
    logSuccess('All time slots retrieved successfully');
    log('Response:', response.data);
    return response.data;
  } catch (error) {
    logError('Failed to get all time slots', error);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Fulfillment API Tests');
  console.log('==================================');
  
  const results = [];
  
  // Run all tests
  results.push(await testCreateTimeSlots());
  results.push(await testGetAvailableTimeSlots());
  results.push(await testGetLocationStats());
  results.push(await testCreateCustomer());
  results.push(await testCreateOrder());
  results.push(await testScheduleFulfillment());
  results.push(await testGetLocationSchedules());
  results.push(await testCreateNotification());
  results.push(await testGetTenantCustomers());
  results.push(await testUpdateScheduleStatus());
  results.push(await testGetAllTimeSlots());
  
  // Summary
  console.log('\n✅ Fulfillment API Tests Complete!');
  console.log('==================================');
  
  const successCount = results.filter(r => r !== null).length;
  const totalCount = results.length;
  
  console.log(`\n📊 Test Results: ${successCount}/${totalCount} passed`);
  console.log('\n🔧 Setup Requirements:');
  console.log('1. Start API server: pnpm dev:api');
  console.log('2. Replace auth0Email and auth0Id with your Auth0 credentials');
  console.log('3. Replace TENANT_ID with actual tenant ID');
  console.log('4. Create test order for scheduling tests');
  
  if (successCount < totalCount) {
    console.log('\n⚠️  Some tests failed - check API server and authentication');
  }
}

// Check if API server is running
async function checkApiServer() {
  try {
    // Try to get stats as a simple health check
    await api.get('/stats/test', { 
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

// Run tests if API server is available
async function main() {
  const serverRunning = await checkApiServer();
  
  if (!serverRunning) {
    console.log('❌ API server is not running on port 4000');
    console.log('Please start the server with: pnpm dev:api');
    process.exit(1);
  }
  
  if (testData.auth0Email === 'yarlmoment@gmail.com' || testData.auth0Id === 'google-oauth2|101197082777619041667') {
    console.log('⚠️  Warning: Using placeholder Auth0 credentials');
    console.log('Update testData.auth0Email and testData.auth0Id in the script for authenticated tests');
  }
  
  await runTests();
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runTests,
  testData
};
