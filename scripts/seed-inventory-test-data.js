/**
 * Seed inventory test data for cross-location inventory system tests
 */

const axios = require('axios');

// Configuration
const API_BASE = 'http://localhost:4000/api/admin/inventory-transfers';
const TENANT_ID = 'tid-042hi7ju';
const AUTH0_EMAIL = 'yarlmoment@gmail.com';
const AUTH0_ID = 'google-oauth2|101197082777619041667';

// Test data - creating inventory pools for both tenants
const inventoryData = [
  {
    locationId: 'tid-042hi7ju', // African International Market
    sku: 'TEST-PRODUCT-001',
    totalQuantity: 100,
    availableQuantity: 75,
    reservedQuantity: 10,
    inTransitQuantity: 15,
    lowStockThreshold: 10,
    reorderPoint: 20,
    reorderQuantity: 50
  },
  {
    locationId: 'tid-8622qs2t', // Ivoire African Market
    sku: 'TEST-PRODUCT-001',
    totalQuantity: 50,
    availableQuantity: 45,
    reservedQuantity: 5,
    inTransitQuantity: 0,
    lowStockThreshold: 5,
    reorderPoint: 10,
    reorderQuantity: 25
  }
];

// Create API client with authentication
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-auth0-email': AUTH0_EMAIL,
    'x-auth0-id': AUTH0_ID
  }
});

async function seedInventoryData() {
  console.log('🌱 Seeding inventory test data...');
  
  try {
    // Create inventory pools using bulk update
    const response = await api.post('/inventory/bulk-update', {
      tenantId: TENANT_ID,
      updates: inventoryData
    });
    
    console.log('✅ Inventory data seeded successfully');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Failed to seed inventory data:', error.response?.data || error.message);
    return false;
  }
}

// Run the seeding
seedInventoryData().then(success => {
  if (success) {
    console.log('🎉 Test data is ready for inventory transfer tests');
  } else {
    console.log('⚠️  Failed to seed test data - tests may not work properly');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Seeding failed:', error);
  process.exit(1);
});
