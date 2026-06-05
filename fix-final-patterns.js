#!/usr/bin/env node

/**
 * Final targeted fix for the remaining specific error patterns
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Final targeted fixes for remaining patterns...');

// Fix config/tenant-limits.ts
const configPath = path.join(__dirname, 'apps/api/src/config/tenant-limits.ts');
if (fs.existsSync(configPath)) {
  let content = fs.readFileSync(configPath, 'utf8');
  content = content.replace(/\.displayName/g, '.display_name');
  fs.writeFileSync(configPath, content);
  console.log('✅ Fixed: config/tenant-limits.ts');
}

// Fix index.ts with specific patterns
const indexPath = path.join(__dirname, 'apps/api/src/index.ts');
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Property access fixes
  content = content.replace(/\.createdBy\b/g, '.created_by');
  content = content.replace(/\.tenantId\b/g, '.tenant_id');
  content = content.replace(/\.businessName\b/g, '.business_name');
  
  // Object literal property fixes (database fields are snake_case)
  content = content.replace(/(\s+)trial_ends_at(\s*:)/g, '$1trialEndsAt$2');
  content = content.replace(/(\s+)tenantId(\s*:)/g, '$1tenant_id$2');
  content = content.replace(/(\s+)created_at(\s*:)/g, '$1createdAt$2');
  
  // Order by fixes
  content = content.replace(/created_at(\s*:)/g, 'createdAt$1');
  
  // Prisma model fixes
  content = content.replace(/prisma\.location_status_log/g, 'prisma.location_status_log');
  content = content.replace(/prisma\.locationStatusLog/g, 'prisma.location_status_log');
  content = content.replace(/prisma\.business_hoursSpecial/g, 'prisma.business_hours_special');
  
  // Remove non-existent includes
  content = content.replace(/(\s+)featureOverrides(\s*:)/g, '$1// featureOverrides: // Relation does not exist$2');
  
  // Fix user_tenants create data structure
  content = content.replace(
    /{\s*user_id:\s*[^,]+,\s*tenant_id:\s*[^,]+,\s*role:\s*"OWNER"\s*}/g,
    '{ data: { user_id: user.user_id, tenant_id: tenant.id, role: "OWNER" } }'
  );
  
  fs.writeFileSync(indexPath, content);
  console.log('✅ Fixed: index.ts');
}

console.log('\n🎉 Final targeted fixes applied!');
console.log('Run: pnpm build to test the final result');
