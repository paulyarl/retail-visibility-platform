#!/usr/bin/env node

/**
 * Script to fix specific remaining TypeScript errors
 * 
 * Fixes:
 * 1. Field name mismatches in JWT payload and request objects
 * 2. Model name typos
 * 3. Property access corrections
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing specific remaining TypeScript errors...');

const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

// Specific fixes for common patterns
const specificFixes = [
  // Model name typos
  { from: /prisma\.userss/g, to: 'prisma.users' },
  { from: /prisma\.users_sessions/g, to: 'prisma.user_sessions' },
  { from: /prisma\.users_tenants/g, to: 'prisma.user_tenants' },
  
  // JWT payload field fixes
  { from: /\.userId/g, to: '.user_id' },
  { from: /userId:/g, to: 'user_id:' },
  
  // Request object field fixes
  { from: /\.tenantId/g, to: '.tenant_id' },
  { from: /tenantId:/g, to: 'tenant_id:' },
  
  // Other common field fixes
  { from: /\.priceCents/g, to: '.price_cents' },
  { from: /priceCents:/g, to: 'price_cents:' },
  { from: /\.imageUrl/g, to: '.image_url' },
  { from: /imageUrl:/g, to: 'image_url:' },
  { from: /\.completedAt/g, to: '.completed_at' },
  { from: /completedAt:/g, to: 'completed_at:' },
  { from: /\.createdAt/g, to: '.created_at' },
  { from: /createdAt:/g, to: 'created_at:' },
  { from: /\.updatedAt/g, to: '.updated_at' },
  { from: /updatedAt:/g, to: 'updated_at:' },
  
  // Order by fixes
  { from: /created_at:/g, to: 'createdAt:' }, // For orderBy, keep camelCase
  { from: /updated_at:/g, to: 'updatedAt:' }, // For orderBy, keep camelCase
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
  
  // Fix specific patterns that need context
  
  // Fix JWT payload access patterns
  const jwtPatterns = [
    { from: /req\.user\.userId/g, to: 'req.user.user_id' },
    { from: /user\.userId/g, to: 'user.user_id' },
    { from: /payload\.userId/g, to: 'payload.user_id' },
  ];
  
  jwtPatterns.forEach(pattern => {
    if (pattern.from.test(content)) {
      content = content.replace(pattern.from, pattern.to);
      changed = true;
    }
  });
  
  // Fix object literal property names in specific contexts
  const objectLiteralFixes = [
    // In where clauses
    { from: /where:\s*{\s*tenantId:/g, to: 'where: { tenant_id:' },
    { from: /where:\s*{\s*userId:/g, to: 'where: { user_id:' },
    
    // In data objects
    { from: /data:\s*{\s*tenantId:/g, to: 'data: { tenant_id:' },
    { from: /data:\s*{\s*userId:/g, to: 'data: { user_id:' },
  ];
  
  objectLiteralFixes.forEach(fix => {
    if (fix.from.test(content)) {
      content = content.replace(fix.from, fix.to);
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
console.log('\nRemaining errors will likely need manual fixes for:');
console.log('- Duplicate object properties');
console.log('- Missing variable declarations');
console.log('- Complex type mismatches');
console.log('\nRun: pnpm build to check remaining errors');
