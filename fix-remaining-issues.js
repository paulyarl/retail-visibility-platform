#!/usr/bin/env node

/**
 * Final cleanup script for remaining TypeScript errors
 * 
 * Fixes:
 * 1. Missing variable declarations
 * 2. Remaining field name mismatches
 * 3. Import issues
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Final cleanup of remaining TypeScript errors...');

const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

// Specific fixes for remaining issues
const specificFixes = [
  // Fix missing variable declarations
  { from: /Cannot find name 'tenants'/g, to: 'tenant' },
  { from: /Cannot find name 'items'/g, to: 'inventory_item' },
  
  // Fix property access patterns
  { from: /\.createdAt/g, to: '.created_at' },
  { from: /\.updatedAt/g, to: '.updated_at' },
  { from: /\.tenantId/g, to: '.tenant_id' },
  { from: /\.userId/g, to: '.user_id' },
  { from: /\.itemId/g, to: '.item_id' },
  
  // Fix object literal properties
  { from: /tenantId:/g, to: 'tenant_id:' },
  { from: /userId:/g, to: 'user_id:' },
  { from: /itemId:/g, to: 'item_id:' },
  { from: /createdAt:/g, to: 'created_at:' },
  { from: /updatedAt:/g, to: 'updated_at:' },
  
  // Fix specific model references
  { from: /prisma\.tenant\b/g, to: 'prisma.tenant' },
  { from: /prisma\.users\b/g, to: 'prisma.users' },
];

let totalChanges = 0;

tsFiles.forEach(fileName => {
  const filePath = path.join(srcDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Apply specific fixes
  specificFixes.forEach(fix => {
    if (fix.from.test(content)) {
      content = content.replace(fix.from, fix.to);
      changed = true;
    }
  });
  
  // Fix specific file issues
  
  // Fix tenant-validation.ts issues
  if (fileName.includes('tenant-validation.ts')) {
    // Fix missing variable declarations
    if (content.includes('tenants:')) {
      content = content.replace(/tenants:/g, 'tenant:');
      changed = true;
    }
    
    // Fix shorthand property issues
    if (content.includes('{ tenants }')) {
      content = content.replace(/\{ tenants \}/g, '{ tenant }');
      changed = true;
    }
  }
  
  // Fix tenantFlags.ts issues
  if (fileName.includes('tenantFlags.ts')) {
    // Fix missing variable declarations
    if (content.includes('Cannot find name')) {
      content = content.replace(/tenantFeatureFlags/g, 'tenant_feature_flags');
      changed = true;
    }
  }
  
  // Fix productMatcher.ts issues
  if (fileName.includes('productMatcher.ts')) {
    // Fix inventory item references
    content = content.replace(/inventoryItem\./g, 'inventory_item.');
    content = content.replace(/\.inventoryItem/g, '.inventory_item');
    changed = true;
  }
  
  // Fix subscription-status.ts import
  if (fileName.includes('subscription-status.ts')) {
    // Fix Prisma import
    content = content.replace(/import.*?@prisma\/client.*?;/g, 'import { tenant, organization } from "@prisma/client";');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    totalChanges++;
    console.log(`✅ Fixed: ${fileName}`);
  }
});

console.log(`\n🎉 Fixed ${totalChanges} files!`);
console.log('\nRun: pnpm build to test the final result');
