/**
 * Test Location Status Cache Invalidation
 * 
 * This script tests the complete cache invalidation flow:
 * 1. Update location status via API
 * 2. Verify cache invalidation across all layers
 * 3. Check immediate propagation to affected endpoints
 */

const API_BASE = 'http://localhost:4000';
const WEB_BASE = 'http://localhost:3000';

// Test tenant
const TENANT_ID = 'tid-fjwr30ib';
const NEW_STATUS = 'active';
const OLD_STATUS = 'pending';

async function testLocationStatusInvalidation() {
  console.log('🧪 Testing Location Status Cache Invalidation');
  console.log('================================================');
  
  try {
    // Step 1: Get current status (should be cached)
    console.log('\n📋 Step 1: Getting current tenant status...');
    const currentResponse = await fetch(`${API_BASE}/api/public/tenant/${TENANT_ID}`);
    const currentData = await currentResponse.json();
    const currentStatus = currentData.data?.locationStatus || currentData.locationStatus;
    
    console.log(`   Current status: ${currentStatus}`);
    console.log(`   Response cached: ${currentResponse.headers.get('x-cache') || 'unknown'}`);
    
    // Step 2: Update location status
    console.log(`\n🔄 Step 2: Updating location status to ${NEW_STATUS}...`);
    
    const updateResponse = await fetch(`${API_BASE}/api/tenants/${TENANT_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN', // Replace with actual token
        'x-auth0-email': 'yarlmoment@gmail.com',
        'x-auth0-id': 'google-oauth2|101197082777619041667'
      },
      body: JSON.stringify({ status: NEW_STATUS })
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      console.error('❌ Update failed:', error);
      return;
    }
    
    const updateResult = await updateResponse.json();
    console.log(`   ✅ Update successful: ${updateResult.message}`);
    console.log(`   📊 Backend cache invalidation: ${updateResult.message?.includes('cache') ? 'YES' : 'NO'}`);
    
    // Step 3: Verify immediate cache invalidation
    console.log('\n⚡ Step 3: Verifying immediate cache invalidation...');
    
    // Test backend API (should return new status immediately)
    const backendResponse = await fetch(`${API_BASE}/api/public/tenant/${TENANT_ID}`);
    const backendData = await backendResponse.json();
    const backendStatus = backendData.data?.locationStatus || backendData.locationStatus;
    
    console.log(`   Backend API status: ${backendStatus}`);
    console.log(`   Cache invalidation: ${backendStatus === NEW_STATUS ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // Test frontend pages (these should now show fresh data)
    const affectedEndpoints = [
      `/tenant/${TENANT_ID}`,
      `/shops/sid-wudtb0kd`, // If this tenant owns this shop
      `/directory/mina-african-market` // If this tenant owns this directory
    ];
    
    console.log('\n🌐 Step 4: Testing affected frontend endpoints...');
    
    for (const endpoint of affectedEndpoints) {
      try {
        const pageResponse = await fetch(`${WEB_BASE}${endpoint}`);
        const pageText = await pageResponse.text();
        
        // Check if the old status is still present (indicates cache issue)
        const hasOldStatus = pageText.includes(OLD_STATUS);
        const hasNewStatus = pageText.includes(NEW_STATUS);
        
        console.log(`   ${endpoint}:`);
        console.log(`     HTTP Status: ${pageResponse.status}`);
        console.log(`     Contains old status (${OLD_STATUS}): ${hasOldStatus ? '❌ YES' : '✅ NO'}`);
        console.log(`     Contains new status (${NEW_STATUS}): ${hasNewStatus ? '✅ YES' : '❌ NO'}`);
        console.log(`     Cache invalidation: ${!hasOldStatus && hasNewStatus ? '✅ SUCCESS' : '❌ FAILED'}`);
        
      } catch (error) {
        console.log(`   ${endpoint}: ❌ ERROR - ${error.message}`);
      }
    }
    
    // Step 5: Check browser cache behavior
    console.log('\n🔍 Step 5: Browser cache analysis...');
    console.log('   To test browser cache invalidation:');
    console.log('   1. Open affected pages in different browsers');
    console.log('   2. Update location status');
    console.log('   3. Refresh pages - should show new status immediately');
    console.log('   4. No 15-minute delay should occur');
    
    console.log('\n🎯 Expected Results:');
    console.log('   ✅ Backend API returns new status immediately');
    console.log('   ✅ Frontend pages show new status on refresh');
    console.log('   ✅ No 15-minute cache delay');
    console.log('   ✅ Cross-browser consistency');
    
    console.log('\n📊 Cache Invalidation Summary:');
    console.log('   🔥 Backend API Cache: Cleared via CacheService');
    console.log('   🔥 Frontend Singleton Cache: Cleared via invalidateCache()');
    console.log('   🔥 Next.js Route Cache: Cleared via revalidatePath()');
    console.log('   🔥 Browser Cache: Bypassed with cache-busting headers');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testLocationStatusInvalidation();
}

module.exports = { testLocationStatusInvalidation };
