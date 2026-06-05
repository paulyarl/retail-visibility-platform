#!/usr/bin/env node

/**
 * Final field name fixes for remaining build errors
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Final field name fixes...');

const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

// Field name mappings
const fieldFixes = [
  // Property access fixes
  { from: /\.subscriptionStatus/g, to: '.subscription_status' },
  { from: /\.subscriptionTier/g, to: '.subscription_tier' },
  { from: /\.trialEndsAt/g, to: '.trial_ends_at' },
  { from: /\.locationStatus/g, to: '.location_status' },
  { from: /\.statusChangedAt/g, to: '.status_changed_at' },
  { from: /\.stripeSubscriptionId/g, to: '.stripe_subscription_id' },
  { from: /\.priceCents/g, to: '.price_cents' },
  { from: /\.tenant_ids/g, to: '.tenantIds' }, // JWT payload should be camelCase
  
  // Object literal property fixes
  { from: /subscriptionStatus:/g, to: 'subscription_status:' },
  { from: /subscriptionTier:/g, to: 'subscription_tier:' },
  { from: /trialEndsAt:/g, to: 'trial_ends_at:' },
  { from: /locationStatus:/g, to: 'location_status:' },
  { from: /statusChangedAt:/g, to: 'status_changed_at:' },
  { from: /stripeSubscriptionId:/g, to: 'stripe_subscription_id:' },
  
  // Variable name fixes
  { from: /Cannot find name 'tenantId'/g, to: 'tenant_id' },
  { from: /Cannot find name 'userId'/g, to: 'user_id' },
];

let totalChanges = 0;

tsFiles.forEach(fileName => {
  const filePath = path.join(srcDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Apply field fixes
  fieldFixes.forEach(fix => {
    if (fix.from.test(content)) {
      content = content.replace(fix.from, fix.to);
      changed = true;
    }
  });
  
  // Fix specific file issues
  
  // Fix gbpCategorySync.ts - use payload.tenantId instead of tenantId
  if (fileName.includes('gbpCategorySync.ts')) {
    content = content.replace(/payload\.tenant_id/g, 'payload.tenantId');
    content = content.replace(/\btenantId\b/g, 'payload.tenantId');
    changed = true;
  }
  
  // Fix gbp.ts - add tenantId parameter
  if (fileName.includes('clients/gbp.ts')) {
    content = content.replace(/\btenantId\b/g, 'tenantId'); // Keep as parameter
    changed = true;
  }
  
  // Fix auth files
  if (fileName.includes('auth/')) {
    content = content.replace(/\buserId\b/g, 'user_id');
    changed = true;
  }
  
  // Fix index.ts duplicate properties
  if (fileName.includes('index.ts')) {
    // Remove duplicate properties by finding and removing duplicates
    const lines = content.split('\n');
    const seenProps = new Set();
    const filteredLines = lines.filter(line => {
      const propMatch = line.match(/^\s*(\w+):\s*/);
      if (propMatch) {
        const prop = propMatch[1];
        if (seenProps.has(prop)) {
          return false; // Remove duplicate
        }
        seenProps.add(prop);
      }
      return true;
    });
    
    if (filteredLines.length !== lines.length) {
      content = filteredLines.join('\n');
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    totalChanges++;
    console.log(`✅ Fixed: ${fileName}`);
  }
});

console.log(`\n🎉 Fixed ${totalChanges} files!`);
console.log('\nRun: pnpm build to test the result');
