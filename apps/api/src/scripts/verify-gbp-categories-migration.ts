import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

/**
 * Script to verify GBP categories migration from metadata to dedicated columns
 */
async function verifyMigration() {
  console.log('=== Verifying GBP Categories Migration ===\n');

  // 1. Check total tenants with GBP data
  const totalTenants = await prisma.tenants.count();
  const tenantsWithMetadata = await prisma.tenants.count({
    where: {
      metadata: {
        not: Prisma.JsonNull
      }
    }
  });
  
  const tenantsWithGbpInMetadata = await prisma.tenants.count({
    where: {
      metadata: {
        path: ['gbp_categories'],
        not: Prisma.JsonNull
      }
    }
  });

  console.log(`Total tenants: ${totalTenants}`);
  console.log(`Tenants with metadata: ${tenantsWithMetadata}`);
  console.log(`Tenants with GBP in metadata: ${tenantsWithGbpInMetadata}\n`);

  // 2. Check migrated data
  const tenantsWithPrimaryCategory = await prisma.tenants.count({
    where: {
      gbp_primary_category_id: {
        not: null
      }
    }
  });

  const tenantsWithSecondaryCategories = await prisma.tenants.count({
    where: {
      gbp_secondary_categories: {
        not: Prisma.JsonNull
      }
    }
  });

  const tenantsWithSyncStatus = await prisma.tenants.count({
    where: {
      gbp_categories_sync_status: {
        not: null
      }
    }
  });

  console.log(`Tenants with primary category (new column): ${tenantsWithPrimaryCategory}`);
  console.log(`Tenants with secondary categories (new column): ${tenantsWithSecondaryCategories}`);
  console.log(`Tenants with sync status (new column): ${tenantsWithSyncStatus}\n`);

  // 3. Show sample data comparison
  const sampleTenants = await prisma.tenants.findMany({
    where: {
      gbp_primary_category_id: {
        not: null
      }
    },
    select: {
      id: true,
      name: true,
      metadata: true,
      gbp_primary_category_id: true,
      gbp_primary_category_name: true,
      gbp_secondary_categories: true,
      gbp_categories_sync_status: true,
      gbp_categories_last_synced_at: true
    },
    take: 3
  });

  console.log('Sample data comparison:');
  sampleTenants.forEach(tenant => {
    const metadata = tenant.metadata as any;
    console.log(`\nTenant: ${tenant.name} (${tenant.id})`);
    console.log(`  Metadata GBP categories:`, JSON.stringify(metadata?.gbp_categories, null, 2));
    console.log(`  New columns:`);
    console.log(`    Primary ID: ${tenant.gbp_primary_category_id}`);
    console.log(`    Primary Name: ${tenant.gbp_primary_category_name}`);
    console.log(`    Secondary: ${JSON.stringify(tenant.gbp_secondary_categories)}`);
    console.log(`    Sync Status: ${tenant.gbp_categories_sync_status}`);
    console.log(`    Last Synced: ${tenant.gbp_categories_last_synced_at}`);
  });

  // 4. Check for data integrity issues
  console.log('\n=== Data Integrity Check ===');
  
  // Use raw SQL for complex JSON path queries that Prisma doesn't support well
  const integrityIssues = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    issue: string | null;
  }>>`
    SELECT 
      id,
      name,
      CASE 
        WHEN (metadata->'gbp_categories'->'primary'->>'id') IS NOT NULL 
        AND gbp_primary_category_id IS NULL 
        THEN 'Missing primary category migration'
        WHEN (metadata->'gbp_categories'->'secondary') IS NOT NULL 
        AND gbp_secondary_categories = '[]'::jsonb 
        THEN 'Missing secondary categories migration'
        WHEN (metadata->'gbp_categories'->>'sync_status') IS NOT NULL 
        AND gbp_categories_sync_status IS NULL 
        THEN 'Missing sync status migration'
        ELSE NULL
      END as issue
    FROM tenants 
    WHERE metadata IS NOT NULL 
      AND (
        (metadata->'gbp_categories'->'primary'->>'id') IS NOT NULL 
        AND gbp_primary_category_id IS NULL
      ) OR (
        (metadata->'gbp_categories'->'secondary') IS NOT NULL 
        AND gbp_secondary_categories = '[]'::jsonb
      ) OR (
        (metadata->'gbp_categories'->>'sync_status') IS NOT NULL 
        AND gbp_categories_sync_status IS NULL
      )
  `;

  if (Array.isArray(integrityIssues) && integrityIssues.length > 0) {
    console.log(`Found ${integrityIssues.length} tenants with migration issues:`);
    integrityIssues.forEach((issue: any) => {
      console.log(`  - ${issue.name} (${issue.id}): ${issue.issue}`);
    });
  } else {
    console.log('✅ No integrity issues found');
  }

  console.log('\n=== Migration Verification Complete ===');
}

// Run the verification
verifyMigration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
