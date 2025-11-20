#!/usr/bin/env node

/**
 * Script to fix TypeScript imports and model references
 * 
 * Fixes:
 * 1. Enum imports (UserRole -> user_role)
 * 2. Model references (inventoryItem -> inventory_item)
 * 3. Type imports (InventoryItem -> inventory_item)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing TypeScript imports and model references...');

// Find all TypeScript files in src directory
const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

console.log(`Found ${tsFiles.length} TypeScript files to process`);

// Mapping of old names to new names
const enumMappings = {
  'UserRole': 'user_role',
  'UserTenantRole': 'user_tenant_role', 
  'AvailabilityStatus': 'availability_status',
  'ProductSource': 'product_source',
  'InventoryItem': 'inventory_item'
};

const modelMappings = {
  // Prisma client model references
  'inventoryItem': 'inventory_item',
  'userTenant': 'user_tenants',
  'photoAsset': 'photo_asset',
  'productPerformance': 'product_performance',
  'syncJob': 'sync_job',
  'auditLog': 'audit_log',
  'userSession': 'user_sessions',
  'tenantCategory': 'tenant_category',
  'tenantFeatureFlag': 'tenant_feature_flags',
  'tenantFeatureOverride': 'tenant_feature_overrides',
  'platformFeatureFlag': 'platform_feature_flags',
  'businessHours': 'business_hours',
  'businessHoursSpecial': 'business_hours_special',
  'tenantBusinessProfile': 'tenant_business_profile',
  'googleOAuthToken': 'google_oauth_tokens',
  'googleOAuthAccounts': 'google_oauth_accounts',
  'directorySettings': 'directory_settings',
  'directoryFeaturedListings': 'directory_featured_listings',
  'directorySupportNotes': 'directory_support_notes',
  'feedPushJob': 'feed_push_jobs',
  'scanSession': 'scan_sessions',
  'scanResult': 'scan_results',
  'barcodeEnrichment': 'barcode_enrichment',
  'barcodeLookupLog': 'barcode_lookup_log',
  'cloverIntegration': 'clover_integrations',
  'cloverItemMapping': 'clover_item_mappings',
  'cloverSyncLog': 'clover_sync_logs',
  'squareIntegration': 'square_integrations',
  'organizationRequest': 'organization_requests',
  'upgradeRequest': 'upgrade_requests',
  'outreachFeedback': 'outreach_feedback',
  'permissionMatrix': 'permission_matrix',
  'permissionAuditLog': 'permission_audit_log',
  'platformSettings': 'platform_settings',
  'subscriptionTier': 'subscription_tiers',
  'tierChangeLog': 'tier_change_logs',
  'tierFeature': 'tier_features',
  'skuBillingPolicyHistory': 'sku_billing_policy_history',
  'stripeWebhookEvent': 'stripe_webhook_events',
  'googleTaxonomy': 'google_taxonomy',
  'gBPCategory': 'gbp_categories',
  'invitation': 'invitations'
};

let totalChanges = 0;

tsFiles.forEach(fileName => {
  const filePath = path.join(srcDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix enum imports
  Object.entries(enumMappings).forEach(([oldName, newName]) => {
    const importRegex = new RegExp(`import.*?\\b${oldName}\\b.*?from.*?@prisma/client`, 'g');
    if (importRegex.test(content)) {
      content = content.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
      changed = true;
    }
  });
  
  // Fix model references (prisma.modelName)
  Object.entries(modelMappings).forEach(([oldName, newName]) => {
    const modelRegex = new RegExp(`prisma\\.${oldName}\\b`, 'g');
    if (modelRegex.test(content)) {
      content = content.replace(modelRegex, `prisma.${newName}`);
      changed = true;
    }
  });
  
  // Fix include/select object properties
  Object.entries(modelMappings).forEach(([oldName, newName]) => {
    // Fix in include objects: { inventoryItem: true }
    const includeRegex = new RegExp(`(\\s+)${oldName}(\\s*:)`, 'g');
    if (includeRegex.test(content)) {
      content = content.replace(includeRegex, `$1${newName}$2`);
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    totalChanges++;
    console.log(`✅ Fixed: ${fileName}`);
  }
});

console.log(`\n🎉 Fixed ${totalChanges} files!`);
console.log('\nNext steps:');
console.log('1. Run: pnpm build');
console.log('2. Check for any remaining errors');
console.log('3. Test the application');
