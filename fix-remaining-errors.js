#!/usr/bin/env node

/**
 * Script to fix remaining TypeScript errors after schema changes
 * 
 * Fixes:
 * 1. Include/select object property names
 * 2. Relation field names in queries
 * 3. Missing required fields in create operations
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing remaining TypeScript errors...');

const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

// Additional relation mappings for include/select objects
const relationMappings = {
  'users': 'user_tenants',
  'tenants': 'tenant',
  'items': 'inventory_item',
  'featureOverrides': 'tenant_feature_overrides',
  'googleOAuthAccounts': 'google_oauth_accounts',
  'businessProfile': 'tenant_business_profile'
};

let totalChanges = 0;

tsFiles.forEach(fileName => {
  const filePath = path.join(srcDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix relation field names in include/select objects
  Object.entries(relationMappings).forEach(([oldName, newName]) => {
    // Fix in include/select objects: { users: true } -> { user_tenants: true }
    const includeRegex = new RegExp(`(\\s+)${oldName}(\\s*:)`, 'g');
    if (includeRegex.test(content)) {
      content = content.replace(includeRegex, `$1${newName}$2`);
      changed = true;
    }
  });
  
  // Fix specific common patterns
  
  // Fix _count property access
  const countRegex = /(\w+)\._count/g;
  content = content.replace(countRegex, (match, modelName) => {
    // Map common model names to their correct snake_case versions
    const modelMappings = {
      'tenant': 'tenant',
      'organization': 'organization',
      'user': 'users'
    };
    const correctName = modelMappings[modelName] || modelName;
    changed = true;
    return `${correctName}._count`;
  });
  
  // Fix common field access patterns
  const fieldMappings = {
    'tenant.organization': 'tenant.organization',
    'organization.tenants': 'organization.tenant',
    'user.userTenants': 'users.user_tenants'
  };
  
  Object.entries(fieldMappings).forEach(([oldPattern, newPattern]) => {
    if (content.includes(oldPattern)) {
      content = content.replace(new RegExp(oldPattern.replace('.', '\\.'), 'g'), newPattern);
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    totalChanges++;
    console.log(`✅ Fixed: ${fileName}`);
  }
});

console.log(`\n🎉 Fixed ${totalChanges} additional files!`);
console.log('\nRemaining errors will likely need manual fixes for:');
console.log('- Missing required fields in create operations');
console.log('- Specific relation field mismatches');
console.log('- Type compatibility issues');
console.log('\nRun: pnpm build to check remaining errors');
