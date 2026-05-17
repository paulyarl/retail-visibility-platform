import fs from 'fs';
import path from 'path';

/**
 * Script to update service files to use new GBP category columns instead of metadata
 * This script searches for patterns and suggests replacements
 */

interface FileUpdate {
  filePath: string;
  replacements: Array<{
    pattern: RegExp;
    replacement: string;
    description: string;
  }>;
}

const filesToUpdate: FileUpdate[] = [
  {
    filePath: 'src/services/GBPBusinessInfoSync.ts',
    replacements: [
      {
        pattern: /tenant\.metadata\?.gbp_categories\?.primary/g,
        replacement: 'tenant.gbp_primary_category_id',
        description: 'Replace metadata primary category access with direct column'
      },
      {
        pattern: /tenant\.metadata\?.gbp_categories\?.secondary/g,
        replacement: 'tenant.gbp_secondary_categories',
        description: 'Replace metadata secondary categories access with direct column'
      },
      {
        pattern: /metadata\?.gbp_categories\?.sync_status/g,
        replacement: 'gbp_categories_sync_status',
        description: 'Replace metadata sync status with direct column'
      },
      {
        pattern: /metadata\?.gbp_categories\?.last_synced_at/g,
        replacement: 'gbp_categories_last_synced_at',
        description: 'Replace metadata last synced with direct column'
      }
    ]
  },
  {
    filePath: 'src/services/GBPSyncTrackingService.ts',
    replacements: [
      {
        pattern: /metadata\?.gbp_categories/g,
        replacement: 'gbp_primary_category_id, gbp_primary_category_name, gbp_secondary_categories',
        description: 'Update sync tracking to use direct columns'
      }
    ]
  },
  {
    filePath: 'src/routes/google-business-oauth.ts',
    replacements: [
      {
        pattern: /tenantMetadata\?.gbp_categories\?.secondary/g,
        replacement: 'tenant.gbp_secondary_categories',
        description: 'Replace metadata secondary categories in OAuth route'
      }
    ]
  },
  {
    filePath: 'src/services/TenantService.ts',
    replacements: [
      {
        pattern: /metadata\?.gbp_categories/g,
        replacement: 'gbp_primary_category_id, gbp_primary_category_name, gbp_secondary_categories',
        description: 'Update tenant service to use direct columns'
      }
    ]
  }
];

function updateFile(filePath: string, replacements: Array<{pattern: RegExp, replacement: string, description: string}>) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let hasChanges = false;

  replacements.forEach(({ pattern, replacement, description }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      hasChanges = true;
      console.log(`  ✅ Updated: ${description}`);
    }
  });

  if (hasChanges) {
    fs.writeFileSync(fullPath, content);
    console.log(`📝 Updated: ${filePath}`);
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
  }
}

function main() {
  console.log('=== Updating Services to Use GBP Category Columns ===\n');

  filesToUpdate.forEach(file => {
    console.log(`\nProcessing: ${file.filePath}`);
    updateFile(file.filePath, file.replacements);
  });

  console.log('\n=== Update Complete ===');
  console.log('\nNext steps:');
  console.log('1. Run the SQL migration: psql -d your_db -f database/migrations/elevate_gbp_categories.sql');
  console.log('2. Run: npx prisma generate');
  console.log('3. Run verification script: npx ts-node src/scripts/verify-gbp-categories-migration.ts');
  console.log('4. Test the updated services');
  console.log('5. Consider cleaning up metadata after verification');
}

if (require.main === module) {
  main();
}

export { filesToUpdate };
