/**
 * API Test for Chain SKU Propagation
 * Tests the /api/organizations/:id/items/propagate endpoint
 * Run with: doppler run --config dev -- npx ts-node src/test-chain-api.ts
 * 
 * Note: This is a manual test script. Update TEST_CONFIG with your actual IDs.
 */

const API_BASE = process.env.API_URL || 'http://localhost:4000';
const WEB_BASE = process.env.WEB_URL || 'http://localhost:3000';

// Test configuration - UPDATE THESE WITH YOUR ACTUAL IDS
const TEST_CONFIG = {
  organizationId: 'YOUR_ORG_ID', // Replace with actual org ID
  sourceItemId: 'YOUR_ITEM_ID',   // Replace with actual item ID
  targetTenantIds: ['TENANT_ID_1', 'TENANT_ID_2'], // Replace with actual tenant IDs
};

async function testPropagateAPI() {
  console.log('\n🧪 Testing Chain SKU Propagation API\n');
  console.log('═'.repeat(60));
  
  console.log('\n📋 Test Configuration:');
  console.log(`  API Base: ${API_BASE}`);
  console.log(`  Organization ID: ${TEST_CONFIG.organizationId}`);
  console.log(`  Source Item ID: ${TEST_CONFIG.sourceItemId}`);
  console.log(`  Target Tenants: ${TEST_CONFIG.targetTenantIds.length}`);
  
  // Check if config is set
  if (TEST_CONFIG.organizationId === 'YOUR_ORG_ID') {
    console.log('\n⚠️  Please update TEST_CONFIG with your actual IDs');
    console.log('\nTo get your IDs:');
    console.log('  1. Go to http://localhost:3000/admin/organizations');
    console.log('  2. Find your test organization');
    console.log('  3. Note the organization ID and tenant IDs');
    console.log('  4. Go to items page and get an item ID');
    console.log('  5. Update TEST_CONFIG in this file\n');
    return;
  }
  
  try {
    console.log('\n🚀 Sending propagation request...\n');
    
    const response = await fetch(
      `${API_BASE}/api/organizations/${TEST_CONFIG.organizationId}/items/propagate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceItemId: TEST_CONFIG.sourceItemId,
          targetTenantIds: TEST_CONFIG.targetTenantIds,
        }),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      return;
    }
    
    console.log('✅ Propagation successful!\n');
    console.log('📊 Results:');
    console.log(`  Total operations: ${data.summary.total}`);
    console.log(`  ✅ Created: ${data.summary.created}`);
    console.log(`  ⏭️  Skipped: ${data.summary.skipped}`);
    console.log(`  ❌ Errors: ${data.summary.errors}`);
    
    if (data.results.created.length > 0) {
      console.log('\n✅ Created at tenants:');
      data.results.created.forEach((tenantId: string) => {
        console.log(`  - ${tenantId}`);
      });
    }
    
    if (data.results.skipped.length > 0) {
      console.log('\n⏭️  Skipped:');
      data.results.skipped.forEach((skip: any) => {
        console.log(`  - ${skip.tenantId}: ${skip.reason}`);
      });
    }
    
    if (data.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      data.results.errors.forEach((err: any) => {
        console.log(`  - ${err.tenantId}: ${err.error}`);
      });
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Test complete!\n');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Helper function to print setup instructions
function printSetupInstructions() {
  console.log('\n📚 Setup Instructions:\n');
  console.log('1. Start your dev server:');
  console.log('   pnpm dev\n');
  console.log('2. Create a test organization:');
  console.log('   - Go to http://localhost:3000/admin/organizations');
  console.log('   - Create a new organization with multiple tenants\n');
  console.log('3. Add an item to one tenant:');
  console.log('   - Go to items page for one tenant');
  console.log('   - Add a test product\n');
  console.log('4. Get the IDs and update TEST_CONFIG in this file\n');
  console.log('5. Run this test again:\n');
  console.log('   doppler run --config dev -- npx ts-node src/test-chain-api.ts\n');
}

testPropagateAPI().then(() => {
  if (TEST_CONFIG.organizationId === 'YOUR_ORG_ID') {
    printSetupInstructions();
  }
});
