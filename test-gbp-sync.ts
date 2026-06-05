// ============================================================================
// TEST GBP CATEGORY SYNC SERVICE
// ============================================================================
// Run this script to test the GBP Category Sync Service
// Usage: npx tsx test-gbp-sync.ts
// ============================================================================

import { GBPCategorySyncService } from './apps/api/src/services/GBPCategorySyncService';
import { prisma } from './apps/api/src/prisma';

async function testGBPCategorySync() {
  console.log('🧪 Testing GBP Category Sync Service...\n');

  try {
    // Step 1: Check if OAuth token exists
    console.log('1. Checking OAuth token in database...');
    const oauthRecord = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        provider,
        tenant_id,
        is_active,
        expires_at,
        access_token->>'access_token' as access_token_preview
      FROM oauth_integrations
      WHERE provider = 'google_business'
        AND tenant_id IS NULL
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!oauthRecord || oauthRecord.length === 0) {
      console.log('❌ No active Google Business OAuth token found');
      return;
    }

    const token = oauthRecord[0];
    console.log('✅ Found OAuth token:', {
      id: token.id,
      provider: token.provider,
      is_active: token.is_active,
      expires_at: token.expires_at,
      token_preview: token.access_token_preview?.substring(0, 20) + '...'
    });

    // Step 2: Test token retrieval (what the service does internally)
    console.log('\n2. Testing token retrieval from service...');
    const service = new GBPCategorySyncService();
    const accessToken = await (service as any).getAccessToken();

    if (!accessToken) {
      console.log('❌ Service could not retrieve access token');
      return;
    }

    console.log('✅ Service successfully retrieved access token');
    console.log('   Token starts with:', accessToken.substring(0, 20) + '...');

    // Step 3: Test category fetching
    console.log('\n3. Testing category fetching...');
    const result = await service.fetchLatestCategories();

    console.log('✅ Category fetch completed!');
    console.log(`   Categories found: ${result.categories.length}`);
    console.log(`   Version: ${result.version}`);
    console.log(`   Total count: ${result.totalCount}`);

    // Step 4: Verify it's using Google API vs hardcoded
    if (result.categories.length > 100) {
      console.log('🎉 SUCCESS: Using Google Business API (4,000+ categories)');
      console.log('   Sample categories:');
      result.categories.slice(0, 3).forEach(cat => {
        console.log(`   - ${cat.displayName} (${cat.categoryId})`);
      });
    } else {
      console.log('⚠️ FALLBACK: Using hardcoded categories (30 items)');
      console.log('   This happens when OAuth token is invalid/expired');
    }

    // Step 5: Check database impact
    console.log('\n4. Checking database impact...');
    const categoryCount = await prisma.gbpCategory.count();
    console.log(`   Total GBP categories in database: ${categoryCount}`);

    if (categoryCount > 100) {
      console.log('✅ Database has live Google categories');
    } else {
      console.log('ℹ️ Database has limited categories (may need sync job)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('   Error details:', error.message);

    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n🔧 Possible issues:');
      console.log('   - OAuth token expired (only lasts 1 hour)');
      console.log('   - Token has insufficient permissions');
      console.log('   - Google API not enabled');
    }
  }
}

// Run the test
testGBPCategorySync()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  });
