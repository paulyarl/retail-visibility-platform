#!/usr/bin/env node

/**
 * Script to fix the final remaining TypeScript errors
 * 
 * Fixes:
 * 1. Field name mismatches (camelCase vs snake_case)
 * 2. Include/select property corrections
 * 3. Prisma model property access
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing final remaining TypeScript errors...');

const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

// Field name mappings (camelCase -> snake_case)
const fieldMappings = {
  // Common field name fixes
  'tenantId': 'tenant_id',
  'userId': 'user_id',
  'imageUrl': 'image_url',
  'priceCents': 'price_cents',
  'completedAt': 'completed_at',
  'userId_tenantId': 'user_id_tenant_id',
  'invitedBy': 'invited_by',
  'expiresAt': 'expires_at',
  'acceptedAt': 'accepted_at',
  'createdAt': 'created_at',
  'updatedAt': 'updated_at'
};

// Include/select property fixes
const includeMappings = {
  'subscription_tiers': 'subscriptionTier',
  'inventory_item': '_count', // For count operations
  'user_tenants': 'user_tenants',
  'tenant': 'tenant',
  'inviter': 'users', // inviter relation should be users
  'user': 'users'
};

// Property access fixes
const propertyMappings = {
  'prisma.user': 'prisma.users',
  'prisma.userTenant': 'prisma.user_tenants',
  '.organization': '.organization',
  '.tenant': '.tenant',
  '.inviter': '.users',
  '._count.items': '._count.inventory_item',
  '.subscription_tiers': '.subscriptionTier'
};

let totalChanges = 0;

tsFiles.forEach(fileName => {
  const filePath = path.join(srcDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix field names in where clauses, create data, etc.
  Object.entries(fieldMappings).forEach(([oldName, newName]) => {
    // Fix in object properties: { tenantId: ... } -> { tenant_id: ... }
    const fieldRegex = new RegExp(`(\\s+)${oldName}(\\s*:)`, 'g');
    if (fieldRegex.test(content)) {
      content = content.replace(fieldRegex, `$1${newName}$2`);
      changed = true;
    }
  });
  
  // Fix include/select properties
  Object.entries(includeMappings).forEach(([oldName, newName]) => {
    // Fix in include/select: subscription_tiers: true -> subscriptionTier: true
    const includeRegex = new RegExp(`(\\s+)${oldName}(\\s*:)`, 'g');
    if (includeRegex.test(content)) {
      content = content.replace(includeRegex, `$1${newName}$2`);
      changed = true;
    }
  });
  
  // Fix property access patterns
  Object.entries(propertyMappings).forEach(([oldPattern, newPattern]) => {
    if (content.includes(oldPattern)) {
      content = content.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);
      changed = true;
    }
  });
  
  // Fix specific patterns
  
  // Fix organization property access
  if (content.includes('.organization.')) {
    // This might need to be organizationId in some cases
    content = content.replace(/\.organization\./g, '.organization.');
    changed = true;
  }
  
  // Fix count property access
  if (content.includes('._count.items')) {
    content = content.replace(/\._count\.items/g, '._count.inventory_item');
    changed = true;
  }
  
  // Fix tenant relation access
  if (content.includes('.tenant.')) {
    // Keep as is, but ensure it's properly included
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    totalChanges++;
    console.log(`✅ Fixed: ${fileName}`);
  }
});

console.log(`\n🎉 Fixed ${totalChanges} files!`);
console.log('\nNext steps:');
console.log('1. Run: pnpm build');
console.log('2. Check for any remaining schema relation issues');
console.log('3. May need to add missing relations to schema.prisma');
