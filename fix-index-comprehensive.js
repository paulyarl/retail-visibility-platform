#!/usr/bin/env node

/**
 * Comprehensive fix for index.ts field naming issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Comprehensive fix for index.ts...');

const indexPath = path.join(__dirname, 'apps/api/src/index.ts');
let content = fs.readFileSync(indexPath, 'utf8');

// JWT payload fixes - should be snake_case
content = content.replace(/payload\.userId/g, 'payload.user_id');
content = content.replace(/req\.user\.userId/g, 'req.user.user_id');

// Object literal property fixes for tenant operations
content = content.replace(/(\s+)subscription_tier(\s*:)/g, '$1subscriptionTier$2');
content = content.replace(/(\s+)tenantId(\s*:)/g, '$1tenant_id$2');
content = content.replace(/(\s+)userId(\s*:)/g, '$1user_id$2');
content = content.replace(/(\s+)createdBy(\s*:)/g, '$1created_by$2');
content = content.replace(/(\s+)updatedAt(\s*:)/g, '$1updated_at$2');
content = content.replace(/(\s+)displayName(\s*:)/g, '$1display_name$2');

// Property access fixes - Prisma generates camelCase for these
content = content.replace(/\.subscription_tier\b/g, '.subscriptionTier');
content = content.replace(/\.created_by\b/g, '.createdBy');
content = content.replace(/\.business_name\b/g, '.businessName');
content = content.replace(/\.display_name\b/g, '.displayName');
content = content.replace(/\.profile_picture_url\b/g, '.profilePictureUrl');
content = content.replace(/\.item_status\b/g, '.itemStatus');
content = content.replace(/\.category_path\b/g, '.categoryPath');
content = content.replace(/\.created_at\b/g, '.createdAt');
content = content.replace(/\.updated_at\b/g, '.updatedAt');
content = content.replace(/\.missing_images\b/g, '.missingImages');
content = content.replace(/\.missing_description\b/g, '.missingDescription');
content = content.replace(/\.missing_specs\b/g, '.missingSpecs');
content = content.replace(/\.missing_brand\b/g, '.missingBrand');
content = content.replace(/\.price_cents\b/g, '.priceCents');

// Prisma model name fixes
content = content.replace(/prisma\.inventoryItem/g, 'prisma.inventory_item');
content = content.replace(/prisma\.photoAsset/g, 'prisma.photo_asset');
content = content.replace(/prisma\.businessHours/g, 'prisma.business_hours');
content = content.replace(/prisma\.businessHoursSpecial/g, 'prisma.business_hours_special');
content = content.replace(/prisma\.userTenant/g, 'prisma.user_tenants');
content = content.replace(/prisma\.locationStatusLog/g, 'prisma.location_status_log');
content = content.replace(/prisma\.google_taxonomy/g, 'prisma.google_taxonomy');
content = content.replace(/prisma\.clover_integrations/g, 'prisma.clover_integrations');

// Unique constraint fixes
content = content.replace(/userId_tenantId:/g, 'user_id_tenant_id:');
content = content.replace(/tenantId_googleAccountId:/g, 'tenant_id_google_account_id:');

// Where clause fixes
content = content.replace(/(\s+)tenantId(\s*:)/g, '$1tenant_id$2');
content = content.replace(/(\s+)userId(\s*:)/g, '$1user_id$2');
content = content.replace(/(\s+)missingImages(\s*:)/g, '$1missing_images$2');
content = content.replace(/(\s+)missingDescription(\s*:)/g, '$1missing_description$2');
content = content.replace(/(\s+)missingBrand(\s*:)/g, '$1missing_brand$2');
content = content.replace(/(\s+)missingSpecs(\s*:)/g, '$1missing_specs$2');
content = content.replace(/(\s+)displayName(\s*:)/g, '$1display_name$2');

// Select clause fixes
content = content.replace(/(\s+)subscription_tier(\s*:)/g, '$1subscriptionTier$2');
content = content.replace(/(\s+)tenantId(\s*:)/g, '$1tenant_id$2');
content = content.replace(/(\s+)missingImages(\s*:)/g, '$1missing_images$2');

// Include clause fixes - remove non-existent relations
content = content.replace(/(\s+)featureOverrides(\s*:)/g, '$1// featureOverrides: // Relation does not exist$2');
content = content.replace(/(\s+)users(\s*:)/g, '$1// users: // Use user_tenants instead$2');
content = content.replace(/(\s+)tokens(\s*:)/g, '$1// tokens: // Relation does not exist$2');

// Order by fixes
content = content.replace(/(\s+)createdAt(\s*:)/g, '$1created_at$2');

fs.writeFileSync(indexPath, content);
console.log('✅ Fixed: index.ts');

console.log('\n🎉 Comprehensive fixes applied!');
console.log('Run: cd apps/api && npx tsc --noEmit src/index.ts to test');
