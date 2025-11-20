#!/usr/bin/env node

/**
 * Careful field name fixes for specific patterns
 * 
 * Fixes:
 * 1. Field access patterns: .subscriptionTier → .subscription_tier
 * 2. Object properties: subscriptionStatus: → subscription_status:
 * 3. Variable declarations: Missing tenantId parameters
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing field access patterns and object properties...');

const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

// Specific field mappings - only the ones causing errors
const fieldAccessFixes = [
  // Property access (dot notation)
  { from: /\.subscriptionTier\b/g, to: '.subscription_tier' },
  { from: /\.subscriptionStatus\b/g, to: '.subscription_status' },
  { from: /\.trialEndsAt\b/g, to: '.trial_ends_at' },
  { from: /\.subscriptionEndsAt\b/g, to: '.subscription_ends_at' },
  { from: /\.stripeCustomerId\b/g, to: '.stripe_customer_id' },
  { from: /\.stripeSubscriptionId\b/g, to: '.stripe_subscription_id' },
  { from: /\.locationStatus\b/g, to: '.location_status' },
  { from: /\.statusChangedAt\b/g, to: '.status_changed_at' },
  { from: /\.priceCents\b/g, to: '.price_cents' },
];

const objectPropertyFixes = [
  // Object literal properties (colon notation)
  { from: /(\s+)subscriptionTier(\s*:)/g, to: '$1subscription_tier$2' },
  { from: /(\s+)subscriptionStatus(\s*:)/g, to: '$1subscription_status$2' },
  { from: /(\s+)trialEndsAt(\s*:)/g, to: '$1trial_ends_at$2' },
  { from: /(\s+)subscriptionEndsAt(\s*:)/g, to: '$1subscription_ends_at$2' },
  { from: /(\s+)stripeCustomerId(\s*:)/g, to: '$1stripe_customer_id$2' },
  { from: /(\s+)stripeSubscriptionId(\s*:)/g, to: '$1stripe_subscription_id$2' },
  { from: /(\s+)locationStatus(\s*:)/g, to: '$1location_status$2' },
  { from: /(\s+)statusChangedAt(\s*:)/g, to: '$1status_changed_at$2' },
];

let totalChanges = 0;

tsFiles.forEach(fileName => {
  const filePath = path.join(srcDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Apply field access fixes
  fieldAccessFixes.forEach(fix => {
    if (fix.from.test(content)) {
      content = content.replace(fix.from, fix.to);
      changed = true;
    }
  });
  
  // Apply object property fixes
  objectPropertyFixes.forEach(fix => {
    if (fix.from.test(content)) {
      content = content.replace(fix.from, fix.to);
      changed = true;
    }
  });
  
  // Fix specific file issues
  
  // Fix JWT payload properties (these should stay camelCase)
  if (content.includes('JWTPayload')) {
    // JWT properties should be camelCase, not snake_case
    content = content.replace(/\.tenant_ids\b/g, '.tenantIds');
    content = content.replace(/\.user_id\b/g, '.userId');
    changed = true;
  }
  
  // Fix gbpCategorySync.ts - add missing tenantId parameter
  if (fileName.includes('gbpCategorySync.ts')) {
    // Fix function calls that reference tenantId but don't have it in scope
    content = content.replace(/\btenantId\b/g, 'payload.tenantId');
    changed = true;
  }
  
  // Fix gbp.ts - ensure tenantId parameter is available
  if (fileName.includes('clients/gbp.ts')) {
    // These functions should have tenantId as a parameter
    const functionRegex = /(export\s+(?:async\s+)?function\s+\w+\s*\([^)]*)\)/g;
    content = content.replace(functionRegex, (match, params) => {
      if (!params.includes('tenantId') && match.includes('tenantId')) {
        return params + ', tenantId: string)';
      }
      return match;
    });
    changed = true;
  }
  
  // Fix auth files - variable declarations
  if (fileName.includes('auth/')) {
    // Fix missing userId declarations
    content = content.replace(/\buserId\b(?!\s*[:=])/g, 'user.userId');
    changed = true;
  }
  
  // Fix context.ts - property access
  if (fileName.includes('context.ts')) {
    content = content.replace(/\.tenant_id\b/g, '.tenantId'); // RequestCtx should be camelCase
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    totalChanges++;
    console.log(`✅ Fixed: ${fileName}`);
  }
});

console.log(`\n🎉 Fixed ${totalChanges} files!`);
console.log('\nNext: Run pnpm build to test the fixes');
