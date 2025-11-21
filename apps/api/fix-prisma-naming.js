#!/usr/bin/env node

/**
 * Systematic Prisma naming fix script
 * Fixes camelCase vs snake_case inconsistencies across the entire codebase
 */

const fs = require('fs');
const path = require('path');

// Patterns to fix
const patterns = [
  // Model names: snake_case -> camelCase
  { from: /\bprisma\.inventory_item\b/g, to: 'prisma.inventoryItem' },
  { from: /\bprisma\.user_tenants\b/g, to: 'prisma.userTenant' },
  { from: /\bprisma\.business_hours\b/g, to: 'prisma.businessHours' },
  { from: /\bprisma\.business_hours_special\b/g, to: 'prisma.businessHoursSpecial' },
  { from: /\bprisma\.clover_integrations\b/g, to: 'prisma.cloverIntegrations' },
  { from: /\bprisma\.google_oauth_tokens\b/g, to: 'prisma.googleOauthTokens' },
  { from: /\bprisma\.google_merchant_links\b/g, to: 'prisma.googleMerchantLinks' },
  { from: /\bprisma\.gbp_locations\b/g, to: 'prisma.gbpLocations' },
  { from: /\bprisma\.gbp_insights_daily\b/g, to: 'prisma.gbpInsightsDaily' },
  { from: /\bprisma\.audit_log\b/g, to: 'prisma.auditLog' },
  { from: /\bprisma\.categoryMirrorRun\b/g, to: 'prisma.categoryMirrorRuns' },

  // Field names in selects: snake_case -> camelCase
  { from: /\bimage_url\s*:\s*true/g, to: 'imageUrl: true' },
  { from: /\bcategory_path\s*:\s*true/g, to: 'categoryPath: true' },
  { from: /\bstore_code\s*:\s*true/g, to: 'storeCode: true' },
  { from: /\bsubscription_tier\s*:\s*true/g, to: 'subscriptionTier: true' },
  { from: /\bsubscription_status\s*:\s*true/g, to: 'subscriptionStatus: true' },
  { from: /\blocation_status\s*:\s*true/g, to: 'locationStatus: true' },
  { from: /\borganizationId\s*:\s*true/g, to: 'organizationId: true' },

  // Field names in data objects: camelCase -> snake_case (for unique indexes and certain contexts)
  { from: /\btenantId\s*:\s*([^,}]+)/g, to: 'tenant_id: $1' },  // Convert back for unique indexes
  { from: /\baccountId\s*:\s*([^,}]+)/g, to: 'account_id: $1' },
  { from: /\blocationId\s*:\s*([^,}]+)/g, to: 'location_id: $1' },
  { from: /\baccountId_locationId\s*:\s*/g, to: 'account_id_location_id: ' },
  { from: /\blocationId_date\s*:\s*/g, to: 'location_id_date: ' },

  // Field names in data objects: snake_case -> camelCase (for create/update)
  { from: /\btenant_id\s*:\s*/g, to: 'tenantId: ' },
  { from: /\bmerchant_id\s*:\s*/g, to: 'merchantId: ' },
  { from: /\baccount_id\s*:\s*/g, to: 'accountId: ' },
  { from: /\blocation_id\s*:\s*/g, to: 'locationId: ' },
  { from: /\blocation_name\s*:\s*/g, to: 'locationName: ' },
  { from: /\bstore_code\s*:\s*/g, to: 'storeCode: ' },
  { from: /\baccess_token_encrypted\s*:\s*/g, to: 'accessTokenEncrypted: ' },
  { from: /\brefresh_token_encrypted\s*:\s*/g, to: 'refreshTokenEncrypted: ' },
  { from: /\btoken_expires_at\s*:\s*/g, to: 'tokenExpiresAt: ' },
  { from: /\bcompleted_at\s*:\s*/g, to: 'completedAt: ' },
  { from: /\bupdated_at\s*:\s*/g, to: 'updatedAt: ' },
  { from: /\bviews_search\s*:\s*/g, to: 'viewsSearch: ' },
  { from: /\bviews_maps\s*:\s*/g, to: 'viewsMaps: ' },
  { from: /\bactions_website\s*:\s*/g, to: 'actionsWebsite: ' },
  { from: /\bactions_phone\s*:\s*/g, to: 'actionsPhone: ' },
  { from: /\bactions_directions\s*:\s*/g, to: 'actionsDirections: ' },
  { from: /\bphotos_count\s*:\s*/g, to: 'photosCount: ' },
  { from: /\bexpires_at\s*:\s*/g, to: 'expiresAt: ' },

  // Field names in where clauses: special cases for unique indexes
  { from: /\btenantId\s*:\s*/g, to: 'tenant_id: ' },  // Keep snake_case for unique indexes
  { from: /\baccountId\s*:\s*/g, to: 'account_id: ' },
  { from: /\blocationId\s*:\s*/g, to: 'location_id: ' },

  // Property access: snake_case -> camelCase
  { from: /\b\.image_url\b/g, to: '.imageUrl' },
  { from: /\b\.category_path\b/g, to: '.categoryPath' },
  { from: /\b\.expires_at\b/g, to: '.expiresAt' },
  { from: /\b\.refresh_token_encrypted\b/g, to: '.refreshTokenEncrypted' },
  { from: /\b\.access_token_encrypted\b/g, to: '.accessTokenEncrypted' },
  { from: /\b\.views_search\b/g, to: '.viewsSearch' },
  { from: /\b\.views_maps\b/g, to: '.viewsMaps' },
  { from: /\b\.actions_website\b/g, to: '.actionsWebsite' },
  { from: /\b\.actions_phone\b/g, to: '.actionsPhone' },
  { from: /\b\.actions_directions\b/g, to: '.actionsDirections' },
  { from: /\b\.photos_count\b/g, to: '.photosCount' },

  // _count relation names: lowercase -> Capitalized
  { from: /_count\s*:\s*{\s*select\s*:\s*{\s*tenant\s*:\s*true/g, to: '_count: { select: { Tenant: true' },
  { from: /_count\s*:\s*{\s*select\s*:\s*{[^}]*tenant\s*:\s*true/g, to: (match) => match.replace(/tenant\s*:\s*true/g, 'Tenant: true') },
];

// Files to process
const filesToProcess = [
  'src/clover/test-clover-integration.ts',
  'src/jobs/gbpCategorySync.ts',
  'src/jobs/gbpHoursSync.ts',
  'src/lib/google/feed-generator.ts',
  'src/lib/google/gbp.ts',
  'src/lib/google/gmc.ts',
  'src/lib/quick-start.ts',
  'src/middleware/audit-logger.ts',
  'src/middleware/image-search-limits.ts',
  'src/middleware/organization-validation.ts',
  'src/middleware/permissions.ts',
  'src/middleware/policy-enforcement.ts',
  'src/middleware/sku-limits.ts',
  'src/middleware/subscription.ts',
  'src/middleware/tier-access.ts',
  'src/middleware/tier-validation.ts',
  'src/routes/dashboard-consolidated.ts',
  'src/routes/tenant-users.ts',
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const pattern of patterns) {
    const newContent = content.replace(pattern.from, pattern.to);
    if (newContent !== content) {
      content = newContent;
      changed = true;
      console.log(`✅ Fixed in ${filePath}: ${pattern.from} -> ${pattern.to}`);
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`💾 Updated: ${filePath}`);
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
  }
}

console.log('🔧 Starting systematic Prisma naming fixes...\n');

for (const file of filesToProcess) {
  processFile(file);
}

console.log('\n✨ Prisma naming fixes complete!');
console.log('Run: npx tsc --noEmit to verify fixes');
