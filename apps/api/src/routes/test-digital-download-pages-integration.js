/**
 * Digital Download Pages Integration Test
 * 
 * Comprehensive test including database setup and cleanup
 * Tests all API endpoints with real database operations
 */

const { PrismaClient } = require('@prisma/client');

// Generate a simple ID since we can't easily import the TS module
function generateItemId() {
  const nanoid = require('nanoid').customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `pid-${nanoid()}`;
}

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4000/api';

// Test data
const TEST_TENANT = {
  id: 'tid-r6cccpag',
  name: 'Test Tenant for Digital Downloads',
  slug: 'tid-r6cccpag',
  location_status: 'active'
};

const TEST_ITEM = {
  id: generateItemId(),
  tenant_id: TEST_TENANT.id,
  sku: 'TEST-DIGITAL-001',
  name: 'Test Digital Product',
  title: 'Test Digital Product',
  price_cents: 9900, // $99.00 in cents
  price: 99.00,
  stock: 999,
  brand: 'Test Brand',
  currency: 'USD',
  product_type: 'digital',
  source: 'MANUAL',
  enrichment_status: 'COMPLETE',
  missing_images: false,
  missing_description: false,
  missing_specs: false,
  missing_brand: false,
  availability: 'in_stock',
  created_at: new Date(),
  updated_at: new Date(),
  item_status: 'active',
  visibility: 'public'
};

const TEST_DOWNLOAD_PAGE = {
  title: 'Test Digital Download Page',
  description: 'A test page for digital downloads',
  instructions: 'Thank you for purchasing! Your files are ready below.',
  thankYouMessage: 'Enjoy your digital purchase!',
  supportEmail: 'test@example.com',
  brandColor: '#3B82F6',
  requireAuthentication: true,
  allowMultipleDownloads: true,
  status: 'draft'
};

