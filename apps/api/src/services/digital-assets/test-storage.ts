/**
 * Test script for Supabase Storage setup
 * Run: doppler run -- npx tsx src/services/digital-assets/test-storage.ts
 */

import { digitalAssetService } from './DigitalAssetService';
import { logger } from '../../logger';

async function testStorage() {
  console.log('🧪 Testing Supabase Storage for Digital Products...\n');
  
  // Test 1: Check bucket access
  console.log('Test 1: Checking bucket access...');
  try {
    const hasAccess = await digitalAssetService.checkBucketAccess();
    if (hasAccess) {
      console.log('✅ Bucket access: OK\n');
    } else {
      logger.error('❌ Bucket access: FAILED', undefined);
      logger.error('Cannot access digital-products bucket. Check:', undefined);
      logger.error('1. Bucket exists in Supabase Dashboard', undefined);
      logger.error('2. SUPABASE_URL environment variable is correct', undefined);
      logger.error('3. SUPABASE_SERVICE_ROLE_KEY environment variable is correct', undefined);
      logger.error('4. Storage policies are configured\n', undefined);
      return;
    }
  } catch (error: any) {
    logger.error('❌ Bucket access check failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
    return;
  }
  
  // Test 2: Upload a test file
  console.log('Test 2: Uploading test file...');
  const testFile = Buffer.from('This is a test digital product file for storage validation.');
  const testTenantId = 'test-tenant';
  const testProductId = 'test-product';
  let testAsset;
  
  try {
    testAsset = await digitalAssetService.uploadFile(
      testTenantId,
      testProductId,
      testFile,
      'test-file.txt',
      'text/plain'
    );
    console.log('✅ File upload: OK');
    console.log(`   Asset ID: ${testAsset.id}`);
    console.log(`   File path: ${testAsset.file_path}`);
    console.log(`   File size: ${testAsset.file_size_bytes} bytes\n`);
  } catch (error: any) {
    logger.error('❌ File upload failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
    return;
  }
  
  // Test 3: Validate the uploaded file exists
  console.log('Test 3: Validating file exists...');
  try {
    const exists = await digitalAssetService.validateAsset(testAsset.file_path!);
    if (exists) {
      console.log('✅ File validation: OK\n');
    } else {
      logger.error('❌ File validation: FAILED - File not found after upload\n', undefined);
    }
  } catch (error: any) {
    logger.error('❌ File validation failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
  }
  
  // Test 4: Get file metadata
  console.log('Test 4: Getting file metadata...');
  try {
    const metadata = await digitalAssetService.getFileMetadata(testAsset.file_path!);
    if (metadata) {
      console.log('✅ File metadata: OK');
      console.log(`   Size: ${metadata.size} bytes`);
      console.log(`   MIME type: ${metadata.mimeType}`);
      console.log(`   Last modified: ${metadata.lastModified}\n`);
    } else {
      logger.error('❌ File metadata: FAILED - No metadata returned\n', undefined);
    }
  } catch (error: any) {
    logger.error('❌ File metadata failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
  }
  
  // Test 5: Generate signed URL
  console.log('Test 5: Generating signed URL...');
  try {
    const signedUrl = await digitalAssetService.generateSignedUrl(testAsset.file_path!, 60);
    console.log('✅ Signed URL generation: OK');
    console.log(`   URL expires in: 60 seconds`);
    console.log(`   URL length: ${signedUrl.length} characters\n`);
  } catch (error: any) {
    logger.error('❌ Signed URL generation failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
  }
  
  // Test 6: Generate access token
  console.log('Test 6: Generating access token...');
  try {
    const accessToken = digitalAssetService.generateAccessToken();
    console.log('✅ Access token generation: OK');
    console.log(`   Token length: ${accessToken.length} characters\n`);
  } catch (error: any) {
    logger.error('❌ Access token generation failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
  }
  
  // Test 7: Generate license key
  console.log('Test 7: Generating license key...');
  try {
    const licenseKey = digitalAssetService.generateLicenseKey('TEST');
    console.log('✅ License key generation: OK');
    console.log(`   License key: ${licenseKey}\n`);
  } catch (error: any) {
    logger.error('❌ License key generation failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
  }
  
  // Test 8: Create external link asset
  console.log('Test 8: Creating external link asset...');
  try {
    const externalAsset = digitalAssetService.createExternalLinkAsset(
      'https://example.com/download/file.pdf',
      'External Test File',
      'Test external link asset'
    );
    console.log('✅ External link asset creation: OK');
    console.log(`   Asset ID: ${externalAsset.id}`);
    console.log(`   External URL: ${externalAsset.external_url}\n`);
  } catch (error: any) {
    logger.error('❌ External link asset creation failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
  }
  
  // Test 9: Create license key asset
  console.log('Test 9: Creating license key asset...');
  try {
    const licenseAsset = digitalAssetService.createLicenseKeyAsset(
      'Software License',
      'Test license key asset'
    );
    console.log('✅ License key asset creation: OK');
    console.log(`   Asset ID: ${licenseAsset.id}\n`);
  } catch (error: any) {
    logger.error('❌ License key asset creation failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
  }
  
  // Test 10: Delete test file (cleanup)
  console.log('Test 10: Deleting test file (cleanup)...');
  try {
    await digitalAssetService.deleteAsset(testAsset.file_path!);
    console.log('✅ File deletion: OK\n');
  } catch (error: any) {
    logger.error('❌ File deletion failed:', undefined, { error: { name: 'Error', message: String(error.message) } });
    logger.error('   You may need to manually delete the test file from Supabase Dashboard\n', undefined);
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ All storage tests completed successfully!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\nNext steps:');
  console.log('1. Set up storage policies in Supabase Dashboard');
  console.log('2. Configure monitoring and alerts');
  console.log('3. Proceed to Phase 2: Product Management UI\n');
}

// Run tests
testStorage().catch(error => {
  logger.error('\n❌ Test suite failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  process.exit(1);
});
