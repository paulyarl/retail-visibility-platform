#!/usr/bin/env node

/**
 * Comprehensive fix for all remaining camel vs snake case patterns
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Comprehensive fix for all remaining patterns...');

const srcDir = path.join(__dirname, 'apps/api/src');
const tsFiles = glob.sync('**/*.ts', { cwd: srcDir });

// Common field mappings based on the error patterns
const fieldMappings = [
  // JWT payload properties (should be snake_case)
  { from: /\.userId\b/g, to: '.user_id' },
  { from: /payload\.userId/g, to: 'payload.user_id' },
  { from: /req\.user\.userId/g, to: 'req.user.user_id' },
  
  // Object literal properties (database fields are snake_case)
  { from: /(\s+)createdBy(\s*:)/g, to: '$1created_by$2' },
  { from: /(\s+)tenantId(\s*:)/g, to: '$1tenant_id$2' },
  { from: /(\s+)userId(\s*:)/g, to: '$1user_id$2' },
  { from: /(\s+)updatedAt(\s*:)/g, to: '$1updated_at$2' },
  { from: /(\s+)createdAt(\s*:)/g, to: '$1created_at$2' },
  { from: /(\s+)displayName(\s*:)/g, to: '$1display_name$2' },
  { from: /(\s+)profilePictureUrl(\s*:)/g, to: '$1profile_picture_url$2' },
  { from: /(\s+)businessName(\s*:)/g, to: '$1business_name$2' },
  { from: /(\s+)itemStatus(\s*:)/g, to: '$1item_status$2' },
  { from: /(\s+)categoryPath(\s*:)/g, to: '$1category_path$2' },
  { from: /(\s+)missingImages(\s*:)/g, to: '$1missing_images$2' },
  { from: /(\s+)missingDescription(\s*:)/g, to: '$1missing_description$2' },
  { from: /(\s+)missingBrand(\s*:)/g, to: '$1missing_brand$2' },
  { from: /(\s+)missingSpecs(\s*:)/g, to: '$1missing_specs$2' },
  { from: /(\s+)priceCents(\s*:)/g, to: '$1price_cents$2' },
  { from: /(\s+)trialEndsAt(\s*:)/g, to: '$1trial_ends_at$2' },
  { from: /(\s+)subscriptionEndsAt(\s*:)/g, to: '$1subscription_ends_at$2' },
  { from: /(\s+)stripeCustomerId(\s*:)/g, to: '$1stripe_customer_id$2' },
  { from: /(\s+)stripeSubscriptionId(\s*:)/g, to: '$1stripe_subscription_id$2' },
  
  // Property access (Prisma generates camelCase for these)
  { from: /\.created_by\b/g, to: '.createdBy' },
  { from: /\.updated_at\b/g, to: '.updatedAt' },
  { from: /\.trial_ends_at\b/g, to: '.trialEndsAt' },
  { from: /\.subscription_ends_at\b/g, to: '.subscriptionEndsAt' },
  { from: /\.stripe_customer_id\b/g, to: '.stripeCustomerId' },
  { from: /\.stripe_subscription_id\b/g, to: '.stripeSubscriptionId' },
  { from: /\.business_name\b/g, to: '.businessName' },
  { from: /\.display_name\b/g, to: '.displayName' },
  { from: /\.profile_picture_url\b/g, to: '.profilePictureUrl' },
  { from: /\.item_status\b/g, to: '.itemStatus' },
  { from: /\.category_path\b/g, to: '.categoryPath' },
  { from: /\.missing_images\b/g, to: '.missingImages' },
  { from: /\.missing_description\b/g, to: '.missingDescription' },
  { from: /\.missing_brand\b/g, to: '.missingBrand' },
  { from: /\.missing_specs\b/g, to: '.missingSpecs' },
  { from: /\.price_cents\b/g, to: '.priceCents' },
  
  // Prisma model references
  { from: /prisma\.inventoryItem/g, to: 'prisma.inventory_item' },
  { from: /prisma\.photoAsset/g, to: 'prisma.photo_asset' },
  { from: /prisma\.businessHours/g, to: 'prisma.business_hours' },
  { from: /prisma\.businessHoursSpecial/g, to: 'prisma.business_hours_special' },
  { from: /prisma\.userTenant/g, to: 'prisma.user_tenants' },
  { from: /prisma\.locationStatusLog/g, to: 'prisma.location_status_log' },
  
  // Unique constraint names
  { from: /userId_tenantId:/g, to: 'user_id_tenant_id:' },
  { from: /tenantId_googleAccountId:/g, to: 'tenant_id_google_account_id:' },
];

let totalChanges = 0;

tsFiles.forEach(fileName => {
  const filePath = path.join(srcDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Apply all field mappings
  fieldMappings.forEach(mapping => {
    if (mapping.from.test(content)) {
      content = content.replace(mapping.from, mapping.to);
      changed = true;
    }
  });
  
  // Fix specific file patterns
  
  // Fix missing tenantId parameters in service files
  if (fileName.includes('Service.ts') || fileName.includes('clients/')) {
    // Add tenantId parameter to functions that use it but don't have it
    const lines = content.split('\n');
    const fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // If this is a function declaration and uses tenantId but doesn't have it as parameter
      if (line.includes('function') && line.includes('(') && !line.includes('tenantId:')) {
        // Look ahead to see if tenantId is used in the function
        let usesTenantId = false;
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          if (lines[j].includes('tenantId') && !lines[j].includes('//')) {
            usesTenantId = true;
            break;
          }
          if (lines[j].includes('}') && lines[j].trim() === '}') break;
        }
        
        if (usesTenantId) {
          // Add tenantId parameter
          line = line.replace(/\(([^)]*)\)/, (match, params) => {
            if (params.trim()) {
              return `(${params}, tenantId: string)`;
            } else {
              return '(tenantId: string)';
            }
          });
          changed = true;
        }
      }
      
      fixedLines.push(line);
    }
    
    if (changed) {
      content = fixedLines.join('\n');
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    totalChanges++;
    console.log(`✅ Fixed: ${fileName}`);
  }
});

console.log(`\n🎉 Fixed ${totalChanges} files!`);
console.log('\nRun: pnpm build to test the comprehensive fixes');
