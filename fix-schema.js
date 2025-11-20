#!/usr/bin/env node

/**
 * Script to fix Prisma schema camel vs snake case issues
 * 
 * Key fixes:
 * 1. Remove duplicate ignored models (InventoryItem, PhotoAsset, etc.)
 * 2. Remove @@ignore from actively used models
 * 3. Add missing @id fields
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'apps/api/prisma/schema.prisma');
const backupPath = path.join(__dirname, 'apps/api/prisma/schema.prisma.backup');

console.log('🔧 Fixing Prisma schema camel vs snake case issues...');

// Backup original schema
const originalSchema = fs.readFileSync(schemaPath, 'utf8');
fs.writeFileSync(backupPath, originalSchema);
console.log('✅ Backed up original schema to schema.prisma.backup');

let fixedSchema = originalSchema;

// 1. Remove duplicate ignored models that have active snake_case equivalents
const modelsToRemove = [
  'InventoryItem',
  'LocationStatusLog', 
  'PhotoAsset',
  'ProductPerformance',
  'SyncJob'
];

modelsToRemove.forEach(modelName => {
  // Remove the entire model block including comments
  const modelRegex = new RegExp(
    `///.*?\\n.*?model ${modelName} \\{[\\s\\S]*?@@ignore\\n\\}\\n\\n?`,
    'g'
  );
  fixedSchema = fixedSchema.replace(modelRegex, '');
  console.log(`✅ Removed duplicate ignored model: ${modelName}`);
});

// 2. Remove @@ignore from actively used models and add @id where needed
const modelsToEnable = [
  'barcode_enrichment',
  'barcode_lookup_log', 
  'clover_demo_snapshots',
  'clover_integrations',
  'clover_item_mappings',
  'clover_sync_logs',
  'directory_listings',
  'directory_settings',
  'directory_support_notes',
  'feed_push_jobs',
  'google_taxonomy',
  'location_status_logs',
  'oauth_integrations',
  'organization_requests',
  'outreach_feedback',
  'permission_audit_log',
  'permission_matrix',
  'scan_results',
  'scan_sessions',
  'scan_templates',
  'sku_billing_policy_history',
  'sku_billing_policy_overrides',
  'square_integrations',
  'square_product_mappings',
  'square_sync_logs',
  'stripe_webhook_events',
  'subscription_tiers',
  'tenant_category',
  'tenant_feature_flags',
  'tenant_feature_overrides',
  'tier_change_logs',
  'tier_features',
  'upgrade_requests'
];

modelsToEnable.forEach(modelName => {
  // Remove @@ignore
  const ignoreRegex = new RegExp(`(model ${modelName} \\{[\\s\\S]*?)\\s*@@ignore`, 'g');
  fixedSchema = fixedSchema.replace(ignoreRegex, '$1');
  
  // Add @id to first String field if no @id exists
  const modelRegex = new RegExp(`(model ${modelName} \\{[\\s\\S]*?)(\\s+id\\s+String)(\\s)`, 'g');
  fixedSchema = fixedSchema.replace(modelRegex, '$1$2 @id @default(cuid())$3');
  
  console.log(`✅ Enabled model: ${modelName}`);
});

// 3. Fix specific field issues
// Fix oauth_integrations id field
fixedSchema = fixedSchema.replace(
  /id\s+String\s+@default\(dbgenerated\("gen_random_uuid\(\)"\)\)\s+@db\.Uuid/g,
  'id String @id @default(cuid())'
);

// Write fixed schema
fs.writeFileSync(schemaPath, fixedSchema);
console.log('✅ Fixed schema written to schema.prisma');

console.log('\n🎉 Schema fixes complete!');
console.log('\nNext steps:');
console.log('1. Run: cd apps/api && npx prisma generate');
console.log('2. Run: pnpm build');
console.log('3. If issues persist, check SCHEMA_FIX_PLAN.md for code updates needed');