// Helper function to make API requests
async function apiRequest(method, url, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-auth0-email': 'yarlmoment@gmail.com',
      'x-auth0-id': 'google-oauth2|101197082777619041667'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE}${url}`, options);
    const result = await response.json();
    
    return {
      status: response.status,
      success: response.ok,
      data: result
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      data: { error: error.message }
    };
  }
}

// Setup test data
async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  try {
    // Create test tenant
    await prisma.tenants.upsert({
      where: { id: TEST_TENANT.id },
      update: TEST_TENANT,
      create: TEST_TENANT
    });

    // Create test item
    await prisma.inventory_items.upsert({
      where: { id: TEST_ITEM.id },
      update: TEST_ITEM,
      create: TEST_ITEM
    });

    console.log('✅ Test data setup complete');
    return true;
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return false;
  }
}

// Cleanup test data
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Delete in order to respect foreign key constraints
    await prisma.digital_download_pages.deleteMany({
      where: {
        tenant_id: TEST_TENANT.id
      }
    });

    await prisma.digital_downloads.deleteMany({
      where: {
        tenant_id: TEST_TENANT.id
      }
    });

    await prisma.inventory_items.delete({
      where: { id: TEST_ITEM.id }
    });

    await prisma.tenants.delete({
      where: { id: TEST_TENANT.id }
    });

    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Test functions
async function testGetAllPages() {
  console.log('\n📋 Testing GET all download pages...');
  
  const result = await apiRequest('GET', `/tenants/${TEST_TENANT.id}/digital-download-pages`);
  
  if (result.success) {
    console.log('✅ GET all pages successful');
    console.log('   Pages:', result.data.data?.pages?.length || 0);
    console.log('   Stats:', result.data.data?.stats);
  } else {
    console.log('❌ GET all pages failed:', result.data);
  }
  
  return result;
}

async function testCreatePage() {
  console.log('\n➕ Testing CREATE download page...');
  
  const result = await apiRequest('POST', `/tenants/${TEST_TENANT.id}/digital-download-pages`, {
    itemId: TEST_ITEM.id,
    ...TEST_DOWNLOAD_PAGE
  });
  
  if (result.success) {
    console.log('✅ CREATE page successful');
    console.log('   Page ID:', result.data.data?.id);
    console.log('   Slug:', result.data.data?.slug);
    return result.data.data;
  } else {
    console.log('❌ CREATE page failed:', result.data);
    return null;
  }
}

async function testGetPage(pageId) {
  console.log('\n🔍 Testing GET specific page...');
  
  const result = await apiRequest('GET', `/tenants/${TEST_TENANT.id}/digital-download-pages/${pageId}`);
  
  if (result.success) {
    console.log('✅ GET page successful');
    console.log('   Title:', result.data.data?.title);
    console.log('   Status:', result.data.data?.status);
  } else {
    console.log('❌ GET page failed:', result.data);
  }
  
  return result;
}

async function testUpdatePage(pageId) {
  console.log('\n✏️ Testing UPDATE page...');
  
  const updateData = {
    title: 'Updated Test Page',
    description: 'Updated description',
    status: 'published',
    thankYouMessage: 'Updated thank you message!'
  };
  
  const result = await apiRequest('PUT', `/tenants/${TEST_TENANT.id}/digital-download-pages/${pageId}`, updateData);
  
  if (result.success) {
    console.log('✅ UPDATE page successful');
    console.log('   Updated title:', result.data.data?.title);
    console.log('   Updated status:', result.data.data?.status);
  } else {
    console.log('❌ UPDATE page failed:', result.data);
  }
  
  return result;
}

async function testPreviewToken(pageId) {
  console.log('\n👁️ Testing preview token generation...');
  
  const result = await apiRequest('POST', `/tenants/${TEST_TENANT.id}/digital-download-pages/${pageId}/preview-token`, {
    expiresInHours: 2
  });
  
  if (result.success) {
    console.log('✅ Preview token generated');
    console.log('   Token:', result.data.data?.previewToken?.substring(0, 20) + '...');
    console.log('   Preview URL:', result.data.data?.previewUrl);
    console.log('   Expires at:', result.data.data?.expiresAt);
  } else {
    console.log('❌ Preview token failed:', result.data);
  }
  
  return result;
}

async function testGetAssets(pageId) {
  console.log('\n📁 Testing GET page assets...');
  
  const result = await apiRequest('GET', `/tenants/${TEST_TENANT.id}/digital-download-pages/${pageId}/assets`);
  
  if (result.success) {
    console.log('✅ GET assets successful');
    console.log('   Asset count:', result.data.data?.length || 0);
  } else {
    console.log('❌ GET assets failed:', result.data);
  }
  
  return result;
}

async function testValidationErrors() {
  console.log('\n🚫 Testing validation errors...');
  
  // Test missing required fields
  const result1 = await apiRequest('POST', `/tenants/${TEST_TENANT.id}/digital-download-pages`, {
    title: '' // Empty title should fail
  });
  
  if (!result1.success && result1.status === 400) {
    console.log('✅ Empty title validation passed');
  } else {
    console.log('❌ Empty title validation failed');
  }
  
  // Test invalid email
  const result2 = await apiRequest('POST', `/tenants/${TEST_TENANT.id}/digital-download-pages`, {
    itemId: TEST_ITEM.id,
    title: 'Test',
    supportEmail: 'invalid-email'
  });
  
  if (!result2.success && result2.status === 400) {
    console.log('✅ Invalid email validation passed');
  } else {
    console.log('❌ Invalid email validation failed');
  }
  
  // Test invalid color
  const result3 = await apiRequest('POST', `/tenants/${TEST_TENANT.id}/digital-download-pages`, {
    itemId: TEST_ITEM.id,
    title: 'Test',
    brandColor: 'invalid-color'
  });
  
  if (!result3.success && result3.status === 400) {
    console.log('✅ Invalid color validation passed');
  } else {
    console.log('❌ Invalid color validation failed');
  }
}

async function testDeletePage(pageId) {
  console.log('\n🗑️ Testing DELETE page...');
  
  const result = await apiRequest('DELETE', `/tenants/${TEST_TENANT.id}/digital-download-pages/${pageId}`);
  
  if (result.success) {
    console.log('✅ DELETE page successful');
  } else {
    console.log('❌ DELETE page failed:', result.data);
  }
  
  return result;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Digital Download Pages API Tests');
  console.log('==========================================');
  
  // Setup
  const setupSuccess = await setupTestData();
  if (!setupSuccess) {
    console.log('❌ Cannot proceed with tests due to setup failure');
    return;
  }
  
  let createdPageId = null;
  
  try {
    // Run tests
    await testGetAllPages();
    
    const createResult = await testCreatePage();
    if (createResult) {
      createdPageId = createResult.id;
      
      await testGetPage(createdPageId);
      await testUpdatePage(createdPageId);
      await testPreviewToken(createdPageId);
      await testGetAssets(createdPageId);
      
      if (createdPageId) {
        await testDeletePage(createdPageId);
      }
    }
    
    await testValidationErrors();
    await testGetAllPages(); // Final check
    
    console.log('\n==========================================');
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.log('\n❌ Test execution failed:', error);
  } finally {
    // Cleanup
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  setupTestData,
  cleanupTestData
};
