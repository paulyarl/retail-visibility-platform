#!/usr/bin/env node

/**
 * Fix specific field naming issues based on actual TypeScript errors
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing specific field naming issues...');

const srcDir = path.join(__dirname, 'apps/api/src');

// Fix auth/auth.service.ts
const authServicePath = path.join(srcDir, 'auth/auth.service.ts');
if (fs.existsSync(authServicePath)) {
  let content = fs.readFileSync(authServicePath, 'utf8');
  
  // Fix JWT payload access - should be camelCase
  content = content.replace(/payload\.user_id/g, 'payload.userId');
  
  // Fix missing userId declarations - these should reference the JWT payload
  content = content.replace(/\buserId\b(?!\s*[=:])/g, 'payload.userId');
  
  fs.writeFileSync(authServicePath, content);
  console.log('✅ Fixed: auth/auth.service.ts');
}

// Fix clients/gbp.ts - add tenantId parameter to functions
const gbpPath = path.join(srcDir, 'clients/gbp.ts');
if (fs.existsSync(gbpPath)) {
  let content = fs.readFileSync(gbpPath, 'utf8');
  
  // Find functions that use tenantId but don't have it as parameter
  const lines = content.split('\n');
  const fixedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // If this is a function declaration and the function uses tenantId
    if (line.includes('export') && line.includes('function') && !line.includes('tenantId:')) {
      // Look ahead to see if tenantId is used in the function
      let usestenantId = false;
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j].includes('tenantId') && !lines[j].includes('//')) {
          usestenantId = true;
          break;
        }
        if (lines[j].includes('}') && lines[j].trim() === '}') break;
      }
      
      if (usestenantId) {
        // Add tenantId parameter
        line = line.replace(/\(([^)]*)\)/, (match, params) => {
          if (params.trim()) {
            return `(${params}, tenantId: string)`;
          } else {
            return '(tenantId: string)';
          }
        });
      }
    }
    
    fixedLines.push(line);
  }
  
  content = fixedLines.join('\n');
  fs.writeFileSync(gbpPath, content);
  console.log('✅ Fixed: clients/gbp.ts');
}

// Fix index.ts - field naming issues
const indexPath = path.join(srcDir, 'index.ts');
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // The issue is that Prisma generates camelCase field names, but we're trying to access snake_case
  // Fix property access to use the correct Prisma field names
  content = content.replace(/\.subscription_status\b/g, '.subscriptionStatus');
  content = content.replace(/\.trial_ends_at\b/g, '.trialEndsAt');
  content = content.replace(/\.subscription_ends_at\b/g, '.subscriptionEndsAt');
  content = content.replace(/\.stripe_customer_id\b/g, '.stripeCustomerId');
  content = content.replace(/\.stripe_subscription_id\b/g, '.stripeSubscriptionId');
  
  // Fix object literal properties to use the correct Prisma field names
  content = content.replace(/(\s+)trial_ends_at(\s*:)/g, '$1trialEndsAt$2');
  content = content.replace(/(\s+)subscription_status(\s*:)/g, '$1subscriptionStatus$2');
  content = content.replace(/(\s+)subscription_ends_at(\s*:)/g, '$1subscriptionEndsAt$2');
  content = content.replace(/(\s+)stripe_customer_id(\s*:)/g, '$1stripeCustomerId$2');
  content = content.replace(/(\s+)stripe_subscription_id(\s*:)/g, '$1stripeSubscriptionId$2');
  
  fs.writeFileSync(indexPath, content);
  console.log('✅ Fixed: index.ts');
}

console.log('\n🎉 Fixed specific field naming issues!');
console.log('Run: cd apps/api && npx tsc --noEmit src/index.ts to test');
